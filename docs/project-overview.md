# Voice Scribe turns live speech into editable text inside VS Code

Voice Scribe v0.6.1 is a desktop VS Code extension for low-friction dictation into an editor or integrated terminal. It captures microphone audio through a local ffmpeg process, streams raw PCM to a selected speech-to-text provider, previews partial recognition in place, and commits final segments through a serialized editor-edit pipeline. Optional Claude Code polishing can revise the most recent dictated paragraph without leaving the editor.

## The shipped product serves a keyboard-centric individual author

The primary user is a developer or technical writer already working in VS Code who wants to speak prose or commands without switching applications. The product assumes a local desktop, an available microphone, ffmpeg, and either an ElevenLabs API key or Google Cloud Application Default Credentials. Claude-assisted features additionally require a locally resolvable Claude Code executable.

## The current release already supports a complete dictation loop

- A status-bar control and commands start, stop, and toggle recording.
- ElevenLabs Scribe realtime and Google Cloud Speech-to-Text V2 are interchangeable through a common provider contract.
- Interim text is rendered as a dotted-underlined live range and is replaced by committed transcription.
- Dictation can target the active editor or the integrated terminal.
- Spoken editing commands, prefix commands, smart comment formatting, filler removal, and configurable vocabulary alter committed text.
- Claude polishing can rewrite the most recent dictated paragraph manually or after a configured pause.
- Provider changes, settings changes, idle timeout, disposal, and cancellation close active resources through one lifecycle queue.
- No audio file or transcript history is persisted by the extension, and telemetry is absent.

## The current boundary is intentionally small but has concentrated orchestration risk

The extension is a single TypeScript package with no internal database, web server, or public API. `src/extension.ts` owns activation, command registration, session lifecycle, editor projection, voice-command interpretation, and polishing coordination. Provider-specific network behavior is isolated behind `TranscriptionProvider`, but cleanup, presentation, and storage have no equivalent ports yet. This makes v0.6.1 understandable and deployable, while increasing the change risk of adding modes, live rewritten previews, and durable notes directly to the existing coordinator.

## User data crosses explicit local and cloud boundaries

Microphone audio is captured locally and streamed to the selected speech provider. Claude polishing sends dictated text and limited editor context to a locally spawned Claude Code process, whose configured model provider may process that content remotely. The extension does not persist audio or transcripts, but the cloud providers' own processing and retention policies remain outside the extension's control. ElevenLabs credentials are read from VS Code settings; Google uses local Application Default Credentials.

## The next iteration is documented as a proposal, not shipped behavior

The proposed iteration adds a provider-neutral cleanup pipeline, a Daniel voice profile, concurrent ordered rewriting, raw-versus-clean live preview, a Task Spec mode, and an optional local note store with Incognito bypass. Those capabilities are specified in `_bmad-output/planning-artifacts/` and must not be inferred from this current-state document.
