/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { EventEmitter } from 'events';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('GoogleSpeechService', () => {
    let GoogleSpeechService: any;
    let toLanguageCodes: any;
    let mockVscode: any;
    let streams: MockStream[];
    let clients: MockSpeechClient[];

    // ── Mock gRPC duplex stream ────────────────────────────────────────
    class MockStream extends EventEmitter {
        writes: any[] = [];
        writableEnded = false;
        destroyed = false;
        write(msg: any) { this.writes.push(msg); return true; }
        end() { this.writableEnded = true; this.emit('end'); }
        destroy() { this.destroyed = true; }
    }

    // ── Mock v2.SpeechClient ───────────────────────────────────────────
    class MockSpeechClient {
        options: any;
        closed = false;
        constructor(options: any) {
            this.options = options;
            clients.push(this);
        }
        initialized = false;
        getProjectId() { return Promise.resolve('adc-project'); }
        initialize() { this.initialized = true; return Promise.resolve(); }
        _streamingRecognize() {
            const s = new MockStream();
            streams.push(s);
            return s;
        }
        close() { this.closed = true; }
    }

    beforeEach(() => {
        streams = [];
        clients = [];
        mockVscode = createMockVscode();

        const mod = proxyquire('../googleSpeechService', {
            'vscode': mockVscode,
            '@google-cloud/speech': { v2: { SpeechClient: MockSpeechClient }, protos: {} },
        });
        GoogleSpeechService = mod.GoogleSpeechService;
        toLanguageCodes = mod.toLanguageCodes;
    });

    afterEach(() => sinon.restore());

    function make(opts?: any) {
        return new GoogleSpeechService({ location: 'eu', model: 'chirp_3', ...opts });
    }

    // ── language mapping ───────────────────────────────────────────────
    describe('toLanguageCodes', () => {
        it('maps auto / empty to ["auto"]', () => {
            assert.deepStrictEqual(toLanguageCodes('auto'), ['auto']);
            assert.deepStrictEqual(toLanguageCodes(''), ['auto']);
        });
        it('maps ISO 639-1 to BCP-47', () => {
            assert.deepStrictEqual(toLanguageCodes('cs'), ['cs-CZ']);
            assert.deepStrictEqual(toLanguageCodes('en'), ['en-US']);
            assert.deepStrictEqual(toLanguageCodes('de'), ['de-DE']);
        });
        it('passes unknown codes through verbatim', () => {
            assert.deepStrictEqual(toLanguageCodes('cs-CZ'), ['cs-CZ']);
        });
    });

    // ── startTranscription / config message ────────────────────────────
    describe('startTranscription', () => {
        it('sends a config-first message with the right recognizer + Chirp 3 config', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());

            const cfg = streams[0].writes[0];
            assert.strictEqual(cfg.recognizer, 'projects/adc-project/locations/eu/recognizers/_');
            assert.strictEqual(cfg.streamingConfig.config.model, 'chirp_3');
            assert.strictEqual(cfg.streamingConfig.config.explicitDecodingConfig.encoding, 'LINEAR16');
            assert.strictEqual(cfg.streamingConfig.config.explicitDecodingConfig.sampleRateHertz, 16000);
            assert.strictEqual(cfg.streamingConfig.streamingFeatures.interimResults, true);
        });

        it('points the client at the regional endpoint', async () => {
            const svc = make({ location: 'us-central1' });
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.strictEqual(clients[0].options.apiEndpoint, 'us-central1-speech.googleapis.com');
        });

        it('uses the configured language (cs → cs-CZ)', async () => {
            mockVscode._configValues.set('language', 'cs');
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.deepStrictEqual(streams[0].writes[0].streamingConfig.config.languageCodes, ['cs-CZ']);
        });

        it('defaults to auto-detect when no language set', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.deepStrictEqual(streams[0].writes[0].streamingConfig.config.languageCodes, ['auto']);
        });

        it('uses the pinned project without calling getProjectId', async () => {
            const svc = make({ project: 'pinned-proj' });
            const spy = sinon.spy(MockSpeechClient.prototype, 'getProjectId');
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.strictEqual(streams[0].writes[0].recognizer, 'projects/pinned-proj/locations/eu/recognizers/_');
            sinon.assert.notCalled(spy);
        });

        it('throws an actionable error when no project can be resolved', async () => {
            sinon.stub(MockSpeechClient.prototype, 'getProjectId').rejects(new Error('Unable to detect a Project Id'));
            const svc = make();   // no project pinned
            await assert.rejects(
                svc.startTranscription(sinon.stub(), sinon.stub()),
                /voiceScribe\.googleProject|gcloud config set project|GOOGLE_CLOUD_PROJECT/,
            );
        });

        it('throws if already transcribing', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            await assert.rejects(svc.startTranscription(sinon.stub(), sinon.stub()), /Already transcribing/);
        });
    });

    // ── model / language compatibility ─────────────────────────────────
    describe('language compatibility', () => {
        it('keeps auto-detect for chirp models', async () => {
            mockVscode._configValues.set('language', 'auto');
            const svc = make({ model: 'chirp_3' });
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.deepStrictEqual(streams[0].writes[0].streamingConfig.config.languageCodes, ['auto']);
        });

        it('falls back to en-US when a conformer model gets auto, and warns', async () => {
            mockVscode._configValues.set('language', 'auto');
            const svc = make({ model: 'long' });
            await svc.startTranscription(sinon.stub(), sinon.stub());
            // 'long' rejects 'auto' server-side, so it must never be sent.
            assert.deepStrictEqual(streams[0].writes[0].streamingConfig.config.languageCodes, ['en-US']);
            sinon.assert.called(mockVscode.window.showWarningMessage);
        });

        it('leaves an explicit language alone on a conformer model', async () => {
            mockVscode._configValues.set('language', 'cs');
            const svc = make({ model: 'long' });
            await svc.startTranscription(sinon.stub(), sinon.stub());
            assert.deepStrictEqual(streams[0].writes[0].streamingConfig.config.languageCodes, ['cs-CZ']);
            sinon.assert.notCalled(mockVscode.window.showWarningMessage);
        });
    });

    // ── latency behaviours ─────────────────────────────────────────────
    describe('startup latency', () => {
        it('buffers audio sent before the stream is open and flushes it after', async () => {
            const svc = make();
            // Hold the project-id resolution open so the stream isn't ready yet.
            let release: () => void = () => { };
            sinon.stub(MockSpeechClient.prototype, 'getProjectId')
                .returns(new Promise<string>((r) => { release = () => r('adc-project'); }));

            const started = svc.startTranscription(sinon.stub(), sinon.stub());
            const early = Buffer.from([9, 9]);
            svc.sendAudioChunk(early);          // arrives before the stream exists
            assert.strictEqual(streams.length, 0, 'no stream yet');

            release();
            await started;

            const audioWrites = streams[0].writes.filter((w: any) => w.audio);
            assert.strictEqual(audioWrites.length, 1, 'buffered chunk should be flushed');
            assert.strictEqual(audioWrites[0].audio, early);
        });

        it('reuses the client across start/stop so the gRPC channel stays warm', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            await svc.stopTranscription();
            await svc.startTranscription(sinon.stub(), sinon.stub());

            assert.strictEqual(clients.length, 1, 'expected one client across both sessions');
            assert.strictEqual(clients[0].closed, false, 'client must not be closed on stop');
            assert.strictEqual(streams.length, 2, 'but a fresh stream per session');
        });

        it('closes the client only on dispose', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            await svc.stopTranscription();
            assert.strictEqual(clients[0].closed, false);
            svc.dispose();
            assert.strictEqual(clients[0].closed, true);
        });

        it('prewarm resolves the project id and never rejects', async () => {
            const svc = make();
            await svc.prewarm();   // must not throw
            assert.strictEqual(clients.length, 1);
        });

        it('prewarm swallows auth failures so activation stays clean', async () => {
            sinon.stub(MockSpeechClient.prototype, 'getProjectId').rejects(new Error('no ADC'));
            const svc = make();
            await svc.prewarm();   // must not throw
        });
    });

    // ── result handling ────────────────────────────────────────────────
    describe('result handling', () => {
        it('routes interim results to onPartial and finals to onFinal', async () => {
            const onPartial = sinon.stub();
            const onFinal = sinon.stub();
            const svc = make();
            await svc.startTranscription(onPartial, onFinal);

            streams[0].emit('data', { results: [{ isFinal: false, alternatives: [{ transcript: 'hel' }] }] });
            streams[0].emit('data', { results: [{ isFinal: true, alternatives: [{ transcript: 'Hello world.' }] }] });

            sinon.assert.calledWith(onPartial, 'hel');
            sinon.assert.calledWith(onFinal, 'Hello world.');
        });

        it('accumulates committed segments into the full transcript', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            streams[0].emit('data', { results: [{ isFinal: true, alternatives: [{ transcript: 'First.' }] }] });
            streams[0].emit('data', { results: [{ isFinal: true, alternatives: [{ transcript: 'Second.' }] }] });
            assert.strictEqual(svc.getFullTranscript(), 'First. Second.');
        });

        it('ignores empty transcripts', async () => {
            const onPartial = sinon.stub();
            const svc = make();
            await svc.startTranscription(onPartial, sinon.stub());
            streams[0].emit('data', { results: [{ isFinal: false, alternatives: [{ transcript: '' }] }] });
            sinon.assert.notCalled(onPartial);
        });
    });

    // ── sendAudioChunk ─────────────────────────────────────────────────
    describe('sendAudioChunk', () => {
        it('writes audio frames wrapped in { audio }', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            const buf = Buffer.from([1, 2, 3]);
            svc.sendAudioChunk(buf);
            const audioWrite = streams[0].writes.find((w: any) => w.audio);
            assert.ok(audioWrite, 'expected an { audio } write');
            assert.strictEqual(audioWrite.audio, buf);
        });

        it('is a no-op before start', () => {
            const svc = make();
            svc.sendAudioChunk(Buffer.from([1]));   // must not throw
            assert.strictEqual(streams.length, 0);
        });
    });

    // ── stop / dispose ─────────────────────────────────────────────────
    describe('stopTranscription', () => {
        it('half-closes the stream and resolves with the transcript', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            streams[0].emit('data', { results: [{ isFinal: true, alternatives: [{ transcript: 'Done.' }] }] });
            const result = await svc.stopTranscription();
            assert.strictEqual(result, 'Done.');
            assert.ok(streams[0].writableEnded);
        });

        it('resolves immediately if not transcribing', async () => {
            const svc = make();
            assert.strictEqual(await svc.stopTranscription(), '');
        });
    });

    describe('dispose', () => {
        it('destroys the stream and closes the client', async () => {
            const svc = make();
            await svc.startTranscription(sinon.stub(), sinon.stub());
            svc.dispose();
            assert.ok(streams[0].destroyed);
            assert.ok(clients[0].closed);
        });
    });
});
