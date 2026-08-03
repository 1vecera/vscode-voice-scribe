# Each module has a clear boundary except the extension coordinator

| Component | Responsibility | Main collaborators | Automated evidence | Change risk |
|---|---|---|---|---|
| `extension.ts` | Activation, commands, configuration, lifecycle serialization, transcript projection, spoken commands, paragraph tracking, polish coordination, status UI | Every runtime module and VS Code | `extension.test.ts` | High because unrelated behaviors share mutable session state |
| `transcriptionProvider.ts` | Provider-neutral streaming speech contract and callback types | Provider adapters, coordinator | Exercised by provider and coordinator tests | Low and strategically important |
| `providerRegistry.ts` | Provider metadata, factory selection, capability flags | Provider adapters, configuration | `providerRegistry.test.ts` | Low |
| `elevenLabsService.ts` | WebSocket session, Scribe events, vocabulary sanitization, bounded drain | `ws`, provider contract | `elevenLabsService.test.ts` | Medium because timing and protocol behavior are external |
| `googleSpeechService.ts` | Google client initialization, regional streaming, buffering, restart, model and language behavior | `@google-cloud/speech`, provider contract | `googleSpeechService.test.ts` | High because stream lifecycle and model rules interact |
| `audioCapture.ts` | ffmpeg discovery, platform device arguments, PCM chunking, graceful termination | Node child processes, filesystem, operating system | `audioCapture.test.ts` | High at operating-system boundaries |
| `claudePolish.ts` | Prompt construction, Claude process execution, cancellation, timeout, output validation | `resolveClaude.ts`, Node child processes | `claudePolish.test.ts` | Medium because model behavior is nondeterministic outside mocks |
| `claudeKeyterms.ts` | Workspace-context collection, Claude keyterm generation, sanitization, persistence | VS Code workspace state, `resolveClaude.ts` | `claudeKeyterms.test.ts` | Medium because repository context can be large or sensitive |
| `resolveClaude.ts` | Cross-platform Claude executable discovery | Environment, filesystem | Indirectly covered by Claude module tests | Medium |
| `vocabularyBuilder.ts` | Static and workspace-derived speech vocabulary | VS Code document and workspace state | `vocabularyBuilder.test.ts` | Low |

## The next iteration needs new seams before new surface area

The intended cleanup engine, preview state, note store, and mode profiles do not map cleanly onto current modules. The target architecture should extract `TranscriptSession`, `CleanupProvider`, `TranscriptProjection`, `NoteStore`, and `OutputSink` boundaries, leaving `extension.ts` responsible for VS Code activation and composition rather than pipeline correctness.
