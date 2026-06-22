# Changelog

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
