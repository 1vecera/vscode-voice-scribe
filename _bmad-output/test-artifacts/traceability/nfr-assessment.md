---
stepsCompleted:
  - context-loaded
  - thresholds-classified
  - evidence-gathered
  - categories-scored
  - report-generated
workflowType: testarch-nfr-assess
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-voice-scribe-2026-08-03/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/ARCHITECTURE-SPINE.md
  - _bmad-output/test-artifacts/test-design/test-design-architecture.md
  - _bmad-output/test-artifacts/test-reviews/current-test-review.md
  - .github/workflows/ci.yml
  - package.json
  - package-lock.json
status: complete
created: 2026-08-03
updated: 2026-08-03
---

# Current NFR evidence fails the security gate and leaves performance thresholds unknown

**Overall status:** FAIL

This audit evaluates evidence available for shipped v0.6.1 on the BMAD retrofit branch. It does not claim the proposed cleanup, Note Store, Incognito, Task Spec, or live panel has been implemented. Those future requirements remain unassessed until their stories produce evidence.

## Known production dependency vulnerabilities block acceptance

`npm audit --omit=dev` reports two high-severity and one moderate production-tree vulnerabilities. The bundled `ws 8.19.0` falls inside the affected ranges for uninitialized memory disclosure and memory-exhaustion denial of service. `protobufjs 7.6.4` is affected by a parser denial of service, with likely low reachability in this extension because schemas are SDK-owned, and `brace-expansion 2.0.2` is present in production dependency metadata even though bundle inspection did not find it in the shipped extension bundle.

The security category therefore fails until `ws` is locked to 8.21.0 or newer and the refreshed production tree is re-audited. Remaining findings require either a patched resolution or a documented reachability review and Daniel-approved exception. Full official advisory evidence is preserved in the architecture's `review-technology-reality.md`.

## The evidence summary separates observed results from missing proof

| Category | Status | Threshold or invariant | Observed evidence | Gap |
|---|---|---|---|---|
| Vulnerability management | FAIL | No unresolved known high-severity bundled runtime advisory without approved exception | Production audit reports two high and one moderate vulnerabilities | Patch and re-audit the runtime tree |
| Credential handling | CONCERNS | Credentials never enter logs, session state, prompts, stored records, or command arguments | Google uses ADC; current ElevenLabs key is stored in VS Code configuration; no credential value was observed in log calls | Decide `SecretStorage` migration and prove Gemini adapter-local authentication |
| Content protection | CONCERNS | No audio, transcript, note content, credentials, or full prompts in diagnostics | Code logs lifecycle, provider configuration, error categories, and character counts; no transcript-value log call was found | Add captured-log tests and content-free diagnostic types during extraction |
| Raw-path performance | CONCERNS | Raw recognition never waits for cleanup and meets an approved percentile threshold | Current design routes raw provider callbacks directly; no reproducible latency report or approved threshold exists | Capture content-free baseline percentiles |
| Cleanup performance | NOT ASSESSED | Bounded concurrency, pending capacity, timeout, and drain meet approved values | Feature is not implemented | Set baseline-derived values and run deterministic burst tests |
| Current test execution | PASS | Complete deterministic suite passes | 182 tests pass in about two seconds after compilation | No blocking gap in current unit suite |
| Lifecycle reliability | CONCERNS | Every stable segment reaches one terminal visible representation and resources dispose within bounds | Current mocked provider, audio, timeout, drain, and disposal tests pass | No extension-host, microphone, live-provider, or burn-in evidence |
| Ordering integrity | NOT ASSESSED | Concurrent cleanup never publishes out of capture order or twice | Feature is not implemented | Build reducer and barrier property tests |
| Incognito integrity | NOT ASSESSED | No extension-owned durable session artifact exists | Feature is not implemented | Enumerate every durable capability and inspect writes |
| Build quality | PASS | Compile, lint, and bundle succeed | TypeScript compilation succeeds; lint has no errors and one warning; esbuild creates a 6.1 MB bundle | Bundle size has no approved budget |
| Toolchain support | CONCERNS | Compiler, lint, API types, Node types, and host are in supported compatible ranges | Current checks run, but typescript-eslint 6.21.0 does not support TypeScript 5.9.3 and ESLint 8 is end-of-life | Upgrade as one supported tuple and align host types |
| Test quality | PASS | Existing tests meet the TEA quality floor | Test review scores 91/100 with one wall-clock helper concern | Replace the 50 ms queue flush and add typed fakes during extraction |
| Code coverage | CONCERNS | Intentional threshold backed by observed baseline | No line, branch, or function coverage report exists | Add a coverage report, observe baseline, then approve a threshold |
| Architecture maintainability | CONCERNS | Domain and application code depend inward through typed ports | Target spine is explicit; current `extension.ts` still concentrates orchestration | Characterize behavior and extract the session core before new stages |
| Accessibility | CONCERNS | Every state and action is keyboard reachable, named, and focus-stable | Current commands and status bar use host primitives | No automated or extension-host accessibility evidence; proposed panel is not implemented |
| Documentation | PASS | Current and proposed behavior remain distinguishable and implementation rules are discoverable | Brownfield docs, BMAD spines, epics, context, and TEA artifacts exist | Keep docs synchronized as decisions resolve |

