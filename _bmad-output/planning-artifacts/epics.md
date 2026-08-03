---
stepsCompleted:
  - requirements-inventoried
  - epics-shaped-by-user-value
  - stories-decomposed
  - coverage-audited
inputDocuments:
  - briefs/brief-voice-scribe-2026-08-03/brief.md
  - prds/prd-voice-scribe-2026-08-03/prd.md
  - ux-designs/ux-voice-scribe-2026-08-03/EXPERIENCE.md
  - architecture/architecture-voice-scribe-2026-08-03/ARCHITECTURE-SPINE.md
status: draft
created: 2026-08-03
updated: 2026-08-03
---

# Voice Scribe can deliver the next iteration through three user-value epics

## The requirements inventory keeps every story tied to an explicit contract

### Functional requirements

- `FR-CLEANUP-ADAPTER` — Cleanup is provider-neutral and returns typed outcomes.
- `FR-CLEANUP-CONCURRENCY` — Stable segments rewrite concurrently within bounded capacity.
- `FR-CLEANUP-ORDER` — Revisions publish in capture order.
- `FR-CLEANUP-VOICE` — A versioned Daniel Voice Profile shapes cleanup without changing meaning.
- `FR-PROJECTION-STATE` — Raw, rewriting, waiting, ready, failed, and cancelled states remain legible.
- `FR-PROJECTION-ORDER` — Segment position and selected representation remain stable.
- `FR-MODE-PROFILE` — Dictate, Command, Notes, Meeting, and Task Spec reuse one session pipeline.
- `FR-TASK-SPEC` — Task Spec produces a reviewable brief with explicit unknowns and source traceability.
- `FR-NOTE-STORE` — Allowed sessions persist locally with raw and derived representations separated.
- `FR-INCOGNITO` — Incognito forbids extension-owned durable writes.
- `FR-OUTPUT-SINK` — Published output reaches VS Code through replaceable sinks.

### Non-functional requirements

- `NFR-LATENCY` — Raw recognition never waits for cleanup; numeric targets come from measured baselines.
- `NFR-RELIABILITY` — Every stable segment becomes visible as raw or cleaned text through bounded lifecycle behavior.
- `NFR-PRIVACY` — Content and credentials stay out of logs, and provider boundaries remain explicit.
- `NFR-SECURITY` — Credentials stay out of session state, persistence, prompts, diagnostics, and outputs.
- `NFR-OBSERVABILITY` — Content-free diagnostics expose queue and lifecycle health.
- `NFR-MAINTAINABILITY` — Domain and application code remain independent of VS Code and concrete SDKs.
- `NFR-ACCESSIBILITY` — Every control and segment state works through keyboard and assistive technology.

### Architecture and UX requirements

- Transcript Session remains the sole lifecycle owner and snapshots its profile and privacy policy at start.
- Raw Text is immutable provenance; Cleanup Revisions remain separate derived records.
- Adapters implement inward-facing ports and translate external failures into typed outcomes.
- Cleanup uses bounded scheduling and an Ordered Publication Barrier.
- Incognito injects no-write persistence and diagnostics adapters at composition.
- The live surface keeps recording, active Mode Profile, Incognito, and provider health visible.
- Segment state changes never move focus or reading position.
- Task Spec remains reviewable output and never starts implementation.
- Existing v0.6.1 dictation behavior must be characterized before orchestration is extracted.

## Coverage assigns every requirement to a delivery epic

