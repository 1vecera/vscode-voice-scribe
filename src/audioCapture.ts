import * as vscode from 'vscode';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';

/** 16 kHz, 16-bit, mono → 32 bytes per millisecond of audio. */
const BYTES_PER_MS = 32;

/**
 * Native audio capture using ffmpeg
 * Replaces WebView approach which is blocked by VS Code security
 */
export class AudioCapture {
    private ffmpegProcess: ChildProcess | null = null;
    private isRecording = false;
    private onAudioChunk: ((chunk: Buffer) => void) | null = null;
    private ffmpegPath: string = 'ffmpeg';
    private stopPromise: Promise<void> | null = null;

    /**
     * Resolve the full path to ffmpeg.
     * VSCode GUI apps on macOS don't inherit the shell PATH,
     * so we check common locations and fall back to shell resolution.
     */
    private resolveFfmpegPath(): string {
        // Common install locations by platform
        const candidates: string[] = process.platform === 'darwin'
            ? ['/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg']
            : process.platform === 'win32'
                ? ['C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe', 'C:\\ffmpeg\\bin\\ffmpeg.exe']
                : ['/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/snap/bin/ffmpeg'];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }

        // Fall back: ask the user's login shell where ffmpeg is
        try {
            const shell = process.env.SHELL || '/bin/zsh';
            const resolved = execSync(`${shell} -ilc "which ffmpeg"`, {
                timeout: 5000,
                encoding: 'utf-8',
            }).trim();
            if (resolved && fs.existsSync(resolved)) {
                return resolved;
            }
        } catch {
            // ignore – will use bare 'ffmpeg' as last resort
        }

