---
stepsCompleted:
  - context-loaded
  - tests-discovered
  - criteria-mapped
  - gaps-analyzed
  - gate-decided
workflowType: testarch-trace
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-voice-scribe-2026-08-03/prd.md
  - _bmad-output/planning-artifacts/epics.md
  - _bmad-output/test-artifacts/test-design/test-design-qa.md
  - _bmad-output/test-artifacts/test-reviews/current-test-review.md
  - _bmad-output/test-artifacts/traceability/nfr-assessment.md
coverageBasis: formal-requirements
oracleConfidence: high
oracleResolutionMode: formal-requirements
oracleSources:
  - _bmad-output/planning-artifacts/prds/prd-voice-scribe-2026-08-03/prd.md
collectionStatus: COLLECTED
gateEligible: true
gateDecision: FAIL
created: 2026-08-03
updated: 2026-08-03
---

# Next-iteration requirements have no full implementation coverage and fail the quality gate

**Target:** Voice Scribe next iteration

**Coverage oracle:** Formal semantic requirements in the PRD, high confidence

**Gate decision:** FAIL

The repository has 182 passing tests for shipped v0.6.1. Those tests are valuable brownfield evidence but cannot be counted as full coverage for cleanup, live rewritten preview, Mode Profiles, Task Spec, local notes, or Incognito because those capabilities do not exist. This trace does not generate tests; planned scenarios live in the system test design.

## Full requirement coverage is currently zero by design

| Priority | Total requirements | Fully covered | Full coverage | Gate status |
|---|---:|---:|---:|---|
| P0 | 6 | 0 | 0% | FAIL |
| P1 | 12 | 0 | 0% | FAIL |
| P2 | 0 | 0 | Not applicable | Not applicable |
| P3 | 0 | 0 | Not applicable | Not applicable |
| Total | 18 | 0 | 0% | FAIL |

P0 contains ordering, privacy, security, Incognito, and loss-prevention requirements. P1 contains the remaining product capabilities and quality attributes. Priority reflects risk and user impact, not test execution timing.

## Every requirement maps to a planned scenario and current evidence status

| Requirement | Priority | Current coverage | Existing evidence | Planned primary scenario | Gap |
|---|---|---|---|---|---|
| `FR-CLEANUP-ADAPTER` | P1 | NONE | Existing speech-provider abstraction demonstrates the registry pattern only | `TEST-CLEANUP-FAILURE-MATRIX` | Cleanup port and adapter contract do not exist |
| `FR-CLEANUP-CONCURRENCY` | P1 | NONE | No cleanup scheduler exists | `TEST-CLEANUP-SCHEDULER` | Capacity, timeout, backpressure, and cancellation are unimplemented |
| `FR-CLEANUP-ORDER` | P0 | NONE | Current editor queue is serialized but no concurrent rewrite barrier exists | `TEST-ORDER-RANDOMIZED` | `segmentSequence`, reducer, and barrier are unimplemented |
| `FR-CLEANUP-VOICE` | P1 | NONE | Claude polish tests cover a separate post-insert feature | `TEST-TASK-SPEC-TRACEABILITY` plus private Voice Profile evaluation | Cleanup Voice Profile contract is unimplemented |
| `FR-PROJECTION-STATE` | P1 | NONE | Current partial decoration covers only unstable recognition | `TEST-LIVE-SEGMENT-STATES` | Raw, rewriting, waiting, ready, failed, and cancelled states do not exist |
| `FR-PROJECTION-ORDER` | P0 | NONE | Current edit queue has ordering tests but not concurrent revision publication | `TEST-ORDER-RANDOMIZED` | Stable segment identity and versioned representation are unimplemented |
| `FR-MODE-PROFILE` | P1 | NONE | Current settings branch behavior is not a declarative profile contract | `TEST-PROFILE-SNAPSHOT` | Profile validation and immutable snapshot do not exist |
| `FR-TASK-SPEC` | P1 | NONE | No current feature | `TEST-TASK-SPEC-TRACEABILITY` | Schema is unresolved and composer is unimplemented |
| `FR-NOTE-STORE` | P1 | NONE | Shipped product intentionally has no transcript store | `TEST-STORE-ATOMICITY`, `TEST-STORE-MIGRATION`, `TEST-HISTORY-RECOVERY` | Product policy and implementation are absent |
| `FR-INCOGNITO` | P0 | NONE | Shipped product has no note persistence but also no durable-capability policy | `TEST-INCOGNITO-BOUNDARIES` | Registry and no-write composition are unimplemented |
| `FR-OUTPUT-SINK` | P1 | PARTIAL | `extension.test.ts` covers current editor and terminal branches | `TEST-OUTPUT-SINK-FAILURE` | Replaceable capability-advertising sink contract does not exist |
| `NFR-LATENCY` | P1 | PARTIAL | Current fake timing and direct raw path exist | `TEST-CLEANUP-BURST` | No repeatable baseline or approved threshold exists |
| `NFR-RELIABILITY` | P0 | PARTIAL | Provider, audio, lifecycle, drain, timeout, and disposal unit tests pass | `TEST-SESSION-STATE-MACHINE`, `TEST-STOP-DRAIN-FAULTS` | No extracted state machine, extension-host smoke, or burn-in evidence |
| `NFR-PRIVACY` | P0 | PARTIAL | Code inspection found content-free logs and no transcript persistence | `TEST-INCOGNITO-BOUNDARIES`, `TEST-DIAGNOSTIC-TYPE-SAFETY` | No captured-log regression or Incognito implementation |
| `NFR-SECURITY` | P0 | PARTIAL | Google uses ADC; current production audit evidence exists | `TEST-PRODUCTION-AUDIT`, `TEST-GEMINI-CONTRACT` | Audit currently fails and Gemini credentials are unresolved |
| `NFR-OBSERVABILITY` | P1 | NONE | Current logs are ad hoc rather than a typed diagnostic contract | `TEST-DIAGNOSTIC-TYPE-SAFETY` | Content-free diagnostic port and queue events do not exist |
| `NFR-MAINTAINABILITY` | P1 | PARTIAL | Provider registry, strict TypeScript, compile, lint, bundle, and 91/100 test quality | `TEST-MINIMUM-HOST-SMOKE` plus static import-boundary rule | Current coordinator is monolithic and toolchain support is unresolved |
| `NFR-ACCESSIBILITY` | P1 | NONE | Current commands use host primitives, but no accessibility assertions exist | `TEST-KEYBOARD-AND-NAMES` | Proposed surface and host harness are absent |

