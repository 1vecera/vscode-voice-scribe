/* eslint-disable @typescript-eslint/no-explicit-any */
import * as sinon from 'sinon';
import { EventEmitter } from 'events';

/**
 * Creates a comprehensive mock of the vscode module.
 * Returns the mock plus internal references for test assertions.
 */
export function createMockVscode() {
    const statusBarItem: any = {
        text: '',
        tooltip: '',
        backgroundColor: undefined as any,
        command: undefined as string | undefined,
        show: sinon.stub(),
        hide: sinon.stub(),
        dispose: sinon.stub(),
    };

    const outputChannel: any = {
        appendLine: sinon.stub(),
        show: sinon.stub(),
        dispose: sinon.stub(),
    };

    const configValues = new Map<string, any>();
    const config: any = {
        get: sinon.stub().callsFake((key: string, defaultValue?: any) => {
            return configValues.has(key) ? configValues.get(key) : defaultValue;
        }),
        update: sinon.stub().resolves(),
        has: sinon.stub().callsFake((key: string) => configValues.has(key)),
        inspect: sinon.stub().returns(undefined),
    };

    const vscode: any = {
        window: {
            createStatusBarItem: sinon.stub().returns(statusBarItem),
            createOutputChannel: sinon.stub().returns(outputChannel),
            createTextEditorDecorationType: sinon.stub().returns({
                dispose: sinon.stub(),
                key: 'mockDecorationType',
            }),
            showInputBox: sinon.stub().resolves(undefined),
            showWarningMessage: sinon.stub().resolves(undefined),
            showErrorMessage: sinon.stub().resolves(undefined),
            showInformationMessage: sinon.stub().resolves(undefined),
            activeTextEditor: undefined as any,
            visibleTextEditors: [] as any[],
            onDidChangeTextEditorSelection: sinon.stub().returns({ dispose: sinon.stub() }),
            withProgress: sinon.stub().callsFake((_opts: any, task: any) => task({ report: () => {} }, { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) })),
            setStatusBarMessage: sinon.stub().returns({ dispose: sinon.stub() }),
        },
        workspace: {
            getConfiguration: sinon.stub().returns(config),
            onDidChangeConfiguration: sinon.stub().returns({ dispose: sinon.stub() }),
        },
        commands: {
            registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
            executeCommand: sinon.stub().resolves(),
        },
        StatusBarAlignment: { Left: 1, Right: 2 },
        ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
        ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
        TextEditorSelectionChangeKind: { Keyboard: 1, Mouse: 2, Command: 3 },
        Uri: { file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }) },
        ThemeColor: class ThemeColor {
            id: string;
            constructor(id: string) { this.id = id; }
        },
        Position: class Position {
            line: number;
            character: number;
            constructor(line: number, character: number) {
                this.line = line;
                this.character = character;
            }
        },
        Range: class Range {
            start: any;
            end: any;
            constructor(start: any, end: any) {
                this.start = start;
                this.end = end;
            }
        },
        Selection: class Selection {
            anchor: any;
            active: any;
            start: any;
            end: any;
            isEmpty: boolean;
            constructor(anchorOrStart: any, activeOrEnd: any) {
                this.anchor = anchorOrStart;
                this.active = activeOrEnd;
                this.start = anchorOrStart;
                this.end = activeOrEnd;
                this.isEmpty = anchorOrStart === activeOrEnd;
            }
        },
        // Internal references for test assertions
        _statusBarItem: statusBarItem,
        _outputChannel: outputChannel,
        _config: config,
        _configValues: configValues,
    };

    return vscode;
}

/**
 * Creates a mock ChildProcess (EventEmitter with stdout, stderr, stdin, kill).
 */
export function createMockChildProcess() {
    const proc: any = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.stdin = {
        write: sinon.stub(),
        end: sinon.stub(),
    };
    proc.kill = sinon.stub();
    proc.pid = 12345;
    return proc;
}