        return 'ffmpeg';
    }

    /**
     * Enumerate Windows DirectShow audio input devices.
     * Returns the friendly names ffmpeg reports.
     *
     * Implementation note: `ffmpeg -list_devices true -f dshow -i dummy`
     * writes the device list to stderr and exits non-zero (because the
     * dummy input is invalid). We only care about parsing stderr.
     */
    private async enumerateWindowsAudioDevices(): Promise<string[]> {
        return new Promise((resolve) => {
            const chunks: string[] = [];
            const probe = spawn(this.ffmpegPath, [
                '-hide_banner', '-list_devices', 'true',
                '-f', 'dshow', '-i', 'dummy'
            ]);
            probe.stderr?.on('data', (data: Buffer) => chunks.push(data.toString()));
            probe.on('close', () => {
                const text = chunks.join('');
                // Lines look like:  [in#0 @ ...] "Microphone (Device Name)" (audio)
                const re = /"([^"]+)"\s*\(audio\)/g;
                const devices: string[] = [];
                let m: RegExpExecArray | null;
                while ((m = re.exec(text)) !== null) {
                    devices.push(m[1]);
                }
                resolve(devices);
            });
            probe.on('error', () => resolve([]));
        });
    }

    /**
     * Decide which DirectShow audio device to use on Windows.
     *  1. If `voiceScribe.audioDevice` is set, use it verbatim.
     *  2. Otherwise enumerate via ffmpeg and pick the first audio device.
     *  3. Throws if no devices are found.
     *
     * Fixes the prior hard-coded `audio=default`, which is not a valid
     * DirectShow device alias and caused audio capture to fail silently
     * on every Windows install.
     */
    private async resolveWindowsAudioDevice(config: vscode.WorkspaceConfiguration): Promise<string> {
        const configured = (config.get<string>('audioDevice', '') || '').trim();
        if (configured) {
            return configured;
        }
        const devices = await this.enumerateWindowsAudioDevices();
        if (devices.length === 0) {
            throw new Error(
                'No DirectShow audio input devices found. ' +
                'Set "voiceScribe.audioDevice" to your microphone name explicitly, ' +
                'or run `ffmpeg -list_devices true -f dshow -i dummy` from a terminal to verify ffmpeg sees your microphone.'
            );
        }
        return devices[0];
    }

    async initialize(onAudioChunk: (chunk: Buffer) => void): Promise<void> {
        this.onAudioChunk = onAudioChunk;
        this.ffmpegPath = this.resolveFfmpegPath();
        console.log('Resolved ffmpeg path:', this.ffmpegPath);

        // Verify ffmpeg is available
        return new Promise((resolve, reject) => {
            const testProcess = spawn(this.ffmpegPath, ['-version']);

            testProcess.on('error', (_error) => {
                vscode.window.showErrorMessage(
                    'ffmpeg not found. Please install ffmpeg to use voice input.\n' +
                    'macOS: brew install ffmpeg\n' +
                    'Linux: sudo apt install ffmpeg\n' +
                    'Windows: choco install ffmpeg'
                );
                reject(new Error('ffmpeg not found'));
            });

            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('ffmpeg check failed'));
                }
            });
        });
    }

    async startRecording(): Promise<void> {
        if (this.isRecording || !this.onAudioChunk) {
            return;
        }

        const config = vscode.workspace.getConfiguration('voiceScribe');

        // ── Resolve platform-specific input format/device ─────────────
        // Done outside the Promise constructor below because the Windows
        // branch awaits device enumeration.
        const platform = process.platform;
        let inputFormat: string;
        let inputDevice: string;

        if (platform === 'darwin') {
            inputFormat = 'avfoundation';
            inputDevice = ':default';
        } else if (platform === 'linux') {
            inputFormat = 'alsa';
            inputDevice = 'default';
        } else if (platform === 'win32') {
            inputFormat = 'dshow';
            try {
                const deviceName = await this.resolveWindowsAudioDevice(config);
                inputDevice = `audio=${deviceName}`;
            } catch (err) {
                vscode.window.showErrorMessage(`Voice Scribe: ${(err as Error).message}`);
                throw err;
            }
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Smaller chunks reach the recognizer sooner. A 100 ms chunk withholds
        // up to 100 ms of already-captured audio; 20 ms matches the ~60 ms
        // cadence at which the low-latency models emit results.
        const chunkMs = Math.max(10, Math.min(200, config.get<number>('audioChunkMs', 20)));
        const chunkSize = Math.round(BYTES_PER_MS * chunkMs);

        return new Promise((resolve, reject) => {
            try {
                const ffmpegArgs = [
                    // Don't let the input layer sit on frames waiting to fill a buffer.
                    '-fflags', 'nobuffer',
                    '-f', inputFormat,
                    '-i', inputDevice,
                    '-ac', '1',
                    '-ar', '16000',
                    '-f', 's16le',
                    // Flush each packet to the pipe instead of accumulating in
                    // the 32 KB AVIO buffer before handing bytes over.
                    '-flush_packets', '1',
                    'pipe:1'
                ];

                console.log('Starting ffmpeg with args:', ffmpegArgs.join(' '));

                this.ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs);
                this.isRecording = true;

                // Handle stdout - audio data
                let buffer = Buffer.alloc(0);

                this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
                    buffer = Buffer.concat([buffer, data]);

                    // Emit fixed-size chunks as soon as enough audio has arrived
                    while (buffer.length >= chunkSize) {
                        const chunk = buffer.subarray(0, chunkSize);
                        buffer = buffer.subarray(chunkSize);

                        if (this.onAudioChunk) {
                            this.onAudioChunk(chunk);
                        }
                    }
                });

                // Handle stderr - ffmpeg logs
                this.ffmpegProcess.stderr?.on('data', (data) => {
                    console.log('ffmpeg:', data.toString());
                });

                // Handle errors
                this.ffmpegProcess.on('error', (error) => {
                    console.error('ffmpeg process error:', error);
                    this.isRecording = false;
                    vscode.window.showErrorMessage(`Audio capture error: ${error.message}`);
                    reject(error);
                });

                // Handle process exit
                this.ffmpegProcess.on('close', (code) => {
                    console.log(`ffmpeg process exited with code ${code}`);
                    this.isRecording = false;
                    
                    // Send any remaining buffer
                    if (buffer.length > 0 && this.onAudioChunk) {
                        this.onAudioChunk(buffer);
                    }
                });

                // Resolve on the real signal that the process is up rather than
                // a fixed 100 ms guess. A spawn failure still rejects via the
                // 'error' handler above, which fires instead of 'spawn'.
                this.ffmpegProcess.once('spawn', () => {
                    vscode.window.showInformationMessage('🎤 Recording started');
                    resolve();
                });

            } catch (error) {
                this.isRecording = false;
                reject(error);
            }
        });
    }

    async stopRecording(): Promise<void> {
        if (this.stopPromise) {
            return this.stopPromise;
        }
        if (!this.isRecording || !this.ffmpegProcess) {
            return;
        }

        const process = this.ffmpegProcess;
        const pending = new Promise<void>((resolve) => {
            let settled = false;
            const timers: Array<ReturnType<typeof setTimeout>> = [];

            const finish = () => {
                if (settled) { return; }
                settled = true;
                timers.forEach(clearTimeout);
                if (this.ffmpegProcess === process) {
                    this.ffmpegProcess = null;
                }
                this.isRecording = false;
                vscode.window.showInformationMessage('🎤 Recording stopped');
                resolve();
            };

            // The recording-time close listener flushes its remaining PCM
            // buffer before this later listener resolves stopRecording().
            process.once('close', finish);
            process.once('error', finish);
            timers.push(setTimeout(() => {
                process.kill('SIGTERM');
            }, 100));
            timers.push(setTimeout(finish, 1_100));
            process.stdin?.write('q');
        });

        this.stopPromise = pending.finally(() => {
            this.stopPromise = null;
        });
        return this.stopPromise;
    }

    getIsRecording(): boolean {
        return this.isRecording;
    }

    dispose(): void {
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill('SIGKILL');
            this.ffmpegProcess = null;
        }
        this.isRecording = false;
    }
}
