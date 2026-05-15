# Changelog

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
