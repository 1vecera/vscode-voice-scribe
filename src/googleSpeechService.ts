import { v2, protos } from '@google-cloud/speech';
import * as vscode from 'vscode';
import { TranscriptionProvider } from './transcriptionProvider';

// ── Logging ─────────────────────────────────────────────────────────────────
// Separate from the ElevenLabs channel; only one provider is active per session
// so only one "Voice Scribe" output channel is created in practice.
let outputChannel: vscode.OutputChannel | null = null;
function log(msg: string) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Voice Scribe');
    }
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
    console.log(`[VoiceScribe/Google] ${msg}`);
}

type SpeechStream = ReturnType<v2.SpeechClient['_streamingRecognize']>;
type StreamingConfig = protos.google.cloud.speech.v2.IStreamingRecognitionConfig;
type StreamingResponse = protos.google.cloud.speech.v2.IStreamingRecognizeResponse;

export interface GoogleSpeechOptions {
    /** GCP project ID. Empty/undefined → auto-detect from Application Default Credentials. */
    project?: string;
    /** Region whose endpoint + recognizer path are used, e.g. 'eu', 'us', 'europe-west4'. */
    location: string;
    /** Speech-to-Text V2 model, e.g. 'long' (low latency) or 'chirp_3' (multilingual). */
    model: string;
}

// Reopen the gRPC stream this many times after unexpected closes before giving
// up. Covers the V2 streaming max-duration cap (~5 min): a healthy stream that
// hits the cap emits 'data' first, which resets the counter, so it restarts
// indefinitely during real use; a genuinely broken config fails fast.
const MAX_RESTARTS = 5;

/**
 * Cached auto-detected ADC project id, shared across service instances.
 *
 * `getProjectId()` consults gcloud config / the metadata server and measured
 * 380-510 ms. It was previously paid on every recording start, because
 * `initializeServices()` builds a fresh service whenever settings change. The
 * ADC project doesn't change under a running window, so resolve it once.
 */
let cachedProjectId: string | null = null;

/**
 * Whether a model accepts `languageCodes: ['auto']`.
 *
 * Only the Chirp family does multilingual auto-detection. The conformer models
 * (`long`, `short`, `telephony_*`) reject `auto` with INVALID_ARGUMENT, so an
 * incompatible pair has to be resolved before the config message goes out —
 * otherwise recording fails with a raw gRPC error.
 */
function supportsAutoLanguage(model: string): boolean {
    return model.startsWith('chirp');
}

/** Language used when the chosen model can't auto-detect but the user asked it to. */
const AUTO_FALLBACK_LANGUAGE = 'en-US';

/**
 * Selectable Speech-to-Text V2 models, in the order the picker shows them.
 *
 * Latency figures are measured end-to-end against the `eu` region, not quoted
 * from docs — see CHANGELOG 0.6.0. They are the whole reason this picker exists:
 * the Chirp family only emits a result once per ~5 seconds of audio, while the
 * conformer models update every ~60 ms, and no amount of local tuning closes
 * that gap.
 */
export interface GoogleModelChoice {
    id: string;
    label: string;
    /** Short latency/accuracy trade-off shown in the quick-pick. */
    detail: string;
    /** Regions this model is NOT served from, to keep the picker honest. */
    unavailableIn?: string[];
}

export const GOOGLE_MODELS: GoogleModelChoice[] = [
    {
        id: 'long',
        label: '$(zap) Long — near-instant (recommended)',
        detail: 'first text ~0.8s · updates every ~60ms · needs an explicit language',
    },
    {
        id: 'short',
        label: '$(zap) Short — near-instant, brief utterances',
        detail: 'same speed as Long, tuned for short phrases · needs an explicit language',
    },
    {
        id: 'chirp_3',
        label: '$(globe) Chirp 3 — best accuracy, slow',
        detail: 'best non-English accuracy + language auto-detect · text lags ~5s behind speech',
        unavailableIn: ['europe-west4', 'us-central1'],
    },
    {
        id: 'chirp_2',
        label: '$(globe) Chirp 2 — previous multilingual generation',
        detail: 'also ~5s behind speech · not served from the "eu" region',
        unavailableIn: ['eu'],
    },
];

