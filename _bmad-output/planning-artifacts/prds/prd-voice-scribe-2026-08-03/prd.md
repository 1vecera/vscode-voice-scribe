---
title: Voice Scribe next iteration
status: draft
created: 2026-08-03
updated: 2026-08-03
sources:
  - ../../briefs/brief-voice-scribe-2026-08-03/brief.md
  - docs/project-overview.md
  - docs/architecture.md
---

# Voice Scribe next iteration requires trustworthy live cleanup and optional memory

## This PRD governs the proposed change, not the shipped v0.6.1 baseline

This document is for product, UX, architecture, epic decomposition, and implementation review. It defines capabilities in terms shared by every downstream artifact. Current behavior is sourced from `docs/`; proposed behavior is tagged through requirements, assumptions, and open decisions. Semantic identifiers remain stable even if sections move.

## The product should preserve the speed of speech while removing repair work

Voice Scribe should let Daniel continue speaking while stable transcript segments are cleaned into his preferred writing voice, visibly and without risking source loss. The same session pipeline should shape a dictation, command, note, meeting record, or task specification and should retain content only when the active privacy policy allows it.

The change succeeds when cleanup reduces correction effort without altering meaning, live state remains understandable, failure falls back to raw text, and adding another cleanup provider or output sink does not require a parallel session implementation.

## The target user is a technical author working inside VS Code

### Jobs to be done

- Capture a thought at speaking speed without leaving the active editor.
- See what the recognizer heard before trusting a rewrite.
- Turn spoken fragments into clear writing that still sounds like Daniel.
- Produce a reusable task specification from a spoken implementation brain dump.
- Recover useful notes later without persisting sensitive sessions accidentally.
- Keep dictation useful during cleanup-provider failure or degraded connectivity.

### Non-users for this delivery

- Teams needing shared workspaces, permissions, or collaborative notes.
- Users expecting an on-device-only transcription or cleanup guarantee.
- Meeting administrators needing participant identity, calendar ingestion, or organization-wide retention controls.
- Users outside VS Code who require a standalone desktop or mobile application.

### Journey `UJ-LIVE-CLEANUP` keeps Daniel speaking while the rewrite catches up

Daniel starts Dictate mode in a working document with cleanup enabled. Raw partial speech appears immediately, then stable segments enter rewriting state. Completed rewrites appear in capture order even if a later cleanup request finishes earlier. The value lands when Daniel can continue speaking while seeing readable cleaned prose and can still inspect or restore raw text. If cleanup fails, the affected segment remains raw and visibly failed without stopping capture.

### Journey `UJ-TASK-SPEC` turns a spoken brain dump into reviewable implementation intent

Daniel selects Task Spec before recording and describes the goal, constraints, acceptance signals, and uncertainties. The live transcript follows the same raw and cleanup states. When the session ends, the profile produces a structured task brief for review rather than executing it. If required information is absent, the output preserves explicit unknowns instead of fabricating decisions.

### Journey `UJ-NOTE-RECOVERY` retains only a session Daniel intended to keep

Daniel records in Notes or Meeting mode with Incognito off. The session store retains raw and cleaned representations, timestamps, profile, model, and completion status. Daniel can reopen the note and distinguish source from rewrite. When Incognito is on, no session record appears in history and no extension-owned persistent write occurs.

## Shared vocabulary prevents implementation drift

