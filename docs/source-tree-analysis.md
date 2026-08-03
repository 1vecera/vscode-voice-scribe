# The repository is a single extension package with one orchestration hotspot

Voice Scribe uses a flat TypeScript source tree, a colocated unit-test tree, an esbuild bundle, and one GitHub Actions workflow. There are no application subpackages, generated source trees, database migrations, or backend services.

```text
vscode-voice-scribe/
├── src/
│   ├── extension.ts                 activation, session lifecycle, commands, editor projection
│   ├── transcriptionProvider.ts     speech-provider contract
│   ├── providerRegistry.ts          provider descriptors and construction
│   ├── elevenLabsService.ts         ElevenLabs realtime adapter
│   ├── googleSpeechService.ts       Google Speech V2 adapter
│   ├── audioCapture.ts              ffmpeg discovery, capture, chunking, shutdown
│   ├── claudePolish.ts              Claude Code paragraph cleanup
│   ├── claudeKeyterms.ts            repository-aware vocabulary generation
│   ├── resolveClaude.ts             Claude executable discovery
│   ├── vocabularyBuilder.ts         domain-vocabulary construction
│   └── test/                         Mocha, Sinon, and mocked VS Code unit tests
├── .github/workflows/ci.yml         test, lint, and bundle checks
├── package.json                     extension manifest, settings, scripts, dependencies
├── tsconfig.json                    strict TypeScript compilation
├── esbuild.js                       production bundle configuration
├── README.md                        user setup and operation
├── CHANGELOG.md                     release history
└── image/                            marketplace media
```

## Source ownership follows runtime boundaries except in the coordinator

The provider adapters own network protocol details, `AudioCapture` owns process and byte-stream behavior, and the Claude modules own command invocation and prompt construction. `extension.ts` crosses all of those boundaries and additionally owns editor state, command semantics, pause timers, status presentation, and cancellation. Any next-iteration work that adds a second transformation stage or a persistent store should first extract session, projection, and cleanup contracts so the coordinator does not become the only place where correctness can be enforced.

## Tests mirror implementation modules but stop at mocked process boundaries

The `src/test/` suite covers audio capture, both speech providers, the extension coordinator, provider registration, vocabulary construction, Claude keyterms, and Claude polishing. External processes, real microphones, live provider credentials, VS Code extension-host behavior, and provider-side timing are mocked or absent. That is appropriate for fast CI but leaves cross-boundary risk for manual or dedicated integration verification.

## Build and packaging discard development-only material

TypeScript is bundled to `out/extension.js`; VS Code and native/external services remain runtime boundaries. `.vscodeignore` excludes sources, tests, local BMAD material, repository instructions, and temporary files from the extension package. The marketplace artifact therefore contains the bundle, manifest, README, changelog, license, and required images rather than the working repository.
