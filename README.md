# Voice Scribe

> Real-time voice-to-text for VS Code. Choose your transcription engine — [ElevenLabs Scribe v2](https://elevenlabs.io) (API key) or [Google Cloud Speech-to-Text V2](https://cloud.google.com/speech-to-text) (gcloud ADC, no key) — and watch your words appear, rewrite, and refine in real time across 34 languages.

## Features

### Core

- **Two transcription providers** — switch between **ElevenLabs Scribe v2** (API key) and **Google Cloud Speech-to-Text V2** (gcloud Application Default Credentials, no key) with one command. Same live-rewrite editor experience either way. See [Providers](#providers).
- **Live rewriting** — partial transcripts replace the "live zone" (dotted underline) in your editor as the model refines its hypothesis; text corrects itself as you speak
- **Toggle recording** — `Cmd+Alt+V` / `Ctrl+Alt+V` starts and stops with one shortcut
- **Prompt-field paste** — start recording from a chat or prompt input and the completed transcript is pasted there when you stop
- **VAD auto-commit** — voice activity detection automatically commits text when you pause speaking
- **Idle auto-stop** — recording stops automatically after 2 minutes of silence so you never forget to turn it off
- **34 languages** — English, Chinese, Spanish, Hindi, Portuguese, Russian, Japanese, German, French, Italian, Korean, and [23 more](#supported-languages). Defaults to auto-detect.

### Smart Text Handling

- **Smart insert mode** — automatically wraps transcriptions in line comments when you're in a code file, inserts plain text in prose files (markdown, plaintext, etc.)
- **Filler word removal** — strips "um", "uh", "hmm", "mhm" automatically for clean output
- **Voice commands** — say "undo", "redo", "delete line", "save", "stop", "new line", "select all" and Voice Scribe executes the command instead of typing it
- **Prefix commands** — say "todo fix the login bug" and it inserts `TODO: fix the login bug`. Also supports `FIXME`, `NOTE`, `HACK`.
- **Terminal target** — send transcriptions directly to the integrated terminal instead of the editor

### Audio

- **VAD sensitivity presets** — `low` (noisy office/cafe), `medium` (normal room), `high` (quiet room/headset). Controls how aggressively non-speech audio is rejected.
- **Cross-platform** — macOS (avfoundation), Linux (ALSA), Windows (DirectShow) via ffmpeg

### Vocabulary

- **Custom vocabulary** — boost domain-specific terms like API names, project jargon, or unusual words. Supports boost factor (1.0–10.0) and phoneme hints. Max 200 entries.
- **Auto vocabulary** — automatically extracts identifiers from your open files (via DocumentSymbolProvider or regex fallback) and boosts them in recognition. Your variable names, function names, and class names get recognized correctly.

## Requirements

- **VS Code** 1.85+
- **ffmpeg** installed and on PATH
- **One transcription provider**, either:
  - **ElevenLabs** — an API key with Scribe v2 access ([elevenlabs.io](https://elevenlabs.io)), or
  - **Google Cloud** — the [gcloud CLI](https://cloud.google.com/sdk) with Application Default Credentials (`gcloud auth application-default login`) and the Speech-to-Text API enabled on your project. No API key.

```bash
# macOS
brew install ffmpeg

# Linux (Debian/Ubuntu)
sudo apt install ffmpeg

# Windows
choco install ffmpeg

# Google provider only — one-time auth (no API key needed)
gcloud auth application-default login
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

- **Configure API key** — `Cmd+Shift+P` → *Voice Scribe: Configure API Key*
- **Start recording** — `Cmd+Alt+V` (macOS) / `Ctrl+Alt+V` (Windows/Linux)
- **Speak** — in a file editor, text appears and rewrites in real time; in a chat or prompt field, recording continues without live text
- **Stop recording** — press the same shortcut again, or say "stop"; prompt-field recordings are pasted at this point

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

## Providers

Voice Scribe can transcribe with either ElevenLabs or Google Cloud — one active at a time. Switch with the command palette: `Cmd+Shift+P` → *Voice Scribe: Select Provider*, or set `voiceScribe.provider`.

| | ElevenLabs (default) | Google Cloud |
|---|---|---|
| Model | Scribe v2 Realtime | Speech-to-Text V2 streaming — `long` (default) or `chirp_3` |
| Auth | API key (`voiceScribe.apiKey`) | gcloud Application Default Credentials — **no API key** |
| Setup | *Voice Scribe: Configure API Key* | `gcloud auth application-default login` |
| Transport | WebSocket (`wss://`) | gRPC streaming to a regional endpoint |
| Keyterm biasing | ✅ (see [Custom Vocabulary](#custom-vocabulary)) | — (V2 streaming has no realtime biasing hook) |

**Google setup (one time):**

1. `gcloud auth application-default login`
2. Ensure the Speech-to-Text API is enabled on your project (`gcloud services enable speech.googleapis.com`).
3. *Voice Scribe: Select Provider* → **Google Cloud**.
4. (Optional) Set `voiceScribe.googleProject` if ADC doesn't resolve your project, and `voiceScribe.googleLocation` (default `eu`) to a region that serves your model.

### Choosing a Google model — speed vs. accuracy

Switch any time with `Cmd/Ctrl+Alt+M` (*Voice Scribe: Select Google Model*). The pick shows each model's trade-off.

Measured end-to-end (keypress → text on screen), `eu` region, median of 3 runs:

| Model | First text | Updates | Lag behind speech | Best for |
|---|---|---|---|---|
| **`long`** (default) | **~0.85s** | every ~60ms | ~185ms | Dictation. English matches Chirp 3 exactly. |
| `short` | ~0.95s | every ~60ms | ~220ms | Short phrases and commands. |
| `chirp_3` | ~5.6s | every ~5s | ~730ms | Czech and other non-English speech; the only model with language auto-detect. |

**Why the gap:** the Chirp family emits a streaming result only once per ~5 seconds of audio, so a word spoken at 0.5s cannot appear until the 5-second boundary passes. The conformer models emit every ~60ms. On English both produce identical transcripts, which is why `long` is the default.

**If you dictate in Czech** (or another non-English language), switch to `chirp_3` — it is noticeably more accurate there and handles Czech/English code-switching well in `"auto"` language mode. `long` and `short` require an explicit language; if `voiceScribe.language` is `"auto"` they fall back to `en-US` and tell you.

## Configuration

All settings are under `voiceScribe.*` in your VS Code settings.

| Setting | Default | Description |
|---|---|---|
| `provider` | `"elevenlabs"` | Transcription engine: `"elevenlabs"` or `"google"`. Switch with *Voice Scribe: Select Provider*. |
| `apiKey` | `""` | Your ElevenLabs API key (provider `elevenlabs` only) |
| `googleProject` | `""` | GCP project ID (provider `google`). Empty = auto-detect from ADC. |
| `googleLocation` | `"eu"` | GCP region for streaming, e.g. `eu`, `us`, `europe-west4`. Must serve the chosen model (`chirp_3` needs `eu`; `chirp_2` is not in `eu`). |
| `googleModel` | `"long"` | Google Speech-to-Text V2 model. `long`/`short` = near-instant, need an explicit language. `chirp_3`/`chirp_2` = best non-English accuracy + auto-detect, but ~5s behind speech. Switch with *Voice Scribe: Select Google Model* (`Cmd/Ctrl+Alt+M`). |
| `language` | `"auto"` | Language for recognition ([ISO 639-1 code](#supported-languages)). `"auto"` lets the engine detect your language (best for code-switching, e.g. Czech ↔ English). |
| `insertMode` | `"smart"` | `"plain"` = as-is, `"comment"` = always wrap in line comment, `"smart"` = auto-comment in code, plain in prose |
| `removeFiller` | `true` | Strip filler words (um, uh, hmm, mhm) from transcriptions |
| `enableVoiceCommands` | `true` | Execute voice commands instead of typing them |
| `target` | `"editor"` | `"editor"` = live insertion in the editor where recording starts and paste-on-stop in prompt fields, `"terminal"` = send to the integrated terminal, `"paste"` = always paste on stop |
| `vadSensitivity` | `"medium"` | VAD preset: `"low"` (noisy), `"medium"` (normal), `"high"` (quiet) |
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

Use the command palette: `Cmd+Shift+P` → *Voice Scribe: Select Language* (or `Cmd/Ctrl+Alt+L`) for a quick-pick menu instead of editing settings manually.

### Select Google Model

`Cmd/Ctrl+Alt+M`, or `Cmd+Shift+P` → *Voice Scribe: Select Google Model*. Each entry shows its latency/accuracy trade-off, and the picker warns if a model isn't served from your configured region or can't auto-detect your language. See [Choosing a Google model](#choosing-a-google-model--speed-vs-accuracy).

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
Microphone → ffmpeg → 100ms PCM chunks → TranscriptionProvider → ElevenLabs (wss) / Google (gRPC)
                                                       ↓
Editor ← handleCommitted() ← onFinal   (committed)  ← interim/final results
Editor ← handlePartial()   ← onPartial (interim)
```

- **ffmpeg** captures raw microphone audio as 16 kHz / 16-bit / mono PCM
- Audio is buffered into fixed chunks of `voiceScribe.audioChunkMs` (default 20 ms / 640 bytes) and flushed straight to the provider
- A `TranscriptionProvider` streams those chunks to the selected engine:
   - **ElevenLabs** — base64 over an encrypted WebSocket (`wss://`) to the Scribe v2 realtime API
   - **Google** — `{ audio }` frames over gRPC `StreamingRecognize` to a regional endpoint (auth via ADC). The client, its gRPC channel and the resolved project ID are pre-warmed at activation and reused across recordings; the stream opens concurrently with ffmpeg, and audio captured during setup is buffered so the first word is never clipped.
- Interim results (`onPartial`) replace the live zone — the model rewrites earlier words as context grows
- Final/committed results (`onFinal`) lock text in place, apply comment wrapping if needed, and advance the cursor
- An edit queue serializes all editor mutations to prevent race conditions
- On stop, a short drain window catches the last committed segment before closing the stream. The Google provider also transparently reopens its stream if it hits the V2 streaming duration cap mid-dictation.

## Security & Privacy

Voice Scribe handles microphone audio and sends it to an external API. We take this seriously:

| Concern | How it's handled |
|---|---|
| **Audio transmission** | Audio is streamed over an encrypted connection — WebSocket (`wss://`) to ElevenLabs, or TLS gRPC to Google Cloud. No unencrypted connections. |
| **No local audio storage** | Audio is streamed in real time and never written to disk. Chunks exist only in memory during recording. |
| **No transcript logging** | Transcript content is never logged to the Output Channel or console. Only message types and character counts appear in logs. |
| **Credentials** | ElevenLabs: API key in VS Code global settings (`settings.json`); the input prompt masks it. Google: no key — uses your local gcloud Application Default Credentials, which never leave your machine via the extension. |
| **Memory cleanup** | Transcript data is cleared from memory when recording stops and when the extension is deactivated. |
| **No telemetry** | The extension collects no analytics, telemetry, or usage data. |
| **Minimal permissions** | Only requires microphone access (via ffmpeg) and network access (to ElevenLabs API). |

**Third-party data processing**: Audio is processed by your chosen provider — [ElevenLabs](https://elevenlabs.io) ([privacy policy](https://elevenlabs.io/privacy)) or [Google Cloud](https://cloud.google.com/speech-to-text) ([data usage](https://cloud.google.com/speech-to-text/docs/data-usage)). Review their data retention and processing terms if you dictate sensitive information.

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