- **Transcript Session** — The lifecycle boundary from recording start through provider drain, cleanup completion or cancellation, projection, and allowed persistence.
- **Transcript Segment** — A stable unit of recognized speech with immutable raw text, ordering identity, timing metadata, and derived revisions.
- **Raw Text** — Recognized source text before cleanup; immutable provenance after the segment becomes stable.
- **Cleanup Revision** — Derived text produced from Raw Text by a Cleanup Provider and Voice Profile.
- **Cleanup Provider** — An adapter that accepts a stable segment plus cleanup context and returns a Cleanup Revision or typed failure.
- **Voice Profile** — Versioned instructions that shape style without authorizing factual additions or meaning changes.
- **Mode Profile** — Configuration selecting cleanup instructions, projection, persistence policy, and Output Sink behavior for a Transcript Session.
- **Projection** — The visible representation of Transcript Segment state in the panel, editor, or terminal.
- **Note Store** — The extension-owned persistence boundary for non-incognito Transcript Sessions.
- **Output Sink** — An adapter that publishes a selected representation to a destination such as the VS Code editor.
- **Incognito** — A session policy that forbids all extension-owned persistent writes while leaving external-provider processing governed by that provider.
- **Ordered Publication Barrier** — The rule that Cleanup Revisions become visible in Transcript Segment capture order even when work completes out of order.

## Live cleanup must be concurrent, ordered, and optional

The cleanup feature realizes `UJ-LIVE-CLEANUP`. A stable Transcript Segment becomes eligible for cleanup while capture continues. Bounded concurrency prevents one slow request from stalling unrelated work or creating unbounded cost. The Ordered Publication Barrier holds completed revisions until every preceding eligible segment has reached ready, failed, skipped, or cancelled state. Raw Text remains the fallback throughout.

### `FR-CLEANUP-ADAPTER` makes cleanup provider-neutral

The system can execute cleanup through a Cleanup Provider selected by configuration without provider-specific branches in Transcript Session orchestration.

**Consequences:**

- The initial adapter can target Gemini 3.6 Flash while tests substitute a deterministic fake.
- The adapter accepts cancellation and returns typed success, timeout, cancellation, authentication, quota, safety, and provider failures.
- A provider failure does not mutate Raw Text or stop speech capture.

### `FR-CLEANUP-CONCURRENCY` bounds simultaneous rewrites

The system can process multiple stable Transcript Segments concurrently up to a configured limit while applying backpressure beyond that limit.

**Consequences:**

- Queue depth remains bounded by an explicit session policy.
- Stopping a Transcript Session cancels queued work and applies the configured bounded drain to in-flight work.
- Cleanup request order does not determine publication order.

### `FR-CLEANUP-ORDER` publishes revisions in capture order

The system publishes each Cleanup Revision only after every preceding eligible Transcript Segment has reached a terminal cleanup state.

**Consequences:**

- A later fast result never appears before an earlier pending segment.
- Failed, skipped, or cancelled segments release the barrier with Raw Text as their published representation.
- Duplicate or late provider results cannot publish a second revision for the same cleanup attempt.

### `FR-CLEANUP-VOICE` applies Daniel's versioned voice profile

Daniel can select a Voice Profile that improves structure and naturalness while preserving the segment's meaning and factual content.

**Consequences:**

- The cleanup request identifies the Voice Profile version used.
- The Cleanup Revision can be compared with and reverted to Raw Text.
- Prompt instructions forbid invented facts, commitments, names, measurements, or decisions.

## Live projection must expose provenance and progress

The projection feature realizes `UJ-LIVE-CLEANUP` and provides the visual contract consumed by every Mode Profile.

### `FR-PROJECTION-STATE` shows raw, rewriting, ready, and failed states

Daniel can distinguish Raw Text from a pending, successful, or failed Cleanup Revision throughout a live session.

**Consequences:**

- Raw Text is readable immediately after recognition.
- Rewriting state does not replace readable content with a spinner-only placeholder.
- Failed state includes a retry path and retains Raw Text.
- Ready state exposes both the selected revision and a path back to Raw Text.

### `FR-PROJECTION-ORDER` keeps visible segments stable

The Projection preserves Transcript Segment order and does not move the user's reading position when a revision becomes ready.

**Consequences:**

- State transitions update the existing segment identity rather than inserting a new unrelated item.
- Late events from a disposed Transcript Session are ignored.
- Editor and panel projections observe the same published representation.

## Mode profiles must reuse one session pipeline

Mode Profiles realize `UJ-LIVE-CLEANUP`, `UJ-TASK-SPEC`, and `UJ-NOTE-RECOVERY`. Dictate, Command, Notes, Meeting, and Task Spec differ through configuration and post-processing contracts rather than duplicated capture loops.

