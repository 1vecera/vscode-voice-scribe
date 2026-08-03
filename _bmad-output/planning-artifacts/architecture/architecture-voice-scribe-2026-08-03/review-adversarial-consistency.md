---
title: Voice Scribe architecture adversarial consistency review
reviewed: 2026-08-03
target: ARCHITECTURE-SPINE.md
input: ../../prds/prd-voice-scribe-2026-08-03/prd.md
verdict: tighten-before-decomposition
---

# Independent implementations can still disagree on state, ordering, privacy, and lifecycle

## The spine needs tightening before epics can safely split implementation

The spine chooses the right overall paradigm and covers every proposed capability, but it does not yet close several compatibility seams one level below it. Independent builders can obey every current decision while producing components that disagree about the canonical segment state, capture order, retry publication, durable side effects, event delivery, or adapter lifetime. The highest-risk holes affect the PRD's ordering and Incognito integrity measures, so epic decomposition should use a tightened spine rather than treat the current draft as a complete build contract.

| Severity | Finding | PRD contract at risk | Smallest tightening |
|---|---|---|---|
| Critical | `HOLE-STATE-OWNERSHIP` | `FR-PROJECTION-STATE`, `NFR-RELIABILITY` | Make a Transcript Session reducer the sole owner of semantic segment and attempt state; schedulers and barriers may own only operational indexes and must submit typed outcomes back to that reducer. |
| Critical | `HOLE-CAPTURE-ORDER` | `FR-CLEANUP-ORDER`, `FR-PROJECTION-ORDER`, `SM-ORDERING-INTEGRITY` | Assign an immutable monotonic segment sequence at stabilization and declare it the only publication-order key. |
| Critical | `HOLE-INCOGNITO-DURABILITY` | `FR-INCOGNITO`, `SM-INCOGNITO-INTEGRITY` | Classify every adapter by durable side effects and make privacy policy deny-dominant across stores, diagnostics, caches, recovery, composers, and sinks. |
| High | `HOLE-RETRY-PUBLICATION` | `FR-PROJECTION-STATE`, `FR-CLEANUP-ORDER` | Define retry as an in-place representation revision after initial ordered publication, with an increasing representation version and no re-entry into the initial barrier. |
| High | `HOLE-EVENT-DELIVERY` | `FR-PROJECTION-ORDER`, `FR-NOTE-STORE`, `FR-OUTPUT-SINK` | Commit state before emitting a canonical sequenced event envelope and require idempotent consumers keyed by session, entity, and representation version. |
| High | `HOLE-ADAPTER-LIFETIME` | `NFR-RELIABILITY`, `AD-BOUNDED-LIFECYCLE` | Separate extension-scoped clients and factories from session-scoped streams, requests, and child-process handles; only session handles participate in session disposal. |
| High | `HOLE-SINK-CAPABILITIES` | `FR-MODE-PROFILE`, `FR-OUTPUT-SINK`, `FR-PROJECTION-STATE` | Require sinks to advertise amendment, reversion, live-update, and durability capabilities and reject incompatible Mode Profiles before recording. |
| High | `HOLE-QUEUE-SATURATION` | `FR-CLEANUP-CONCURRENCY`, `NFR-LATENCY`, `NFR-RELIABILITY` | Declare that full cleanup capacity never blocks speech; an unadmitted segment becomes terminal `skipped` and publishes Raw Text. |
| High | `HOLE-STABLE-SEGMENT-CONTRACT` | `FR-CLEANUP-ADAPTER`, `FR-PROJECTION-STATE` | Normalize provider callbacks into ephemeral partial updates and a single session-owned stabilization command; late provider corrections cannot mutate immutable Raw Text. |
| Medium | `HOLE-CLEANUP-SCOPE` | `FR-CLEANUP-VOICE`, `FR-CLEANUP-ORDER` | Make each cleanup request target exactly one stable segment and make context read-only, identified, bounded, and incapable of changing segment boundaries or order. |
| Medium | `HOLE-FINAL-SNAPSHOT` | `FR-TASK-SPEC`, `FR-NOTE-STORE` | Define a frozen final session snapshot after fallback resolution as the only Task Spec input and the authoritative terminal persistence image. |
| Medium | `HOLE-PROFILE-RESOLUTION` | `FR-MODE-PROFILE`, `FR-CLEANUP-VOICE`, `NFR-SECURITY` | Snapshot resolved immutable profile content and capability references, not only mutable version labels; inject authenticated adapters so requests and events never carry credentials. |

## Semantic state needs a single writer and a shared transition contract

`AD-SESSION-OWNER` says Transcript Session owns the segment registry, while the state-mutation convention allows the session's “owned scheduler or barrier” to mutate the aggregate. That exception permits three independently built state machines: the session can mark an attempt pending, the scheduler can mark it timed out, and the barrier can mark the segment published. Every component could claim compliance while racing to produce incompatible terminal states or selected revisions.

