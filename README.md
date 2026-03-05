# Voice Scribe

> Real-time voice-to-text for VS Code powered by [ElevenLabs Scribe v2](https://elevenlabs.io) — ranked #1 for speech-to-text accuracy. Speak and watch your words appear, rewrite, and refine in real time across 34 languages.

<!-- ![Demo GIF placeholder](demo.gif) -->

## Features

- **Live rewriting** — partial transcripts replace the "live zone" (underlined) in your editor as the model refines its hypothesis; text corrects itself as you speak
- **VAD auto-commit** — voice activity detection automatically commits text when you pause speaking
- **34 languages** — English, Chinese, Spanish, Hindi, Portuguese, Russian, Japanese, German, French, Italian, Korean, and [23 more](#supported-languages)
- **Cross-platform** — macOS (avfoundation), Linux (ALSA), and Windows (DirectShow) via ffmpeg
- **Status bar integration** — microphone icon shows recording state at a glance

## Requirements

- **VS Code** 1.85+
- **ffmpeg** installed and on PATH
- **ElevenLabs API key** with Scribe v2 access — [elevenlabs.io](https://elevenlabs.io)

```bash
# macOS
brew install ffmpeg

# Linux (Debian/Ubuntu)
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

## Installation

### Open VSX (Cursor)

Search **"Voice Scribe"** in the extensions panel, or install from [Open VSX](https://open-vsx.org/extension/1vecera/voice-scribe).

### VS Code / Cursor (direct install)

```bash
# VS Code
curl -sL https://github.com/1vecera/vscode-voice-scribe/releases/download/v0.1.0/voice-scribe-0.1.0.vsix -o /tmp/voice-scribe.vsix && code --install-extension /tmp/voice-scribe.vsix

# Cursor
curl -sL https://github.com/1vecera/vscode-voice-scribe/releases/download/v0.1.0/voice-scribe-0.1.0.vsix -o /tmp/voice-scribe.vsix && cursor --install-extension /tmp/voice-scribe.vsix
```

### Build from source

```bash
git clone https://github.com/1vecera/vscode-voice-scribe.git
cd vscode-voice-scribe
npm install
npm run compile
npx @vscode/vsce package
code --install-extension voice-scribe-0.1.0.vsix
```

## Usage

1. **Configure API key** — `Cmd+Shift+P` → *Voice Scribe: Configure API Key*
2. **Start recording** — `Cmd+Alt+V` (macOS) / `Ctrl+Alt+V` (Windows/Linux)
3. **Speak** — text appears and rewrites in real time
4. **Stop recording** — press the same shortcut again

The status bar shows a microphone icon that turns red while recording.

## Configuration

| Setting | Default | Description |
|---|---|---|
| `voiceScribe.apiKey` | `""` | Your ElevenLabs API key |
| `voiceScribe.language` | `"en"` | Language for speech recognition ([ISO 639-1 code](#supported-languages)) |

## Supported Languages

Set `voiceScribe.language` to any of these ISO 639-1 codes:

| Code | Language | Code | Language | Code | Language |
|------|----------|------|----------|------|----------|
| `en` | English | `ko` | Korean | `hu` | Hungarian |
| `zh` | Chinese | `nl` | Dutch | `no` | Norwegian |
| `es` | Spanish | `pl` | Polish | `ro` | Romanian |
| `hi` | Hindi | `sv` | Swedish | `sk` | Slovak |
| `pt` | Portuguese | `tr` | Turkish | `uk` | Ukrainian |
| `ru` | Russian | `cs` | Czech | `bg` | Bulgarian |
| `ja` | Japanese | `da` | Danish | `hr` | Croatian |
| `de` | German | `fi` | Finnish | `ca` | Catalan |
| `fr` | French | `el` | Greek | `ta` | Tamil |
| `it` | Italian | `ar` | Arabic | `ms` | Malay |
| | | `id` | Indonesian | `th` | Thai |
| | | `vi` | Vietnamese | `tl` | Filipino |

## How It Works

1. **ffmpeg** captures microphone audio as 16 kHz 16-bit PCM mono
2. 100 ms chunks are base64-encoded and sent over a WebSocket to the ElevenLabs Scribe v2 realtime API
3. `partial_transcript` messages replace the live zone in the editor — the model rewrites earlier words as more context arrives
4. `committed_transcript` messages lock text in place, clear the live decoration, and advance the cursor
5. An edit queue serializes all editor mutations to prevent race conditions

## Security & Privacy

Voice Scribe handles microphone audio and sends it to an external API. We take this seriously:

| Concern | How it's handled |
|---|---|
| **Audio transmission** | All audio is streamed over encrypted WebSocket (`wss://`) to ElevenLabs. No unencrypted connections. |
| **No local audio storage** | Audio is streamed in real time and never written to disk. Chunks exist only in memory during recording. |
| **No transcript logging** | Transcript content is never logged to the Output Channel or console. Only message types and character counts appear in logs. |
| **API key storage** | Stored in VS Code's global settings (plaintext `settings.json`). The input prompt masks the key in the UI. This is standard for VS Code extensions. |
| **Memory cleanup** | Transcript data is cleared from memory when recording stops and when the extension is deactivated. |
| **No telemetry** | The extension collects no analytics, telemetry, or usage data. |
| **Minimal permissions** | The extension only requires microphone access (via ffmpeg) and network access (to ElevenLabs API). No file system access beyond VS Code's editor API. |

**Third-party data processing**: Audio is processed by [ElevenLabs](https://elevenlabs.io) under their [privacy policy](https://elevenlabs.io/privacy). Review their data retention and processing terms if you dictate sensitive information.

## Development

```bash
npm install
npm run watch   # compile on save
npm test        # run tests
# Press F5 to launch Extension Development Host
```

## License

MIT