/**
 * Google Cloud Speech-to-Text V2 streaming provider.
 *
 * Auth is via Application Default Credentials (`gcloud auth application-default
 * login`) — no API key. Models are served from regional endpoints, so the client
 * points at `<location>-speech.googleapis.com` and the recognizer path uses the
 * same location.
 *
 * Latency design: the client and its gRPC channel are built once and kept warm
 * across start/stop cycles — only the bidirectional stream is per-recording.
 * Closing the client on every stop (as the previous version did) discarded the
 * TLS + HTTP/2 handshake and made the next start pay for it again.
 */
export class GoogleSpeechService implements TranscriptionProvider {
    private readonly project?: string;
    private readonly location: string;
    private readonly model: string;

    private client: v2.SpeechClient | null = null;
    private stream: SpeechStream | null = null;
    private recognizer = '';
    private languageCodes: string[] = ['auto'];

    private isTranscribing = false;
    private userStopped = false;
    private restartCount = 0;
    private fullTranscript = '';

    // Audio captured before the stream is ready. Recording now starts in
    // parallel with stream setup, so the first frames can arrive first;
    // discarding them would clip the opening word.
    private pendingAudio: Buffer[] = [];
    private streamEverOpened = false;

    private onPartial: ((text: string) => void) | null = null;
    private onFinal: ((text: string) => void) | null = null;

    constructor(options: GoogleSpeechOptions) {
        this.project = options.project;
        this.location = options.location;
        this.model = options.model;
    }

    /**
     * Build the client, resolve the project id and open the gRPC channel ahead
     * of the first recording, so the keypress doesn't pay for auth or TLS.
     *
     * Called at activation and after a settings change. Failures are logged and
     * swallowed on purpose: a machine without ADC yet must still activate
     * cleanly, and the real error surfaces with actionable text on the first
     * recording attempt.
     */
    async prewarm(): Promise<void> {
        try {
            const client = this.ensureClient();
            await this.resolveProjectId(client);
            await client.initialize();
            log(`Pre-warmed ${this.model} @ ${this.location}: client, project id and gRPC channel ready.`);
        } catch (err) {
            log(`Pre-warm skipped: ${(err as Error).message}`);
        }
    }

    /** The one long-lived client; its channel is what we keep warm. */
    private ensureClient(): v2.SpeechClient {
        if (!this.client) {
            this.client = new v2.SpeechClient({ apiEndpoint: `${this.location}-speech.googleapis.com` });
        }
        return this.client;
    }

    /**
     * Pinned project wins; otherwise auto-detect from gcloud config / env / ADC
     * once and reuse. Auto-detect fails when none of those is set, so turn the
     * gax "Unable to detect a Project Id" error into actionable guidance.
     */
    private async resolveProjectId(client: v2.SpeechClient): Promise<string> {
        if (this.project) { return this.project; }
        if (cachedProjectId) { return cachedProjectId; }
        try {
            cachedProjectId = await client.getProjectId();
        } catch {
            /* handled below */
        }
        if (!cachedProjectId) {
            throw new Error(
                'No Google Cloud project found. Set "voiceScribe.googleProject" in settings, ' +
                'or run `gcloud config set project <PROJECT_ID>`, or export GOOGLE_CLOUD_PROJECT.',
            );
        }
        return cachedProjectId;
    }

