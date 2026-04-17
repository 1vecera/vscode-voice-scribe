import * as vscode from 'vscode';
import * as path from 'path';
import { ElevenLabsService } from './elevenLabsService';
import { AudioCapture } from './audioCapture';
import { ClaudePolishService } from './claudePolish';

let elevenLabsService: ElevenLabsService | null = null;
let audioCapture: AudioCapture | null = null;
let claudePolish: ClaudePolishService | null = null;
let isRecording = false;
let statusBarItem: vscode.StatusBarItem;

// ── Paragraph tracking for polish ───────────────────────────────────────────
// Tracks the span of text accumulated from successive committed transcripts.
// Reset on: recording stop, explicit polish, user moves caret out of range,
// or manual command. Used to know WHICH span to send to `claude -p`.
let paragraphStart: vscode.Position | null = null;
let paragraphEnd: vscode.Position | null = null;
let paragraphDocUri: vscode.Uri | null = null;
let isPolishing = false;

// ── Live-rewrite state ──────────────────────────────────────────────────────
// Tracks the "live zone" — the range of text currently being rewritten by
// incoming partial_transcript messages.  committed_transcript locks it in.

let liveStart: vscode.Position | null = null;   // anchor: where partial text begins
let liveRange: vscode.Range | null = null;       // current extent of partial text
let editQueue: Promise<void> = Promise.resolve(); // serialises editor mutations

// ── Idle auto-stop state ────────────────────────────────────────────────────
const IDLE_TIMEOUT_MS = 120_000;  // 2 minutes
let lastTranscriptTime = 0;
let idleTimer: ReturnType<typeof setInterval> | null = null;

// Decoration: subtle underline for "live / unconfirmed" text
// (user prefers minimal visual noise)
const liveDecorationType = vscode.window.createTextEditorDecorationType({
    textDecoration: 'underline dotted rgba(150,150,150,0.4)',
});

/** Enqueue an editor mutation so they never overlap. */
function enqueueEdit(fn: () => Promise<void>) {
    editQueue = editQueue.then(fn, fn);      // run even if prev rejected
}

function resetIdleTimer() {
    lastTranscriptTime = Date.now();
}

function startIdleTimer() {
    lastTranscriptTime = Date.now();
    let pausePolishFired = false;
    idleTimer = setInterval(() => {
        const idleMs = Date.now() - lastTranscriptTime;
        const config = vscode.workspace.getConfiguration('voiceScribe');

        // Auto-polish after a configurable pause (opt-in, 0 = off)
        const pausePolishMs = config.get<number>('polishOnPauseMs', 0);
        if (pausePolishMs > 0 && !pausePolishFired && !isPolishing &&
            idleMs >= pausePolishMs && paragraphStart && paragraphEnd) {
            pausePolishFired = true;
            polishLast().catch(err => console.error('Voice Scribe pause-polish:', err));
        }

        // Reset the pause-polish flag when user starts speaking again
        if (idleMs < 2000) { pausePolishFired = false; }

        if (idleMs >= IDLE_TIMEOUT_MS && isRecording) {
            stopIdleTimer();
            vscode.window.showInformationMessage('Voice Scribe: auto-stopped after 2 minutes of silence.');
            stopRecording();
        }
    }, 1_000);
}

function stopIdleTimer() {
    if (idleTimer) {
        clearInterval(idleTimer);
        idleTimer = null;
    }
}

// ── Prose language set (for smart comment mode) ────────────────────────────
const PROSE_LANGUAGES = new Set([
    'markdown', 'plaintext', 'restructuredtext', 'latex',
    'json', 'jsonc', 'yaml', 'xml', 'html',
]);
function isProseLanguage(languageId: string): boolean {
    return PROSE_LANGUAGES.has(languageId);
}

// ── Filler word removal ────────────────────────────────────────────────────
const FILLER_REGEX = /\b(um|uh|uh huh|hmm|mm|mhm)\b/gi;
function removeFiller(text: string): string {
    const config = vscode.workspace.getConfiguration('voiceScribe');
    if (!config.get<boolean>('removeFiller', true)) { return text; }
    return text.replace(FILLER_REGEX, '').replace(/\s{2,}/g, ' ').trim();
}

