import * as vscode from 'vscode';
import { spawn, execSync, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';

const MODELS_DIR = path.join(os.homedir(), '.voicescribe', 'models');
const RNNOISE_MODEL = 'sh.rnnn';

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

    /**
     * Ensure the RNNoise model file is available locally.
     * Downloads from GitHub if not present.
     * Returns the full path on success, null on failure.
     */
    async ensureRnnoiseModel(): Promise<string | null> {
        const modelPath = path.join(MODELS_DIR, RNNOISE_MODEL);
        if (fs.existsSync(modelPath)) {
            return modelPath;
        }

        try {
            fs.mkdirSync(MODELS_DIR, { recursive: true });

            return await new Promise<string | null>((resolve) => {
                const url = 'https://github.com/richardpl/arnndn-models/raw/refs/heads/master/sh.rnnn';
                const followRedirect = (requestUrl: string, redirectCount: number) => {
                    if (redirectCount > 5) {
                        console.error('RNNoise model download: too many redirects');
                        resolve(null);
                        return;
                    }
                    https.get(requestUrl, (response) => {
                        // Handle redirects (GitHub serves via redirect)
                        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                            response.resume(); // consume response to free memory
                            followRedirect(response.headers.location, redirectCount + 1);
                            return;
                        }

                        if (response.statusCode !== 200) {
                            console.error(`RNNoise model download failed: HTTP ${response.statusCode}`);
                            response.resume();
                            resolve(null);
                            return;
                        }

                        const fileStream = fs.createWriteStream(modelPath);
                        response.pipe(fileStream);
                        fileStream.on('finish', () => {
                            fileStream.close();
                            resolve(modelPath);
                        });
                        fileStream.on('error', (err) => {
                            console.error('RNNoise model write error:', err);
                            // Clean up partial file
                            try { fs.unlinkSync(modelPath); } catch { /* ignore */ }
                            resolve(null);
                        });
                    }).on('error', (err) => {
                        console.error('RNNoise model download error:', err);
                        resolve(null);
                    });
                };
                followRedirect(url, 0);
            });
        } catch (err) {
            console.error('RNNoise model setup error:', err);
            return null;
        }
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

        // ── Build noise reduction filter chain ────────────────────────
        const config = vscode.workspace.getConfiguration('voiceScribe');
        const noiseReduction = config.get<string>('noiseReduction', 'basic');

        let afFilter: string | null = null;
        if (noiseReduction === 'basic') {
            afFilter = 'highpass=f=200,lowpass=f=3000,afftdn=nr=15:nf=-30';
        } else if (noiseReduction === 'neural') {
            const modelPath = await this.ensureRnnoiseModel();
            if (modelPath) {
                afFilter = `highpass=f=200,lowpass=f=3000,afftdn=nr=15:nf=-30,arnndn=m='${modelPath}':mix=0.85`;
            } else {
                // Fallback to basic if model download fails
                afFilter = 'highpass=f=200,lowpass=f=3000,afftdn=nr=15:nf=-30';
                vscode.window.showWarningMessage('Voice Scribe: RNNoise model not available, using basic noise reduction');
            }
        }
        // 'off' leaves afFilter as null

        return new Promise((resolve, reject) => {
            try {
                // ── Platform-specific input format/device ─────────────
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
                    inputDevice = 'audio=default';
                } else {
                    throw new Error(`Unsupported platform: ${platform}`);
                }

                const ffmpegArgs = [
                    '-f', inputFormat,
                    '-i', inputDevice,
                    '-ac', '1',
                    '-ar', '16000',
                    ...(afFilter ? ['-af', afFilter] : []),
                    '-f', 's16le',
                    'pipe:1'
                ];

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
