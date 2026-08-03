/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { createMockVscode, createMockChildProcess } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('AudioCapture', () => {
    let AudioCaptureClass: any;
    let mockSpawn: sinon.SinonStub;
    let mockVscode: any;

    beforeEach(() => {
        mockVscode = createMockVscode();
        mockSpawn = sinon.stub();
        const mod = proxyquire('../audioCapture', {
            'vscode': mockVscode,
            'child_process': { spawn: mockSpawn, execSync: () => '' },
            'fs': { existsSync: () => false },
        });
        AudioCaptureClass = mod.AudioCapture;
    });

    afterEach(() => {
        sinon.restore();
    });

    // ── initialize ─────────────────────────────────────────────────────

    describe('initialize', () => {
        it('should resolve when ffmpeg is found', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const ac = new AudioCaptureClass();
            const promise = ac.initialize(sinon.stub());
            proc.emit('close', 0);
            await promise;

            sinon.assert.calledWith(mockSpawn, 'ffmpeg', ['-version']);
        });

        it('should reject when ffmpeg is not found', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const ac = new AudioCaptureClass();
            const promise = ac.initialize(sinon.stub());
            proc.emit('error', new Error('not found'));

            await assert.rejects(promise, /ffmpeg not found/);
            sinon.assert.calledOnce(mockVscode.window.showErrorMessage);
        });

        it('should reject when ffmpeg exits with non-zero code', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const ac = new AudioCaptureClass();
            const promise = ac.initialize(sinon.stub());
            proc.emit('close', 1);

            await assert.rejects(promise, /ffmpeg check failed/);
        });
    });

    // ── startRecording ─────────────────────────────────────────────────

    describe('startRecording', () => {
        it('should do nothing if not initialized', async () => {
            const ac = new AudioCaptureClass();
            await ac.startRecording(); // onAudioChunk is null → early return
            // spawn was never called (no second call)
            sinon.assert.notCalled(mockSpawn);
        });

        it('should spawn ffmpeg with correct common args', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording(); // resolves after ~100ms

            const args: string[] = mockSpawn.secondCall.args[1];
            assert.ok(args.includes('-ac'),   'expected -ac flag');
            assert.ok(args.includes('1'),     'expected mono channel');
            assert.ok(args.includes('-ar'),   'expected -ar flag');
            assert.ok(args.includes('16000'), 'expected 16kHz sample rate');
            assert.ok(args.includes('-f'),    'expected -f flag');
            assert.ok(args.includes('s16le'), 'expected PCM s16le format');
            assert.ok(args.includes('pipe:1'),'expected stdout pipe');
        });

        it('should send raw microphone audio without filters', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();

            const args: string[] = mockSpawn.secondCall.args[1];
            assert.strictEqual(args.indexOf('-af'), -1,
                'expected raw microphone audio without an -af filter');
        });

        it(`should use platform-specific input format (${process.platform})`, async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();

            const args: string[] = mockSpawn.secondCall.args[1];
            const platformFormats: Record<string, string> = {
                darwin: 'avfoundation',
                linux:  'alsa',
                win32:  'dshow',
            };
            const expected = platformFormats[process.platform];
            if (expected) {
                assert.ok(args.includes(expected),
                    `expected ${expected} for ${process.platform}`);
            }
        });

        it('should chunk audio data at the default 640-byte (20ms) boundaries', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const chunks: Buffer[] = [];
            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize((chunk: Buffer) => chunks.push(chunk));
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();

            // Emit 1280 bytes → expect 2 chunks of 640 (20ms each at 16kHz/16bit/mono)
            recordProc.stdout.emit('data', Buffer.alloc(1280, 0x42));
            assert.strictEqual(chunks.length, 2);
            assert.strictEqual(chunks[0].length, 640);
            assert.strictEqual(chunks[1].length, 640);
        });

        it('should buffer data smaller than chunk size', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const chunks: Buffer[] = [];
            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize((chunk: Buffer) => chunks.push(chunk));
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();

            // Emit 200 bytes — not enough for a full 640-byte chunk
            recordProc.stdout.emit('data', Buffer.alloc(200));
            assert.strictEqual(chunks.length, 0);

            // Emit 440 more → total 640 → one chunk
            recordProc.stdout.emit('data', Buffer.alloc(440));
            assert.strictEqual(chunks.length, 1);
            assert.strictEqual(chunks[0].length, 640);
        });

        it('should send remaining buffer when process closes', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const chunks: Buffer[] = [];
            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize((chunk: Buffer) => chunks.push(chunk));
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();

            // Emit 300 bytes — smaller than the 640-byte chunkSize
            recordProc.stdout.emit('data', Buffer.alloc(300));
            assert.strictEqual(chunks.length, 0);

            // Process closes — remaining buffer flushed
            recordProc.emit('close', 0);
            assert.strictEqual(chunks.length, 1);
            assert.strictEqual(chunks[0].length, 300);
        });

    });

    // ── stopRecording ──────────────────────────────────────────────────

    describe('stopRecording', () => {
        it('should send q and resolve after ffmpeg closes', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();
            const stopPromise = ac.stopRecording();

            sinon.assert.calledWith(recordProc.stdin.write, 'q');
            sinon.assert.notCalled(recordProc.kill);

            recordProc.emit('close', 0);
            await stopPromise;
        });

        it('should terminate ffmpeg when graceful stop times out', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;
            await ac.startRecording();

            const clock = sinon.useFakeTimers();
            try {
                const stopPromise = ac.stopRecording();
                clock.tick(100);

                sinon.assert.calledWith(recordProc.kill, 'SIGTERM');
                recordProc.emit('close', 0);
                await stopPromise;
            } finally {
                clock.restore();
            }
        });

        it('should flush the final audio buffer before stop resolves', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const chunks: Buffer[] = [];
            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize((chunk: Buffer) => chunks.push(chunk));
            initProc.emit('close', 0);
            await initPromise;
            await ac.startRecording();

            recordProc.stdout.emit('data', Buffer.alloc(300));
            const stopPromise = ac.stopRecording();
            assert.strictEqual(chunks.length, 0);

            recordProc.emit('close', 0);
            await stopPromise;

            assert.strictEqual(chunks.length, 1);
            assert.strictEqual(chunks[0].length, 300);
        });

        it('should share one pending stop operation', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;
            await ac.startRecording();

            const firstStop = ac.stopRecording();
            const secondStop = ac.stopRecording();
            recordProc.emit('close', 0);
            await Promise.all([firstStop, secondStop]);

            sinon.assert.calledOnce(recordProc.stdin.write);
            sinon.assert.notCalled(recordProc.kill);
        });

        it('should do nothing if not recording', async () => {
            const ac = new AudioCaptureClass();
            await ac.stopRecording(); // should return without error
        });
    });

    // ── dispose ────────────────────────────────────────────────────────

    describe('dispose', () => {
        it('should kill process with SIGKILL', async () => {
            const initProc = createMockChildProcess();
            const recordProc = createMockChildProcess();
            mockSpawn.onFirstCall().returns(initProc);
            mockSpawn.onSecondCall().returns(recordProc);

            const ac = new AudioCaptureClass();
            const initPromise = ac.initialize(sinon.stub());
            initProc.emit('close', 0);
            await initPromise;

            await ac.startRecording();
            ac.dispose();

            sinon.assert.calledWith(recordProc.kill, 'SIGKILL');
            assert.strictEqual(ac.getIsRecording(), false);
        });
    });
});