| Requirement | Primary epic | Supporting stories |
|---|---|---|
| `FR-CLEANUP-ADAPTER` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-CLEANUP-PORT`, `STORY-GEMINI-ADAPTER` |
| `FR-CLEANUP-CONCURRENCY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-CLEANUP-SCHEDULER` |
| `FR-CLEANUP-ORDER` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-ORDERED-PUBLICATION` |
| `FR-CLEANUP-VOICE` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-VOICE-PROFILE` |
| `FR-PROJECTION-STATE` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-LIVE-PROJECTION` |
| `FR-PROJECTION-ORDER` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-ORDERED-PUBLICATION`, `STORY-LIVE-PROJECTION` |
| `FR-MODE-PROFILE` | `EPIC-SHAPED-OUTPUTS` | `STORY-MODE-PROFILES` |
| `FR-TASK-SPEC` | `EPIC-SHAPED-OUTPUTS` | `STORY-TASK-SPEC` |
| `FR-NOTE-STORE` | `EPIC-OPTIONAL-MEMORY` | `STORY-NOTE-STORE`, `STORY-SESSION-HISTORY` |
| `FR-INCOGNITO` | `EPIC-OPTIONAL-MEMORY` | `STORY-INCOGNITO` |
| `FR-OUTPUT-SINK` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-OUTPUT-SINKS` |
| `NFR-LATENCY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-BASELINE-HARNESS`, `STORY-CLEANUP-SCHEDULER` |
| `NFR-RELIABILITY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-SESSION-CORE`, `STORY-ORDERED-PUBLICATION`, `STORY-OUTPUT-SINKS` |
| `NFR-PRIVACY` | `EPIC-OPTIONAL-MEMORY` | `STORY-NOTE-STORE`, `STORY-INCOGNITO` |
| `NFR-SECURITY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-SECURE-RUNTIME-DEPENDENCIES`, `STORY-GEMINI-ADAPTER`, `STORY-CONTENT-FREE-DIAGNOSTICS` |
| `NFR-OBSERVABILITY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-CONTENT-FREE-DIAGNOSTICS` |
| `NFR-MAINTAINABILITY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-SECURE-RUNTIME-DEPENDENCIES`, `STORY-HOST-COMPATIBILITY`, `STORY-SESSION-CORE`, `STORY-CLEANUP-PORT`, `STORY-OUTPUT-SINKS` |
| `NFR-ACCESSIBILITY` | `EPIC-TRUSTWORTHY-CLEANUP` | `STORY-LIVE-PROJECTION` |

## `EPIC-TRUSTWORTHY-CLEANUP` lets Daniel keep speaking while visible rewrites catch up

Daniel receives the current fast raw dictation plus provider-neutral, voice-aware cleanup that remains ordered, understandable, cancellable, and safe under failure. The epic includes the minimum brownfield extraction needed to deliver that outcome without placing another asynchronous subsystem inside `extension.ts`.

### `STORY-BASELINE-HARNESS` protects the shipped dictation contract

As Daniel, I want the current recording, projection, command, and shutdown behavior characterized before the session is extracted so that the next iteration does not trade new cleanup for old regressions.

**Acceptance criteria:**

- **Given** the v0.6.1 coordinator and deterministic speech-provider fakes, **when** raw partials, stable segments, stop, provider change, settings change, cancellation, and late callbacks are exercised, **then** tests capture current visible ordering and lifecycle behavior.
- **Given** content-free timing hooks, **when** the current path runs under representative fake event sequences, **then** raw publication latency and edit-queue behavior can be baselined without recording transcript values.
- **Given** the existing test suite, **when** the harness lands, **then** all prior tests remain green and no live credential is required.

### `STORY-SECURE-RUNTIME-DEPENDENCIES` removes known production advisory exposure

As Daniel, I want bundled runtime dependencies free of unreviewed high-severity advisories so that the next iteration does not build new capability on a known vulnerable baseline.

**Acceptance criteria:**

- **Given** the direct WebSocket dependency, **when** the lockfile is refreshed, **then** `ws` resolves to 8.21.0 or newer and the bundle contains the patched resolution.
- **Given** the Google speech dependency tree, **when** production dependencies are refreshed, **then** advisory-affected protobuf and globbing transitive resolutions are patched where compatible.
- **Given** `npm audit --omit=dev`, **when** the production tree is assessed, **then** no high-severity finding remains without a documented reachability review, owner, and Daniel-approved exception.
- **Given** dependency changes, **when** repository checks run, **then** compilation, all existing tests, lint, bundle creation, and one provider-adapter smoke remain green.

### `STORY-HOST-COMPATIBILITY` makes the extension's minimum runtime honest

As Daniel, I want the declared VS Code floor and development toolchain to match what the code is actually compiled and tested against so that installation compatibility is not an unproven promise.

**Acceptance criteria:**

- **Given** the chosen minimum VS Code release, **when** package metadata is updated, **then** `engines.vscode`, `@types/vscode`, `@types/node`, and the extension-host test matrix describe that same floor.
- **Given** TypeScript and lint tooling, **when** versions are selected, **then** ESLint, parser, plugin, and TypeScript form an officially supported tuple and move together.
- **Given** the packaged extension, **when** host smoke runs, **then** activation and core dictation projection work on the declared minimum host and a current supported host.

### `STORY-FFMPEG-CAPABILITY` validates the unbundled audio prerequisite

As Daniel, I want Voice Scribe to verify the actual ffmpeg input capability before recording so that an installed but incompatible executable fails with an actionable setup message.

**Acceptance criteria:**

- **Given** a supported operating system, **when** setup probes ffmpeg, **then** it verifies the executable plus the required `avfoundation`, `alsa`, or `dshow` input capability.
- **Given** a missing or unsupported capability, **when** recording setup runs, **then** it returns a typed failure naming the missing platform requirement and does not spawn a capture session.
- **Given** release documentation, **when** supported platforms are listed, **then** each has recorded ffmpeg capability evidence without pretending the developer machine's exact version is the global minimum.