// ── Voice commands ─────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getVoiceCommands(): Record<string, () => any> {
    return {
        'undo':           () => vscode.commands.executeCommand('undo'),
        'undo that':      () => vscode.commands.executeCommand('undo'),
        'redo':           () => vscode.commands.executeCommand('redo'),
        'delete line':    () => vscode.commands.executeCommand('editor.action.deleteLines'),
        'delete that':    () => vscode.commands.executeCommand('editor.action.deleteLines'),
        'new line':       () => { const e = vscode.window.activeTextEditor; if (e) { e.edit(b => b.insert(e.selection.active, '\n')); } },
        'select all':     () => vscode.commands.executeCommand('editor.action.selectAll'),
        'save':           () => vscode.commands.executeCommand('workbench.action.files.save'),
        'save file':      () => vscode.commands.executeCommand('workbench.action.files.save'),
        'stop':           () => stopRecording(),
        'stop recording': () => stopRecording(),
    };
}

const PREFIX_COMMANDS: Record<string, string> = {
    'todo': 'TODO',
    'fix me': 'FIXME',
    'note': 'NOTE',
    'hack': 'HACK',
};

// ── Polish voice triggers ───────────────────────────────────────────────────
// Normalized phrases (lowercase, trailing punctuation stripped) that invoke
// Claude Code to rewrite the last paragraph. Czech + English.
const POLISH_TRIGGERS = new Set([
    'polish that', 'polish this', 'polish it',
    'rewrite that', 'rewrite this', 'rewrite it',
    'clean that up', 'clean this up', 'clean it up', 'clean up',
    'fix that', 'fix this',
    'uhlaď to', 'přepiš to', 'vyčisti to',
]);

function normalizeForCommand(text: string): string {
    return text.toLowerCase().replace(/[.,!?;:]+$/g, '').trim();
}

function clearLiveDecoration(editor: vscode.TextEditor | undefined) {
    editor?.setDecorations(liveDecorationType, []);
}

function applyLiveDecoration(editor: vscode.TextEditor, range: vscode.Range) {
    editor.setDecorations(liveDecorationType, [range]);
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Voice Scribe extension is now active');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'voiceScribe.toggleRecording';
    context.subscriptions.push(statusBarItem);
    updateStatusBar();

    // Initialize services
    initializeServices();

    // Register commands
    const toggleRecordingCommand = vscode.commands.registerCommand(
        'voiceScribe.toggleRecording',
        () => isRecording ? stopRecording() : startRecording()
    );

    const configureApiKeyCommand = vscode.commands.registerCommand(
        'voiceScribe.configureApiKey',
        () => configureApiKey()
    );

    const selectLanguageCommand = vscode.commands.registerCommand(
        'voiceScribe.selectLanguage',
        () => selectLanguage()
    );

    const polishLastCommand = vscode.commands.registerCommand(
        'voiceScribe.polishLast',
        () => polishLast()
    );

    context.subscriptions.push(toggleRecordingCommand);
    context.subscriptions.push(configureApiKeyCommand);
    context.subscriptions.push(selectLanguageCommand);
    context.subscriptions.push(polishLastCommand);

    // Invalidate the tracked paragraph when the user clicks/arrows away from it —
    // otherwise "polish that" could rewrite an unintended span.
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(e => {
            if (!paragraphStart || !paragraphEnd || !paragraphDocUri) { return; }
            if (e.textEditor.document.uri.toString() !== paragraphDocUri.toString()) {
                paragraphStart = null;
                paragraphEnd = null;
                paragraphDocUri = null;
                return;
            }
            // Only invalidate on user-initiated moves (keyboard/mouse), not our own edits
            if (e.kind === vscode.TextEditorSelectionChangeKind.Command) { return; }
            const sel = e.selections[0];
            const range = new vscode.Range(paragraphStart, paragraphEnd);
            const outside = sel.active.isBefore(range.start) || sel.active.isAfter(range.end);
            if (outside && !isRecording) {
                paragraphStart = null;
                paragraphEnd = null;
                paragraphDocUri = null;
            }
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('voiceScribe')) {
                initializeServices();
            }
        })
    );
}

