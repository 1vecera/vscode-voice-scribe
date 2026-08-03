---
title: Voice Scribe testability and architecture risk contract
status: draft
created: 2026-08-03
updated: 2026-08-03
mode: system-level
sources:
  - ../../planning-artifacts/prds/prd-voice-scribe-2026-08-03/prd.md
  - ../../planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/ARCHITECTURE-SPINE.md
  - ../../planning-artifacts/epics.md
companions:
  - test-design-qa.md
---

# Architecture must expose deterministic control before cleanup implementation begins

This document is the testability contract for architecture and engineering. It identifies production-code seams, observable outcomes, and unresolved decisions needed before the next iteration can produce fast, deterministic quality evidence. Test scenarios and execution details live in [the QA companion](test-design-qa.md).

## The design is testable in principle but not yet implementation-ready

The ports-and-adapters spine provides strong isolation, typed failures, a single session owner, immutable provenance, and explicit scheduling and ordering components. Those choices can support deterministic unit and integration tests without cloud credentials. The current v0.6.1 code, however, still concentrates orchestration in `extension.ts`, has no cleanup, store, or projection ports, and has no extension-host suite. Product contracts for Gemini credentials, Task Spec shape, local retention, and live comparison remain open.

| Risk band | Count | Meaning |
|---|---:|---|
| Critical | 3 | Score 9; blocks safe delivery until mitigated |
| High | 6 | Score 6; requires owned mitigation before release |
| Medium | 4 | Score 4; validate during implementation |

## Product and architecture decisions block several integration tests

- `BLOCKER-GEMINI-AUTH` — Approve the Gemini authentication, billing, SDK, quota, and timeout contract before adapter integration tests can be authoritative. Owner: Daniel as product owner with implementation owner. Required before `STORY-GEMINI-ADAPTER`.
- `BLOCKER-TASK-SPEC-SCHEMA` — Approve the required output sections and structured-data boundary before Task Spec contract tests are written. Owner: Daniel. Required before `STORY-TASK-SPEC`.
- `BLOCKER-STORE-POLICY` — Approve retention, scope, location, encryption, deletion, and crash-recovery behavior before selecting or testing a store. Owner: Daniel with architecture owner. Required before `STORY-NOTE-STORE`.
- `BLOCKER-PROJECTION-PATTERN` — Prototype narrow and wide panel behavior and choose inline or comparative projection before final component assertions. Owner: UX and Daniel. Prototype work may begin immediately.
- `BLOCKER-QUALITY-THRESHOLDS` — Capture raw-path and cleanup baselines before setting latency and correction-quality acceptance thresholds. Owner: implementation and test owner. Baseline harness may begin immediately.
- `BLOCKER-RUNTIME-DEPENDENCIES` — Patch the bundled WebSocket dependency and refresh advisory-affected production transitives before next-iteration feature work. Owner: implementation owner. Required before feature implementation.
- `BLOCKER-HOST-COMPATIBILITY` — Align the VS Code engine floor, API types, Node types, lint tuple, and host test matrix. Owner: architecture and implementation owners. Required before the new projection surface freezes its API use.

## The highest risks are ordering, regression, privacy, provenance, and invented output