### `STORY-SESSION-CORE` extracts one lifecycle owner

As Daniel, I want recording transitions to remain deterministic while new stages are added so that starting, stopping, and changing settings never leaves stale text or processes behind.

**Acceptance criteria:**

- **Given** activation composition, **when** a recording begins, **then** one Transcript Session snapshots session identity, Mode Profile, privacy policy, providers, and Output Sink.
- **Given** overlapping lifecycle commands, **when** they arrive, **then** the session serializes idempotent transitions and owns one cancellation scope.
- **Given** scheduler, barrier, provider, or sink outcomes, **when** semantic state changes, **then** only the Transcript Session reducer commits session, segment, attempt, or representation state and emits the resulting canonical event afterward.
- **Given** a terminal session, **when** a late adapter callback arrives, **then** the callback is rejected by session identity and no projection or persistence changes.
- **Given** the extracted core, **when** domain and application imports are inspected, **then** they do not import VS Code, concrete provider SDKs, child-process APIs, or a concrete store.
- **Given** reusable provider clients or prewarm resources, **when** a session stops, **then** only session-scoped streams, requests, timers, processes, and subscriptions are disposed; extension-scoped resources remain until deactivation.

### `STORY-CLEANUP-PORT` defines provider-neutral revision outcomes

As Daniel, I want cleanup behavior independent of one model so that model replacement does not fork the recording pipeline.

**Acceptance criteria:**

- **Given** a stable Transcript Segment and Voice Profile, **when** cleanup is requested, **then** a Cleanup Provider receives immutable input, cancellation, and a request context without credentials in domain state.
- **Given** provider recognition input becomes stable, **when** Transcript Session accepts it, **then** the session assigns immutable Raw Text and a monotonic segment sequence that is the only publication-order key; duplicate or late correction cannot mutate it.
- **Given** optional cleanup context, **when** an adapter succeeds, **then** it replaces only the target segment and cannot split, merge, delete, reorder, or revise context segments.
- **Given** any adapter outcome, **when** it crosses the port, **then** it is a typed success, timeout, cancellation, authentication, quota, safety, malformed-output, or provider failure.
- **Given** a failed outcome, **when** the session records it, **then** Raw Text remains immutable and selected as fallback.

### `STORY-GEMINI-ADAPTER` supplies the initial cleanup implementation

As Daniel, I want Gemini 3.6 Flash to clean stable speech segments so that dictated prose becomes usable while I continue speaking.

**Acceptance criteria:**

- **Given** an approved authentication and billing design, **when** the Gemini adapter starts, **then** it obtains credentials outside Transcript Session state and identifies the configured model.
- **Given** a cleanup request, **when** the provider succeeds, **then** the adapter returns text plus model and Voice Profile version without logging content.
- **Given** authentication, quota, safety, timeout, cancellation, malformed-output, or provider failure, **when** the adapter returns, **then** it emits the matching typed outcome and capture continues.
- **Given** implementation begins, **when** the SDK and model are selected, **then** their current stable official support is reverified and recorded.

### `STORY-CLEANUP-SCHEDULER` bounds concurrent work

As Daniel, I want cleanup to use available parallelism without unbounded backlog so that live dictation stays responsive and predictable.

**Acceptance criteria:**

- **Given** a configured concurrency cap and pending capacity, **when** stable segments arrive rapidly, **then** no more than the cap run and excess work receives explicit backpressure policy.
- **Given** pending capacity is full, **when** another stable segment arrives, **then** speech never blocks, the segment becomes terminal `skipped-capacity`, Raw Text publishes, and saturation is observed without content.
- **Given** randomized completion, timeout, and cancellation, **when** work resolves, **then** each attempt reaches exactly one terminal outcome.
- **Given** session stop, **when** cleanup remains queued or active, **then** queued work cancels, active work drains within a bound, and unresolved segments select Raw Text.
- **Given** content-free diagnostics, **when** the scheduler runs, **then** queue depth, active count, duration, and outcome category are observable without content.

### `STORY-ORDERED-PUBLICATION` prevents completed work from overtaking speech order

As Daniel, I want cleaned segments to appear in the order I spoke them so that the transcript remains readable even when model requests finish unpredictably.

**Acceptance criteria:**