## P0 gaps block implementation acceptance

- `FR-CLEANUP-ORDER` and `FR-PROJECTION-ORDER` require deterministic randomized tests proving the reducer, canonical sequence, barrier, retry versioning, and duplicate rejection.
- `FR-INCOGNITO` and `NFR-PRIVACY` require enumeration and inspection of every durable capability across success, failure, retry, stop, and disposal.
- `NFR-RELIABILITY` requires extracted state-machine and bounded lifecycle evidence in addition to the current coordinator suite.
- `NFR-SECURITY` currently fails the production vulnerability audit and lacks an approved Gemini credential path.

These are critical gaps because the affected behavior protects source text, privacy, credential safety, and transcript order with no safe invisible workaround.

## P1 gaps define the implementation test backlog

- Build provider-contract tests for cleanup success and typed failure translation.
- Build scheduler tests for admission, saturation, timeout, cancellation, stop drain, and content-free queue evidence.
- Build component tests for every visible segment state, compare, retry, revert, focus stability, keyboard access, and screen-reader names.
- Build profile tests for validation, immutable snapshot, sink capability intersection, and session-boundary changes.
- Build Task Spec contract tests only after its schema is approved.
- Build Note Store atomicity, migration, deletion, terminal snapshot, and history tests only after storage policy is approved.
- Build minimum-host and current-host package smoke after the compatibility floor is resolved.
- Build ffmpeg platform-capability tests and protected live-provider smoke outside ordinary pull requests.

## Current tests remain the brownfield regression floor

| Existing area | Tests | Role in the next iteration |
|---|---:|---|
| Audio capture | 13 | Preserve initialization, PCM chunking, stop, and disposal behavior |
| Keyterm parsing | 11 | Preserve sanitization limits and model-output parsing |
| Claude polishing | 22 | Preserve the separate current polish command while cleanup is introduced |
| ElevenLabs speech | 37 | Preserve WebSocket protocol, vocabulary, failures, and drain behavior |
| Extension coordinator | 56 | Characterize activation, lifecycle, editor, terminal, commands, polish, and provider selection |
| Google speech | 29 | Preserve configuration, buffering, recognition, drain, and client lifetime behavior |
| Provider registry | 8 | Preserve data-driven provider construction and setup checks |
| Vocabulary builder | 6 | Preserve symbol and regex extraction behavior |

The suite passes 182/182 locally. No existing test is falsely relabeled as a next-iteration requirement test; implementation stories should introduce semantic test IDs from the test design without manual numbering.

## Test quality is sufficient for a baseline but not complete system evidence

The current suite scores 91/100 in the TEA test review. Its shared 50 ms `flushEditQueue()` wall wait should become a deterministic queue-idle seam during session extraction. Global proxyquire fixtures and broad `any` use should give way to typed port fakes. No duplicate future coverage exists because the future tests are not yet written.

## NFR failure independently confirms the gate decision

The current NFR audit is FAIL because the production dependency tree contains two high-severity and one moderate vulnerabilities. Performance, reliability, maintainability, privacy, and accessibility remain CONCERNS due missing thresholds or evidence. Even if functional coverage existed, the security gate would still block acceptance until runtime dependencies are patched or formally excepted.

## Deterministic gate criteria produce FAIL

| Criterion | Required | Actual | Status |
|---|---:|---:|---|
| P0 full requirement coverage | 100% | 0% | Not met |
| P1 minimum full coverage | 80% | 0% | Not met |
| Overall minimum full coverage | 80% | 0% | Not met |
| Current automated test pass rate | 100% for executed baseline suite | 100% | Met |
| NFR release status | No unresolved FAIL | Security FAIL | Not met |
| Open score-9 risks | None | Three | Not met |

**Decision:** FAIL. The decision is expected for a requirements-first retrofit before feature implementation. It means the artifacts are ready to guide work; it does not mean the shipped v0.6.1 test suite is failing.

## The gate can move only through evidence, not document edits

- Resolve the production dependency blocker and attach a clean audit or approved exception.
- Implement stories with their planned tests and update this matrix from actual test paths and results.
- Require P0 full coverage, P1 coverage at or above 90% for PASS, overall coverage at or above 80%, and no unresolved NFR FAIL.
- Re-run NFR evidence audit and traceability after each deliverable epic rather than declaring readiness from planned scenarios.
- Keep code coverage marked unknown until a report exists and Daniel approves a baseline-informed threshold.
