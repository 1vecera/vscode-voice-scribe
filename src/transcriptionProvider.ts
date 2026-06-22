/**
 * Common contract for a streaming speech-to-text backend.
 *
 * Both ElevenLabs (Scribe v2 Realtime over WebSocket) and Google Cloud
 * (Chirp 3 over gRPC StreamingRecognize) implement this so the extension can
 * swap providers via the `voiceScribe.provider` setting without touching the
 * recording / editor-mutation logic.
 *
 * The audio side is provider-agnostic: AudioCapture emits 16 kHz / 16-bit /
 * mono PCM in 100 ms chunks, which is exactly what both backends accept.
 */
export interface TranscriptionProvider {
    /**
     * Open the streaming session.
     *
     *  - onPartial(text) → interim hypothesis for the current segment. The full
     *    current hypothesis (not a delta), so callers replace the live zone.
     *  - onFinal(text)   → committed segment, locked in.
     *
     * `additionalVocabulary` is a best-effort biasing hint; providers that don't
     * support realtime biasing ignore it.
     */
    startTranscription(
        onPartial: (text: string) => void,
        onFinal: (text: string) => void,
        additionalVocabulary?: Array<{ word: string; boost: number }>,
    ): Promise<void>;

    /** Stop streaming, flush any last committed segment, resolve with the full transcript. */
    stopTranscription(): Promise<string>;

    /** Feed one PCM audio chunk (16 kHz / 16-bit / mono). */
    sendAudioChunk(audioData: Buffer): Promise<void> | void;

    /** Everything committed so far this session. */
    getFullTranscript(): string;

    /** Tear down sockets/streams/clients. */
    dispose(): void;
}
