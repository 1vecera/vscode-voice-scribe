---
stepsCompleted:
  - context-loaded
  - tests-discovered
  - quality-evaluated
  - score-aggregated
  - report-generated
workflowType: testarch-test-review
inputDocuments:
  - src/test/audioCapture.test.ts
  - src/test/claudeKeyterms.test.ts
  - src/test/claudePolish.test.ts
  - src/test/elevenLabsService.test.ts
  - src/test/extension.test.ts
  - src/test/googleSpeechService.test.ts
  - src/test/providerRegistry.test.ts
  - src/test/vocabularyBuilder.test.ts
  - src/test/helpers.ts
status: complete
created: 2026-08-03
updated: 2026-08-03
---

# The current test suite is fast and isolated but one timing helper is flaky by construction

**Quality score:** 91/100 — A+, approve with comments

**Review scope:** Complete shipped TypeScript unit suite. This audit evaluates test quality, not requirements coverage; coverage is assessed in the traceability artifact.

## The suite gives strong fast feedback over mocked boundaries

The repository compiles and passes 182 tests in roughly two seconds after compilation. Tests cover every current source module except `resolveClaude.ts` as a direct unit, use explicit Node and Sinon assertions, restore global stubs after each test, and use fake timers for long timeout and drain behavior. Speech, child-process, and VS Code dependencies remain mocked, so the suite is deterministic enough for pull-request CI and needs no cloud credential, microphone, or installed Claude process.

The suite's main quality defect is a shared `flushEditQueue()` helper that waits for real wall time. Many editor-projection tests therefore take about 50–100 milliseconds and depend on scheduler timing even though the rest of the suite carefully uses fake timers. The broad `extension.test.ts` fixture and extensive `any` usage also make interface drift harder to detect as the coordinator is extracted.

## Quality criteria distinguish applicable checks from browser-only rubric items

| Criterion | Status | Violations | Evidence |
|---|---|---:|---|
| Behavior-focused structure | Pass | 0 | Nested `describe` blocks and explicit test names make intent readable; strict Given-When-Then comments are not required by repository convention |
| Test identifiers | Not applicable | 0 | The current repository has no stable test-ID convention, and manual numbering is prohibited |
| Priority markers | Not applicable | 0 | Risk priority belongs in BMAD test design and traceability rather than existing Mocha names |
| Hard waits | Fail | 1 shared pattern | `src/test/extension.test.ts:647` uses a real 50 ms timer in `flushEditQueue()` |
| Determinism | Warn | 1 shared pattern | The wall-clock flush introduces scheduler dependence; fake timers elsewhere are strong |
| Isolation | Pass | 0 | Module instances are recreated and `sinon.restore()` or explicit clock restoration runs consistently |
| Fixture patterns | Warn | 1 maintainability concern | `extension.test.ts` builds a large all-service fixture through global proxyquire stubs |
| Data factories | Not applicable | 0 | No database or persistent domain data exists in the shipped product |
| Network-first browser pattern | Not applicable | 0 | This is not a browser test suite and all network clients are mocked |
| Explicit assertions | Pass | 0 | Assertions remain in test bodies through `assert` and `sinon.assert` |
| Test focus and length | Pass with comment | 0 | Several files exceed 300 lines, but individual tests are short and single-purpose |
| Test duration | Pass | 0 | Complete suite reports 182 passing in about two seconds after compilation |
| Flakiness patterns | Warn | 1 shared pattern | The wall-clock microtask flush is the only direct hard wait found |
| Type safety | Warn | 1 suite-wide concern | Test files disable `no-explicit-any`, so fake interfaces can drift from production contracts |

## The score reflects one high and two medium maintainability defects

```text
Starting score                         100
Wall-clock queue flush                 -5
Broad global extension fixture         -2
Suite-wide fake-interface type drift   -2
Final score                            91
```

No bonus points were applied; the score already reflects strengths through the absence of deductions for isolation, explicit assertions, focus, duration, and cleanup.

## The wall-clock queue flush should become a deterministic completion seam

**Severity:** P1 high

**Location:** `src/test/extension.test.ts:640`

`flushEditQueue()` drains promise microtasks and then sleeps for 50 milliseconds. The helper is reused across editor, command, terminal, comment, and polish-trigger tests, so a busy runner or changed queue depth can make multiple otherwise-correct tests intermittently fail or slow down.

