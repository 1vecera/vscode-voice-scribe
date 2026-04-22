import WebSocket from 'ws';
import * as vscode from 'vscode';

// ── Logging ─────────────────────────────────────────────────────────────────
let outputChannel: vscode.OutputChannel | null = null;

function log(msg: string) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Voice Scribe');
    }
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
    console.log(`[VoiceScribe] ${msg}`);
}

export function showLog() {
    outputChannel?.show(true);
}

// ── Service ─────────────────────────────────────────────────────────────────
export class ElevenLabsService {
    private apiKey: string;
    private ws: WebSocket | null = null;
    private isTranscribing = false;
    private fullTranscript = '';
    private sentFirstChunk = false;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * Open WebSocket, start streaming session.
     *
     * Callbacks:
     *  - onPartial(text)  → interim result (replace previous partial)
     *  - onFinal(text)    → committed result (append permanently)
     */
    async startTranscription(
        onPartial: (text: string) => void,
        onFinal: (text: string) => void,
        _additionalVocabulary?: Array<{ word: string; boost: number }>
    ): Promise<void> {
        if (this.isTranscribing) {
            throw new Error('Already transcribing');
        }
        this.fullTranscript = '';
        this.sentFirstChunk = false;

        return new Promise((resolve, reject) => {
            try {
                // ── Build URL with REQUIRED query params ────────────────
                const config = vscode.workspace.getConfiguration('voiceScribe');
                const language = config.get<string>('language') || 'auto';
                log(`Language: ${language}`);

                // ── VAD sensitivity presets ────────────────────────
                const vadSensitivity = config.get<string>('vadSensitivity', 'medium');
                const vadPresets: Record<string, { threshold: string; minSpeech: string; minSilence: string }> = {
                    low:    { threshold: '0.7', minSpeech: '400', minSilence: '200' },
                    medium: { threshold: '0.5', minSpeech: '250', minSilence: '100' },
                    high:   { threshold: '0.3', minSpeech: '100', minSilence: '50' },
                };
                const vad = vadPresets[vadSensitivity] || vadPresets['medium'];

                const params = new URLSearchParams({
                    model_id: 'scribe_v2_realtime',   // REQUIRED
                    audio_format: 'pcm_16000',        // 16 kHz 16-bit LE mono
                    commit_strategy: 'vad',           // auto-commit on silence
                    tag_audio_events: 'false',        // don't insert (laughter) etc.
                    num_speakers: '1',                // single speaker dictation
                    no_verbatim: 'true',              // strip filler words & false starts
                    // ── VAD tuning (from sensitivity preset) ─────────
                    vad_silence_threshold_secs: '0.8', // commit faster (default 1.5)
                    vad_threshold: vad.threshold,
                    min_speech_duration_ms: vad.minSpeech,
                    min_silence_duration_ms: vad.minSilence,
                });
                // Only set language_code when a specific language is chosen;
                // omitting it lets the API auto-detect the spoken language.
                if (language !== 'auto') {
                    params.set('language_code', language);
                }
                const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${params}`;

                log(`Connecting to ${wsUrl}`);

                this.ws = new WebSocket(wsUrl, {
                    headers: { 'xi-api-key': this.apiKey },
                });

                // ── open ────────────────────────────────────────────────
                this.ws.on('open', () => {
                    this.isTranscribing = true;
                    log('WebSocket connected — waiting for session_started');
                    // Note: custom vocabulary / keyterm boosting is only available
                    // in the batch Scribe v2 API, not in the realtime WebSocket API.
                    // The realtime protocol only accepts input_audio_chunk messages.
                    resolve();
                });

                // ── message ─────────────────────────────────────────────
                this.ws.on('message', (data: WebSocket.Data) => {
                    try {
                        const raw = data.toString();
                        const msg = JSON.parse(raw);
                        const t = msg.message_type || '';

                        // Log message type + length only — never log transcript content
                        log(`← ${t} (${(msg.text || '').length} chars)`);

                        switch (t) {
                            case 'session_started':
                                log(`Session ${msg.session_id} ready`);
                                break;

                            case 'partial_transcript': {
                                const text = msg.text || '';
                                if (text) { onPartial(text); }
                                break;
                            }

                            case 'committed_transcript':
                            case 'committed_transcript_with_timestamps': {
                                const text = msg.text || '';
                                if (text) {
                                    this.fullTranscript +=
                                        (this.fullTranscript ? ' ' : '') + text;
                                    onFinal(text);
                                }
                                break;
                            }

                            default:
                                if (t.includes('error')) {
                                    const errMsg = msg.error || msg.message || raw;
                                    log(`ERROR: ${errMsg}`);
                                    vscode.window.showErrorMessage(
                                        `Voice Scribe: ${errMsg}`
                                    );
                                }
                                break;
                        }
                    } catch (err) {
                        log(`Parse error: ${err}`);
                    }
                });

                // ── error / close ───────────────────────────────────────
                this.ws.on('error', (error: Error) => {
                    log(`WebSocket error: ${error.message}`);
                    this.isTranscribing = false;
                    reject(error);
                });

                this.ws.on('close', (code, reason) => {
                    this.isTranscribing = false;
                    log(`WebSocket closed: code=${code} reason=${reason?.toString() || 'none'}`);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Stop recording — wait briefly for any final VAD commit, then close.
     */
    async stopTranscription(): Promise<string> {
        return new Promise((resolve) => {
            if (!this.ws || !this.isTranscribing) {
                resolve(this.fullTranscript);
                return;
            }

            log('Stopping — waiting 2 s for final VAD commit...');

            // Listen for any last committed_transcript
            const finalHandler = (data: WebSocket.Data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const t = msg.message_type || '';
                    log(`← (drain) ${t}`);

                    if (t === 'committed_transcript' || t === 'committed_transcript_with_timestamps') {
                        const text = msg.text || '';
                        if (text) {
                            this.fullTranscript +=
                                (this.fullTranscript ? ' ' : '') + text;
                        }
                    }
                } catch (err) {
                    log(`Drain parse error: ${err}`);
                }
            };
            this.ws.on('message', finalHandler);

            setTimeout(() => {
                if (this.ws) {
                    this.ws.off('message', finalHandler);
                    this.ws.close();
                    this.isTranscribing = false;
                }
                log(`Full transcript: ${this.fullTranscript.length} chars`);
                resolve(this.fullTranscript);
            }, 2000);
        });
    }

    /**
     * Send a raw PCM audio chunk (Buffer) to the API.
     * Encodes as base64 inside the required JSON envelope.
     */
    async sendAudioChunk(audioData: Buffer): Promise<void> {
        if (!this.ws || !this.isTranscribing) { return; }
        if (this.ws.readyState !== WebSocket.OPEN) { return; }

        // CORRECT protocol: message_type + audio_base_64
        const payload: Record<string, unknown> = {
            message_type: 'input_audio_chunk',
            audio_base_64: audioData.toString('base64'),
        };
        // previous_text is only allowed on the FIRST audio chunk
        if (!this.sentFirstChunk && this.fullTranscript.length > 0) {
            payload.previous_text = this.fullTranscript.slice(-200);
        }
        this.sentFirstChunk = true;
        this.ws.send(JSON.stringify(payload));
    }

    getFullTranscript(): string {
        return this.fullTranscript;
    }

    dispose() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isTranscribing = false;
        this.fullTranscript = '';
        if (outputChannel) {
            outputChannel.dispose();
            outputChannel = null;
        }
    }
}
