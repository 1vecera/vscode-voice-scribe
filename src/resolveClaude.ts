import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Resolve the absolute path to the `claude` CLI.
 *
 * Why: VS Code launched from Dock / Spotlight on macOS does not inherit the
 * user's shell PATH, so `spawn('claude', ...)` returns ENOENT even though
 * the binary exists. Same bug we fixed for ffmpeg in v0.1.3.
 *
 * Strategy: check known install locations, then ask the login shell, then
 * fall back to the literal name (which will ENOENT loudly, same as today).
 *
 * Result is memoized — resolution is identical across calls in one session.
 */

let cachedPath: string | null = null;

export function resolveClaudePath(): string {
    if (cachedPath) { return cachedPath; }
    cachedPath = resolveUncached();
    return cachedPath;
}

/** Test-only: reset the memoized path. */
export function resetClaudePathCache(): void {
    cachedPath = null;
}

function resolveUncached(): string {
    const home = os.homedir();

    const candidates: string[] = process.platform === 'darwin'
        ? [
            path.join(home, '.local/bin/claude'),                       // Anthropic native installer
            path.join(home, '.local/share/claude/versions/latest'),     // native installer (direct)
            '/opt/homebrew/bin/claude',                                 // Homebrew (Apple Silicon)
            '/usr/local/bin/claude',                                    // Homebrew (Intel) / npm-global
            path.join(home, '.npm-global/bin/claude'),
            path.join(home, '.volta/bin/claude'),
            path.join(home, '.bun/bin/claude'),
        ]
        : process.platform === 'win32'
            ? [
                path.join(home, 'AppData/Local/Programs/claude/claude.exe'),
                path.join(home, '.local/bin/claude.exe'),
                'C:\\Program Files\\Claude\\claude.exe',
            ]
            : [
                path.join(home, '.local/bin/claude'),
                '/usr/local/bin/claude',
                '/usr/bin/claude',
                path.join(home, '.npm-global/bin/claude'),
            ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    // Fall back to the user's login shell PATH
    try {
        const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd' : '/bin/zsh');
        const whichCmd = process.platform === 'win32' ? 'where claude' : 'which claude';
        const resolved = execSync(`${shell} -ilc "${whichCmd}"`, {
            timeout: 5000,
            encoding: 'utf-8',
        }).trim().split(/\r?\n/)[0];
        if (resolved && fs.existsSync(resolved)) {
            return resolved;
        }
    } catch {
        // ignore — last-resort fallback below
    }

    return 'claude';
}