### `FR-MODE-PROFILE` composes behavior declaratively

The system can define each Mode Profile through a stable configuration containing cleanup instructions, Projection options, persistence policy, and Output Sink selection.

**Consequences:**

- Adding a profile does not add a second Transcript Session implementation.
- A profile validates unsupported combinations before recording begins.
- The active profile remains visible throughout recording.

### `FR-TASK-SPEC` produces a reviewable task brief

Daniel can end a Task Spec session and receive a structured implementation brief that separates known intent, constraints, acceptance signals, and unresolved questions.

**Consequences:**

- The output never launches implementation automatically.
- Missing information remains explicit rather than inferred as fact.
- Raw Text and Cleanup Revision remain traceable to the generated brief.
- The exact Markdown and optional structured-data schema is a release-blocking product decision.

## Optional storage must preserve provenance and obey Incognito

The Note Store realizes `UJ-NOTE-RECOVERY` and is disabled by policy rather than hidden behavior.

### `FR-NOTE-STORE` retains permitted session records locally

Daniel can persist and reopen an allowed Transcript Session with Raw Text, Cleanup Revisions, timestamps, Mode Profile, model identity, Voice Profile version, and terminal status.

**Consequences:**

- Raw Text and Cleanup Revision occupy distinct fields.
- Partial or interrupted sessions carry an explicit terminal status.
- Daniel can delete an individual stored session.
- Retention duration, bulk deletion, storage location, and encryption remain open product decisions.

### `FR-INCOGNITO` forbids extension-owned durable writes

Daniel can enable Incognito before recording so the Transcript Session performs no extension-owned persistent write.

**Consequences:**

- Incognito state is visible before and during recording.
- The Note Store receives no session, segment, revision, diagnostic payload, or derived Task Spec from that session.
- Ephemeral in-memory state is disposed at session end.
- Product copy does not imply that Incognito controls external-provider retention.

## VS Code remains the active delivery surface while output becomes replaceable

### `FR-OUTPUT-SINK` decouples publication from session orchestration

The system can publish the selected segment representation through an Output Sink without embedding destination-specific branches in Transcript Session behavior.

**Consequences:**

- The existing VS Code editor and terminal behavior can be adapted as the initial sinks.
- Sink failure does not delete Raw Text from live session state.
- A future standalone surface can consume the same session events without reimplementing speech or cleanup.

## Cross-cutting requirements protect trust and operability

### `NFR-LATENCY` keeps raw capture perceptibly live

Raw partial and stable recognition must remain on the current direct path and must not wait for cleanup. Cleanup latency targets must be set from measured baseline percentiles before implementation approval.

### `NFR-RELIABILITY` prevents silent transcript loss

Every stable Transcript Segment must reach a visible published state as Raw Text or Cleanup Revision. Session stop, extension deactivation, provider failure, cleanup failure, and sink failure must have bounded completion or cancellation behavior.

### `NFR-PRIVACY` minimizes and labels data movement

The extension must not log transcript values, audio, credentials, full cleanup prompts, or stored note contents. UI and documentation must identify which selected providers receive audio or text. Incognito must be tested at every persistence boundary.

### `NFR-SECURITY` keeps credentials outside session records

Provider credentials must never enter Transcript Session events, Note Store records, diagnostics, prompts, or task outputs. The Gemini credential mechanism and any migration of the ElevenLabs key to secret storage require an explicit design before implementation.

### `NFR-OBSERVABILITY` exposes content-free pipeline health

Local diagnostics may record timing, state transitions, queue depth, provider category, model identifier, and error category without transcript content or stable user identifiers. Incognito policy must explicitly decide whether even content-free diagnostics persist; the default is no persistent diagnostic write.

### `NFR-MAINTAINABILITY` enforces dependency direction

Transcript Session core types and policies must not import VS Code, provider SDKs, child-process APIs, or the Note Store implementation. External adapters depend inward on ports and domain events.

