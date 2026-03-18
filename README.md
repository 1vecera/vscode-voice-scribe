# Voice Scribe

> Real-time voice-to-text for VS Code powered by [ElevenLabs Scribe v2](https://elevenlabs.io) — ranked #1 for speech-to-text accuracy. Speak and watch your words appear, rewrite, and refine in real time across 34 languages.

## Features

### Core

- **Live rewriting** — partial transcripts replace the "live zone" (dotted underline) in your editor as the model refines its hypothesis; text corrects itself as you speak
- **Toggle recording** — `Cmd+Alt+V` / `Ctrl+Alt+V` starts and stops with one shortcut
- **VAD auto-commit** — voice activity detection automatically commits text when you pause speaking
- **Idle auto-stop** — recording stops automatically after 2 minutes of silence so you never forget to turn it off
- **34 languages** — English, Chinese, Spanish, Hindi, Portuguese, Russian, Japanese, German, French, Italian, Korean, and [23 more](#supported-languages). Defaults to auto-detect.

### Smart Text Handling

- **Smart insert mode** — automatically wraps transcriptions in line comments when you're in a code file, inserts plain text in prose files (markdown, plaintext, etc.)
- **Filler word removal** — strips "um", "uh", "hmm", "mhm" automatically for clean output
- **Voice commands** — say "undo", "redo", "delete line", "save", "stop", "new line", "select all" and Voice Scribe executes the command instead of typing it
- **Prefix commands** — say "todo fix the login bug" and it inserts `TODO: fix the login bug`. Also supports `FIXME`, `NOTE`, `HACK`.
- **Terminal target** — send transcriptions directly to the integrated terminal instead of the editor

### Audio Quality

- **Neural noise reduction** — RNNoise neural denoiser on top of highpass/lowpass/FFT filters. Downloads a small model on first use. Three levels: `off`, `basic`, `neural` (default).
- **VAD sensitivity presets** — `low` (noisy office/cafe), `medium` (normal room), `high` (quiet room/headset). Controls how aggressively non-speech audio is rejected.
- **Cross-platform** — macOS (avfoundation), Linux (ALSA), Windows (DirectShow) via ffmpeg

### Vocabulary

- **Custom vocabulary** — boost domain-specific terms like API names, project jargon, or unusual words. Supports boost factor (1.0–10.0) and phoneme hints. Max 200 entries.
- **Auto vocabulary** — automatically extracts identifiers from your open files (via DocumentSymbolProvider or regex fallback) and boosts them in recognition. Your variable names, function names, and class names get recognized correctly.

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
curl -sL https://github.com/1vecera/vscode-voice-scribe/releases/latest/download/voice-scribe.vsix -o /tmp/voice-scribe.vsix && code --install-extension /tmp/voice-scribe.vsix

# Cursor
curl -sL https://github.com/1vecera/vscode-voice-scribe/releases/latest/download/voice-scribe.vsix -o /tmp/voice-scribe.vsix && cursor --install-extension /tmp/voice-scribe.vsix
```

### Build from source

```bash
git clone https://github.com/1vecera/vscode-voice-scribe.git
cd vscode-voice-scribe
npm install
npm run compile
npx @vscode/vsce package
code --install-extension voice-scribe-*.vsix
```

## Usage

1. **Configure API key** — `Cmd+Shift+P` → *Voice Scribe: Configure API Key*
2. **Start recording** — `Cmd+Alt+V` (macOS) / `Ctrl+Alt+V` (Windows/Linux)
3. **Speak** — text appears and rewrites in real time
4. **Stop recording** — press the same shortcut again, or say "stop"

The status bar shows a microphone icon that turns red while recording.

### Voice Commands

When `enableVoiceCommands` is on (default), these spoken phrases are executed instead of typed:

| Command | Action |
|---|---|
| "undo" / "undo that" | Undo last edit |
| "redo" | Redo |
| "delete line" / "delete that" | Delete current line |
| "new line" | Insert newline |
| "select all" | Select all text |
| "save" / "save file" | Save current file |
| "stop" / "stop recording" | Stop recording |

Prefix commands insert annotation tags:

| Say | Inserts |
|---|---|
| "todo fix the auth bug" | `TODO: fix the auth bug` |
| "fix me missing null check" | `FIXME: missing null check` |
| "note this needs refactoring" | `NOTE: this needs refactoring` |

## Configuration

All settings are under `voiceScribe.*` in your VS Code settings.

| Setting | Default | Description |
|---|---|---|
| `apiKey` | `""` | Your ElevenLabs API key |
| `language` | `"auto"` | Language for recognition ([ISO 639-1 code](#supported-languages)). `"auto"` lets the API detect your language. |
| `insertMode` | `"smart"` | `"plain"` = as-is, `"comment"` = always wrap in line comment, `"smart"` = auto-comment in code, plain in prose |
| `removeFiller` | `true` | Strip filler words (um, uh, hmm, mhm) from transcriptions |
| `enableVoiceCommands` | `true` | Execute voice commands instead of typing them |
| `target` | `"editor"` | `"editor"` = insert into active editor, `"terminal"` = send to integrated terminal |
| `vadSensitivity` | `"medium"` | VAD preset: `"low"` (noisy), `"medium"` (normal), `"high"` (quiet) |
| `noiseReduction` | `"neural"` | `"off"`, `"basic"` (highpass+lowpass+FFT), `"neural"` (basic + RNNoise) |
| `autoVocabulary` | `true` | Auto-extract identifiers from open files and boost in recognition |
| `customVocabulary` | `[]` | Custom terms to boost. See [Custom Vocabulary](#custom-vocabulary). |

### Custom Vocabulary

Add domain-specific terms to improve recognition accuracy. Set in your `settings.json`:

```json
"voiceScribe.customVocabulary": [
    { "word": "ElevenLabs", "boost": 5.0 },
    { "word": "kubectl", "boost": 4.0 },
    { "word": "Kubernetes", "boost": 3.0 },
    { "word": "proxyquire", "boost": 4.0, "phonemes": ["PROK-see-kwire"] }
]
```

- **word** (required) — the term to boost
- **boost** (optional, 1.0–10.0) — higher values increase recognition likelihood
- **phonemes** (optional) — pronunciation hints for unusual words
- Max 200 entries. User-defined entries take priority over auto-extracted ones.

### Select Language

Use the command palette: `Cmd+Shift+P` → *Voice Scribe: Select Language* for a quick-pick menu instead of editing settings manually.

## Supported Languages

Set `voiceScribe.language` to any of these ISO 639-1 codes, or `"auto"` to let the API detect:

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

```
Microphone → ffmpeg → 100ms PCM chunks → WebSocket → ElevenLabs Scribe v2 API
                                                          ↓
Editor ← handleCommitted() ← committed_transcript   ← VAD silence detection
Editor ← handlePartial()   ← partial_transcript     ← interim hypothesis
```

1. **ffmpeg** captures microphone audio as 16 kHz / 16-bit / mono PCM with noise reduction filters
2. Audio is buffered into exactly 3200-byte chunks (100ms) and base64-encoded
3. Chunks are sent over an encrypted WebSocket (`wss://`) to the ElevenLabs Scribe v2 realtime API
4. `partial_transcript` messages replace the live zone — the model rewrites earlier words as context grows
5. `committed_transcript` messages lock text in place, apply comment wrapping if needed, and advance the cursor
6. An edit queue serializes all editor mutations to prevent race conditions
7. On stop, a 2-second drain window catches any final VAD commits before closing the WebSocket

## Security & Privacy

Voice Scribe handles microphone audio and sends it to an external API. We take this seriously:

| Concern | How it's handled |
|---|---|
| **Audio transmission** | All audio is streamed over encrypted WebSocket (`wss://`) to ElevenLabs. No unencrypted connections. |
| **No local audio storage** | Audio is streamed in real time and never written to disk. Chunks exist only in memory during recording. |
| **No transcript logging** | Transcript content is never logged to the Output Channel or console. Only message types and character counts appear in logs. |
| **API key storage** | Stored in VS Code's global settings (plaintext `settings.json`). The input prompt masks the key in the UI. |
| **Memory cleanup** | Transcript data is cleared from memory when recording stops and when the extension is deactivated. |
| **No telemetry** | The extension collects no analytics, telemetry, or usage data. |
| **Minimal permissions** | Only requires microphone access (via ffmpeg) and network access (to ElevenLabs API). |

**Third-party data processing**: Audio is processed by [ElevenLabs](https://elevenlabs.io) under their [privacy policy](https://elevenlabs.io/privacy). Review their data retention and processing terms if you dictate sensitive information.

## Development

```bash
npm install
npm run watch   # compile on save
npm test        # run tests
npm run lint    # eslint
# Press F5 to launch Extension Development Host
```

## License

MIT
