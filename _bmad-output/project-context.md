---
project_name: voice-scribe
user_name: Daniel
date: 2026-08-03
sections_completed:
  - technology-stack
  - language-and-module-rules
  - architecture-and-lifecycle-rules
  - testing-rules
  - quality-and-privacy-rules
  - workflow-rules
  - change-scope-rules
status: complete
optimized_for_llm: true
sources:
  - docs/index.md
  - docs/architecture.md
  - _bmad-output/planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/ARCHITECTURE-SPINE.md
---

# AI agents must preserve raw dictation while evolving the pipeline

This file contains the non-obvious rules an implementation agent must follow. `docs/` describes shipped v0.6.1 behavior; `_bmad-output/planning-artifacts/` describes proposed behavior and may contain unresolved decisions. Code and tests remain the executable truth.

## The repository uses a strict bundled TypeScript extension stack

- Use TypeScript 5.9.3 under the existing strict `tsconfig.json`; do not weaken compiler checks to land a change.
- Target the VS Code extension engine declared as `^1.85.0` and preserve CommonJS ES2021 bundle compatibility.
- Use the existing esbuild 0.27.3 pipeline and keep `vscode` external to the bundle.
- Preserve Node 22 as the CI reference runtime unless the workflow and compatibility evidence change together.
- Keep runtime dependencies deliberate: `@google-cloud/speech` 7.4.0 and `ws` 8.19.0 are current shipped boundaries.
- Keep Mocha 10.8.2 and Sinon 17.0.1 test conventions unless a separately approved migration replaces the whole harness coherently.

## TypeScript modules expose dependencies rather than hiding them

- Use explicit interfaces for speech, cleanup, projection, storage, output, clock, and diagnostics boundaries; provider names do not belong in session branching.
- Inject child processes, network clients, clocks, and VS Code boundaries so tests can control timing, failures, and cancellation.
- Use discriminated unions for segment events and typed failure outcomes; do not use message-string inspection to drive behavior.
- Keep opaque session, segment, revision, and cleanup-attempt identity independent of transcript content and array position.
- Store instants as UTC ISO 8601 strings and durations as integer milliseconds; inject time in tests.
- Name files and exported types for the capability they own; generic `manager`, `helper`, `data`, or `utils` modules require a narrower name.

## One session core owns mutable state and every adapter depends inward

- `TranscriptSession` is the sole owner of lifecycle state, cancellation, profile snapshot, privacy snapshot, segment registry, and terminal transition.
- Domain and application modules must not import VS Code, provider SDKs, Node child-process APIs, or a concrete persistence library.
- Convert provider callbacks to immutable session events before projection, storage, output, or diagnostics consumes them.
- Keep Raw Text immutable after stable recognition; store each Cleanup Revision separately and select it by reference.
- Run cleanup through bounded capacity, per-request timeout, cancellation, and a bounded session-stop drain.
- Publish cleaned segments through one Ordered Publication Barrier; completion order must never become visible transcript order.
- Treat timeout, cancellation, authentication, quota, safety, malformed output, and provider failure as typed terminal cleanup outcomes with Raw Text fallback.
- Snapshot Mode Profile, Voice Profile version, providers, persistence policy, and Output Sink at recording start; setting changes begin a new session boundary.
- Enforce Incognito by composing no-write persistence and persistent-diagnostics adapters; application code may not bypass those ports.
- Reject every callback whose session identity is no longer active, including callbacks arriving after stop, settings change, provider change, reload, or disposal.

## Tests control completion order and inspect durable boundaries

- Keep tests beside the existing modules under `src/test/` until a deliberate package restructure moves implementation and tests together.
- Use deterministic fakes for speech, cleanup, clock, store, sink, and diagnostics; unit tests never require a microphone, cloud credential, or installed Claude process.
- Characterize current v0.6.1 partial replacement, final insertion, command transformation, stop-and-drain, settings change, and cancellation before extracting orchestration.
- Randomize cleanup completion order under repeatable seeds and assert capture-order publication, one terminal outcome per attempt, and no late-event mutation.
- Test every failure path with Raw Text preserved and every owned resource disposed within a bound.
- Inspect all durable adapters after an Incognito session and assert zero session-derived writes, including notes, task outputs, recovery checkpoints, caches, and diagnostics.
- Run `npm test`, `npm run lint`, and `npm run esbuild-base` before review; add live provider or extension-host evidence when the changed boundary is not represented by mocks.

## Privacy and observability are enforced by type shape

- Never log or persist audio, transcript content, Cleanup Revisions, note content, credentials, full prompts, or repository context gathered for model input.
- Diagnostic event types may expose timing, queue depth, state transition, provider category, model identifier, and typed error category only.
- Keep credentials out of session events, stores, task outputs, diagnostic payloads, and command arguments; resolve them inside the owning adapter.
- State privacy boundaries precisely: Incognito controls extension-owned writes and does not prove external-provider zero retention.
- Preserve actionable user-visible fallback: cleanup failure continues raw dictation, sink failure leaves text recoverable, and storage failure states that the note was not saved.

## Repository changes ship through isolated review

- Make every change in a dedicated worktree under `.claude/worktrees/<slug>` on a non-main branch.
- Commit, push, open a GitHub pull request, and wait for green CI; never merge without Daniel's explicit confirmation.
- Run `gh auth status` before GitHub commands and use the `1vecera` account for this personal repository.
- Preserve unrelated dirty files and ignored local backlog material; do not fold them into a change without an explicit artifact decision.
- Use `apply_patch` for text edits, `rg` for search, repository-local `tmp/` for scratch, and `uv run` for any Python command.

## Proposed behavior stays gated by unresolved product decisions

- Do not implement the Gemini adapter until authentication, billing, SDK, timeout, and quota policy are approved and reverified against current official documentation.
- Do not freeze Task Spec output types until Daniel approves the schema.
- Do not select a Note Store technology until retention, scope, storage location, encryption, deletion, and recovery requirements are approved.
- Do not treat the supplied panel screenshot as a pixel contract; prototype raw-versus-clean composition at narrow and wide VS Code widths.
- Do not invent numeric latency or quality targets; collect content-free baselines and record approved thresholds before acceptance.

## Agents should keep this file lean and current

Read this context before implementation and follow the more restrictive binding rule when documents differ. Update it only when a durable implementation convention changes; leave feature rationale and rejected alternatives in the relevant BMAD memlog or planning artifact.
