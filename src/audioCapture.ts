import * as vscode from 'vscode';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';

/**
 * Native audio capture using ffmpeg
 * Replaces WebView approach which is blocked by VS Code security
 */
export class AudioCapture {
    private ffmpegProcess: ChildProcess | null = null;
    private isRecording = false;
    private onAudioChunk: ((chunk: Buffer) => void) | null = null;
    private ffmpegPath: string = 'ffmpeg';

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

        return new Promise((resolve, reject) => {
            try {
                // ffmpeg command for different platforms
                const platform = process.platform;
                let ffmpegArgs: string[];
                
                if (platform === 'darwin') {
                    // macOS
                    ffmpegArgs = [
                        '-f', 'avfoundation',
                        '-i', ':default',
                        '-ac', '1',           // Mono
                        '-ar', '16000',       // 16kHz sample rate
                        '-f', 's16le',        // Raw PCM 16-bit little-endian
                        'pipe:1'              // Output to stdout
                    ];
                } else if (platform === 'linux') {
                    // Linux
                    ffmpegArgs = [
                        '-f', 'alsa',
                        '-i', 'default',
                        '-ac', '1',
                        '-ar', '16000',
                        '-f', 's16le',
                        'pipe:1'
                    ];
                } else if (platform === 'win32') {
                    // Windows
                    ffmpegArgs = [
                        '-f', 'dshow',
                        '-i', 'audio=default',
                        '-ac', '1',
                        '-ar', '16000',
                        '-f', 's16le',
                        'pipe:1'
                    ];
                } else {
                    throw new Error(`Unsupported platform: ${platform}`);
                }

                console.log('Starting ffmpeg with args:', ffmpegArgs.join(' '));
                
                this.ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs);
                this.isRecording = true;

                // Handle stdout - audio data
                let buffer = Buffer.alloc(0);
                const chunkSize = 3200; // 100ms at 16kHz/16bit/mono
                
                this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
                    buffer = Buffer.concat([buffer, data]);
                    
                    // Send chunks as they reach 100ms
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

                // Small delay to ensure ffmpeg starts
                setTimeout(() => {
                    if (this.isRecording) {
                        vscode.window.showInformationMessage('🎤 Recording started');
                        resolve();
                    }
                }, 100);

            } catch (error) {
                this.isRecording = false;
                reject(error);
            }
        });
    }

    async stopRecording(): Promise<void> {
        if (!this.isRecording || !this.ffmpegProcess) {
            return;
        }

        return new Promise((resolve) => {
            if (this.ffmpegProcess) {
                // Send 'q' to ffmpeg to quit gracefully
                this.ffmpegProcess.stdin?.write('q');
                
                // Give it a moment to flush
                setTimeout(() => {
                    this.ffmpegProcess?.kill('SIGTERM');
                    this.ffmpegProcess = null;
                    this.isRecording = false;
                    vscode.window.showInformationMessage('🎤 Recording stopped');
                    resolve();
                }, 100);
            } else {
                resolve();
            }
        });
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
