import { spawn, ChildProcess } from 'child_process';
import * as vscode from 'vscode';

// ── Logging ─────────────────────────────────────────────────────────────────
let outputChannel: vscode.OutputChannel | null = null;
function log(msg: string) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Voice Scribe — Polish');
    }
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
}

const DEFAULT_SYSTEM_PROMPT = `You are a dictation polisher for a developer writing in a VS Code editor.

Your job: rewrite the user's raw dictated paragraph into clean, well-punctuated prose while preserving their exact meaning, voice, and technical terminology. Fix grammar, insert punctuation, remove verbal tics, and merge fragments — do not add new ideas, do not soften opinions, do not add disclaimers.

If the surrounding file is code, treat the paragraph as a comment/docstring and keep it pithy. If the file is markdown or plaintext, produce readable prose. Leverage anything you know about this project (CLAUDE.md, open files) to correctly spell identifiers, product names, and domain terms.

OUTPUT RULES — critical:
- Output ONLY the polished text.
- No preamble ("Here's the rewrite:"), no quotes wrapping the output, no trailing explanation.
- Preserve the user's language (if they dictated in Czech, respond in Czech).
- If the input is already clean and nothing needs changing, output it verbatim.`;

export interface PolishContext {
    text: string;
    languageId?: string;
    filePath?: string;
    cwd?: string;
    beforeText?: string;
    afterText?: string;
}

export interface PolishResult {
    polished: string;
    durationMs: number;
}

export class ClaudePolishService {
    private current: ChildProcess | null = null;

    /**
     * Run `claude -p` against the paragraph. Resolves with polished text.
     * Throws on timeout, non-zero exit, or cancellation.
     */
    async polish(ctx: PolishContext, opts?: {
        model?: string;
        timeoutMs?: number;
        extraInstructions?: string;
    }): Promise<PolishResult> {
        const started = Date.now();
        const timeoutMs = opts?.timeoutMs ?? 30_000;
        const model = opts?.model ?? 'haiku';

        // Cancel any in-flight polish
        this.cancel();

        const userPrompt = buildUserPrompt(ctx, opts?.extraInstructions);

        const args = [
            '-p',
            '--model', model,
            '--output-format', 'text',
            '--tools', '',                      // no tools — pure text, fastest
            '--no-session-persistence',         // don't clutter session history
            '--append-system-prompt', DEFAULT_SYSTEM_PROMPT,
        ];

        log(`polish start: model=${model} chars=${ctx.text.length} lang=${ctx.languageId ?? '?'}`);

        return new Promise<PolishResult>((resolve, reject) => {
            const child = spawn('claude', args, {
                cwd: ctx.cwd ?? process.cwd(),
                stdio: ['pipe', 'pipe', 'pipe'],
                env: process.env,
            });
            this.current = child;

            let stdout = '';
            let stderr = '';
            let settled = false;

            const timer = setTimeout(() => {
                if (settled) { return; }
                settled = true;
                log(`polish timeout after ${timeoutMs}ms`);
                child.kill('SIGTERM');
                reject(new Error(`claude polish timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
            child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

            child.on('error', err => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timer);
                log(`polish spawn error: ${err.message}`);
                reject(new Error(`Failed to spawn claude: ${err.message}. Is \`claude\` on PATH?`));
            });

            child.on('close', code => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timer);
                this.current = null;

                if (code !== 0) {
                    const tail = stderr.trim().split('\n').slice(-3).join(' | ');
                    log(`polish exit ${code}: ${tail}`);
                    reject(new Error(`claude exited ${code}: ${tail || 'no stderr'}`));
                    return;
                }

                const polished = stripWrappingQuotes(stdout.trim());
                const durationMs = Date.now() - started;
                log(`polish ok: ${durationMs}ms, out=${polished.length} chars`);
                resolve({ polished, durationMs });
            });

            child.stdin?.write(userPrompt);
            child.stdin?.end();
        });
    }

    cancel() {
        if (this.current && !this.current.killed) {
            log('polish cancel (superseded)');
            this.current.kill('SIGTERM');
        }
        this.current = null;
    }

    dispose() {
        this.cancel();
        outputChannel?.dispose();
        outputChannel = null;
    }
}

function buildUserPrompt(ctx: PolishContext, extra?: string): string {
    const parts: string[] = [];
    if (ctx.filePath) {
        parts.push(`FILE: ${ctx.filePath}${ctx.languageId ? ` (${ctx.languageId})` : ''}`);
    }
    if (ctx.beforeText) {
        parts.push(`CONTEXT BEFORE:\n${truncate(ctx.beforeText, 400)}`);
    }
    if (ctx.afterText) {
        parts.push(`CONTEXT AFTER:\n${truncate(ctx.afterText, 200)}`);
    }
    if (extra) {
        parts.push(`EXTRA INSTRUCTIONS:\n${extra}`);
    }
    parts.push(`PARAGRAPH TO POLISH:\n${ctx.text}`);
    return parts.join('\n\n');
}

function truncate(s: string, max: number): string {
    if (s.length <= max) { return s; }
    return '…' + s.slice(-max);
}

function stripWrappingQuotes(s: string): string {
    if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) ||
                          (s.startsWith('`') && s.endsWith('`')) ||
                          (s.startsWith('\'') && s.endsWith('\'')))) {
        return s.slice(1, -1).trim();
    }
    return s;
}