- **Given** later cleanup completes before earlier cleanup, **when** the barrier evaluates results, **then** the later result waits and neither the panel nor editor publishes it early.
- **Given** the earlier segment reaches ready, failed, skipped, or cancelled, **when** the barrier advances, **then** consecutive terminal segments publish in capture order.
- **Given** a duplicate or late adapter result, **when** a cleanup attempt already has a terminal outcome, **then** no second publication occurs.
- **Given** a retry succeeds after Raw Text was initially published, **when** the target projection or sink supports amendment, **then** an in-place representation change advances the representation version without rewinding the barrier.
- **Given** randomized completion orders under automated stress, **when** all attempts settle, **then** publication order equals segment capture order with no duplicate terminal revision.

### `STORY-LIVE-PROJECTION` makes provenance and progress readable

As Daniel, I want to see Raw Text and cleanup state without losing focus so that I know what the system heard and whether the rewrite can be trusted.

**Acceptance criteria:**

- **Given** a Transcript Segment enters raw, rewriting, waiting, ready, failed, or cancelled state, **when** the panel updates, **then** readable text, a non-color-only state label, and relevant action appear on the same stable segment identity.
- **Given** a Cleanup Revision becomes ready, **when** the visible representation changes, **then** focus and reading position remain stable and Raw Text remains available for compare or revert.
- **Given** a cleanup failure, **when** the state becomes failed, **then** Raw Text remains readable, capture continues, and retry appears only when allowed.
- **Given** keyboard and screen-reader use, **when** Daniel operates every session and segment action, **then** controls have meaningful names, states, deterministic focus order, and no hover-only dependency.

### `STORY-VOICE-PROFILE` makes cleanup sound like Daniel without changing facts

As Daniel, I want a versioned writing profile applied to cleanup so that the result sounds natural while preserving what I meant.

**Acceptance criteria:**

- **Given** an approved Voice Profile seeded from `humanize-writing`, **when** cleanup runs, **then** the request records the profile version and forbids invented facts, commitments, names, measurements, and decisions.
- **Given** a private representative evaluation set, **when** raw and cleaned text are compared, **then** reviewers can score meaning preservation, voice fit, and correction effort without sending content to diagnostics.
- **Given** a profile change, **when** an active session is recording, **then** the change applies only at a new session boundary.

### `STORY-OUTPUT-SINKS` preserves editor and terminal delivery behind a port

As Daniel, I want cleaned or raw output to reach my chosen VS Code destination without tying session logic to that destination so that current workflows remain intact and future surfaces stay possible.

**Acceptance criteria:**

- **Given** editor and terminal adapters, **when** a representation publishes, **then** the selected Output Sink receives an immutable event and preserves current editor or terminal semantics.
- **Given** a Mode Profile requests live amendment, reversion, derived output, or durable delivery, **when** recording is validated, **then** the selected sink advertises compatible capabilities or start fails with an actionable message.
- **Given** an append-only terminal sink, **when** the profile is compatible, **then** it receives the ordered terminal representation or operates under an explicit raw-only profile and never duplicates a retry through a stable idempotency key.
- **Given** sink failure, **when** delivery returns a typed failure, **then** live session state and Raw Text remain available for retry or copy.
- **Given** multiple projections consume the same session, **when** a segment publishes, **then** they observe the same selected representation and publication order.

### `STORY-CONTENT-FREE-DIAGNOSTICS` makes pipeline health inspectable without user text

As Daniel, I want enough local evidence to tune cleanup and diagnose failures without leaking what I dictated.

**Acceptance criteria:**

- **Given** compile-time diagnostic event types, **when** a producer emits health data, **then** the type exposes no field for Raw Text, Cleanup Revision, audio, credential, note content, or full prompt.
- **Given** a session under load, **when** health data is collected, **then** timing, queue depth, state transition, provider category, model identifier, and typed error category are available.
- **Given** Incognito, **when** diagnostics execute, **then** persistent diagnostic writes are absent by default.

## `EPIC-SHAPED-OUTPUTS` lets Daniel choose the kind of material he is creating

Daniel can select a Mode Profile before recording and receive behavior appropriate to dictation, commands, notes, meetings, or a reviewable task specification without creating separate capture implementations.

### `STORY-MODE-PROFILES` composes one session through declarative behavior

As Daniel, I want to choose Dictate, Command, Notes, Meeting, or Task Spec before recording so that the same reliable pipeline produces the right working material.

**Acceptance criteria:**

- **Given** a Mode Profile definition, **when** recording starts, **then** cleanup instructions, projection options, persistence policy, and Output Sink validate and snapshot together.
- **Given** an unsupported provider or persistence combination, **when** Daniel tries to start, **then** recording remains idle and an actionable capability message identifies the invalid setting.
- **Given** an active session, **when** Daniel requests a profile change, **then** the product requires a new session boundary rather than changing behavior midstream.
- **Given** every shipped profile, **when** source structure is inspected, **then** none implements a parallel audio or speech lifecycle.

