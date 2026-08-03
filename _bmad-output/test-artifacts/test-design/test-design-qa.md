---
title: Voice Scribe system test coverage plan
status: draft
created: 2026-08-03
updated: 2026-08-03
mode: system-level
sources:
  - test-design-architecture.md
  - ../../planning-artifacts/epics.md
---

# Quality evidence should concentrate on lifecycle, ordering, provenance, and privacy

This plan defines scenario ownership and test level without duplicating behavior at every layer. Priority expresses product and risk importance, not execution timing. All functional tests should run in pull requests while they remain fast and deterministic; credentialed, hardware-dependent, performance, and long burn-in checks run separately.

## Coverage uses the lowest level that can prove each contract

| Scenario ID | Contract | Level | Priority | Risk | Planned assertion |
|---|---|---|---|---|---|
| `TEST-PRODUCTION-AUDIT` | `STORY-SECURE-RUNTIME-DEPENDENCIES` | Static and bundle inspection | P0 | `RISK-VULNERABLE-RUNTIME` | No unreviewed high-severity production advisory remains and the bundle carries patched runtime resolutions |
| `TEST-CURRENT-LIFECYCLE` | `STORY-BASELINE-HARNESS` | Integration with fake adapters | P0 | `RISK-ORCHESTRATION-REGRESSION` | Current partial, final, commands, stop, settings change, cancellation, and late-callback behavior remains characterized |
| `TEST-SESSION-STATE-MACHINE` | `STORY-SESSION-CORE` | Unit | P0 | `RISK-ORCHESTRATION-REGRESSION` | Commands produce legal idempotent transitions and reject late session identity |
| `TEST-RAW-PROVENANCE` | `FR-CLEANUP-VOICE`, `FR-NOTE-STORE` | Unit | P0 | `RISK-PROVENANCE-LOSS` | Stable Raw Text cannot mutate and revisions remain separate references |
| `TEST-CLEANUP-FAILURE-MATRIX` | `FR-CLEANUP-ADAPTER` | Adapter contract | P0 | `RISK-PROVIDER-DEGRADATION` | Every typed failure selects Raw Text and capture remains active |
| `TEST-ORDER-RANDOMIZED` | `FR-CLEANUP-ORDER`, `FR-PROJECTION-ORDER` | Unit property-style | P0 | `RISK-ORDERING` | Random completion, duplicate, timeout, and cancellation preserve capture order and one publication |
| `TEST-INCOGNITO-BOUNDARIES` | `FR-INCOGNITO` | Integration with spy adapters | P0 | `RISK-INCOGNITO-WRITE` | Notes, diagnostics, task output, recovery, and cache receive zero durable writes |
| `TEST-DIAGNOSTIC-TYPE-SAFETY` | `NFR-PRIVACY`, `NFR-OBSERVABILITY` | Static and unit | P0 | `RISK-CREDENTIAL-EXPOSURE` | Diagnostic types and emitted payloads contain no content or credential field |
| `TEST-STOP-DRAIN-FAULTS` | `NFR-RELIABILITY` | Integration with fake clock | P0 | `RISK-ORCHESTRATION-REGRESSION` | Stop bounds speech and cleanup drain, publishes raw fallback, flushes allowed writes, and disposes once |
| `TEST-CLEANUP-SCHEDULER` | `FR-CLEANUP-CONCURRENCY` | Unit | P1 | `RISK-CLEANUP-LATENCY` | Active and pending capacity, backpressure, timeout, and cancellation obey approved policy |
| `TEST-LIVE-SEGMENT-STATES` | `FR-PROJECTION-STATE` | Component | P1 | `RISK-ACCESSIBILITY-DRIFT` | Every state keeps readable text, stable identity, correct actions, and no focus jump |
| `TEST-KEYBOARD-AND-NAMES` | `NFR-ACCESSIBILITY` | Component and host smoke | P1 | `RISK-ACCESSIBILITY-DRIFT` | Controls are keyboard reachable, named, stateful, and not hover or color dependent |
| `TEST-PROFILE-SNAPSHOT` | `FR-MODE-PROFILE` | Unit | P1 | `RISK-ORCHESTRATION-REGRESSION` | Valid profile starts atomically and settings changes require a new session |
| `TEST-GEMINI-CONTRACT` | `STORY-GEMINI-ADAPTER` | Adapter contract | P1 | `RISK-CREDENTIAL-EXPOSURE` | Approved authentication stays adapter-local and provider outcomes map correctly |
| `TEST-TASK-SPEC-TRACEABILITY` | `FR-TASK-SPEC` | Unit and private golden set | P1 | `RISK-TASK-SPEC-INVENTION` | Required sections map to source and missing content remains an explicit unknown |
| `TEST-STORE-ATOMICITY` | `FR-NOTE-STORE` | Integration | P1 | `RISK-STORE-CORRUPTION` | Interrupted writes do not replace the previous valid record and errors remain typed |
| `TEST-STORE-MIGRATION` | `FR-NOTE-STORE` | Integration | P1 | `RISK-STORE-CORRUPTION` | Supported older records migrate without Raw Text loss and unknown versions fail explicitly |
| `TEST-OUTPUT-SINK-FAILURE` | `FR-OUTPUT-SINK` | Adapter contract | P1 | `RISK-PROVENANCE-LOSS` | Editor or terminal failure leaves live text recoverable and does not alter session order |
| `TEST-CLEANUP-BURST` | `NFR-LATENCY`, `NFR-RELIABILITY` | Integration performance | P1 | `RISK-CLEANUP-LATENCY` | Burst traffic respects approved capacity and raw-path latency thresholds |
| `TEST-HISTORY-RECOVERY` | `STORY-SESSION-HISTORY` | Component and storage integration | P2 | `RISK-STORE-CORRUPTION` | Retained rows open, preserve provenance and terminal status, and delete the selected record |
| `TEST-MINIMUM-HOST-SMOKE` | `STORY-HOST-COMPATIBILITY` | Packaged extension-host integration | P1 | `RISK-HOST-FLOOR-DRIFT` | Activation and core dictation projection work on the declared minimum and a current supported host |
| `TEST-FFMPEG-CAPABILITY` | `STORY-FFMPEG-CAPABILITY` | Adapter integration | P1 | `RISK-PROVIDER-DEGRADATION` | Required platform input capability passes or setup returns a typed actionable failure before capture |
| `TEST-LIVE-PROVIDER-SMOKE` | External speech and cleanup adapters | Manual or protected scheduled integration | P2 | `RISK-PROVIDER-DEGRADATION` | Selected provider authenticates, streams or cleans one safe synthetic sample, and drains cleanly |
| `TEST-PLATFORM-AUDIO-SMOKE` | ffmpeg and device boundary | Manual platform smoke | P2 | `RISK-PROVIDER-DEGRADATION` | Supported platform discovers the configured device, captures PCM, and stops without leaked process |
| `TEST-LONG-BURN-IN` | Ordering and lifecycle | Scheduled integration | P3 | `RISK-ORDERING` | Long randomized sessions show no duplicate publication, queue leak, or stale callback mutation |