## Performance cannot pass without thresholds and repeatable evidence

The repository contains historical latency claims in configuration copy, but they are not a current repeatable benchmark artifact and do not cover cleanup. No response-time, throughput, CPU, memory, queue-depth, or long-session resource threshold is approved. Performance remains CONCERNS rather than FAIL because the threshold is unknown and the shipped raw pipeline still has fast unit evidence; the proposed cleanup path is NOT ASSESSED because it does not exist.

Required evidence is a content-free raw-path baseline, deterministic fake-provider burst report, cleanup percentile and fallback report, queue saturation report, and long-session memory or handle-leak observation. The evidence must record configuration and model identity without speech content.

## Reliability has strong unit evidence but no real-host proof

The current suite covers provider startup and error translation, audio process lifecycle, buffered Google startup, provider drains, idle stop, settings change, cancellation, and disposal. All 182 tests pass. The suite does not exercise a real VS Code extension host, microphone, ffmpeg capability, live provider, operating-system device path, or repeated burn-in.

Reliability remains CONCERNS until a minimum-host and current-host smoke suite exists, ffmpeg capability checks are automated, randomized ordering burn-in passes for the new pipeline, and protected live-provider smoke confirms authentication and drain behavior.

## Maintainability passes local checks but not the support and coverage bar

Compilation, lint, and bundling pass. Lint reports one unused-variable warning in `src/test/claudePolish.test.ts`. The test quality review scores 91/100. Brownfield and BMAD documentation now establish an implementation boundary.

Maintainability remains CONCERNS because code coverage is unmeasured, `extension.ts` remains the orchestration hotspot, the lint tuple is unsupported, the VS Code compatibility floor is unproven, and no dependency-boundary rule currently enforces inward imports. These are concrete prerequisite stories in `epics.md` rather than hidden debt.

## Privacy evidence is promising but not yet complete

Current code does not persist audio or transcript history and has no telemetry. Logging calls inspected in `src/` report lifecycle, configuration, errors, and character counts rather than transcript values. Claude polishing and keyterm generation intentionally send text or repository context to the locally authenticated Claude process, while selected speech providers receive audio.

Privacy remains CONCERNS because provider retention is external, the ElevenLabs key is ordinary VS Code configuration, there is no captured-log regression test, and the proposed Incognito guarantee has no implementation. Product copy must continue naming the exact extension-owned boundary.

## Release-blocking and follow-up actions are explicit

### Release blockers

- Patch `ws` to 8.21.0 or newer, refresh production transitive dependencies, rebuild, inspect the bundle, and re-run `npm audit --omit=dev`.
- Document any remaining advisory reachability exception with owner and Daniel approval; do not treat audit noise as acceptance.

### Required before next-iteration feature implementation

- Select a supported TypeScript and ESLint tuple and align the VS Code engine floor with API types, Node types, and host tests.
- Establish raw-path and cleanup performance baselines before approving numeric scheduler and latency thresholds.
- Extract deterministic session, clock, scheduler, barrier, durable-capability, and diagnostics seams with tests.
- Approve Gemini credentials, Task Spec schema, Note Store policy, and projection pattern before the dependent evidence is authored.

### Evidence that can follow the initial architecture slice

- Add extension-host smoke on the minimum and current supported VS Code hosts.
- Add platform ffmpeg capability smoke and protected provider smoke.
- Add code-coverage reporting and choose a threshold only after observing the baseline.
- Replace the extension test's wall-clock queue flush with an observable deterministic completion seam.

No effort or calendar estimates are included because repository policy forbids time estimates.

## The gate remains deterministic

```yaml
nfr_gate:
  evaluated_at: 2026-08-03
  scope: shipped-v0.6.1-baseline
  overall: FAIL
  performance: CONCERNS
  security: FAIL
  reliability: CONCERNS
  maintainability: CONCERNS
  privacy: CONCERNS
  accessibility: CONCERNS
  blockers: true
  blocking_evidence:
    - two-high-production-dependency-vulnerabilities
```
