import { spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { sanitizeKeyterms } from './elevenLabsService';
import { resolveClaudePath } from './resolveClaude';

// ── Logging ─────────────────────────────────────────────────────────────────
let outputChannel: vscode.OutputChannel | null = null;
function log(msg: string) {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Voice Scribe — Keyterms');
    }
    const ts = new Date().toISOString().slice(11, 23);
    outputChannel.appendLine(`[${ts}] ${msg}`);
}

const KEYTERM_SYSTEM_PROMPT = `You extract a keyterm vocabulary for a real-time speech-to-text dictation system.

The user is dictating into a code editor and the speech model needs a small biasing list so it correctly transcribes the technical terms they use. The terms will be passed as ?keyterms=... query params to ElevenLabs Scribe v2 Realtime.

INPUT: file contents from the user's project (README, CLAUDE.md, currently open files in VS Code).

TASK: Produce up to 50 keyterms — the technical identifiers, library names, function names, CLI flag roots, file extensions, and domain words that are likely to appear when the user dictates into this codebase.

OUTPUT FORMAT — critical:
- One term per line. Plain text. No markdown bullets, no numbering, no quotes, no commentary.
- Exactly the term, nothing else.
- Maximum 50 lines.

HARD RULES — terms that don't meet these will be discarded:
- Each term ≤ 20 characters.
- No leading dashes on CLI flags. Bias the root: write "max-tokens" not "--max-tokens".
- Prefer single tokens (numpy, useState, kubectl, pydantic) over phrases.
- camelCase and snake_case are fine, preserve them verbatim (useState, get_user_by_id).
- Lowercase is fine; PascalCase is fine; UPPER_SNAKE is fine.
- Do not include normal English/Czech vocabulary (e.g., "function", "import", "the", "také").
- Do not include language keywords (if, else, return, class, def).
- Do not include single letters or very short words (< 3 chars).
- Deduplicate.

SELECTION PRIORITY (when you have more than 50 candidates):
1. Library / framework names actually imported or mentioned (numpy, fastapi, vitest).
2. Function and class names defined in the open files (getUserById, ElevenLabsService).
3. Tool names (kubectl, pytest, ruff, pnpm, esbuild).
4. Project-specific identifiers from README/CLAUDE.md.
5. CLI flag roots that appear in commands.

If the user works in Czech + English (mixed codebase), keep English technical terms — Czech body text is handled by the model's native multilingual decoder and does not benefit from keyterms.`;

export interface KeytermGenerationResult {
    keyterms: string[];
    rejected: string[];
    durationMs: number;
}

/**
 * Run `claude -p --model opus` against the workspace files to generate a
 * 50-term keyterm list for ElevenLabs Scribe v2 Realtime biasing.
 */
export async function generateKeyterms(opts?: {
    model?: string;
    timeoutMs?: number;
}): Promise<KeytermGenerationResult> {
    const started = Date.now();
    const timeoutMs = opts?.timeoutMs ?? 60_000;
    const model = opts?.model ?? 'opus';

    const context = await gatherWorkspaceContext();
    if (!context.trim()) {
        throw new Error('No README.md, CLAUDE.md, or open files found to extract keyterms from.');
    }

    log(`Generating keyterms with model=${model}, context=${context.length} chars`);

    const args = [
        '-p',
        '--model', model,
        '--output-format', 'text',
        '--append-system-prompt', KEYTERM_SYSTEM_PROMPT,
    ];

    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const claudeBin = resolveClaudePath();
    log(`claude binary: ${claudeBin}`);

    return new Promise<KeytermGenerationResult>((resolve, reject) => {
        const child = spawn(claudeBin, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            env: process.env,
        });

        let stdout = '';
        let stderr = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) { return; }
            settled = true;
            log(`Generation timed out after ${timeoutMs}ms`);
            child.kill('SIGTERM');
            reject(new Error(`Keyterm generation timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8'); });
        child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8'); });

        child.on('error', err => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);
            log(`Spawn error: ${err.message}`);
            reject(new Error(`Failed to spawn claude: ${err.message}. Is \`claude\` on PATH?`));
        });

        child.on('close', code => {
            if (settled) { return; }
            settled = true;
            clearTimeout(timer);

            if (code !== 0) {
                const tail = stderr.trim().split('\n').slice(-3).join(' | ');
                log(`Exit ${code}: ${tail}`);
                reject(new Error(`claude exited ${code}: ${tail || 'no stderr'}`));
                return;
            }

            const { kept, rejected } = parseKeytermOutput(stdout);
            const durationMs = Date.now() - started;
            log(`Generated ${kept.length} keyterms (${rejected.length} rejected) in ${durationMs}ms`);
            resolve({ keyterms: kept, rejected, durationMs });
        });

        child.stdin?.write(context);
        child.stdin?.end();
    });
}

/**
 * Read README.md + CLAUDE.md (workspace root) and the contents of all
 * currently open text documents. Concatenate with file-header markers,
 * truncate to a reasonable size, return for piping to Claude.
 */
async function gatherWorkspaceContext(): Promise<string> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    const root = folders[0]?.uri;
    const parts: string[] = [];

    // README + CLAUDE.md from workspace root
    if (root) {
        for (const fileName of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
            const text = await readFileSafe(vscode.Uri.joinPath(root, fileName));
            if (text) {
                parts.push(`### ${fileName}\n${truncate(text, 4000)}`);
            }
        }
    }

    // Currently open text documents (visible + tabs)
    const seen = new Set<string>(parts.map(() => '')); // placeholder dedupe
    const docs = vscode.workspace.textDocuments;
    let perFileBudget = 2000;
    let totalBudget = 20_000;

    for (const doc of docs) {
        if (doc.uri.scheme !== 'file') { continue; }
        if (doc.languageId === 'log') { continue; }
        const fsPath = doc.uri.fsPath;
        const base = path.basename(fsPath);
        if (['README.md', 'CLAUDE.md', 'AGENTS.md'].includes(base)) { continue; }
        if (seen.has(fsPath)) { continue; }
        seen.add(fsPath);

        const snippet = truncate(doc.getText(), perFileBudget);
        const rel = root ? path.relative(root.fsPath, fsPath) : fsPath;
        parts.push(`### ${rel}\n${snippet}`);

        totalBudget -= snippet.length;
        if (totalBudget <= 0) { break; }
    }

    return parts.join('\n\n');
}

async function readFileSafe(uri: vscode.Uri): Promise<string | null> {
    try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(bytes).toString('utf8');
    } catch {
        return null;
    }
}

function truncate(s: string, max: number): string {
    if (s.length <= max) { return s; }
    return s.slice(0, max) + '\n…[truncated]';
}

/**
 * Parse Claude's raw output into kept/rejected lists. Each line is a
 * candidate term. We strip common boilerplate (bullets, numbering, quotes)
 * before applying the elevenLabsService `sanitizeKeyterms` constraints.
 */
export function parseKeytermOutput(stdout: string): { kept: string[]; rejected: string[] } {
    const raw = stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .map(line => line.replace(/^[-*+\d.)\s]+/, '')) // strip bullets/numbering
        .map(line => line.replace(/^["'`]|["'`]$/g, '')) // strip wrapping quotes
        .filter(Boolean);

    const kept = sanitizeKeyterms(raw);
    const keptSet = new Set(kept.map(t => t.toLowerCase()));
    const rejected = raw.filter(t => !keptSet.has(t.toLowerCase()));
    return { kept, rejected };
}

export function disposeKeytermsChannel() {
    outputChannel?.dispose();
    outputChannel = null;
}