The smallest fix is to name a single exported reducer or command handler in `domain/transcriptSession.ts` as the only writer of semantic session, segment, attempt, and representation state. The scheduler may own queue slots, timers, and cancellation handles; the barrier may own a cursor and readiness index; both return typed commands or outcomes to the reducer. State events are emitted only after the reducer commits a valid transition. The architecture should include the allowed transition union for cleanup attempts and publication, while leaving concrete class layout to implementation.

A concrete incompatibility that currently passes the spine is a scheduler marking a timed-out attempt `failed` while a late success records a Cleanup Revision directly in the segment registry. A separately built barrier can then publish either Raw Text or the late revision depending on callback timing. Reducer-owned terminal compare-and-set behavior closes that race.

## Ordered publication needs an explicit key and retry semantics

Opaque segment identifiers are expressly not derived from array position, yet no other capture-order field is defined. One builder can order by registry insertion, another by provider timestamp, and another by identifier generation time; each can reasonably interpret “capture order” and still disagree during buffering, provider restart, or equal timestamps.

The session should assign an immutable integer `segmentSequence` when a provider result first becomes stable. Sequence allocation, not callback time, provider time, array position, or identifier ordering, becomes the sole key for the Ordered Publication Barrier. The barrier advances across consecutive sequence values whose initial cleanup attempt is terminal. An ephemeral partial is not assigned a segment sequence and never enters storage or cleanup.

Retry is also unresolved after the barrier advances. `AD-RAW-FALLBACK` permits a new attempt, while `AD-ORDERED-PUBLICATION` emits at most one representation per attempt; neither says whether a successful retry can replace Raw Text after the segment was published. The smallest coherent rule is that the initial terminal attempt participates in ordered first publication, while later retries produce an in-place `SegmentRepresentationChanged` event with a strictly increasing representation version. A retry never rewinds the barrier and can only reach projections or sinks that declare amendment support.

## Queue saturation needs a deterministic raw-first result

Bounded pending capacity does not define backpressure behavior. A cleanup scheduler can block admission until capacity opens, discard the oldest pending segment, discard the newest segment, or pause upstream recognition, and all four choices satisfy the present wording. Blocking or pausing upstream violates the PRD's direct Raw Text latency path, while silent dropping can permanently hold the publication barrier.

The session should submit each stable segment without awaiting capacity. Admission success creates a pending attempt; admission failure caused by capacity creates a terminal `skipped-capacity` outcome that selects Raw Text and releases the barrier. This preserves capture, bounds memory and cost, and makes overload observable without transcript content. No queue policy may discard a segment or leave it non-terminal.

## Provider callbacks need normalization before they become domain input

`AD-TYPED-SEGMENT-EVENTS` prevents downstream consumers from observing provider callbacks, but the speech-port boundary does not decide who owns stabilization, deduplication, or provider correction. One speech adapter can emit a stable domain segment itself while another emits mutable recognition hypotheses for the session to stabilize. Their segment identities, timing, and Raw Text immutability will not interoperate with a shared scheduler or projection.

The speech port should expose a provider-neutral recognition input union with ephemeral partial text and stable text, always scoped to a session handle. Transcript Session owns segment identity, sequence allocation, and the single transition from ephemeral partial to immutable stable Raw Text. Duplicate stable callbacks are rejected by a provider-result identity or adapter-local deduplication token. A provider correction arriving after stabilization becomes a typed unsupported correction or a new segment under an explicit policy; it never mutates Raw Text silently.

## Cleanup adapters need a shared replacement scope

The PRD says cleanup accepts a stable segment plus context, but the spine leaves the request and response scope open. A Gemini adapter can return a rewrite for one segment, while a deterministic fake or later provider can return a rewritten context window containing several segments. Both implement “cleanup” but cannot share the same revision, ordering, or provenance logic.

The cleanup port should accept one target segment identity, immutable Raw Text, a resolved Voice Profile snapshot reference, and an optional bounded read-only context list whose entries retain their source segment identities. A successful result contains replacement text for only the target segment plus content-free model metadata. Cleanup may not split, merge, delete, reorder, or revise context segments. Cross-segment restructuring belongs to a separate derived-document composer such as Task Spec, after the session snapshot is frozen.

## Event delivery needs commit order, identity, and idempotency

The phrase “events or an equivalent read model” leaves consumers free to observe different moments. A panel can subscribe to cleanup completion, an editor sink can subscribe to ordered publication, and a Note Store can snapshot on stop; each follows an authoritative source but can persist or display different selected text. The spine also does not specify behavior after duplicate delivery, sink retry, or a storage flush that races a representation change.

