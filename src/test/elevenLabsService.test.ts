/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { EventEmitter } from 'events';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('ElevenLabsService', () => {
    let ElevenLabsService: any;
    let mockVscode: any;
    let wsInstances: any[];

    // ── Mock WebSocket ─────────────────────────────────────────────────
    class MockWebSocket extends EventEmitter {
        static OPEN = 1;
        static CONNECTING = 0;
        static CLOSING = 2;
        static CLOSED = 3;

        url: string;
        options: any;
        readyState: number = MockWebSocket.OPEN;
        sentMessages: string[] = [];

        constructor(url: string, options?: any) {
            super();
            this.url = url;
            this.options = options;
            wsInstances.push(this);
        }

        send(data: string) {
            this.sentMessages.push(data);
        }

        close() {
            this.readyState = MockWebSocket.CLOSED;
        }
    }

    beforeEach(() => {
        wsInstances = [];
        mockVscode = createMockVscode();
        mockVscode._configValues.set('language', 'en');

        const mod = proxyquire('../elevenLabsService', {
            'vscode': mockVscode,
            'ws': MockWebSocket,
        });
        ElevenLabsService = mod.ElevenLabsService;
    });

    afterEach(() => {
        sinon.restore();
    });

    /**
     * Helper: create a service, start transcription, and emit 'open'.
     * Returns everything needed for subsequent assertions.
     */
    function startService(
        onPartial?: sinon.SinonStub,
        onFinal?: sinon.SinonStub,
        additionalVocabulary?: Array<{ word: string; boost: number }>,
    ) {
        const service = new ElevenLabsService('test-api-key');
        const p = onPartial || sinon.stub();
        const f = onFinal || sinon.stub();

        const promise = service.startTranscription(p, f, additionalVocabulary);
        const ws = wsInstances[wsInstances.length - 1];
        ws.emit('open');

        return { service, promise, ws, onPartial: p, onFinal: f };
    }

    // ── startTranscription ─────────────────────────────────────────────

    describe('startTranscription', () => {
        it('should create WebSocket with correct URL params', async () => {
            const { ws, promise } = startService();
            await promise;

            assert.ok(ws.url.includes('wss://api.elevenlabs.io/v1/speech-to-text/realtime'));
            assert.ok(ws.url.includes('model_id=scribe_v2_realtime'));
            assert.ok(ws.url.includes('audio_format=pcm_16000'));
            assert.ok(ws.url.includes('language_code=en'));
            assert.ok(ws.url.includes('commit_strategy=vad'));
        });

        it('should pass API key in WebSocket headers', async () => {
            const { ws, promise } = startService();
            await promise;

            assert.deepStrictEqual(ws.options.headers, {
                'xi-api-key': 'test-api-key',
            });
        });

        it('should resolve when WebSocket opens', async () => {
            const service = new ElevenLabsService('key');
            const promise = service.startTranscription(sinon.stub(), sinon.stub());
            const ws = wsInstances[0];

            ws.emit('open');
            await promise; // should resolve without timeout
        });

        it('should reject when WebSocket emits error', async () => {
            const service = new ElevenLabsService('key');
            const promise = service.startTranscription(sinon.stub(), sinon.stub());
            const ws = wsInstances[0];

            ws.emit('error', new Error('connection refused'));

            await assert.rejects(promise, /connection refused/);
        });

        it('should throw if already transcribing', async () => {
            const { service, promise } = startService();
            await promise;

            await assert.rejects(
                () => service.startTranscription(sinon.stub(), sinon.stub()),
                /Already transcribing/,
            );
        });

        it('should include VAD noise-rejection params in URL', async () => {
            const { ws, promise } = startService();
            await promise;

            assert.ok(ws.url.includes('vad_threshold=0.5'),
                'expected vad_threshold=0.5 in URL');
            assert.ok(ws.url.includes('min_speech_duration_ms=250'),
                'expected min_speech_duration_ms=250 in URL');
            assert.ok(ws.url.includes('min_silence_duration_ms=100'),
                'expected min_silence_duration_ms=100 in URL');
        });

        it('should not auto-open output panel on WebSocket connect', async () => {
            const { promise } = startService();
            await promise;

            sinon.assert.notCalled(mockVscode._outputChannel.show);
        });

        it('should use configured language code', async () => {
            mockVscode._configValues.set('language', 'ja');
            // Reload module with updated config
            const mod = proxyquire('../elevenLabsService', {
                'vscode': mockVscode,
                'ws': MockWebSocket,
            });
            const svc = new mod.ElevenLabsService('key');
            const p = svc.startTranscription(sinon.stub(), sinon.stub());
            const ws = wsInstances[wsInstances.length - 1];
            ws.emit('open');
            await p;

            assert.ok(ws.url.includes('language_code=ja'));
        });

        it('should use low VAD preset when configured', async () => {
            mockVscode._configValues.set('vadSensitivity', 'low');
            const mod = proxyquire('../elevenLabsService', {
                'vscode': mockVscode,
                'ws': MockWebSocket,
            });
            const svc = new mod.ElevenLabsService('key');
            const p = svc.startTranscription(sinon.stub(), sinon.stub());
            const ws = wsInstances[wsInstances.length - 1];
            ws.emit('open');
            await p;

            assert.ok(ws.url.includes('vad_threshold=0.7'),
                'expected vad_threshold=0.7 for low sensitivity');
            assert.ok(ws.url.includes('min_speech_duration_ms=400'),
                'expected min_speech_duration_ms=400 for low sensitivity');
            assert.ok(ws.url.includes('min_silence_duration_ms=200'),
                'expected min_silence_duration_ms=200 for low sensitivity');
        });

        it('should use high VAD preset when configured', async () => {
            mockVscode._configValues.set('vadSensitivity', 'high');
            const mod = proxyquire('../elevenLabsService', {
                'vscode': mockVscode,
                'ws': MockWebSocket,
            });
            const svc = new mod.ElevenLabsService('key');
            const p = svc.startTranscription(sinon.stub(), sinon.stub());
            const ws = wsInstances[wsInstances.length - 1];
            ws.emit('open');
            await p;

            assert.ok(ws.url.includes('vad_threshold=0.3'),
                'expected vad_threshold=0.3 for high sensitivity');
            assert.ok(ws.url.includes('min_speech_duration_ms=100'),
                'expected min_speech_duration_ms=100 for high sensitivity');
            assert.ok(ws.url.includes('min_silence_duration_ms=50'),
                'expected min_silence_duration_ms=50 for high sensitivity');
        });

        it('should not send any session_config message (realtime API does not support custom vocabulary)', async () => {
            // The realtime Scribe v2 WebSocket API does not support custom
            // vocabulary / keyterm boosting — that feature is batch-only.
            // Configure both user vocabulary (via config) and additional
            // vocabulary (via arg) and verify NO session_config is sent.
            mockVscode._configValues.set('customVocabulary', [
                { word: 'useState', boost: 5.0 },
                { word: 'kubectl', boost: 3.0 },
            ]);
            const mod = proxyquire('../elevenLabsService', {
                'vscode': mockVscode,
                'ws': MockWebSocket,
            });
            const svc = new mod.ElevenLabsService('key');
            const p = svc.startTranscription(
                sinon.stub(), sinon.stub(),
                [{ word: 'myFunc', boost: 2.0 }],
            );
            const ws = wsInstances[wsInstances.length - 1];
            ws.emit('open');
            await p;

            // Verify no session_config message was sent
            const sessionConfigMessages = ws.sentMessages.filter((raw: string) => {
                try {
                    const parsed = JSON.parse(raw);
                    return parsed.type === 'session_config';
                } catch {
                    return false;
                }
            });
            assert.strictEqual(sessionConfigMessages.length, 0,
                'expected no session_config messages (realtime API does not support custom vocabulary)');
            // Only input_audio_chunk messages should ever be sent; at this
            // point no audio has been sent, so sentMessages should be empty.
            assert.strictEqual(ws.sentMessages.length, 0,
                'expected no messages sent on connect');
        });

        it('should not send custom vocabulary when empty', async () => {
            // customVocabulary not set — defaults to [] via config.get default
            const { ws, promise } = startService();
            await promise;

            assert.strictEqual(ws.sentMessages.length, 0,
                'expected no messages sent when custom vocabulary is empty');
        });
    });

    // ── message handling ───────────────────────────────────────────────

    describe('message handling', () => {
        it('should call onPartial for partial_transcript', async () => {
            const { ws, promise, onPartial } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'partial_transcript',
                text: 'hello wor',
            }));

            sinon.assert.calledOnce(onPartial);
            sinon.assert.calledWith(onPartial, 'hello wor');
        });

        it('should ignore empty partial_transcript text', async () => {
            const { ws, promise, onPartial } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'partial_transcript',
                text: '',
            }));

            sinon.assert.notCalled(onPartial);
        });

        it('should call onFinal for committed_transcript', async () => {
            const { ws, promise, onFinal } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript',
                text: 'hello world',
            }));

            sinon.assert.calledOnce(onFinal);
            sinon.assert.calledWith(onFinal, 'hello world');
        });

        it('should call onFinal for committed_transcript_with_timestamps', async () => {
            const { ws, promise, onFinal } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript_with_timestamps',
                text: 'hello world',
            }));

            sinon.assert.calledOnce(onFinal);
            sinon.assert.calledWith(onFinal, 'hello world');
        });

        it('should accumulate fullTranscript from committed messages', async () => {
            const { service, ws, promise } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript',
                text: 'hello',
            }));
            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript',
                text: 'world',
            }));

            assert.strictEqual(service.getFullTranscript(), 'hello world');
        });

        it('should show error message for error-type messages', async () => {
            const { ws, promise } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'error',
                error: 'Rate limit exceeded',
            }));

            sinon.assert.calledOnce(mockVscode.window.showErrorMessage);
            const errArg = mockVscode.window.showErrorMessage.firstCall.args[0];
            assert.ok(errArg.includes('Rate limit exceeded'));
        });

        it('should handle malformed JSON gracefully', async () => {
            const { ws, promise, onPartial, onFinal } = startService();
            await promise;

            // Should not throw — the try/catch inside the handler absorbs it
            ws.emit('message', 'not valid json {{{');

            sinon.assert.notCalled(onPartial);
            sinon.assert.notCalled(onFinal);
        });

        it('should handle session_started message without error', async () => {
            const { ws, promise } = startService();
            await promise;

            // session_started is logged but no callback is invoked
            ws.emit('message', JSON.stringify({
                message_type: 'session_started',
                session_id: 'abc-123',
            }));
            // No assertion needed — just ensure no exception
        });
    });

    // ── sendAudioChunk ─────────────────────────────────────────────────

    describe('sendAudioChunk', () => {
        it('should send base64-encoded audio in JSON envelope', async () => {
            const { service, ws, promise } = startService();
            await promise;

            const audioData = Buffer.from('test audio data');
            await service.sendAudioChunk(audioData);

            assert.strictEqual(ws.sentMessages.length, 1);
            const sent = JSON.parse(ws.sentMessages[0]);
            assert.strictEqual(sent.message_type, 'input_audio_chunk');
            assert.strictEqual(sent.audio_base_64, audioData.toString('base64'));
        });

        it('should include previous_text only on first chunk when transcript exists', async () => {
            const { service, ws, promise } = startService();
            await promise;

            // Simulate prior committed text
            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript',
                text: 'prior words',
            }));

            // First chunk — should have previous_text
            await service.sendAudioChunk(Buffer.from('chunk1'));
            const sent1 = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
            assert.strictEqual(sent1.previous_text, 'prior words');

            // Second chunk — should NOT have previous_text
            await service.sendAudioChunk(Buffer.from('chunk2'));
            const sent2 = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
            assert.strictEqual(sent2.previous_text, undefined);
        });

        it('should not include previous_text on first chunk when transcript is empty', async () => {
            const { service, ws, promise } = startService();
            await promise;

            await service.sendAudioChunk(Buffer.from('chunk'));
            const sent = JSON.parse(ws.sentMessages[0]);
            assert.strictEqual(sent.previous_text, undefined);
        });

        it('should not send if not transcribing', async () => {
            const service = new ElevenLabsService('key');
            await service.sendAudioChunk(Buffer.from('data'));

            assert.strictEqual(wsInstances.length, 0);
        });

        it('should not send if WebSocket is not open', async () => {
            const { service, ws, promise } = startService();
            await promise;

            ws.readyState = MockWebSocket.CLOSED;
            await service.sendAudioChunk(Buffer.from('data'));

            assert.strictEqual(ws.sentMessages.length, 0);
        });
    });

    // ── stopTranscription ──────────────────────────────────────────────

    describe('stopTranscription', () => {
        it('should return empty string immediately if not transcribing', async () => {
            const service = new ElevenLabsService('key');
            const result = await service.stopTranscription();
            assert.strictEqual(result, '');
        });

        it('should close WebSocket after 2s drain window', async () => {
            const { service, ws, promise } = startService();
            await promise;

            const clock = sinon.useFakeTimers();
            try {
                const stopPromise = service.stopTranscription();
                clock.tick(2000);
                await stopPromise;

                assert.strictEqual(ws.readyState, MockWebSocket.CLOSED);
            } finally {
                clock.restore();
            }
        });

        it('should return accumulated fullTranscript', async () => {
            const { service, ws, promise } = startService();
            await promise;

            ws.emit('message', JSON.stringify({
                message_type: 'committed_transcript',
                text: 'hello world',
            }));

            const clock = sinon.useFakeTimers();
            try {
                const stopPromise = service.stopTranscription();
                clock.tick(2000);
                const result = await stopPromise;

                assert.strictEqual(result, 'hello world');
            } finally {
                clock.restore();
            }
        });

        it('should attach drain listener during 2s window', async () => {
            const { service, ws, promise } = startService();
            await promise;

            const listenersBefore = ws.listenerCount('message');

            const clock = sinon.useFakeTimers();
            try {
                service.stopTranscription();

                // During drain, an extra message listener is attached
                const listenersDuring = ws.listenerCount('message');
                assert.ok(listenersDuring > listenersBefore,
                    'Expected extra message listener during drain');

                clock.tick(2000);
            } finally {
                clock.restore();
            }
        });
    });

    // ── dispose ────────────────────────────────────────────────────────

    describe('dispose', () => {
        it('should close WebSocket and dispose output channel', async () => {
            const { service, ws, promise } = startService();
            await promise;

            service.dispose();

            assert.strictEqual(ws.readyState, MockWebSocket.CLOSED);
        });

        it('should handle dispose when no WebSocket exists', () => {
            const service = new ElevenLabsService('key');
            service.dispose(); // should not throw
        });
    });
});