function initializeServices() {
    const config = vscode.workspace.getConfiguration('voiceScribe');
    const apiKey = config.get<string>('apiKey');

    if (apiKey) {
        elevenLabsService = new ElevenLabsService(apiKey);

        // Initialize audio capture (no WebView needed)
        audioCapture = new AudioCapture();
        audioCapture.initialize(async (chunk: Buffer) => {
            // Send audio chunk to ElevenLabs
            if (elevenLabsService) {
                elevenLabsService.sendAudioChunk(chunk);
            }
        }).catch((error) => {
            console.error('Failed to initialize audio capture:', error);
            // Error already shown to user in AudioCapture.initialize()
        });
    } else {
        elevenLabsService = null;
        audioCapture = null;
    }
}

async function startRecording() {
    if (isRecording) {
        vscode.window.showWarningMessage('Already recording!');
        return;
    }

    if (!elevenLabsService || !audioCapture) {
        const action = await vscode.window.showErrorMessage(
            'Extension not initialized. Please configure API key first.',
            'Configure'
        );
        if (action === 'Configure') {
            await configureApiKey();
        }
        return;
    }

    try {
        // Reset live-rewrite state
        liveStart = null;
        liveRange = null;
        editQueue = Promise.resolve();
        clearLiveDecoration(vscode.window.activeTextEditor);

        // Auto-populate vocabulary from workspace (Task 10)
        // Lazy-load to avoid requiring vscode in non-extension-host environments (tests)
        let autoVocabulary: Array<{ word: string; boost: number }> | undefined;
        const autoVocabConfig = vscode.workspace.getConfiguration('voiceScribe');
        if (autoVocabConfig.get<boolean>('autoVocabulary', false)) {
            try {
                const { extractWorkspaceVocabulary } = await import('./vocabularyBuilder');
                autoVocabulary = await extractWorkspaceVocabulary(100);
            } catch (err) {
                console.error('Failed to extract workspace vocabulary:', err);
            }
        }

        // Start ElevenLabs connection with two callbacks
        await elevenLabsService.startTranscription(
            // ── onPartial ───────────────────────────────────────────
            // Each partial_transcript is the FULL rewritten hypothesis.
            // The model rewrites earlier words as context grows.
            // We replace the entire live zone each time.
            (text: string) => {
                resetIdleTimer();
                enqueueEdit(() => handlePartial(text));
            },
            // ── onFinal ─────────────────────────────────────────────
            // committed_transcript = locked in. Replace live zone one
            // last time, remove decoration, advance cursor.
            (text: string) => {
                resetIdleTimer();
                enqueueEdit(() => handleCommitted(text));
            },
            autoVocabulary
        );

        // Start audio capture
        await audioCapture.startRecording();

        isRecording = true;
        startIdleTimer();
        updateStatusBar();

        // Set context for keybinding
        await vscode.commands.executeCommand('setContext', 'voiceScribe.recording', true);

    } catch (error) {
        isRecording = false;
        stopIdleTimer();
        updateStatusBar();
        await vscode.commands.executeCommand('setContext', 'voiceScribe.recording', false);
        vscode.window.showErrorMessage(`Failed to start recording: ${error}`);
    }
}

async function stopRecording() {
    if (!isRecording || !elevenLabsService || !audioCapture) {
        return;
    }

    try {
        stopIdleTimer();

        // Stop audio capture first (stops sending chunks)
        await audioCapture.stopRecording();

        // Stop ElevenLabs — waits for last VAD commit
        await elevenLabsService.stopTranscription();
        isRecording = false;
        updateStatusBar();

        // Clear live state
        clearLiveDecoration(vscode.window.activeTextEditor);
        liveStart = null;
        liveRange = null;

        // Preserve paragraph span across stop/start so users can say "stop" then
        // trigger the keybind polish after the fact — but only for a short window.
        // For now we keep the span; it'll be invalidated on cursor move.

        // Clear context for keybinding
        await vscode.commands.executeCommand('setContext', 'voiceScribe.recording', false);

        // Note: we do NOT re-insert finalText here.
        // The onFinal callback already inserted each committed segment in real-time.
        // stopTranscription() just waits for any last VAD commit to flush through
        // the same callback pipeline.
    } catch (error) {
        isRecording = false;
        stopIdleTimer();
        updateStatusBar();
        await vscode.commands.executeCommand('setContext', 'voiceScribe.recording', false);
        vscode.window.showErrorMessage(`Failed to stop recording: ${error}`);
    }
}