    async startTranscription(
        onPartial: (text: string) => void,
        onFinal: (text: string) => void,
        _additionalVocabulary?: Array<{ word: string; boost: number }>,
    ): Promise<void> {
        if (this.isTranscribing) {
            throw new Error('Already transcribing');
        }
        this.fullTranscript = '';
        this.userStopped = false;
        this.restartCount = 0;
        this.pendingAudio = [];
        this.streamEverOpened = false;
        this.onPartial = onPartial;
        this.onFinal = onFinal;

        const config = vscode.workspace.getConfiguration('voiceScribe');
        const language = config.get<string>('language') || 'auto';
        this.languageCodes = this.resolveLanguageCodes(language);

        log(`Provider: Google ${this.model} @ ${this.location} | languages: ${this.languageCodes.join(',')}`);

        const client = this.ensureClient();
        // Accepting audio before the stream exists lets frames captured during
        // setup queue up instead of being dropped on the floor.
        this.isTranscribing = true;
        try {
            const projectId = await this.resolveProjectId(client);
            this.recognizer = `projects/${projectId}/locations/${this.location}/recognizers/_`;
        } catch (err) {
            this.isTranscribing = false;
            throw err;
        }

        this.openStream();
    }

    /**
     * Map the stored language setting onto codes this model actually accepts,
     * warning rather than failing when the pair is incompatible.
     */
    private resolveLanguageCodes(language: string): string[] {
        const codes = toLanguageCodes(language);
        if (codes[0] !== 'auto' || supportsAutoLanguage(this.model)) {
            return codes;
        }
        log(`Model "${this.model}" cannot auto-detect language — falling back to ${AUTO_FALLBACK_LANGUAGE}.`);
        vscode.window.showWarningMessage(
            `Voice Scribe: the "${this.model}" model can't auto-detect language, so ${AUTO_FALLBACK_LANGUAGE} ` +
            'is being used. Pick your language with "Voice Scribe: Select Language", or set ' +
            '"voiceScribe.googleModel" to chirp_3 for auto-detection.',
        );
        return [AUTO_FALLBACK_LANGUAGE];
    }

    /** (Re)open the bidirectional stream and send the config message first. */
    private openStream(): void {
        const client = this.client;
        if (!client) { return; }

        const stream = client._streamingRecognize();

        // Identity guards: a stream we've already replaced (during a restart)
        // must not mutate state or trigger another restart.
        stream.on('data', (resp: StreamingResponse) => {
            if (stream !== this.stream) { return; }
            this.restartCount = 0;
            this.handleResponse(resp);
        });
        stream.on('error', (err: Error) => {
            if (stream !== this.stream) { return; }
            this.onStreamClosed(err);
        });
        stream.on('end', () => {
            if (stream !== this.stream) { return; }
            this.onStreamClosed(null);
        });

        stream.write({ recognizer: this.recognizer, streamingConfig: this.buildStreamingConfig() });
        this.stream = stream;

        // Only the session's first stream drains the queue. On a mid-session
        // restart (the ~5-min cap) anything buffered would already be stale.
        if (!this.streamEverOpened) {
            this.streamEverOpened = true;
            const queued = this.pendingAudio;
            this.pendingAudio = [];
            for (const chunk of queued) {
                try { stream.write({ audio: chunk }); } catch { break; }
            }
            if (queued.length) { log(`Flushed ${queued.length} audio chunk(s) captured during stream setup.`); }
        }
    }

    private buildStreamingConfig(): StreamingConfig {
        return {
            config: {
                explicitDecodingConfig: {
                    encoding: 'LINEAR16',   // raw s16le PCM from ffmpeg
                    sampleRateHertz: 16000,
                    audioChannelCount: 1,
                },
                model: this.model,
                languageCodes: this.languageCodes,
                features: { enableAutomaticPunctuation: true },
            },
            streamingFeatures: { interimResults: true },
        };
    }

    private handleResponse(resp: StreamingResponse): void {
        for (const result of resp.results ?? []) {
            const text = result.alternatives?.[0]?.transcript ?? '';
            if (!text) { continue; }
            // Privacy: log type + length only, never transcript content.
            if (result.isFinal) {
                log(`← final (${text.length} chars)`);
                this.fullTranscript += (this.fullTranscript ? ' ' : '') + text;
                this.onFinal?.(text);
            } else {
                log(`← partial (${text.length} chars)`);
                this.onPartial?.(text);
            }
        }
    }

