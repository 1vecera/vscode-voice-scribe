# Local development uses the bundled TypeScript extension workflow

Voice Scribe requires Node.js compatible with the repository and VS Code extension tooling. The CI reference environment is Node 22. Install dependencies from the lockfile before building or testing.

```bash
npm ci
```

## Fast checks cover compilation, unit behavior, lint, and bundling

```bash
npm test
npm run lint
npm run esbuild-base
```

`npm test` compiles TypeScript and runs the Mocha suite under `out/test/**/*.test.js`. The suite uses Sinon and a mocked VS Code module, so it does not require a live extension host, microphone, speech-provider credential, or Claude account. `npm run esbuild-base` produces the development bundle consumed by the extension manifest.

## Extension-host debugging exercises the actual VS Code boundary

Open the repository in VS Code and run the extension launch configuration. Use a real untitled or workspace document, verify the configured audio input, and select a provider whose credentials are present. Live checks should cover startup, partial text replacement, final insertion, stop-and-drain, provider switching, terminal targeting, and cancellation of any in-flight polish.

## Provider tests should preserve raw text when dependencies fail

When changing an adapter, test startup failure, authentication rejection, network close, delayed final results, duplicate or late callbacks, cancellation, and disposal. When changing editor projection, test ordering under rapid partial and final events. New cleanup behavior should never block raw transcription publication indefinitely and should expose a deterministic raw fallback.

## Source conventions favor explicit ownership over ambient state

Keep provider-specific branching inside registries or adapters. Preserve strict TypeScript types, injectable external boundaries, serialized editor edits, bounded buffers, and idempotent disposal. Logs may include lifecycle events and character counts but must not include raw audio, transcript content, credentials, or full model prompts.

## BMAD artifacts guide changes but current code remains the executable truth

Read [the documentation index](index.md) and `_bmad-output/project-context.md` before implementation. Planning artifacts describe proposed behavior and may contain open questions; do not treat a draft requirement or UX state as shipped behavior. Update the artifacts when a decision changes the intended contract.