// ── Live-rewrite handlers ───────────────────────────────────────────────────

/**
 * Handle a partial_transcript.
 * The API sends the FULL current hypothesis — it may have rewritten earlier
 * words ("I wanted" → "I want to book").  We replace the entire live zone.
 */
async function handlePartial(text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) { return; }

    // Apply filler removal (Task 3)
    text = removeFiller(text);
    if (!text) { return; }

    const ok = await editor.edit(editBuilder => {
        if (liveRange) {
            // Replace existing live zone with the updated hypothesis
            editBuilder.replace(liveRange, text);
        } else {
            // First partial of a new segment — insert at cursor
            liveStart = editor.selection.active;
            editBuilder.insert(liveStart, text);
        }
    });

    if (ok) {
        // Recalculate live range after edit
        const start = liveStart ?? editor.selection.active;
        const end = editor.document.positionAt(
            editor.document.offsetAt(start) + text.length
        );
        liveRange = new vscode.Range(start, end);

        // Dim italic decoration so user sees this is "live / unconfirmed"
        applyLiveDecoration(editor, liveRange);
    }
}

/**
 * Handle a committed_transcript.
 * This is the final, locked-in text for the current segment.
 * Replace live zone, clear decoration, add trailing space, reset for next segment.
 *
 * Flow: filler removal → voice commands → terminal target → editor insert → auto-comment
 */
async function handleCommitted(text: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No active editor to insert text');
        return;
    }

    const config = vscode.workspace.getConfiguration('voiceScribe');

    // 1. Apply filler removal (Task 3)
    let processedText = removeFiller(text);
    if (!processedText) {
        // Filler removal left nothing — clear live state and skip
        clearLiveDecoration(editor);
        liveStart = null;
        liveRange = null;
        return;
    }

    // 2. Check voice commands (Task 5) — may return early
    if (config.get<boolean>('enableVoiceCommands', false)) {
        const normalized = normalizeForCommand(processedText);

        // Polish triggers — invoke Claude Code on the last paragraph
        if (POLISH_TRIGGERS.has(normalized)) {
            liveStart = null;
            liveRange = null;
            clearLiveDecoration(editor);
            polishLast().catch(err => {
                vscode.window.showErrorMessage(`Voice Scribe: polish failed — ${err.message}`);
            });
            return;
        }

        // Exact match commands
        const commands = getVoiceCommands();
        if (commands[normalized]) {
            await commands[normalized]();
            liveStart = null;
            liveRange = null;
            clearLiveDecoration(editor);
            return; // Don't insert text
        }

        // Prefix commands (todo X, fix me X, etc.)
        for (const [prefix, tag] of Object.entries(PREFIX_COMMANDS)) {
            if (normalized.startsWith(prefix + ' ')) {
                const content = processedText.slice(prefix.length + 1).trim();
                processedText = `${tag}: ${content}`;
                break;
            }
        }
    }

    // 3. Check terminal target (Task 6) — may return early
    const target = config.get<string>('target', 'editor');
    if (target === 'terminal') {
        await vscode.commands.executeCommand(
            'workbench.action.terminal.sendSequence',
            { text: processedText + '\n' }
        );
        // Clear live state (partial was in editor, but committed goes to terminal)
        clearLiveDecoration(editor);
        liveStart = null;
        liveRange = null;
        return;
    }

    // 4. Insert text into editor (existing logic)
    const finalText = processedText + ' ';

    // Track where the insertion starts for auto-comment
    const insertStart = liveRange
        ? liveRange.start
        : editor.selection.isEmpty
            ? editor.selection.active
            : editor.selection.start;

    await editor.edit(editBuilder => {
        if (liveRange) {
            editBuilder.replace(liveRange, finalText);
        } else if (editor.selection.isEmpty) {
            editBuilder.insert(editor.selection.active, finalText);
        } else {
            editBuilder.replace(editor.selection, finalText);
        }
    });

    // 5. Apply auto-comment (Task 1) — after editor insertion
    const insertMode = config.get<string>('insertMode', 'plain');
    if (insertMode === 'comment' || insertMode === 'smart') {
        const shouldComment = insertMode === 'comment' || !isProseLanguage(editor.document.languageId);
        if (shouldComment) {
            // Select the inserted range, then toggle line comment
            const insertEnd = editor.document.positionAt(
                editor.document.offsetAt(insertStart) + finalText.length
            );
            editor.selection = new vscode.Selection(insertStart, insertEnd);
            await vscode.commands.executeCommand('editor.action.addCommentLine');
        }
    }

    // 6. Track paragraph range for polish (Claude Code integration)
    //    Extend the paragraph on each commit; reset happens elsewhere
    //    (polishLast, stopRecording, or cursor moved outside the span).
    const paragraphInsertEnd = editor.document.positionAt(
        editor.document.offsetAt(insertStart) + finalText.length
    );
    if (!paragraphStart || paragraphDocUri?.toString() !== editor.document.uri.toString()) {
        paragraphStart = insertStart;
        paragraphDocUri = editor.document.uri;
    }
    paragraphEnd = paragraphInsertEnd;

    // 7. Clear decorations and reset for next segment
    clearLiveDecoration(editor);
    liveStart = null;
    liveRange = null;
}