### `NFR-ACCESSIBILITY` preserves keyboard and screen-reader operation

Every mode, recording control, segment state, retry, raw-view action, and privacy control must be keyboard reachable and expose a meaningful accessible name and state through VS Code-supported UI primitives.

## Explicit non-goals keep the iteration narrow

- Building a standalone application or mobile client.
- Sharing notes across users or devices.
- Retaining microphone audio.
- Running generated Task Specs autonomously.
- Supporting arbitrary user-installed model plugins.
- Claiming on-device-only processing or provider-side zero retention.
- Replacing the existing speech-provider abstraction.
- Adding organization administration, billing, or analytics telemetry.

## The delivery scope has a clear core and explicit deferred choices

In scope are the Transcript Session extraction, cleanup port, Gemini adapter, bounded concurrency, Ordered Publication Barrier, live state projection, Daniel Voice Profile, declarative Mode Profiles, Task Spec generation, local Note Store, Incognito enforcement, and VS Code Output Sinks.

Deferred are standalone output surfaces, note sync, collaboration, audio retention, a public plugin API, additional cleanup adapters, and autonomous task execution. These remain deferred even if the extracted ports make them technically easier.

## Success criteria require baseline collection before target approval

- `SM-CORRECTION-EFFORT` — On a representative private evaluation set, cleanup should reduce Daniel's manual correction effort while preserving intended meaning. The baseline, scoring method, and approval threshold must be recorded before implementation acceptance. Validates `FR-CLEANUP-VOICE` and `NFR-RELIABILITY`.
- `SM-CLEANUP-LATENCY` — Measured cleanup latency and fallback frequency must meet baseline-derived thresholds without delaying Raw Text. Validates `FR-CLEANUP-CONCURRENCY`, `FR-CLEANUP-ORDER`, and `NFR-LATENCY`.
- `SM-ORDERING-INTEGRITY` — Automated stress tests must observe no out-of-order publication or duplicate terminal revision across randomized completion order. Validates `FR-CLEANUP-ORDER` and `FR-PROJECTION-ORDER`.
- `SM-INCOGNITO-INTEGRITY` — Automated tests must observe no durable extension-owned artifact from an Incognito session. Validates `FR-INCOGNITO`, `NFR-PRIVACY`, and `NFR-OBSERVABILITY`.
- `SM-REPEATED-USE` — Daniel should continue using cleanup and note recovery weekly after the evaluation period; the duration and success threshold require confirmation. Validates the product outcome rather than a single feature.
- `SM-COUNTER-EDIT-SUPPRESSION` — The product must not optimize for fewer edits by hiding Raw Text, preventing reversion, or producing blander writing. Counterbalances `SM-CORRECTION-EFFORT`.

## Open decisions block unconditional implementation readiness

- Daniel must choose the Gemini authentication and billing path.
- Daniel must approve the Task Spec output schema.
- Daniel must choose the live raw-versus-clean presentation pattern after a prototype.
- Daniel must set local retention, deletion, location, and encryption expectations.
- The team must capture current and prototype baselines before setting latency and quality thresholds.
- The release owner must decide whether ElevenLabs credentials migrate from VS Code settings to `SecretStorage` in this iteration.

## Assumptions remain indexed for review

- `ASSUMPTION-PRIMARY-USER` — Daniel remains the sole primary operator for this delivery.
- `ASSUMPTION-INITIAL-SURFACE` — VS Code desktop remains the only supported product surface.
- `ASSUMPTION-CLEANUP-MODEL` — Gemini 3.6 Flash is available and suitable as the initial cleanup adapter at implementation time; reverify the model and SDK before coding.
- `ASSUMPTION-TASK-SPEC` — Task Spec is a reviewable output and does not execute work.
- `ASSUMPTION-LOCAL-STORE` — The Note Store is local to the extension until retention and encryption decisions say otherwise.
- `ASSUMPTION-VOICE-PROFILE` — Existing `humanize-writing` guidance is the seed for Daniel's Voice Profile, subject to a private evaluation set and explicit approval.
