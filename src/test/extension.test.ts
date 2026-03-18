/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-var-requires */
import * as sinon from 'sinon';
import * as assert from 'assert';
import { createMockVscode } from './helpers';

const proxyquire = require('proxyquire').noCallThru();

describe('Extension', () => {
    let mockVscode: any;
    let registeredCommands: Record<string, (...args: any[]) => any>;
    let mockElevenLabsInstance: any;
    let mockAudioCaptureInstance: any;
    let ext: any;
    let mockContext: any;

    beforeEach(() => {
        mockVscode = createMockVscode();
        registeredCommands = {};

        // Capture registered command handlers
        mockVscode.commands.registerCommand.callsFake(
            (id: string, handler: (...args: any[]) => any) => {
                registeredCommands[id] = handler;
                return { dispose: sinon.stub() };
            },
        );

        // Mock service instances
        mockElevenLabsInstance = {
            startTranscription: sinon.stub().resolves(),
            stopTranscription: sinon.stub().resolves('final text'),
            sendAudioChunk: sinon.stub(),
            getFullTranscript: sinon.stub().returns(''),
            dispose: sinon.stub(),
        };

        mockAudioCaptureInstance = {
            initialize: sinon.stub().resolves(),
            startRecording: sinon.stub().resolves(),
            stopRecording: sinon.stub().resolves(),
            getIsRecording: sinon.stub().returns(false),
            dispose: sinon.stub(),
        };

        const MockElevenLabsService = sinon.stub().returns(mockElevenLabsInstance);
        const MockAudioCapture = sinon.stub().returns(mockAudioCaptureInstance);

        ext = proxyquire('../extension', {
            'vscode': mockVscode,
            './elevenLabsService': { ElevenLabsService: MockElevenLabsService },
            './audioCapture': { AudioCapture: MockAudioCapture },
        });

        mockContext = {
            subscriptions: [] as any[],
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    // ── activate ───────────────────────────────────────────────────────

    describe('activate', () => {
        it('should register 3 commands', () => {
            ext.activate(mockContext);
            assert.strictEqual(mockVscode.commands.registerCommand.callCount, 3);
        });

        it('should register voiceScribe.toggleRecording command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.toggleRecording' in registeredCommands);
        });

        it('should register voiceScribe.configureApiKey command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.configureApiKey' in registeredCommands);
        });

        it('should register voiceScribe.selectLanguage command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.selectLanguage' in registeredCommands);
        });

        it('should create status bar item (right-aligned, priority 100)', () => {
            ext.activate(mockContext);
            sinon.assert.calledOnce(mockVscode.window.createStatusBarItem);
            sinon.assert.calledWith(
                mockVscode.window.createStatusBarItem,
                mockVscode.StatusBarAlignment.Right,
                100,
            );
        });

        it('should show status bar in idle state', () => {
            ext.activate(mockContext);
            sinon.assert.calledOnce(mockVscode._statusBarItem.show);
            assert.strictEqual(
                mockVscode._statusBarItem.text,
                '$(mic) Voice Scribe',
            );
            assert.strictEqual(
                mockVscode._statusBarItem.command,
                'voiceScribe.toggleRecording',
            );
        });

        it('should push disposables to context.subscriptions', () => {
            ext.activate(mockContext);
            // statusBarItem + 3 commands + onDidChangeConfiguration = 5
            assert.ok(
                mockContext.subscriptions.length >= 5,
                `Expected >= 5 subscriptions, got ${mockContext.subscriptions.length}`,
            );
        });

        it('should listen for configuration changes', () => {
            ext.activate(mockContext);
            sinon.assert.calledOnce(mockVscode.workspace.onDidChangeConfiguration);
        });
    });

    // ── deactivate ─────────────────────────────────────────────────────

    describe('deactivate', () => {
        it('should dispose status bar item', () => {
            ext.activate(mockContext);
            ext.deactivate();
            sinon.assert.calledOnce(mockVscode._statusBarItem.dispose);
        });

        it('should clear recording context', () => {
            ext.activate(mockContext);
            ext.deactivate();
            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'setContext',
                'voiceScribe.recording',
                false,
            );
        });

        it('should dispose ElevenLabs service when initialized', () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);
            ext.deactivate();
            sinon.assert.calledOnce(mockElevenLabsInstance.dispose);
        });

        it('should dispose AudioCapture when initialized', () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);
            ext.deactivate();
            sinon.assert.calledOnce(mockAudioCaptureInstance.dispose);
        });

        it('should not throw when services are not initialized', () => {
            ext.activate(mockContext); // No API key → no services
            ext.deactivate(); // Should not throw
        });
    });

    // ── toggleRecording command ──────────────────────────────────────────

    describe('toggleRecording command', () => {
        it('should show error when services are not initialized', async () => {
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledOnce(mockVscode.window.showErrorMessage);
            const msg = mockVscode.window.showErrorMessage.firstCall.args[0];
            assert.ok(msg.includes('not initialized'));
        });

        it('should offer Configure action when not initialized', async () => {
            ext.activate(mockContext);
            mockVscode.window.showErrorMessage.resolves('Configure');
            mockVscode.window.showInputBox.resolves('xi_newkey');

            await registeredCommands['voiceScribe.toggleRecording']();

            // Should prompt for API key
            sinon.assert.calledOnce(mockVscode.window.showInputBox);
        });

        it('should start transcription and audio capture', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledOnce(mockElevenLabsInstance.startTranscription);
            sinon.assert.calledOnce(mockAudioCaptureInstance.startRecording);
        });

        it('should set recording context to true', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'setContext',
                'voiceScribe.recording',
                true,
            );
        });

        it('should update status bar to recording state', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();

            assert.strictEqual(
                mockVscode._statusBarItem.text,
                '$(mic) Recording...',
            );
            assert.strictEqual(
                mockVscode._statusBarItem.command,
                'voiceScribe.toggleRecording',
            );
        });

        it('should show warning if already recording', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
            sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
        });

        it('should show error and reset state if startTranscription fails', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.startTranscription.rejects(
                new Error('WS connect failed'),
            );

            ext.activate(mockContext);
            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledOnce(mockVscode.window.showErrorMessage);
            const msg = mockVscode.window.showErrorMessage.firstCall.args[0];
            assert.ok(msg.includes('Failed to start recording'));

            // Recording context should be cleared
            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'setContext',
                'voiceScribe.recording',
                false,
            );
        });

        it('should stop audio capture and transcription when toggled off', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
            sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
        });

        it('should stop audio capture before transcription', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            await registeredCommands['voiceScribe.toggleRecording']();

            assert.ok(
                mockAudioCaptureInstance.stopRecording.calledBefore(
                    mockElevenLabsInstance.stopTranscription,
                ),
                'Audio capture should stop before transcription',
            );
        });

        it('should set recording context to false after stop', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            mockVscode.commands.executeCommand.resetHistory();

            await registeredCommands['voiceScribe.toggleRecording']();

            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'setContext',
                'voiceScribe.recording',
                false,
            );
        });

        it('should update status bar to idle state after stopping', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            await registeredCommands['voiceScribe.toggleRecording']();

            assert.strictEqual(
                mockVscode._statusBarItem.text,
                '$(mic) Voice Scribe',
            );
        });
    });

    // ── configureApiKey command ─────────────────────────────────────────

    describe('configureApiKey command', () => {
        it('should prompt user for API key', async () => {
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.configureApiKey']();

            sinon.assert.calledOnce(mockVscode.window.showInputBox);
            const opts = mockVscode.window.showInputBox.firstCall.args[0];
            assert.strictEqual(opts.password, true);
        });

        it('should save API key to global config', async () => {
            mockVscode.window.showInputBox.resolves('xi_my_key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.configureApiKey']();

            sinon.assert.calledWith(
                mockVscode._config.update,
                'apiKey',
                'xi_my_key',
                mockVscode.ConfigurationTarget.Global,
            );
        });

        it('should show confirmation after saving', async () => {
            mockVscode.window.showInputBox.resolves('xi_my_key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.configureApiKey']();

            sinon.assert.calledWith(
                mockVscode.window.showInformationMessage,
                '✅ API key saved',
            );
        });

        it('should not save when user cancels input', async () => {
            mockVscode.window.showInputBox.resolves(undefined);
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.configureApiKey']();

            sinon.assert.notCalled(mockVscode._config.update);
            sinon.assert.notCalled(mockVscode.window.showInformationMessage);
        });
    });

    // ── idle auto-stop ──────────────────────────────────────────────────

    describe('idle auto-stop', () => {
        it('should auto-stop after 2 minutes of silence', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            const clock = sinon.useFakeTimers();
            try {
                await registeredCommands['voiceScribe.toggleRecording']();

                // Advance past 120s — the idle check fires every 10s
                clock.tick(130_000);

                // Let the floating async stopRecording() promise settle
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();

                sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
                sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
                sinon.assert.calledWith(
                    mockVscode.window.showInformationMessage,
                    'Voice Scribe: auto-stopped after 2 minutes of silence.',
                );
            } finally {
                clock.restore();
            }
        });

        it('should reset timer on transcript activity', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            const clock = sinon.useFakeTimers();
            try {
                await registeredCommands['voiceScribe.toggleRecording']();

                // Capture the onPartial callback passed to startTranscription
                const onPartial = mockElevenLabsInstance.startTranscription.firstCall.args[0];

                // Advance to 110s — not yet 120s, no auto-stop
                clock.tick(110_000);
                await Promise.resolve();
                sinon.assert.notCalled(mockAudioCaptureInstance.stopRecording);

                // Simulate transcript activity — resets the idle timer
                onPartial('some words');

                // Advance another 110s (total 220s from start, but only 110s since reset)
                clock.tick(110_000);
                await Promise.resolve();
                sinon.assert.notCalled(mockAudioCaptureInstance.stopRecording);

                // Advance 20s more (130s since reset) — now auto-stop should fire
                clock.tick(20_000);
                await Promise.resolve();
                await Promise.resolve();
                await Promise.resolve();

                sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
                sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
            } finally {
                clock.restore();
            }
        });

        it('should clear timer on manual stop', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            const clock = sinon.useFakeTimers();
            try {
                // Start recording
                await registeredCommands['voiceScribe.toggleRecording']();

                // Advance a bit, then stop manually (second toggle)
                clock.tick(10_000);
                await registeredCommands['voiceScribe.toggleRecording']();

                // Reset history so we can assert no FURTHER calls
                mockAudioCaptureInstance.stopRecording.resetHistory();
                mockElevenLabsInstance.stopTranscription.resetHistory();
                mockVscode.window.showInformationMessage.resetHistory();

                // Advance well past 120s — auto-stop should NOT fire
                clock.tick(200_000);
                await Promise.resolve();
                await Promise.resolve();

                sinon.assert.notCalled(mockAudioCaptureInstance.stopRecording);
                sinon.assert.notCalled(mockElevenLabsInstance.stopTranscription);

                // Verify no auto-stop message
                const infoMessages = mockVscode.window.showInformationMessage.args.map(
                    (a: any[]) => a[0],
                );
                assert.ok(
                    !infoMessages.some((m: string) => m.includes('auto-stopped')),
                    'Should not show auto-stop message after manual stop',
                );
            } finally {
                clock.restore();
            }
        });
    });

    // ── Helper: create mock editor ──────────────────────────────────────
    function createMockEditor(languageId = 'plaintext') {
        const editBuilder: any = {
            insert: sinon.stub(),
            replace: sinon.stub(),
        };
        const editor: any = {
            edit: sinon.stub().callsFake((cb: any) => {
                cb(editBuilder);
                return Promise.resolve(true);
            }),
            selection: {
                active: { line: 0, character: 0 },
                isEmpty: true,
                start: { line: 0, character: 0 },
            },
            setDecorations: sinon.stub(),
            document: {
                positionAt: sinon.stub().returns({ line: 0, character: 0 }),
                offsetAt: sinon.stub().returns(0),
                languageId,
            },
        };
        return { editor, editBuilder };
    }

    /**
     * Start recording and capture onPartial / onFinal callbacks.
     * Requires mockVscode._configValues.set('apiKey', 'test-key') before calling.
     */
    async function startRecordingAndCapture() {
        await registeredCommands['voiceScribe.toggleRecording']();
        const onPartial = mockElevenLabsInstance.startTranscription.firstCall.args[0];
        const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
        return { onPartial, onFinal };
    }

    /** Let the editQueue promise chain settle. */
    async function flushEditQueue() {
        // Multiple awaits to let chained promises resolve
        for (let i = 0; i < 10; i++) {
            await Promise.resolve();
        }
        // One more via setTimeout to catch any enqueued microtasks
        await new Promise(r => setTimeout(r, 50));
    }

    // ── filler word removal ─────────────────────────────────────────────

    describe('filler word removal', () => {
        it('should strip filler words from committed text', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            // removeFiller defaults to true
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            onFinal('um hello uh world');
            await flushEditQueue();

            sinon.assert.called(editor.edit);
            // The editBuilder should have been called with text
            // that does not contain filler words
            const insertCalls = editBuilder.insert.args;
            const replaceCalls = editBuilder.replace.args;
            const allTexts = [
                ...insertCalls.map((a: any[]) => a[a.length - 1]),
                ...replaceCalls.map((a: any[]) => a[a.length - 1]),
            ];
            assert.ok(allTexts.length > 0, 'expected at least one insert/replace call');
            for (const text of allTexts) {
                assert.ok(!/\bum\b/i.test(text), `text should not contain "um": ${text}`);
                assert.ok(!/\buh\b/i.test(text), `text should not contain "uh": ${text}`);
            }
        });

        it('should skip edit when filler removal produces empty text', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            const { editor } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            onFinal('um uh');
            await flushEditQueue();

            // When filler removal produces empty text, handleCommitted returns early
            // The edit call that happens is from the enqueueEdit wrapper, but
            // the actual editor.edit for insertion should NOT be called
            // since processedText is empty after removeFiller
            sinon.assert.notCalled(editor.edit);
        });

        it('should not strip filler when removeFiller is false', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('removeFiller', false);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            onFinal('um hello');
            await flushEditQueue();

            sinon.assert.called(editor.edit);
            const insertCalls = editBuilder.insert.args;
            const replaceCalls = editBuilder.replace.args;
            const allTexts = [
                ...insertCalls.map((a: any[]) => a[a.length - 1]),
                ...replaceCalls.map((a: any[]) => a[a.length - 1]),
            ];
            assert.ok(allTexts.length > 0, 'expected at least one insert/replace call');
            // Text should still contain "um" since filler removal is disabled
            const combined = allTexts.join(' ');
            assert.ok(combined.includes('um'), `text should contain "um": ${combined}`);
        });
    });

    // ── voice commands ──────────────────────────────────────────────────

    describe('voice commands', () => {
        it('should execute voice command instead of inserting text', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('undo');
            await flushEditQueue();

            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'undo',
            );
            // editor.edit should NOT be called for an insert/replace
            sinon.assert.notCalled(editor.edit);
        });

        it('should transform prefix command to annotation', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            onFinal('todo fix the bug');
            await flushEditQueue();

            sinon.assert.called(editor.edit);
            const insertCalls = editBuilder.insert.args;
            const replaceCalls = editBuilder.replace.args;
            const allTexts = [
                ...insertCalls.map((a: any[]) => a[a.length - 1]),
                ...replaceCalls.map((a: any[]) => a[a.length - 1]),
            ];
            const combined = allTexts.join(' ');
            assert.ok(combined.startsWith('TODO: '),
                `expected text to start with "TODO: ", got: ${combined}`);
        });

        it('should not check voice commands when disabled', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            // enableVoiceCommands defaults to false
            ext.activate(mockContext);

            const { editor } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('undo');
            await flushEditQueue();

            // "undo" should be inserted as regular text, not executed as command
            sinon.assert.called(editor.edit);
            // commands.executeCommand should NOT have been called with 'undo'
            const execCalls = mockVscode.commands.executeCommand.args;
            const undoCalls = execCalls.filter((a: any[]) => a[0] === 'undo');
            assert.strictEqual(undoCalls.length, 0,
                'should not execute "undo" command when voice commands are disabled');
        });
    });

    // ── dictate-to-terminal ─────────────────────────────────────────────

    describe('dictate-to-terminal', () => {
        it('should send committed text to terminal when target is terminal', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('target', 'terminal');
            ext.activate(mockContext);

            const { editor } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('hello world');
            await flushEditQueue();

            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'workbench.action.terminal.sendSequence',
                { text: 'hello world\n' },
            );
            // Editor edit should NOT be called for text insertion
            sinon.assert.notCalled(editor.edit);
        });

        it('should not send to terminal when target is editor (default)', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            // target defaults to 'editor'
            ext.activate(mockContext);

            const { editor } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('hello world');
            await flushEditQueue();

            // Should NOT call terminal sendSequence
            const execCalls = mockVscode.commands.executeCommand.args;
            const terminalCalls = execCalls.filter(
                (a: any[]) => a[0] === 'workbench.action.terminal.sendSequence',
            );
            assert.strictEqual(terminalCalls.length, 0,
                'should not send to terminal when target is editor');
            // Should insert into editor
            sinon.assert.called(editor.edit);
        });
    });

    // ── auto-comment mode ───────────────────────────────────────────────

    describe('auto-comment mode', () => {
        it('should run commentLine command when insertMode is comment', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('insertMode', 'comment');
            ext.activate(mockContext);

            const { editor } = createMockEditor('typescript');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('some text');
            await flushEditQueue();

            const execCalls = mockVscode.commands.executeCommand.args;
            const commentCalls = execCalls.filter(
                (a: any[]) => a[0] === 'editor.action.commentLine',
            );
            assert.strictEqual(commentCalls.length, 1,
                'should call editor.action.commentLine in comment mode');
        });

        it('should not comment in plain mode (default)', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            // insertMode defaults to 'plain'
            ext.activate(mockContext);

            const { editor } = createMockEditor('typescript');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('some text');
            await flushEditQueue();

            const execCalls = mockVscode.commands.executeCommand.args;
            const commentCalls = execCalls.filter(
                (a: any[]) => a[0] === 'editor.action.commentLine',
            );
            assert.strictEqual(commentCalls.length, 0,
                'should not call editor.action.commentLine in plain mode');
        });

        it('should not comment prose files in smart mode', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('insertMode', 'smart');
            ext.activate(mockContext);

            const { editor } = createMockEditor('markdown');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('some text');
            await flushEditQueue();

            const execCalls = mockVscode.commands.executeCommand.args;
            const commentCalls = execCalls.filter(
                (a: any[]) => a[0] === 'editor.action.commentLine',
            );
            assert.strictEqual(commentCalls.length, 0,
                'should not comment markdown files in smart mode');
        });

        it('should comment code files in smart mode', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('insertMode', 'smart');
            ext.activate(mockContext);

            const { editor } = createMockEditor('typescript');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('some text');
            await flushEditQueue();

            const execCalls = mockVscode.commands.executeCommand.args;
            const commentCalls = execCalls.filter(
                (a: any[]) => a[0] === 'editor.action.commentLine',
            );
            assert.strictEqual(commentCalls.length, 1,
                'should call editor.action.commentLine for code files in smart mode');
        });
    });
});
