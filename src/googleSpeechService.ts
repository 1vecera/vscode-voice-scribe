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
    /** Speech-to-Text V2 model, e.g. 'chirp_3'. */
    model: string;
}

// Reopen the gRPC stream this many times after unexpected closes before giving
// up. Covers the V2 streaming max-duration cap (~5 min): a healthy stream that
// hits the cap emits 'data' first, which resets the counter, so it restarts
// indefinitely during real use; a genuinely broken config fails fast.
const MAX_RESTARTS = 5;

/**
 * Google Cloud Speech-to-Text V2 streaming provider (Chirp 3 by default).
 *
 * Auth is via Application Default Credentials (`gcloud auth application-default
 * login`) — no API key. Chirp models require a regional endpoint, so the client
 * is pointed at `<location>-speech.googleapis.com` and the recognizer path uses
 * the same location.
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

    private onPartial: ((text: string) => void) | null = null;
    private onFinal: ((text: string) => void) | null = null;

    constructor(options: GoogleSpeechOptions) {
        this.project = options.project;
        this.location = options.location;
        this.model = options.model;
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
        this.onPartial = onPartial;
        this.onFinal = onFinal;

        const config = vscode.workspace.getConfiguration('voiceScribe');
        const language = config.get<string>('language') || 'auto';
        this.languageCodes = toLanguageCodes(language);

        // Chirp models are only served from regional endpoints.
        const apiEndpoint = `${this.location}-speech.googleapis.com`;
        log(`Provider: Google ${this.model} @ ${apiEndpoint} | languages: ${this.languageCodes.join(',')}`);

        this.client = new v2.SpeechClient({ apiEndpoint });
        // Auto-detect the project from ADC when not pinned in settings.
        const projectId = this.project || (await this.client.getProjectId());
        this.recognizer = `projects/${projectId}/locations/${this.location}/recognizers/_`;
        log(`Recognizer: ${this.recognizer}`);

        this.openStream();
        this.isTranscribing = true;
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
                this.cleanup();
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
        const stream = this.stream;
        if (!stream || !this.isTranscribing || this.userStopped) { return; }
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

    private cleanup(): void {
        if (this.stream) {
            try {
                this.stream.removeAllListeners();
                this.stream.destroy();
            } catch { /* ignore */ }
            this.stream = null;
        }
        if (this.client) {
            try { this.client.close(); } catch { /* ignore */ }
            this.client = null;
        }
        this.isTranscribing = false;
    }

    dispose(): void {
        this.userStopped = true;
        this.cleanup();
        this.fullTranscript = '';
        if (outputChannel) {
            outputChannel.dispose();
            outputChannel = null;
        }
    }
}

// ── Language mapping ─────────────────────────────────────────────────────────
// The extension stores ISO 639-1 codes (matching ElevenLabs); Chirp wants
// BCP-47 locales. 'auto' → multilingual auto-detection (Chirp 3 handles
// code-switching, e.g. Czech ↔ English, well in this mode).
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
