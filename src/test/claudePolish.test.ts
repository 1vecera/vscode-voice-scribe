/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { createMockVscode, createMockChildProcess } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('ClaudePolishService', () => {
    let ClaudePolishServiceClass: any;
    let mockSpawn: sinon.SinonStub;
    let mockVscode: any;

    beforeEach(() => {
        mockVscode = createMockVscode();
        mockSpawn = sinon.stub();
        const mod = proxyquire('../claudePolish', {
            'vscode': mockVscode,
            'child_process': { spawn: mockSpawn },
        });
        ClaudePolishServiceClass = mod.ClaudePolishService;
    });

    afterEach(() => {
        sinon.restore();
    });

    // ── spawn args ────────────────────────────────────────────────────

    describe('spawn arguments', () => {
        it('should spawn claude with -p flag and correct model', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'hello world' }, { model: 'sonnet' });

            proc.stdout.emit('data', Buffer.from('Hello, world.'));
            proc.emit('close', 0);
            await promise;

            sinon.assert.calledOnce(mockSpawn);
            const args = mockSpawn.firstCall.args[1];
            assert.ok(args.includes('-p'), 'should include -p flag');
            assert.ok(args.includes('sonnet'), 'should include model name');
            assert.ok(args.includes('--output-format'), 'should include --output-format');
            assert.ok(args.includes('text'), 'output format should be text');
            assert.ok(args.includes('--no-session-persistence'), 'should disable session persistence');
        });

        it('should default to haiku model', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);
            await promise;

            const args = mockSpawn.firstCall.args[1];
            const modelIdx = args.indexOf('--model');
            assert.strictEqual(args[modelIdx + 1], 'haiku');
        });

        it('should spawn with cwd from context', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'x', cwd: '/my/project' });

            proc.stdout.emit('data', Buffer.from('X.'));
            proc.emit('close', 0);
            await promise;

            const opts = mockSpawn.firstCall.args[2];
            assert.strictEqual(opts.cwd, '/my/project');
        });

        it('should pass --tools "" to disable tools', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);
            await promise;

            const args = mockSpawn.firstCall.args[1];
            const toolsIdx = args.indexOf('--tools');
            assert.ok(toolsIdx >= 0, 'should include --tools');
            assert.strictEqual(args[toolsIdx + 1], '', 'tools arg should be empty string');
        });

        it('should include system prompt via --append-system-prompt', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);
            await promise;

            const args = mockSpawn.firstCall.args[1];
            const promptIdx = args.indexOf('--append-system-prompt');
            assert.ok(promptIdx >= 0, 'should include --append-system-prompt');
            assert.ok(
                args[promptIdx + 1].includes('dictation polisher'),
                'system prompt should mention dictation polisher'
            );
        });
    });

    // ── stdin / stdout ────────────────────────────────────────────────

    describe('stdin and stdout', () => {
        it('should write user prompt to stdin and end it', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'um so like we need to fix auth' });

            proc.stdout.emit('data', Buffer.from('We need to fix auth.'));
            proc.emit('close', 0);
            await promise;

            sinon.assert.calledOnce(proc.stdin.write);
            sinon.assert.calledOnce(proc.stdin.end);
            const stdinContent = proc.stdin.write.firstCall.args[0] as string;
            assert.ok(stdinContent.includes('um so like we need to fix auth'), 'stdin should contain paragraph text');
        });

        it('should include file context in stdin when provided', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({
                text: 'hello',
                filePath: 'src/main.ts',
                languageId: 'typescript',
                beforeText: 'const x = 1;',
                afterText: 'return x;',
            });

            proc.stdout.emit('data', Buffer.from('Hello.'));
            proc.emit('close', 0);
            await promise;

            const stdinContent = proc.stdin.write.firstCall.args[0] as string;
            assert.ok(stdinContent.includes('FILE: src/main.ts (typescript)'));
            assert.ok(stdinContent.includes('CONTEXT BEFORE:'));
            assert.ok(stdinContent.includes('const x = 1;'));
            assert.ok(stdinContent.includes('CONTEXT AFTER:'));
            assert.ok(stdinContent.includes('return x;'));
            assert.ok(stdinContent.includes('PARAGRAPH TO POLISH:'));
        });

        it('should return polished text from stdout', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'um hello' });

            proc.stdout.emit('data', Buffer.from('Hel'));
            proc.stdout.emit('data', Buffer.from('lo.'));
            proc.emit('close', 0);

            const result = await promise;
            assert.strictEqual(result.polished, 'Hello.');
        });

        it('should strip wrapping double quotes from output', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('"Hello world."'));
            proc.emit('close', 0);

            const result = await promise;
            assert.strictEqual(result.polished, 'Hello world.');
        });

        it('should strip wrapping backticks from output', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('`Hello world.`'));
            proc.emit('close', 0);

            const result = await promise;
            assert.strictEqual(result.polished, 'Hello world.');
        });

        it('should not strip quotes that are part of content', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('He said "hello" to everyone.'));
            proc.emit('close', 0);

            const result = await promise;
            assert.strictEqual(result.polished, 'He said "hello" to everyone.');
        });
    });

    // ── error handling ────────────────────────────────────────────────

    describe('error handling', () => {
        it('should reject on non-zero exit code', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stderr.emit('data', Buffer.from('rate limit exceeded'));
            proc.emit('close', 1);

            await assert.rejects(promise, /claude exited 1.*rate limit/);
        });

        it('should reject on spawn error', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.emit('error', new Error('ENOENT'));

            await assert.rejects(promise, /Failed to spawn claude.*ENOENT/);
        });

        it('should reject on timeout', async () => {
            const clock = sinon.useFakeTimers();
            try {
                const proc = createMockChildProcess();
                mockSpawn.returns(proc);

                const service = new ClaudePolishServiceClass();
                const promise = service.polish({ text: 'test' }, { timeoutMs: 5000 });

                clock.tick(5001);

                await assert.rejects(promise, /timed out after 5000ms/);
                sinon.assert.calledWith(proc.kill, 'SIGTERM');
            } finally {
                clock.restore();
            }
        });

        it('should reject with "no stderr" when exit code non-zero but stderr empty', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.emit('close', 2);

            await assert.rejects(promise, /no stderr/);
        });
    });

    // ── cancellation ──────────────────────────────────────────────────

    describe('cancellation', () => {
        it('should kill prior process when polish() called again', async () => {
            const proc1 = createMockChildProcess();
            const proc2 = createMockChildProcess();
            mockSpawn.onFirstCall().returns(proc1);
            mockSpawn.onSecondCall().returns(proc2);

            const service = new ClaudePolishServiceClass();

            // Start first polish (will hang)
            const _p1 = service.polish({ text: 'first' });

            // Start second — should cancel the first
            const p2 = service.polish({ text: 'second' });

            sinon.assert.calledWith(proc1.kill, 'SIGTERM');

            proc2.stdout.emit('data', Buffer.from('Second.'));
            proc2.emit('close', 0);

            const result = await p2;
            assert.strictEqual(result.polished, 'Second.');
        });

        it('cancel() should kill running process', () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            service.polish({ text: 'test' }); // fire and forget

            service.cancel();
            sinon.assert.calledWith(proc.kill, 'SIGTERM');
        });
    });

    // ── durationMs ────────────────────────────────────────────────────

    describe('timing', () => {
        it('should return durationMs in result', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'test' });

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);

            const result = await promise;
            assert.ok(typeof result.durationMs === 'number');
            assert.ok(result.durationMs >= 0);
        });
    });

    // ── buildUserPrompt (via stdin inspection) ────────────────────────

    describe('prompt construction', () => {
        it('should include extra instructions when provided', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish(
                { text: 'test' },
                { extraInstructions: 'Make it formal' }
            );

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);
            await promise;

            const stdinContent = proc.stdin.write.firstCall.args[0] as string;
            assert.ok(stdinContent.includes('EXTRA INSTRUCTIONS:'));
            assert.ok(stdinContent.includes('Make it formal'));
        });

        it('should truncate long before-context', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const longContext = 'x'.repeat(500);
            const service = new ClaudePolishServiceClass();
            const promise = service.polish({
                text: 'test',
                beforeText: longContext,
            });

            proc.stdout.emit('data', Buffer.from('Test.'));
            proc.emit('close', 0);
            await promise;

            const stdinContent = proc.stdin.write.firstCall.args[0] as string;
            // Truncated to 400 chars + ellipsis prefix
            assert.ok(stdinContent.includes('CONTEXT BEFORE:'));
            assert.ok(!stdinContent.includes('x'.repeat(500)), 'should not include full 500-char context');
            assert.ok(stdinContent.includes('…'), 'should include truncation ellipsis');
        });

        it('should omit file/context sections when not provided', async () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            const promise = service.polish({ text: 'just text' });

            proc.stdout.emit('data', Buffer.from('Just text.'));
            proc.emit('close', 0);
            await promise;

            const stdinContent = proc.stdin.write.firstCall.args[0] as string;
            assert.ok(!stdinContent.includes('FILE:'));
            assert.ok(!stdinContent.includes('CONTEXT BEFORE:'));
            assert.ok(!stdinContent.includes('CONTEXT AFTER:'));
            assert.ok(stdinContent.includes('PARAGRAPH TO POLISH:'));
        });
    });

    // ── dispose ───────────────────────────────────────────────────────

    describe('dispose', () => {
        it('should kill running process and clean up', () => {
            const proc = createMockChildProcess();
            mockSpawn.returns(proc);

            const service = new ClaudePolishServiceClass();
            service.polish({ text: 'test' }); // fire and forget

            service.dispose();
            sinon.assert.calledWith(proc.kill, 'SIGTERM');
        });
    });
});