    /** Handle an unexpected stream close while still recording (e.g. the 5-min cap). */
    private onStreamClosed(err: Error | null): void {
        if (this.userStopped || !this.isTranscribing) { return; }
        if (err) { log(`stream error: ${err.message}`); }

        if (this.restartCount >= MAX_RESTARTS) {
            this.isTranscribing = false;
            const detail = err?.message ?? 'stream closed unexpectedly';
            vscode.window.showErrorMessage(`Voice Scribe (Google): ${detail}`);
            return;
        }
        this.restartCount++;
        log(`reopening stream (#${this.restartCount})`);
        this.openStream();
    }

    async stopTranscription(): Promise<string> {
        if (!this.isTranscribing) {
            return this.fullTranscript;
        }
        this.userStopped = true;
        log('Stopping — half-closing stream, waiting for final result...');

        return new Promise((resolve) => {
            const stream = this.stream;
            let settled = false;
            const finish = () => {
                if (settled) { return; }
                settled = true;
                this.endSession();
                log(`Full transcript: ${this.fullTranscript.length} chars`);
                resolve(this.fullTranscript);
            };

            if (!stream) { finish(); return; }

            // half-close: signals no more audio; Google flushes the last final
            // result via 'data' then ends the stream.
            stream.on('end', finish);
            stream.on('error', finish);
            try { stream.end(); } catch { /* already closing */ }
            setTimeout(finish, 2500);   // cap the drain like the ElevenLabs path
        });
    }

    sendAudioChunk(audioData: Buffer): void {
        if (!this.isTranscribing || this.userStopped) { return; }

        const stream = this.stream;
        if (!stream) {
            // Stream still being set up — hold the audio rather than lose it.
            this.pendingAudio.push(audioData);
            return;
        }
        if (stream.writableEnded || stream.destroyed) { return; }
        try {
            stream.write({ audio: audioData });
        } catch {
            // stream is being swapped during a restart — drop this chunk
        }
    }

    getFullTranscript(): string {
        return this.fullTranscript;
    }

    /**
     * Tear down the per-recording stream but keep the client and its warm gRPC
     * channel, so the next start skips auth and the handshake.
     */
    private endSession(): void {
        if (this.stream) {
            try {
                this.stream.removeAllListeners();
                this.stream.destroy();
            } catch { /* ignore */ }
            this.stream = null;
        }
        this.pendingAudio = [];
        this.isTranscribing = false;
    }

    dispose(): void {
        this.userStopped = true;
        this.endSession();
        if (this.client) {
            try { this.client.close(); } catch { /* ignore */ }
            this.client = null;
        }
        this.fullTranscript = '';
        if (outputChannel) {
            outputChannel.dispose();
            outputChannel = null;
        }
    }
}

// ── Language mapping ─────────────────────────────────────────────────────────
// The extension stores ISO 639-1 codes (matching ElevenLabs); Google wants
// BCP-47 locales. 'auto' → multilingual auto-detection, which only the Chirp
// family supports (see `supportsAutoLanguage`).
const LANGUAGE_MAP: Record<string, string> = {
    en: 'en-US', zh: 'cmn-Hans-CN', es: 'es-ES', hi: 'hi-IN', pt: 'pt-BR',
    ru: 'ru-RU', ja: 'ja-JP', de: 'de-DE', fr: 'fr-FR', it: 'it-IT',
    ko: 'ko-KR', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE', tr: 'tr-TR',
    cs: 'cs-CZ', da: 'da-DK', fi: 'fi-FI', el: 'el-GR', hu: 'hu-HU',
    no: 'nb-NO', ro: 'ro-RO', sk: 'sk-SK', uk: 'uk-UA', bg: 'bg-BG',
    hr: 'hr-HR', ca: 'ca-ES', ta: 'ta-IN', ar: 'ar-EG', ms: 'ms-MY',
    id: 'id-ID', th: 'th-TH', vi: 'vi-VN', tl: 'fil-PH',
};

export function toLanguageCodes(language: string): string[] {
    if (!language || language === 'auto') { return ['auto']; }
    if (language in LANGUAGE_MAP) { return [LANGUAGE_MAP[language]]; }
    return [language];   // already a BCP-47 code or something we pass through verbatim
}