// ── Paragraph polish via `claude -p` ────────────────────────────────────────

async function polishLast(): Promise<void> {
    if (isPolishing) {
        vscode.window.showInformationMessage('Voice Scribe: polish already in progress');
        return;
    }
    if (!paragraphStart || !paragraphEnd || !paragraphDocUri) {
        vscode.window.showInformationMessage('Voice Scribe: nothing to polish yet');
        return;
    }
    if (!claudePolish) {
        claudePolish = new ClaudePolishService();
    }

    // Re-acquire the editor for the tracked document
    const doc = vscode.workspace.textDocuments.find(
        d => d.uri.toString() === paragraphDocUri!.toString()
    );
    const editor = vscode.window.visibleTextEditors.find(e => e.document === doc)
        ?? vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== paragraphDocUri.toString()) {
        vscode.window.showWarningMessage('Voice Scribe: document with last dictation is not active');
        return;
    }

    const range = new vscode.Range(paragraphStart, paragraphEnd);
    const paragraphText = editor.document.getText(range).trim();
    if (!paragraphText) {
        return;
    }

    // Gather surrounding context (a few lines before/after) for Claude
    const beforeLine = Math.max(0, range.start.line - 3);
    const afterLine = Math.min(editor.document.lineCount - 1, range.end.line + 2);
    const beforeText = editor.document.getText(
        new vscode.Range(new vscode.Position(beforeLine, 0), range.start)
    );
    const afterText = editor.document.getText(
        new vscode.Range(range.end, editor.document.lineAt(afterLine).range.end)
    );

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    const cwd = workspaceFolder?.uri.fsPath ?? path.dirname(editor.document.uri.fsPath);

    const config = vscode.workspace.getConfiguration('voiceScribe');
    const model = config.get<string>('polishModel', 'haiku');
    const timeoutMs = config.get<number>('polishTimeoutMs', 30_000);

    isPolishing = true;
    updateStatusBar();
    try {
        await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: '$(sparkle) Polishing with Claude…', cancellable: true },
            async (_progress, token) => {
                token.onCancellationRequested(() => claudePolish?.cancel());

                const { polished, durationMs } = await claudePolish!.polish(
                    {
                        text: paragraphText,
                        languageId: editor.document.languageId,
                        filePath: vscode.workspace.asRelativePath(editor.document.uri),
                        cwd,
                        beforeText,
                        afterText,
                    },
                    { model, timeoutMs }
                );

                if (token.isCancellationRequested) { return; }
                if (!polished || polished === paragraphText) {
                    vscode.window.setStatusBarMessage(`$(sparkle) Polish: no changes (${durationMs}ms)`, 3000);
                    return;
                }

                // Preserve trailing whitespace behavior: original had a trailing space
                const originalEndsWithSpace = editor.document.getText(range).endsWith(' ');
                const replacement = originalEndsWithSpace ? polished + ' ' : polished;

                await editor.edit(b => b.replace(range, replacement));
                vscode.window.setStatusBarMessage(`$(sparkle) Polished in ${durationMs}ms`, 3000);
            }
        );
    } finally {
        isPolishing = false;
        // Reset paragraph span — polish completed or was cancelled
        paragraphStart = null;
        paragraphEnd = null;
        paragraphDocUri = null;
        updateStatusBar();
    }
}