| Risk ID | Category | Description | Probability | Impact | Score | Mitigation | Owner | Required by |
|---|---|---|---:|---:|---:|---|---|---|
| `RISK-VULNERABLE-RUNTIME` | SEC | Bundled `ws 8.19.0` has known high-severity advisory exposure | 3 | 3 | 9 | Lock patched same-major release, refresh transitives, re-audit and inspect bundle | Implementation owner | Before feature implementation |
| `RISK-ORCHESTRATION-REGRESSION` | TECH | Extracting session state changes current partial, final, command, or shutdown behavior | 3 | 3 | 9 | Characterize v0.6.1 before extraction; migrate behind ports in vertical slices | Implementation owner | Before session extraction |
| `RISK-ORDERING` | DATA | Concurrent cleanup publishes later speech before earlier speech or publishes twice | 3 | 3 | 9 | Isolate one barrier; randomized completion tests; reject duplicate terminal outcomes | Implementation owner | Before cleanup release |
| `RISK-PROVENANCE-LOSS` | DATA | Cleaned text overwrites Raw Text and removes fallback or auditability | 2 | 3 | 6 | Immutable segment model; storage schema separates source and revisions | Architecture owner | Before cleanup persistence |
| `RISK-INCOGNITO-WRITE` | SEC | Notes, diagnostics, recovery, or task output persists an Incognito session | 2 | 3 | 6 | No-write adapters at composition; inspect every durable boundary in tests | Implementation owner | Before storage release |
| `RISK-CREDENTIAL-EXPOSURE` | SEC | Cleanup or speech credentials enter settings, logs, session events, prompts, or stored records | 2 | 3 | 6 | Adapter-local credential resolution; secret scan; content-free diagnostic types | Architecture owner | Before provider release |
| `RISK-CLEANUP-LATENCY` | PERF | Slow cleanup creates an unbounded queue or makes the live surface misleading | 3 | 2 | 6 | Bounded scheduler, timeout, backpressure, queue telemetry, raw fallback | Implementation owner | Before cleanup release |
| `RISK-STORE-CORRUPTION` | DATA | Schema change or interrupted write loses Raw Text or makes history unreadable | 2 | 3 | 6 | Versioned records, atomic writes, migration tests, typed incompatible state | Implementation owner | Before storage release |
| `RISK-TASK-SPEC-INVENTION` | BUS | Generated Task Spec adds unsupported goals, constraints, or commitments | 2 | 3 | 6 | Approved schema, source traceability, explicit unknowns, private evaluation set | Product and implementation owners | Before Task Spec release |
| `RISK-PROVIDER-DEGRADATION` | OPS | Cleanup-provider outage is presented as total dictation failure | 2 | 2 | 4 | Typed capability health and raw-only degradation path | Implementation owner | Before cleanup release |
| `RISK-ACCESSIBILITY-DRIFT` | BUS | New live states or segment actions become keyboard or color dependent | 2 | 2 | 4 | Host-native controls, component accessibility tests, extension-host smoke | UX and implementation owners | Before UI release |
| `RISK-UNSUPPORTED-TOOLCHAIN` | TECH | TypeScript and lint versions sit outside upstream support and may fail on future change | 2 | 2 | 4 | Upgrade compiler, ESLint, parser, and plugin as one supported tuple | Implementation owner | Before session extraction |
| `RISK-HOST-FLOOR-DRIFT` | TECH | Code compiles against VS Code and Node APIs newer than the manifest's minimum host | 2 | 2 | 4 | Align types and engine floor; smoke-test minimum and current hosts | Architecture owner | Before UI release |

## The architecture must make control, observation, and isolation concrete

### Fast feedback requires controllable seams

| Concern | Impact | Architecture requirement | Owner | Required by |
|---|---|---|---|---|
| Cleanup timing is external | Ordering and timeout tests become flaky | Inject Cleanup Provider and Clock; expose deterministic fake completion and cancellation | Architecture owner | `STORY-CLEANUP-PORT` |
| Session state is concentrated in `extension.ts` | Lifecycle cases require broad mocks and hidden mutable state | Extract Transcript Session commands and immutable events before adding cleanup | Implementation owner | `STORY-SESSION-CORE` |
| Durable boundaries do not exist | Incognito cannot be proven | Route every note, recovery, Task Spec, cache, and persistent diagnostic write through injected ports | Architecture owner | `STORY-INCOGNITO` |
| VS Code live surface is undecided | Focus and assistive-state behavior cannot be automated | Select a supported host surface and define stable semantic selectors or test handles | UX and implementation owners | `STORY-LIVE-PROJECTION` |
| Content-free baseline capture is absent | Latency thresholds would be guessed | Add injectable diagnostics whose types cannot carry transcript content | Implementation owner | `STORY-BASELINE-HARNESS` |

### Existing design choices already improve testability

- The shipped speech providers already implement a common contract and are thoroughly exercised with mocks.
- The target spine isolates scheduler, publication barrier, store, sink, projection, clock, and diagnostics.
- Raw fallback gives every cleanup failure a deterministic user-visible outcome.
- Semantic requirement and architecture identifiers allow direct traceability without depending on document position.
- Session identity and immutable events can make late-callback tests precise.

## Architecturally significant requirements need explicit evidence hooks

| Requirement | Significance | Architecture support | Required evidence |
|---|---|---|---|
| `NFR-RELIABILITY` | Capture cannot silently lose stable speech | Session owner, bounded lifecycle, raw fallback | State-machine tests, failure injection, resource-leak checks |
| `NFR-PRIVACY` | Speech and notes are sensitive content | No-write Incognito composition, content-free diagnostics | Durable-boundary audit, log capture, package inspection |
| `NFR-SECURITY` | Multiple external credentials are involved | Adapter-local resolution is specified; exact Gemini path open | Secret scan, credential-flow review, negative configuration tests |
| `NFR-LATENCY` | Cleanup must not degrade raw-path immediacy | Direct raw path and bounded scheduler specified; thresholds open | Content-free percentile report and burst test |
| `NFR-MAINTAINABILITY` | More providers and destinations are expected | Inward ports and typed events | Import-boundary test, adapter contract suite, code review |
| `NFR-ACCESSIBILITY` | Live asynchronous UI can disrupt focus and announcements | UX spine defines stable focus and state labels; surface undecided | Component accessibility assertions and extension-host smoke |

