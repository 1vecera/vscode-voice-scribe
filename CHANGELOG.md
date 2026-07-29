# Changelog

## 0.6.0

**Google dictation is now near-instant.** First text lands in ~0.85s instead of ~5.6s, and updates arrive every ~60ms instead of every 5s.

Measured end-to-end (keypress → token rendered), `eu` region, median of 3 runs:

| | first token | update cadence | lag behind speech |
|---|---|---|---|
| 0.5.1 (`chirp_3`) | ~5.6s | 5000ms | ~730ms |
| **0.6.0 (`long`)** | **~0.85s** | **60ms** | **~185ms** |

- **Default Google model is now `long`, not `chirp_3`.** This was the dominant cost by an order of magnitude: the Chirp family emits a streaming result only once per ~5 seconds of audio, so a word spoken at 0.5s could not appear before the 5s boundary. The conformer models (`long`, `short`) emit every ~60ms. On English the two produce byte-identical transcripts, so the old default was paying 5 seconds of latency for nothing.
  - **If you dictate in Czech or another non-English language, switch back to `chirp_3`** — it is noticeably more accurate there (and is the only model that supports `voiceScribe.language: auto`). The new picker states the trade-off.
- **New command `Voice Scribe: Select Google Model`** (`cmd/ctrl+alt+m`) — switch models from a quick-pick that shows each one's latency/accuracy trade-off, and warns up front about the two mismatches that used to fail only at record time: a model not served from your region, and `auto` language on a model that cannot auto-detect.
- **`auto` language no longer breaks on non-Chirp models.** `long`/`short` reject `languageCodes: ['auto']` with a raw `INVALID_ARGUMENT`; the service now detects the incompatible pair, falls back to `en-US`, and tells you how to fix it properly.
- **Auth and the gRPC channel are pre-warmed at activation**, and the client is reused across start/stop instead of being closed each time. `getProjectId()` alone measured 380–510ms and was paid on *every* recording start; it is now resolved once and cached.
- **The recognizer stream and ffmpeg now start concurrently** rather than one after the other, so startup costs the slower of the two instead of their sum. Audio captured while the stream is still opening is buffered and flushed, so the first word is never clipped.
- **Workspace vocabulary extraction is skipped for providers that ignore it.** It runs a `DocumentSymbolProvider`, which can block on a cold language server — and the Google provider discarded the result. Providers now declare `usesVocabulary` in the registry.
- **Audio chunks are 20ms instead of 100ms** (`voiceScribe.audioChunkMs`, 10–200). A 100ms chunk withheld up to 100ms of already-captured audio; 20ms matches the models' ~60ms emission cadence. ffmpeg also gets `-fflags nobuffer` and `-flush_packets 1`.
- Recording start no longer waits on a fixed 100ms timer; it resolves on ffmpeg's actual `spawn` event.
- Documented two measured findings that remain your call: `noiseReduction: off` shaves a further ~80ms (the FFT denoiser's cost, ~0.85s → ~0.82s first token and ~185ms → ~153ms lag), and the `basic` preset's 3kHz lowpass discards the fricative band, which can cost recognition accuracy.
- Remaining latency is dominated by CoreAudio microphone capture (~350–500ms to first byte), which ffmpeg exposes no knob for.

## 0.5.1

- Google provider: when no project can be resolved (empty `voiceScribe.googleProject`, no `gcloud config` project, no `GOOGLE_CLOUD_PROJECT`), fail with actionable guidance instead of a cryptic `Unable to detect a Project Id` error. Set `voiceScribe.googleProject`, run `gcloud config set project <id>`, or export `GOOGLE_CLOUD_PROJECT`.

## 0.5.0

- **Google Cloud transcription provider (Chirp 3)** — Voice Scribe now supports two speech-to-text engines, selectable one at a time:
  - **ElevenLabs** Scribe v2 Realtime (API key), or
  - **Google Cloud** Speech-to-Text V2 streaming with the **Chirp 3** model (gcloud Application Default Credentials — **no API key**).
- New command **Voice Scribe: Select Provider** to switch engines; `voiceScribe.provider` setting (`elevenlabs` | `google`).
- New Google settings: `voiceScribe.googleProject` (auto-detected from ADC when empty), `voiceScribe.googleLocation` (default `eu`), `voiceScribe.googleModel` (default `chirp_3`).
- Google path streams the same 16 kHz PCM over gRPC `StreamingRecognize` to a regional endpoint, maps interim→live-rewrite and final→commit (identical editor UX), maps the language picker to BCP-47 (`cs` → `cs-CZ`, etc.), and transparently reopens the stream on the V2 duration cap so long dictations don't drop.
- Internals: providers sit behind a `TranscriptionProvider` interface and a data-driven **provider registry** (`src/providerRegistry.ts`). Adding a provider is one descriptor entry plus a package.json enum value — init, the picker, credential setup, and the not-set-up guard all read from the registry, no per-provider branching. `@google-cloud/speech` is bundled into the extension (no extra runtime install).

## 0.4.2

- Keyterms now save to **workspace** settings (`.vscode/settings.json`) by default — each project keeps its own list. Falls back to global when no workspace is open.
- Generate-keyterms popup now opens the Settings page directly (no two-button prompt).

## 0.4.1

- Fix `spawn claude ENOENT` when VS Code is launched from Dock/Spotlight on macOS. Polish and keyterm generation now resolve the absolute path to the `claude` CLI via `~/.local/bin/claude`, Homebrew, or login-shell PATH — same pattern as the ffmpeg fix in v0.1.3.

## 0.4.0

- **Polish dictation with Claude Code**: voice trigger ("polish that" / "rewrite that"), keybinding `cmd/ctrl+alt+p`, optional idle-pause auto-polish. Uses subscription auth via `claude -p` (no API billing).
- **Auto-generated keyterms**: new command `Voice Scribe: Generate Keyterms from Open Files (Claude Opus)` extracts up to 50 identifiers from README/CLAUDE.md/open files and biases transcription via ElevenLabs' `keyterms` param (+20% per-minute cost when non-empty).
- **Scribe v2 Realtime tuning** (research-backed):
  - `previous_text` capped at 50 chars per ElevenLabs guidance
  - `vad_silence_threshold_secs` dropped from 0.8 to 0.5 (dictation sweet spot)
- Quick keybinding `cmd/ctrl+alt+l` for `Voice Scribe: Select Language`.

## 0.3.1

- Recording prefix: custom string inserted at the cursor when recording starts (configurable via `Voice Scribe: Set Recording Prefix` command)

## 0.3.0

- Toggle recording command with idle auto-stop
- Custom vocabulary support (word boosts + IPA phonemes)
- Filler word removal (client-side regex)
- Voice commands (undo/redo/save/delete line/todo/fixme prefixes)
- Dictate-to-terminal mode
- VAD sensitivity presets (low/medium/high)
- Enhanced noise reduction: basic (afftdn) and neural (RNNoise / arnndn)
- Smart insert mode: comment in code, plain text in prose
- Auto-populate vocabulary from workspace symbols
- Audio event tagging and speaker settings

## 0.1.1

- Added complete marketplace metadata (homepage, bugs, author, gallery banner)
- Switched to `latest` release URLs in README
- Claimed Open VSX namespace for verified status

## 0.1.0 — Initial Release

- Real-time voice-to-text powered by ElevenLabs Scribe v2
- Live rewriting with partial transcript display
- Voice Activity Detection (VAD) auto-commit
- 34 language support
- Cross-platform audio capture via ffmpeg (macOS, Linux, Windows)
- Status bar integration with recording indicator
