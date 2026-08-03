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
    let mockGoogleInstance: any;
    let mockAudioCaptureInstance: any;
    let ext: any;
    let mockContext: any;
    let mockClaudePolishInstance: any;
    let MockElevenLabsService: sinon.SinonStub;
    let MockGoogleSpeechService: sinon.SinonStub;
    let MockAudioCapture: sinon.SinonStub;

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

        mockGoogleInstance = {
            startTranscription: sinon.stub().resolves(),
            stopTranscription: sinon.stub().resolves('final text'),
            sendAudioChunk: sinon.stub(),
            getFullTranscript: sinon.stub().returns(''),
            dispose: sinon.stub(),
        };

        MockElevenLabsService = sinon.stub().returns(mockElevenLabsInstance);
        MockGoogleSpeechService = sinon.stub().returns(mockGoogleInstance);
        MockAudioCapture = sinon.stub().returns(mockAudioCaptureInstance);

        mockClaudePolishInstance = {
            polish: sinon.stub().resolves({ polished: 'Polished text.', durationMs: 42 }),
            cancel: sinon.stub(),
            dispose: sinon.stub(),
        };
        const MockClaudePolishService = sinon.stub().returns(mockClaudePolishInstance);

        // extension.ts talks to providers only through ./providerRegistry, which
        // transitively requires the concrete services + vscode. Mark those stubs
        // @global so proxyquire applies them to the registry's requires too —
        // this exercises the real registry wiring with mocked services.
        mockVscode['@global'] = true;

        ext = proxyquire('../extension', {
            'vscode': mockVscode,
            './elevenLabsService': { ElevenLabsService: MockElevenLabsService, '@global': true },
            './googleSpeechService': { GoogleSpeechService: MockGoogleSpeechService, '@global': true },
            './audioCapture': { AudioCapture: MockAudioCapture },
            './claudePolish': { ClaudePolishService: MockClaudePolishService },
            './claudeKeyterms': {
                generateKeyterms: sinon.stub().resolves({
                    keyterms: ['numpy', 'pandas'],
                    rejected: [],
                    durationMs: 10,
                }),
            },
        });

        mockContext = {
            subscriptions: [] as any[],
        };
    });

    afterEach(() => {
        ext.deactivate();
        sinon.restore();
    });

    // ── activate ───────────────────────────────────────────────────────

    describe('activate', () => {
        it('should register 8 commands', () => {
            ext.activate(mockContext);
            assert.strictEqual(mockVscode.commands.registerCommand.callCount, 8);
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
            assert.ok(msg.includes('not set up'));
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

        it('pastes a recording into a focused prompt input when stopped', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('recordingPrefix', 'user note: ');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('hello from dictation');

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });

            sinon.assert.calledWithExactly(
                mockVscode.env.clipboard.writeText,
                'user note: hello from dictation',
            );
            sinon.assert.calledWith(
                mockVscode.commands.executeCommand,
                'editor.action.clipboardPasteAction',
            );
        });

        it('uses the provider transcript when paste mode receives no callback', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.stopTranscription.resolves('provider fallback');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });

            sinon.assert.calledWithExactly(
                mockVscode.env.clipboard.writeText,
                'provider fallback',
            );
        });

        it('keeps the final partial after earlier paste-mode commits', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.stopTranscription.resolves('committed unfinished thought');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });
            const onPartial = mockElevenLabsInstance.startTranscription.firstCall.args[0];
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('committed');
            onPartial('unfinished thought');
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });

            sinon.assert.calledWithExactly(
                mockVscode.env.clipboard.writeText,
                'committed unfinished thought',
            );
        });

        it('does not paste a spoken stop command into a prompt', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            mockElevenLabsInstance.stopTranscription.resolves('stop');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'paste' });
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('stop');
            await flushEditQueue();

            sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
            sinon.assert.notCalled(mockVscode.env.clipboard.writeText);
        });

        it('keeps editor insertion anchored when focus moves to another editor', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            const { editor: originalEditor, editBuilder } = createMockEditor();
            const { editor: otherEditor } = createMockEditor();
            mockVscode.window.activeTextEditor = originalEditor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            mockVscode.window.activeTextEditor = otherEditor;
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('stay in the original editor');
            await flushEditQueue();

            sinon.assert.calledOnce(originalEditor.edit);
            sinon.assert.calledWith(
                editBuilder.insert,
                originalEditor.selection.active,
                'stay in the original editor ',
            );
            sinon.assert.notCalled(otherEditor.edit);
        });

        it('drains queued transcript edits before stop resolves', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            const { editor, editBuilder } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('queued text');
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });

            sinon.assert.calledWith(
                editBuilder.insert,
                editor.selection.active,
                'queued text ',
            );
        });

        it('commits the latest partial when stop receives no final result', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.stopTranscription.resolves('');
            const { editor, editBuilder } = createMockEditor();
            mockVscode.window.activeTextEditor = editor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            const onPartial = mockElevenLabsInstance.startTranscription.firstCall.args[0];
            onPartial('unfinished thought');
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });

            assert.strictEqual(editBuilder.replace.lastCall.args[1], 'unfinished thought ');
        });

        it('copies the recording when VS Code rejects the editor edit', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.stopTranscription.resolves('safe fallback');
            const { editor } = createMockEditor();
            editor.edit.resolves(false);
            mockVscode.window.activeTextEditor = editor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('safe fallback');
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });

            sinon.assert.calledWithExactly(mockVscode.env.clipboard.writeText, 'safe fallback');
            sinon.assert.calledWith(
                mockVscode.window.showWarningMessage,
                'Voice Scribe could not insert the recording, so it was copied to the clipboard.',
            );
        });

        it('copies the latest partial when its stop-time commit is rejected', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.stopTranscription.resolves('');
            const { editor, editBuilder } = createMockEditor();
            editor.edit.onSecondCall().callsFake((cb: any) => {
                cb(editBuilder);
                return Promise.resolve(false);
            });
            mockVscode.window.activeTextEditor = editor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            const onPartial = mockElevenLabsInstance.startTranscription.firstCall.args[0];
            onPartial('recover this partial');
            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });

            sinon.assert.calledWithExactly(
                mockVscode.env.clipboard.writeText,
                'recover this partial',
            );
        });

        it('replaces the starting selection with prefix and transcript', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('recordingPrefix', 'note: ');
            const { editor, editBuilder } = createMockEditor();
            const selection = {
                active: { line: 0, character: 5 },
                isEmpty: false,
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 },
            };
            editor.selection = selection;
            mockVscode.window.activeTextEditor = editor;
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']({ target: 'editor' });
            const onFinal = mockElevenLabsInstance.startTranscription.firstCall.args[1];
            onFinal('replacement');
            await flushEditQueue();

            sinon.assert.calledWith(editBuilder.replace, selection, 'note: ');
            const transcriptInsert = editBuilder.insert.args.find(
                (args: any[]) => args[1] === 'replacement ',
            );
            assert.ok(transcriptInsert, 'expected the transcript after the replacement prefix');
            assert.strictEqual(transcriptInsert[0].character, 6);
        });

        it('coalesces concurrent stop requests without restarting', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            let releaseAudioStop: (() => void) | undefined;
            mockAudioCaptureInstance.stopRecording.callsFake(
                () => new Promise<void>(resolve => { releaseAudioStop = resolve; }),
            );
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.toggleRecording']();
            const firstStop = registeredCommands['voiceScribe.toggleRecording']();
            const secondStop = registeredCommands['voiceScribe.toggleRecording']();
            for (let attempt = 0; attempt < 10 && !releaseAudioStop; attempt++) {
                await Promise.resolve();
            }
            assert.ok(releaseAudioStop, 'expected the first stop operation to begin');
            releaseAudioStop();
            await Promise.all([firstStop, secondStop]);

            sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
            sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
            sinon.assert.calledOnce(mockElevenLabsInstance.startTranscription);
        });

        it('stops and disposes the active session before switching models', async () => {
            mockVscode._configValues.set('provider', 'google');
            const nextGoogleInstance = {
                startTranscription: sinon.stub().resolves(),
                stopTranscription: sinon.stub().resolves(''),
                sendAudioChunk: sinon.stub(),
                getFullTranscript: sinon.stub().returns(''),
                dispose: sinon.stub(),
            };
            const nextAudioCaptureInstance = {
                initialize: sinon.stub().resolves(),
                startRecording: sinon.stub().resolves(),
                stopRecording: sinon.stub().resolves(),
                getIsRecording: sinon.stub().returns(false),
                dispose: sinon.stub(),
            };
            MockGoogleSpeechService.onSecondCall().returns(nextGoogleInstance);
            MockAudioCapture.onSecondCall().returns(nextAudioCaptureInstance);

            ext.activate(mockContext);
            await registeredCommands['voiceScribe.toggleRecording']();

            const configurationHandler =
                mockVscode.workspace.onDidChangeConfiguration.firstCall.args[0];
            await configurationHandler({
                affectsConfiguration: (key: string) => key === 'voiceScribe.googleModel',
            });

            sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
            sinon.assert.calledOnce(mockGoogleInstance.stopTranscription);
            sinon.assert.calledOnce(mockAudioCaptureInstance.dispose);
            sinon.assert.calledOnce(mockGoogleInstance.dispose);
            assert.strictEqual(mockVscode._statusBarItem.text, '$(mic) Voice Scribe');

            await registeredCommands['voiceScribe.toggleRecording']();
            sinon.assert.calledOnce(nextGoogleInstance.startTranscription);
            sinon.assert.calledOnce(nextAudioCaptureInstance.startRecording);
        });

        it('binds each audio capture callback to the provider created with it', async () => {
            mockVscode._configValues.set('provider', 'google');
            const nextGoogleInstance = {
                startTranscription: sinon.stub().resolves(),
                stopTranscription: sinon.stub().resolves(''),
                sendAudioChunk: sinon.stub(),
                getFullTranscript: sinon.stub().returns(''),
                dispose: sinon.stub(),
            };
            const nextAudioCaptureInstance = {
                initialize: sinon.stub().resolves(),
                startRecording: sinon.stub().resolves(),
                stopRecording: sinon.stub().resolves(),
                getIsRecording: sinon.stub().returns(false),
                dispose: sinon.stub(),
            };
            MockGoogleSpeechService.onSecondCall().returns(nextGoogleInstance);
            MockAudioCapture.onSecondCall().returns(nextAudioCaptureInstance);

            ext.activate(mockContext);
            await registeredCommands['voiceScribe.toggleRecording']();
            await registeredCommands['voiceScribe.toggleRecording']();
            const oldAudioCallback = mockAudioCaptureInstance.initialize.firstCall.args[0];

            const configurationHandler =
                mockVscode.workspace.onDidChangeConfiguration.firstCall.args[0];
            await configurationHandler({
                affectsConfiguration: (key: string) => key === 'voiceScribe.googleModel',
            });
            const nextAudioCallback = nextAudioCaptureInstance.initialize.firstCall.args[0];

            const oldChunk = Buffer.from([1]);
            const nextChunk = Buffer.from([2]);
            oldAudioCallback(oldChunk);
            nextAudioCallback(nextChunk);

            sinon.assert.calledWithExactly(mockGoogleInstance.sendAudioChunk, oldChunk);
            sinon.assert.calledWithExactly(nextGoogleInstance.sendAudioChunk, nextChunk);
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
                '✅ ElevenLabs API key saved',
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
    function createMockEditor(languageId = 'plaintext', opts?: { content?: string }) {
        const content = opts?.content ?? '';
        const editBuilder: any = {
            insert: sinon.stub(),
            replace: sinon.stub(),
        };
        const docUri = { fsPath: '/test/file.txt', toString: () => 'file:///test/file.txt' };
        const lineAt = sinon.stub().callsFake((n: number) => ({
            range: { start: { line: n, character: 0 }, end: { line: n, character: 80 } },
        }));
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
                positionAt: sinon.stub().callsFake((offset: number) => ({
                    line: 0, character: offset,
                    isBefore: (other: any) => offset < (other?.character ?? 0),
                    isAfter: (other: any) => offset > (other?.character ?? 0),
                })),
                offsetAt: sinon.stub().callsFake((pos: any) => pos?.character ?? 0),
                languageId,
                uri: docUri,
                getText: sinon.stub().callsFake((_range?: any) => content),
                lineCount: content.split('\n').length,
                lineAt,
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
            mockVscode._configValues.set('enableVoiceCommands', false);
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
        it('should run addCommentLine command when insertMode is comment', async () => {
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
                (a: any[]) => a[0] === 'editor.action.addCommentLine',
            );
            assert.strictEqual(commentCalls.length, 1,
                'should call editor.action.addCommentLine in comment mode');
        });

        it('should not comment in plain mode (default)', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('insertMode', 'plain');
            ext.activate(mockContext);

            const { editor } = createMockEditor('typescript');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            mockVscode.commands.executeCommand.resetHistory();
            onFinal('some text');
            await flushEditQueue();

            const execCalls = mockVscode.commands.executeCommand.args;
            const commentCalls = execCalls.filter(
                (a: any[]) => a[0] === 'editor.action.addCommentLine',
            );
            assert.strictEqual(commentCalls.length, 0,
                'should not call editor.action.addCommentLine in plain mode');
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
                (a: any[]) => a[0] === 'editor.action.addCommentLine',
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
                (a: any[]) => a[0] === 'editor.action.addCommentLine',
            );
            assert.strictEqual(commentCalls.length, 1,
                'should call editor.action.addCommentLine for code files in smart mode');
        });
    });

    // ── polish voice triggers ─────────────────────────────────────────

    describe('polish voice triggers', () => {
        it('should register voiceScribe.polishLast command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.polishLast' in registeredCommands,
                'polishLast command should be registered');
        });

        it('"polish that" should invoke polishLast, not insert the phrase', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor('markdown', { content: 'hello world ' });
            mockVscode.window.activeTextEditor = editor;
            mockVscode.window.visibleTextEditors = [editor];
            mockVscode.workspace.textDocuments = [editor.document];

            const { onFinal } = await startRecordingAndCapture();

            // First commit some text to build a paragraph range
            onFinal('hello world');
            await flushEditQueue();

            // Reset stubs, then say "polish that"
            editBuilder.insert.resetHistory();
            editBuilder.replace.resetHistory();
            onFinal('polish that');
            await flushEditQueue();

            // editBuilder should NOT have received "polish that " as inserted text
            const allTexts = [
                ...editBuilder.insert.args.map((a: any[]) => a[a.length - 1]),
                ...editBuilder.replace.args.map((a: any[]) => a[a.length - 1]),
            ];
            for (const t of allTexts) {
                assert.ok(
                    !String(t).toLowerCase().includes('polish that'),
                    `"polish that" should not be inserted as text, got: ${t}`,
                );
            }
        });

        it('"rewrite that" should not insert the phrase as text', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor('markdown', { content: 'some text ' });
            mockVscode.window.activeTextEditor = editor;
            mockVscode.window.visibleTextEditors = [editor];
            mockVscode.workspace.textDocuments = [editor.document];

            const { onFinal } = await startRecordingAndCapture();

            onFinal('some text');
            await flushEditQueue();
            editBuilder.insert.resetHistory();
            editBuilder.replace.resetHistory();

            onFinal('rewrite that');
            await flushEditQueue();

            const allTexts = [
                ...editBuilder.insert.args.map((a: any[]) => a[a.length - 1]),
                ...editBuilder.replace.args.map((a: any[]) => a[a.length - 1]),
            ];
            for (const t of allTexts) {
                assert.ok(
                    !String(t).toLowerCase().includes('rewrite that'),
                    `"rewrite that" should not be inserted as text, got: ${t}`,
                );
            }
        });

        it('"clean it up" should not insert the phrase as text', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor('markdown', { content: 'some text ' });
            mockVscode.window.activeTextEditor = editor;
            mockVscode.window.visibleTextEditors = [editor];
            mockVscode.workspace.textDocuments = [editor.document];

            const { onFinal } = await startRecordingAndCapture();

            onFinal('some text');
            await flushEditQueue();
            editBuilder.insert.resetHistory();
            editBuilder.replace.resetHistory();

            onFinal('clean it up');
            await flushEditQueue();

            const allTexts = [
                ...editBuilder.insert.args.map((a: any[]) => a[a.length - 1]),
                ...editBuilder.replace.args.map((a: any[]) => a[a.length - 1]),
            ];
            for (const t of allTexts) {
                assert.ok(
                    !String(t).toLowerCase().includes('clean it up'),
                    `"clean it up" should not be inserted as text, got: ${t}`,
                );
            }
        });

        it('should strip trailing punctuation from trigger phrases', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', true);
            ext.activate(mockContext);

            const { editor, editBuilder } = createMockEditor('markdown', { content: 'text ' });
            mockVscode.window.activeTextEditor = editor;
            mockVscode.window.visibleTextEditors = [editor];
            mockVscode.workspace.textDocuments = [editor.document];

            const { onFinal } = await startRecordingAndCapture();

            onFinal('some text');
            await flushEditQueue();
            editBuilder.insert.resetHistory();
            editBuilder.replace.resetHistory();

            // Scribe might transcribe with trailing period
            onFinal('Polish that.');
            await flushEditQueue();

            // Should still trigger polish, not insert "Polish that."
            const allTexts = [
                ...editBuilder.insert.args.map((a: any[]) => a[a.length - 1]),
                ...editBuilder.replace.args.map((a: any[]) => a[a.length - 1]),
            ];
            for (const t of allTexts) {
                assert.ok(
                    !String(t).toLowerCase().includes('polish that'),
                    `"Polish that." should trigger polish, not insert text, got: ${t}`,
                );
            }
        });

        it('should not trigger polish when voice commands disabled', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockVscode._configValues.set('enableVoiceCommands', false);
            ext.activate(mockContext);

            const { editor } = createMockEditor('markdown');
            mockVscode.window.activeTextEditor = editor;

            const { onFinal } = await startRecordingAndCapture();
            editor.edit.resetHistory();

            // "polish that" should be inserted as regular text
            onFinal('polish that');
            await flushEditQueue();

            sinon.assert.called(editor.edit);
        });
    });

    // ── polishLast command ────────────────────────────────────────────

    describe('polishLast command', () => {
        it('should show info message when nothing to polish', async () => {
            ext.activate(mockContext);
            mockVscode.window.showInformationMessage.resetHistory();

            await registeredCommands['voiceScribe.polishLast']();
            await flushEditQueue();

            sinon.assert.calledWith(
                mockVscode.window.showInformationMessage,
                'Voice Scribe: nothing to polish yet',
            );
        });
    });

    // ── provider selection ────────────────────────────────────────────

    describe('provider selection', () => {
        it('uses ElevenLabs by default (with an API key)', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.toggleRecording']();
            sinon.assert.calledOnce(mockElevenLabsInstance.startTranscription);
            sinon.assert.notCalled(mockGoogleInstance.startTranscription);
        });

        it('uses Google (no API key required) when provider=google', async () => {
            mockVscode._configValues.set('provider', 'google');
            ext.activate(mockContext);   // note: no apiKey set
            await registeredCommands['voiceScribe.toggleRecording']();
            sinon.assert.calledOnce(mockGoogleInstance.startTranscription);
            sinon.assert.notCalled(mockElevenLabsInstance.startTranscription);
            sinon.assert.calledOnce(mockAudioCaptureInstance.startRecording);
        });

        it('selectProvider writes the chosen provider to settings', async () => {
            ext.activate(mockContext);
            mockVscode.window.showQuickPick = sinon.stub().resolves({ value: 'google' });
            await registeredCommands['voiceScribe.selectProvider']();
            sinon.assert.calledWith(
                mockVscode._config.update,
                'provider',
                'google',
                mockVscode.ConfigurationTarget.Global,
            );
        });

        it('configureApiKey is a no-op prompt under the Google provider', async () => {
            mockVscode._configValues.set('provider', 'google');
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.configureApiKey']();
            sinon.assert.notCalled(mockVscode.window.showInputBox);
        });
    });
});
