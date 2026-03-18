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
        it('should register 5 commands', () => {
            ext.activate(mockContext);
            assert.strictEqual(mockVscode.commands.registerCommand.callCount, 5);
        });

        it('should register voiceScribe.startRecording command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.startRecording' in registeredCommands);
        });

        it('should register voiceScribe.stopRecording command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.stopRecording' in registeredCommands);
        });

        it('should register voiceScribe.configureApiKey command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.configureApiKey' in registeredCommands);
        });

        it('should register voiceScribe.selectLanguage command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.selectLanguage' in registeredCommands);
        });

        it('should register voiceScribe.toggleRecording command', () => {
            ext.activate(mockContext);
            assert.ok('voiceScribe.toggleRecording' in registeredCommands);
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
            // statusBarItem + 5 commands + onDidChangeConfiguration = 7
            assert.ok(
                mockContext.subscriptions.length >= 7,
                `Expected >= 7 subscriptions, got ${mockContext.subscriptions.length}`,
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

    // ── startRecording command ──────────────────────────────────────────

    describe('startRecording command', () => {
        it('should show error when services are not initialized', async () => {
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.startRecording']();

            sinon.assert.calledOnce(mockVscode.window.showErrorMessage);
            const msg = mockVscode.window.showErrorMessage.firstCall.args[0];
            assert.ok(msg.includes('not initialized'));
        });

        it('should offer Configure action when not initialized', async () => {
            ext.activate(mockContext);
            mockVscode.window.showErrorMessage.resolves('Configure');
            mockVscode.window.showInputBox.resolves('xi_newkey');

            await registeredCommands['voiceScribe.startRecording']();

            // Should prompt for API key
            sinon.assert.calledOnce(mockVscode.window.showInputBox);
        });

        it('should start transcription and audio capture', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.startRecording']();

            sinon.assert.calledOnce(mockElevenLabsInstance.startTranscription);
            sinon.assert.calledOnce(mockAudioCaptureInstance.startRecording);
        });

        it('should set recording context to true', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.startRecording']();

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

            await registeredCommands['voiceScribe.startRecording']();

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

            await registeredCommands['voiceScribe.startRecording']();
            await registeredCommands['voiceScribe.startRecording']();

            sinon.assert.calledOnce(mockVscode.window.showWarningMessage);
            const msg = mockVscode.window.showWarningMessage.firstCall.args[0];
            assert.ok(msg.includes('Already recording'));
        });

        it('should show error and reset state if startTranscription fails', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            mockElevenLabsInstance.startTranscription.rejects(
                new Error('WS connect failed'),
            );

            ext.activate(mockContext);
            await registeredCommands['voiceScribe.startRecording']();

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
    });

    // ── stopRecording command ───────────────────────────────────────────

    describe('stopRecording command', () => {
        it('should do nothing if not recording', async () => {
            ext.activate(mockContext);
            await registeredCommands['voiceScribe.stopRecording']();
            sinon.assert.notCalled(mockElevenLabsInstance.stopTranscription);
        });

        it('should stop audio capture and transcription', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.startRecording']();
            await registeredCommands['voiceScribe.stopRecording']();

            sinon.assert.calledOnce(mockAudioCaptureInstance.stopRecording);
            sinon.assert.calledOnce(mockElevenLabsInstance.stopTranscription);
        });

        it('should stop audio capture before transcription', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.startRecording']();
            await registeredCommands['voiceScribe.stopRecording']();

            assert.ok(
                mockAudioCaptureInstance.stopRecording.calledBefore(
                    mockElevenLabsInstance.stopTranscription,
                ),
                'Audio capture should stop before transcription',
            );
        });

        it('should set recording context to false', async () => {
            mockVscode._configValues.set('apiKey', 'test-key');
            ext.activate(mockContext);

            await registeredCommands['voiceScribe.startRecording']();
            mockVscode.commands.executeCommand.resetHistory();

            await registeredCommands['voiceScribe.stopRecording']();

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

            await registeredCommands['voiceScribe.startRecording']();
            await registeredCommands['voiceScribe.stopRecording']();

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
});