## NFR thresholds remain unknown where evidence does not exist

| Category | Required threshold or invariant | Current design support | Gap | Planned evidence |
|---|---|---|---|---|
| Security | No credentials or content in logs, events, stores outside allowed fields, package, or command arguments | Partial | Gemini credential design and ElevenLabs `SecretStorage` decision are open | Secret scan, captured logs, storage inspection, package manifest |
| Performance | Raw recognition does not wait for cleanup; cleanup latency and queue limits meet approved baseline-derived values | Partial | Numeric latency, capacity, timeout, and drain thresholds are unknown | Deterministic burst report and content-free latency percentiles |
| Reliability | Every stable segment reaches one visible raw or cleaned terminal representation | Strong design | Implementation evidence absent | State-machine property tests, randomized completion, fault injection |
| Maintainability | Domain and application imports remain independent of adapters | Strong design | No automated dependency-boundary test yet | Static import rule plus adapter contract suite |
| Accessibility | Every state and action is keyboard reachable, named, and does not move focus on async completion | Partial | Final host surface and selector contract are open | Component audit and extension-host keyboard or screen-reader smoke |
| Privacy | Incognito produces no extension-owned durable session artifact | Strong design | Durable ports and implementation absent | Store, diagnostics, cache, and recovery spy assertions |

Final PASS, CONCERNS, or FAIL status belongs in the evidence-based NFR assessment, not this planning contract.

## High-risk mitigations are release conditions

| Risk | Production change | Verification | Residual risk after mitigation |
|---|---|---|---|
| `RISK-ORCHESTRATION-REGRESSION` | Extract current behavior behind ports without changing visible semantics in the same change | Characterization suite plus editor and terminal extension-host smoke | Operating-system audio behavior still needs live smoke |
| `RISK-VULNERABLE-RUNTIME` | Replace advisory-affected runtime resolutions without changing provider contracts | Clean production audit or approved reachability exception plus bundle inspection | Future advisories require recurring scan evidence |
| `RISK-ORDERING` | Centralize terminal outcomes and publication cursor in one barrier | Randomized deterministic tests and long burst burn-in | Real provider timing differs but cannot bypass the barrier |
| `RISK-PROVENANCE-LOSS` | Make Raw Text immutable and persist revisions separately | Domain mutation tests and stored-record inspection | Provider recognition itself remains external provenance |
| `RISK-INCOGNITO-WRITE` | Inject no-write durable adapters and prohibit direct filesystem or state writes | Boundary-spy suite across every session branch | External provider retention remains outside the extension boundary |
| `RISK-CREDENTIAL-EXPOSURE` | Resolve credentials only in adapters and prohibit credential fields in shared types | Static secret scan, captured diagnostics, package inspection | User machine and provider credential stores remain external |
| `RISK-CLEANUP-LATENCY` | Bound concurrency, pending capacity, timeout, and stop drain | Burst and slow-provider tests against approved thresholds | Provider outage still causes raw fallback by design |
| `RISK-STORE-CORRUPTION` | Version records and use atomic persistence with explicit migration | Interrupted-write, migration, and incompatible-version tests | Local disk failure remains user-visible and recoverable only from live memory |
| `RISK-TASK-SPEC-INVENTION` | Compose against an approved schema with source links and explicit unknowns | Private golden-set review and unsupported-claim assertions | Model interpretation remains probabilistic and always reviewable |

## Assumptions and dependencies remain visible

- The product remains a single-user local VS Code extension for this delivery.
- Existing provider adapters and unit tests remain the behavioral baseline.
- Cloud-provider internals are tested by their owners; Voice Scribe tests its adapter contract, failure translation, and live smoke only.
- Daniel owns product decisions; implementation, architecture, UX, and test roles may be the same person but remain separate responsibilities in the artifacts.
- Integration testing depends on approved Gemini credentials, Task Spec schema, Note Store policy, UI surface, and baseline thresholds.
- Live provider and microphone smoke depends on private local credentials and hardware and is not a pull-request prerequisite.

## Architecture review exits when the blocking contracts and test seams are resolved

The architecture side of the test gate is ready when the five blocker contracts are approved or explicitly deferred out of scope, deterministic fake ports and an injectable clock exist, current lifecycle behavior is characterized, all high-risk mitigations are implemented, and the QA companion's critical scenarios can run without cloud credentials. No implementation estimate is included because repository policy forbids time estimates.