## Test data stays synthetic and content-safe

- Domain and adapter-contract tests use fixed short synthetic segments with no personal, repository, or credential content.
- Property-style ordering tests use seeded segment identities, completion permutations, failures, and fake-clock advances so failure reproduction is exact.
- Voice Profile evaluation uses a private, explicitly approved corpus outside logs and durable test artifacts; published results contain scores and failure categories rather than source prose.
- Stored-record fixtures include schema versions, interrupted states, unicode, empty optional metadata, and explicit incompatible versions.
- Credentialed smoke uses provider-scoped test credentials supplied through approved local or protected CI channels and never CLI arguments.

## Pull requests carry functional evidence while expensive checks remain isolated

- **Pull request** — Run compile, the complete deterministic unit and fake-adapter integration suite, lint, bundle, traceability validation, and any fast component tests. Preserve the current philosophy of running all functional tests when the suite remains below the repository's practical feedback budget.
- **Nightly** — Run randomized completion burn-in, store migration matrix, extended burst scenarios, and any extension-host suite whose startup cost is too high for pull requests.
- **Weekly or release candidate** — Run live provider, microphone, supported-platform, private Voice Profile, package-content, and approved performance-threshold checks in a controlled environment.

No Playwright or Pact stack is selected. The product has no browser or service-to-service HTTP contract. A VS Code host harness should be chosen only after the live surface technology is fixed.

## Entry criteria prevent tests from encoding guesses

- The PRD, architecture spine, and epic acceptance criteria use the same semantic identifiers.
- Gemini authentication, Task Spec schema, Note Store policy, projection pattern, and numeric thresholds are approved for the scenarios that depend on them.
- Domain ports accept deterministic fakes and time is injectable.
- Synthetic fixtures and any private evaluation corpus have an explicit owner and handling boundary.
- Current v0.6.1 tests pass before behavior extraction begins.

## Exit criteria make release quality visible

- P0 scenarios pass at 100% with no waiver for ordering, provenance, Incognito, lifecycle, or content leakage.
- P1 scenarios pass at or above 95%; any failure has an owned mitigation and blocks its affected feature from release.
- No open score-9 risk remains, and every score-6 risk has verified mitigation or an explicit Daniel-approved waiver with revisit condition.
- Every functional requirement and NFR maps to planned evidence; implemented requirements map to actual passing tests.
- Approved latency, queue, timeout, drain, and quality thresholds have evidence where the implementation claims readiness.
- Existing `npm test`, `npm run lint`, and `npm run esbuild-base` checks remain green.
- Package inspection shows no credentials, local notes, test corpus, BMAD output, or scratch artifacts.

Code-line coverage has no current measured baseline or repository threshold, so this plan does not invent one. Requirement coverage and critical-state coverage are the binding gates until an observed code-coverage baseline supports an intentional threshold.

## External boundaries receive contract tests and small live smoke checks

| Boundary | Regression obligation | Coordination |
|---|---|---|
| Existing ElevenLabs adapter | Current mocked protocol, drain, vocabulary, and failure tests remain green | Live smoke requires private key |
| Existing Google adapter | Current mocked buffering, restart, model, language, drain, and failure tests remain green | Live smoke requires ADC and project configuration |
| ffmpeg audio | Existing process and chunk tests remain green | Real device smoke is platform-local |
| Claude polishing and keyterms | Existing process, timeout, cancellation, and sanitization tests remain green | No cleanup refactor may silently change current Claude behavior |
| VS Code editor and terminal | Existing coordinator tests remain green; host smoke covers focus and real edit behavior | Requires selected UI surface and host harness |
| Gemini cleanup | Adapter contract suite is mandatory; live smoke is protected | Depends on approved credential and billing path |
| Local Note Store | Atomicity, migration, deletion, and Incognito spy suite | Depends on selected persistence design |

## Test implementation effort is intentionally not estimated

Repository policy prohibits time estimates. Planning should schedule by prerequisite and risk: baseline harness and deterministic domain seams lead; critical ordering, lifecycle, provenance, and Incognito scenarios land with their production stories; protected integration and manual evidence follow only after credentials, hardware, and product contracts exist.
