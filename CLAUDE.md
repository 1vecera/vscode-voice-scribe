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

### Three Source Modules

- **extension.ts** — Entry point. Registers commands, manages recording state, and handles editor mutations. Partial transcripts replace a "live zone" (dotted underline decoration) that gets locked in on commit. All editor edits are serialized through an `editQueue` promise chain to prevent race conditions.

- **elevenLabsService.ts** — WebSocket client for the ElevenLabs realtime STT API. Sends base64-encoded audio chunks, receives partial/committed transcript messages. On stop, waits 2 seconds for final VAD commits before closing.

- **audioCapture.ts** — Spawns ffmpeg with platform-specific input (`avfoundation` on macOS, `alsa` on Linux, `dshow` on Windows). Outputs 16kHz/16-bit/mono PCM. Buffers stdout into exactly 3200-byte chunks (100ms of audio).

### Key State in extension.ts

- `liveStart` / `liveRange` — Track the editor region containing unconfirmed (partial) text
- `editQueue` — Promise chain ensuring editor mutations don't interleave
- `isRecording` — Guards against double-start/stop

### Extension Manifest

Commands: `voiceScribe.startRecording`, `stopRecording`, `configureApiKey`, `selectLanguage`
Keybinding: `Cmd+Alt+V` / `Ctrl+Alt+V` toggles recording
Configuration: `voiceScribe.apiKey` (string), `voiceScribe.language` (ISO 639-1 code, default "auto")

### Testing

Mocha + Sinon with proxyquire for dependency injection. Mock factories for vscode API, ChildProcess, and WebSocket are in `src/test/helpers.ts`. Three test suites cover extension commands/state, WebSocket protocol, and platform-specific ffmpeg spawning.

### Runtime Dependency

Single runtime dep: `ws` for WebSocket. Audio capture uses system ffmpeg (must be installed).