### `STORY-TASK-SPEC` turns a spoken session into explicit implementation intent

As Daniel, I want Task Spec mode to produce a reviewable brief so that a spoken brain dump becomes usable input without silently inventing decisions or starting work.

**Acceptance criteria:**

- **Given** an approved Task Spec schema, **when** a Task Spec session ends, **then** the composer maps published segments into goal, context, constraints, acceptance signals, and unresolved questions according to that schema.
- **Given** speech and cleanup draining has resolved every stable segment to ready or raw fallback, **when** Task Spec composition begins, **then** it consumes the immutable terminal session snapshot rather than live callbacks or a partial store record.
- **Given** missing required information, **when** the preview renders, **then** it shows an explicit open question rather than inferred fact.
- **Given** a derived section, **when** Daniel reviews it, **then** he can trace it to Raw Text or Cleanup Revisions.
- **Given** the preview, **when** Daniel acts, **then** he can edit, copy, or insert the brief and cannot launch autonomous implementation from this feature.

## `EPIC-OPTIONAL-MEMORY` lets Daniel recover useful sessions without accidental retention

Daniel can retain eligible notes and task material locally, recover raw and cleaned representations, delete stored sessions, or use Incognito to prevent every extension-owned durable write.

### `STORY-NOTE-STORE` persists a versioned provenance record

As Daniel, I want eligible sessions stored locally with source and rewrite separated so that I can recover useful material and understand its origin.

**Acceptance criteria:**

- **Given** approved retention, location, encryption, and deletion requirements, **when** a non-incognito session emits storage events, **then** the Note Store writes a versioned record with session identity, Mode Profile, model, Voice Profile version, timestamps, terminal status, Raw Text, and Cleanup Revisions in distinct fields.
- **Given** allowed recovery checkpoints, **when** the terminal session snapshot is frozen, **then** its higher version becomes the authoritative idempotent record and supersedes incomplete recovery state.
- **Given** interrupted cleanup or output, **when** the record is stored, **then** the terminal status and per-segment outcome remain explicit.
- **Given** a future schema version, **when** an older supported record opens, **then** a tested migration or typed incompatibility preserves source data.
- **Given** storage failure, **when** a session remains live, **then** the product reports that the note was not saved and retains the in-memory representation for copy or retry.

### `STORY-INCOGNITO` enforces zero extension-owned persistence

As Daniel, I want Incognito fixed before recording so that sensitive speech leaves no Voice Scribe history or durable diagnostic artifact.

**Acceptance criteria:**

- **Given** Incognito selected before start, **when** composition creates the session, **then** the durable-capability registry applies a deny-dominant policy to storage, persistent diagnostics, cache, recovery, automatic file creation, and background export and locks the policy until session end.
- **Given** an Incognito session exercises cleanup, Task Spec, failures, retry, stop, and extension disposal, **when** every registered durable capability is inspected, **then** no hidden session-derived write exists; only the explicitly selected visible editor or terminal output may remain.
- **Given** Incognito is active, **when** the live surface renders, **then** the state remains visible and copy explains only extension-owned persistence, not provider retention.
- **Given** the session ends, **when** in-memory state is disposed, **then** no history row or crash-recovery checkpoint remains.

### `STORY-SESSION-HISTORY` makes retained sessions recoverable and deletable

As Daniel, I want a compact local history so that I can reopen an intended note, compare source and rewrite, and remove it when no longer needed.

**Acceptance criteria:**

- **Given** retained sessions, **when** History opens, **then** each keyboard-reachable row exposes time, Mode Profile, safe title or excerpt, and terminal status.
- **Given** a selected row, **when** Session detail opens, **then** Raw Text and Cleanup Revisions remain separately labeled with model and profile provenance.
- **Given** Daniel requests deletion, **when** he confirms the named local session, **then** its Note Store record is removed and the row disappears.
- **Given** no retained sessions or Incognito-only use, **when** History opens, **then** an empty-state explanation does not imply data loss.

## Delivery cannot begin on stories whose product contracts remain unresolved

- `STORY-GEMINI-ADAPTER` waits for authentication and billing choice.
- `STORY-TASK-SPEC` waits for the approved output schema.
- `STORY-NOTE-STORE` waits for retention, location, encryption, and deletion requirements.
- `STORY-LIVE-PROJECTION` may begin with a prototype but its final layout waits for the raw-versus-clean composition decision.
- Baseline and harness stories can proceed without those decisions and produce evidence needed to set numeric quality thresholds.
