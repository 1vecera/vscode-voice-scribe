# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Build (bundle with esbuild for production)
npm run esbuild-base

# Compile TypeScript (for development/testing)
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch

# Lint
npm run lint

# Run all tests
npm test

# Run a single test file
npx mocha 'out/test/audioCapture.test.js' --timeout 10000

# Package .vsix for distribution
npx @vscode/vsce package

# Debug: press F5 in VSCode to launch Extension Development Host
```

Tests require `npm run compile` first (the `pretest` script handles this for `npm test`).

## Architecture

**Voice Scribe** is a VSCode extension that streams microphone audio to the ElevenLabs Scribe v2 realtime API and inserts transcribed text at the cursor with live rewriting.

### Core Data Flow

```
Microphone → ffmpeg (child_process) → 100ms PCM chunks → WebSocket → ElevenLabs API
                                                                          ↓
Editor ← handleCommitted() ← committed_transcript    ←──── VAD silence detection
Editor ← handlePartial()   ← partial_transcript      ←──── interim hypothesis
```

### Source Modules

- **extension.ts** — Entry point. Registers commands, manages recording state, and handles editor mutations. Talks to a provider only through the `TranscriptionProvider` interface (`transcriber` variable) — never a concrete service. Partial transcripts replace a "live zone" (dotted underline decoration) that gets locked in on commit. All editor edits are serialized through an `editQueue` promise chain to prevent race conditions.

- **transcriptionProvider.ts** — The provider contract (`startTranscription(onPartial,onFinal)`, `sendAudioChunk`, `stopTranscription`, `getFullTranscript`, `dispose`). Every backend implements it.

- **providerRegistry.ts** — Data-driven registry of providers. Each `ProviderDescriptor` carries `{id, label, detail, create(config), configure(config), setupHint}`. `extension.ts` reads it for init, the provider picker, credential setup, and the not-set-up guard — **no per-provider branching anywhere**. **To add a provider:** implement `TranscriptionProvider` in `src/<name>Service.ts`, append one descriptor to `PROVIDERS`, and add the id (+ any `voiceScribe.<name>*` settings) to package.json.

- **elevenLabsService.ts** — WebSocket client for the ElevenLabs realtime STT API. Sends base64-encoded audio chunks, receives partial/committed transcript messages. On stop, waits 2 seconds for final VAD commits before closing.

- **googleSpeechService.ts** — Google Cloud Speech-to-Text V2 streaming (Chirp 3) over gRPC `_streamingRecognize`. Auth via ADC (no API key), regional endpoint `<location>-speech.googleapis.com`, config-first write then `{audio}` frames, interim→onPartial / final→onFinal. Reopens the stream on the V2 duration cap. Maps the ISO 639-1 language picker to BCP-47.

- **audioCapture.ts** — Spawns ffmpeg with platform-specific input (`avfoundation` on macOS, `alsa` on Linux, `dshow` on Windows). Outputs 16kHz/16-bit/mono PCM. Buffers stdout into exactly 3200-byte chunks (100ms of audio). Provider-agnostic — feeds whichever provider is active.

### Key State in extension.ts

- `liveStart` / `liveRange` — Track the editor region containing unconfirmed (partial) text
- `editQueue` — Promise chain ensuring editor mutations don't interleave
- `isRecording` — Guards against double-start/stop

### Extension Manifest

Commands: `voiceScribe.toggleRecording`, `configureApiKey`, `selectLanguage`, `selectProvider`, `polishLast`, `setRecordingPrefix`, `generateKeyterms`
Keybinding: `Cmd+Alt+V` / `Ctrl+Alt+V` toggles recording
Configuration: `voiceScribe.provider` (`elevenlabs`|`google`), `voiceScribe.apiKey` (ElevenLabs), `voiceScribe.google{Project,Location,Model}` (Google), `voiceScribe.language` (ISO 639-1 code, default "auto")

### Testing

Mocha + Sinon with proxyquire for dependency injection. Mock factories for vscode API and ChildProcess are in `src/test/helpers.ts`; WebSocket and the Google duplex stream are mocked inline per-suite. Suites cover extension commands/state + provider selection, the ElevenLabs WebSocket protocol, the Google streaming protocol, and platform-specific ffmpeg spawning.

### Runtime Dependencies

`ws` (ElevenLabs WebSocket) and `@google-cloud/speech` (Google Chirp 3, bundled into `out/extension.js` by esbuild). Audio capture uses system ffmpeg (must be installed). The Google provider needs gcloud Application Default Credentials.
