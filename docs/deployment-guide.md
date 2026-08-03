# GitHub Actions gates the extension bundle before release

The repository's `ci.yml` workflow runs on pull requests and pushes to `main` using Node 22. It installs the lockfile, executes the test suite, runs ESLint, and creates the esbuild bundle. A release should not proceed while any of those checks fail.

## Packaging includes runtime material and excludes the working repository

The extension manifest points to `out/extension.js`. `.vscodeignore` excludes TypeScript sources, tests, local configuration, BMAD artifacts, repository instructions, temporary files, and pre-existing VSIX files. Run the packaging command only after a clean production bundle, then inspect the VSIX contents so credentials, local notes, and planning material are absent.

## Runtime dependencies are intentionally external

The installed extension requires a compatible VS Code host and local ffmpeg. ElevenLabs operation requires a configured API key; Google operation requires Application Default Credentials plus a configured project and location. Claude features require Claude Code and its own authenticated runtime. Packaging must not embed any of those credentials or executables.

## Release evidence should cover more than CI's mocked boundaries

Before publishing a version that changes capture, providers, projection, or cleanup, run smoke checks on the affected operating systems and live providers. Confirm microphone discovery, partial and final output, stop-and-drain, cancellation, settings changes, and the absence of transcript-value logging. The current CI workflow does not provide this integration evidence.

## Rollback is a marketplace version change rather than a server deployment

Voice Scribe has no deployed backend owned by this repository. A defective release is contained by stopping publication, documenting the affected version, and publishing a corrected extension version. Provider-side incidents should degrade through clear user errors and raw-text preservation rather than silent loss or a partially written local history.