async function selectLanguage() {
    const languages: { label: string; code: string }[] = [
        { label: '$(globe) Auto-detect', code: 'auto' },
        { label: 'English', code: 'en' },
        { label: 'Chinese', code: 'zh' },
        { label: 'Spanish', code: 'es' },
        { label: 'Hindi', code: 'hi' },
        { label: 'Portuguese', code: 'pt' },
        { label: 'Russian', code: 'ru' },
        { label: 'Japanese', code: 'ja' },
        { label: 'German', code: 'de' },
        { label: 'French', code: 'fr' },
        { label: 'Italian', code: 'it' },
        { label: 'Korean', code: 'ko' },
        { label: 'Dutch', code: 'nl' },
        { label: 'Polish', code: 'pl' },
        { label: 'Swedish', code: 'sv' },
        { label: 'Turkish', code: 'tr' },
        { label: 'Czech', code: 'cs' },
        { label: 'Danish', code: 'da' },
        { label: 'Finnish', code: 'fi' },
        { label: 'Greek', code: 'el' },
        { label: 'Hungarian', code: 'hu' },
        { label: 'Norwegian', code: 'no' },
        { label: 'Romanian', code: 'ro' },
        { label: 'Slovak', code: 'sk' },
        { label: 'Ukrainian', code: 'uk' },
        { label: 'Bulgarian', code: 'bg' },
        { label: 'Croatian', code: 'hr' },
        { label: 'Catalan', code: 'ca' },
        { label: 'Tamil', code: 'ta' },
        { label: 'Arabic', code: 'ar' },
        { label: 'Malay', code: 'ms' },
        { label: 'Indonesian', code: 'id' },
        { label: 'Thai', code: 'th' },
        { label: 'Vietnamese', code: 'vi' },
        { label: 'Filipino', code: 'tl' },
    ];

    const config = vscode.workspace.getConfiguration('voiceScribe');
    const current = config.get<string>('language') || 'auto';

    const items = languages.map(l => ({
        label: l.label,
        description: l.code === current ? '(current)' : l.code,
        code: l.code,
    }));

    const picked = await vscode.window.showQuickPick(items, {
        placeHolder: `Select transcription language (current: ${current})`,
    });

    if (picked) {
        await config.update('language', picked.code, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(`Voice Scribe language set to ${picked.label}`);
    }
}

async function configureApiKey() {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your ElevenLabs API key',
        password: true,
        placeHolder: 'xi_xxxxxxxxxxxxxxxx'
    });

    if (apiKey) {
        const config = vscode.workspace.getConfiguration('voiceScribe');
        await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        initializeServices();
        vscode.window.showInformationMessage('✅ API key saved');
    }
}

function updateStatusBar() {
    statusBarItem.command = 'voiceScribe.toggleRecording';
    if (isPolishing) {
        statusBarItem.text = '$(sparkle) Polishing...';
        statusBarItem.tooltip = 'Claude Code is polishing the last paragraph';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (isRecording) {
        statusBarItem.text = '$(mic) Recording...';
        statusBarItem.tooltip = 'Click to stop recording';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
        statusBarItem.text = '$(mic) Voice Scribe';
        statusBarItem.tooltip = 'Click to start recording';
        statusBarItem.backgroundColor = undefined;
    }
    statusBarItem.show();
}

export function deactivate() {
    stopIdleTimer();
    if (elevenLabsService) {
        elevenLabsService.dispose();
    }
    if (audioCapture) {
        audioCapture.dispose();
    }
    if (claudePolish) {
        claudePolish.dispose();
        claudePolish = null;
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
    liveDecorationType.dispose();
    // Clear recording context
    vscode.commands.executeCommand('setContext', 'voiceScribe.recording', false);
}