The smallest convergence rule is a canonical immutable event envelope emitted after reducer commit with `sessionId`, a monotonic session event sequence, semantic event type, entity identity, and entity or representation version. Projection and Output Sinks consume only publication events or the read model derived from them, never cleanup-completion events. Note Store writes are idempotent by session, entity, and version. Delivery remains in-process rather than becoming a durable message bus, but duplicates and stale versions must be harmless.

## Sink capabilities need validation before capture starts

The architecture assumes that panel, editor, and terminal sinks can observe the same selected representation, but these destinations have different mutation semantics. A panel and tracked editor range can amend an existing segment; a terminal is normally append-only. A terminal adapter that emits Raw Text immediately cannot later replace it with a ready revision or satisfy reversion without duplicating content.

Each Output Sink should advertise capabilities such as `livePartial`, `amendPublishedSegment`, `revertToRaw`, `emitDerivedDocument`, and `durableSideEffect`. Mode Profile validation intersects requested behavior with those capabilities before session start. An append-only sink must either wait for the ordered terminal representation or operate in a declared raw-only profile; it cannot pretend to support live raw-to-clean replacement. Delivery operations should carry an idempotency key derived from session, segment, and representation version so a retry cannot duplicate an append.

## Incognito needs deny-dominant policy across every durable capability

`AD-INCOGNITO-AT-STORE-BOUNDARY` swaps the Note Store and persistent diagnostics adapters, but Task Spec composition, an Output Sink, a cache, a recovery checkpoint, or a future adapter can still create a durable artifact. This permits an implementation that passes “zero Note Store writes” while violating the PRD's broader “no extension-owned persistent write” guarantee.

The composition root should classify every injected capability by side-effect class and resolve an effective policy as the intersection of Mode Profile requests and privacy permissions. Incognito denies extension-managed retention, cache, recovery, persistent diagnostics, automatic file creation, and background export. It may allow the explicitly selected visible editor or terminal delivery that constitutes the user's active output, but that exception must be named and must not create hidden history or an automatic save. Unknown durability fails closed, and the privacy conformance test enumerates the capability registry rather than checking only `NoteStore`.

This tightening also resolves precedence: Incognito always overrides a Mode Profile's persistence request, and a profile that requires forbidden retention is rejected before recording instead of silently weakening privacy.

## Adapter lifetimes need separate extension and session ownership

The current product prewarms and can reuse provider clients, while `AD-BOUNDED-LIFECYCLE` says the session disposes adapters. An independently built composition root can create a singleton provider adapter at activation, and an independently built session can dispose it at stop; the next session then receives a dead client despite both components following the spine.

The architecture should distinguish extension-scoped factories, authenticated SDK clients, model registries, and prewarm resources from session-scoped speech streams, cleanup requests, timers, audio processes, and subscription handles. Starting a session acquires session handles from factories; stopping or cancelling disposes only those handles. Extension deactivation disposes shared clients after all sessions have ended. Every callback is bound to the session handle and rejected after that handle becomes terminal.

## Final consumers need one frozen session snapshot

Task Spec composition can currently run from the latest cleanup callbacks, the ordered publication read model, or a Note Store record, creating different documents for the same session. Storage can likewise flush before unresolved segments are converted to Raw Text fallback and persist a non-terminal image even when the live projection is terminal.

After speech drain and cleanup drain or fallback resolution, Transcript Session should freeze a terminal snapshot containing the ordered segment sequence, immutable Raw Text, selected revision references, attempt outcomes, effective profile references, and terminal status. Task Spec composition consumes only this snapshot. Note Store may persist idempotent incremental states for interruption recovery when retention policy allows, but the frozen snapshot is the authoritative terminal image and replaces any lower-version state.

## Profile snapshots need resolved content and credential-free requests

A version label alone does not freeze behavior if separate components resolve that label through mutable settings or files. The cleanup adapter can then apply different instructions than the Task Spec composer or persist metadata that cannot reconstruct which voice rules were used.

At session start, composition should resolve Mode Profile and Voice Profile into immutable validated values with schema version, stable profile identity, and content hash. The exact Voice Profile content is passed to the cleanup adapter through a frozen request value but is not logged or persisted where privacy policy forbids it. Authentication is resolved when constructing the adapter; credentials and credential references never enter cleanup requests, session events, snapshots, diagnostics, or Note Store records.

## The tightened decision set can remain lean

The spine does not need to select a database, Gemini SDK, UI layout, retention duration, or Task Spec document schema to close these holes. It only needs enforceable amendments or semantic decisions that establish the shared state owner, order keys, transition and retry semantics, event envelope and delivery rules, capability and privacy classification, lifecycle scopes, cleanup replacement scope, and terminal snapshot authority. Those invariants let independent domain, scheduler, projection, storage, and adapter builders remain compatible while the explicitly deferred product choices stay deferred.
