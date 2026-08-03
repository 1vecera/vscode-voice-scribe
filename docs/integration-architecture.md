# Five external boundaries determine Voice Scribe's runtime behavior

The extension integrates with the VS Code host, a local ffmpeg executable, one speech provider, and optionally the Claude Code executable. It owns orchestration and presentation but does not own external service availability, provider retention, microphone drivers, or model behavior.

| Boundary | Local contract | Data sent | Result received | Credential path | Failure handling |
|---|---|---|---|---|---|
| VS Code extension host | Commands, configuration, editor edits, terminal writes, status-bar UI | Command intent and extension-owned text edits | Active editor, workspace configuration, lifecycle events | None | Disable unavailable actions, show actionable errors, dispose subscriptions |
| ffmpeg | Spawned process producing raw PCM on stdout | Input-device arguments; no transcript | 16 kHz, mono, signed 16-bit PCM chunks | None | Surface missing binary or device errors, terminate process, stop session |
| ElevenLabs Scribe realtime | WebSocket streaming session | PCM audio and sanitized vocabulary terms | Partial and committed transcript events | API key from VS Code configuration | Bound final drain, close socket, reject authentication and protocol failures |
| Google Speech-to-Text V2 | Regional gRPC streaming recognizer | PCM audio, recognition configuration, optional adaptation terms | Interim and final recognition results | Application Default Credentials | Buffer while stream starts, restart bounded streams, drain final result, stop on fatal error |
| Claude Code | Spawned CLI process for polish or keyterm generation | Dictated paragraph and limited context, or repository context for keyterms | Rewritten paragraph or sanitized keyterms | Claude Code's local authentication | Resolve executable, enforce timeout and cancellation, preserve original text on failure |

## Speech-provider differences remain inside their adapters

ElevenLabs uses Scribe v2 realtime over WebSocket with provider-side voice activity detection. Google uses Speech-to-Text V2 over gRPC, regional endpoints, recognizer model selection, and stream restart logic. The registry exposes only stable capabilities to the coordinator. Google automatic language selection is limited by model support; unsupported combinations fall back to an explicit language and warn the user.

## Credential storage is functional but not equivalent across providers

Google credentials remain in the local Application Default Credentials chain. The ElevenLabs API key is currently a VS Code setting, which makes it configuration data rather than secret-storage data. Documentation must not imply that the extension cryptographically protects this key. Moving it to `SecretStorage` is a security-hardening candidate, not current behavior.

## Privacy claims stop at the extension boundary

The extension does not write audio or transcript history and does not emit telemetry. Audio and text still cross to the explicitly selected cloud or model-provider boundary. Incognito behavior proposed for the next iteration can guarantee that the extension skips its own persistent note store; it cannot guarantee zero provider retention without provider-specific contractual evidence.

## Integration evolution should preserve ports and explicit fallback

New speech providers should implement `TranscriptionProvider`. New cleanup models should implement a separate cleanup contract instead of adding model branches to `extension.ts`. Storage and output destinations should receive equivalent ports. Every asynchronous integration should expose cancellation, bounded timeout or drain behavior, typed failure state, and a user-visible fallback that preserves raw text.