The production coordinator should expose a testable queue-idle promise through an injected scheduler or the extracted Transcript Session, or tests should own a deterministic deferred promise and fake clock. Assertions should await the actual queued operation becoming idle rather than elapsed wall time. This directly supports `STORY-BASELINE-HARNESS` and the target session architecture.

## The extension fixture should split along extracted ports

**Severity:** P2 medium

**Location:** `src/test/extension.test.ts:8`

The file is 1,157 lines and creates global proxyquire stubs for speech providers, audio, Claude, VS Code, configuration, editor projection, and commands in one fixture. Individual tests remain focused, but a change to any constructor or activation path can require edits across unrelated scenarios.

As the architecture extracts ports, keep a small activation-composition suite and move state-machine, projection, command-transformation, and lifecycle cases into typed domain or adapter tests. This is not a request to split by line count alone; split by ownership so each fixture represents one contract.

## Typed fakes should replace the broad use of `any`

**Severity:** P2 medium

**Location:** `src/test/helpers.ts:1` and `src/test/extension.test.ts:1`

The current mock shape is intentionally comprehensive but compiled mostly as `any`. A new required method, altered callback payload, or capability field can therefore be absent from a fake while production still compiles, weakening the value of the port extraction.

Define `satisfies`-checked fake factories for inward ports and narrow VS Code test doubles to the exact consumed surface. Keep targeted escape hatches where proxyquire requires them, but do not let domain fakes bypass their real interfaces.

## Existing patterns should remain the reference during refactoring

- Provider tests inject fake clients or WebSockets and assert protocol translation without live network calls.
- Long logical delays use Sinon fake timers with `try/finally` clock restoration.
- Every suite that mutates Sinon state restores it, and extension deactivation runs after coordinator tests.
- Process tests use a shared event-emitting child-process fake rather than spawning real binaries.
- Assertions are concrete about calls, payloads, ordering, disposal, and error messages.
- No test logs or assertions contain real credentials or personal transcript content.

## File-level evidence shows where complexity is concentrated

| Test file | Lines | Passing tests | Main boundary |
|---|---:|---:|---|
| `audioCapture.test.ts` | 264 | 13 | ffmpeg process and PCM chunks |
| `claudeKeyterms.test.ts` | 99 | 11 | keyterm parsing and sanitization |
| `claudePolish.test.ts` | 417 | 22 | Claude process, timeout, cancellation, prompt output |
| `elevenLabsService.test.ts` | 566 | 37 | WebSocket protocol, vocabulary, drain, errors |
| `extension.test.ts` | 1,157 | 56 | Activation, lifecycle, editor, commands, polish, provider selection |
| `googleSpeechService.test.ts` | 342 | 29 | gRPC configuration, buffering, recognition, drain |
| `providerRegistry.test.ts` | 102 | 8 | Provider descriptors, construction, setup |
| `vocabularyBuilder.test.ts` | 157 | 6 | Symbol and regex vocabulary extraction |

The table uses Mocha's reported total and the product scan's file mapping; raw text-pattern counts can overcount helper calls and are not used as the authoritative test count.

## Coverage and real-boundary gaps remain outside this quality score

The suite has no code-coverage report, extension-host tests, real microphone tests, or live-provider CI. Those are material readiness gaps, but penalizing them here would mix test quality with coverage. They are instead recorded in the system test design, traceability matrix, and NFR assessment.

## Re-review should follow the session extraction

Approve the current suite as a strong brownfield baseline with comments. Replace the wall-clock queue flush while extracting deterministic session seams, introduce typed fakes for new ports, and split the broad extension fixture by architectural ownership. Re-run this review when the baseline harness and Transcript Session tests land.

## Knowledge used for the review remains local to BMAD TEA

- `test-quality.md` supplied determinism, isolation, assertion, focus, and duration criteria.
- `fixture-architecture.md` informed the recommendation to split fixtures by capability ownership.
- `test-levels-framework.md` kept provider and coordinator behavior at unit or fake-adapter integration level.
- `timing-debugging.md` informed the replacement of wall-clock flushing with observable completion.
- `tea-index.csv` confirmed browser network and Pact patterns are not relevant to this extension suite.
