# Reject unchanged stack preservation until security and compatibility drift are corrected

**Verdict: changes required before architecture acceptance.** The architecture pattern is implementable and every version in the stack table can be traced either to the lockfile, a repository policy file, or installed BMAD metadata. The technology section is not safe to accept unchanged because the locked WebSocket runtime is vulnerable, the lint stack is outside its supported version matrix, and the declared VS Code compatibility floor is not enforced by the API and Node type packages used to compile the extension.

The repository still compiles, passes all 182 tests, and bundles successfully on Node 22.23.0. Those checks establish that the present lockfile is internally runnable; they do not establish security, upstream support, or compatibility with the declared minimum VS Code release.

## Replace the vulnerable WebSocket lock before preserving the runtime stack

**Severity: blocker.** `package.json` allows `ws ^8.14.2`, but `package-lock.json` resolves `ws 8.19.0`, and esbuild includes that implementation in `out/extension.js`. A live `npm audit --omit=dev` on 2026-08-03 reports the direct dependency in both affected ranges: the high-severity memory-exhaustion issue affects `ws >=8.0.0 <8.21.0` and is patched in `8.21.0`, while the uninitialized-memory issue affects `ws >=8.0.0 <8.20.1` and is patched in `8.20.1`. The first issue is directly relevant to a WebSocket client because a remote peer can force the receiver to retain disproportionate memory through tiny fragments and chunks. See the reviewed [memory-exhaustion advisory](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) and [memory-disclosure advisory](https://github.com/advisories/GHSA-58qx-3vcg-4xpx).

The same production audit reports `protobufjs 7.6.4` through `@google-cloud/speech 7.4.0 -> google-gax 5.0.7`; that version is affected through `7.6.4` and patched in `7.6.5`. The generated bundle contains protobufjs, but the advisory requires parsing attacker-influenced `.proto` schema text, while this extension uses SDK-owned schemas, so current reachability appears low rather than zero. See the reviewed [protobufjs advisory](https://github.com/advisories/GHSA-j3f2-48v5-ccww).

The audit also reports high-severity `brace-expansion 2.0.2` through production dependency metadata. The generated bundle contains no `brace-expansion` module, so this appears to be build-tree exposure rather than shipped extension runtime exposure, but it still prevents a clean production audit and has a straightforward patched line at `2.1.3` or newer. See the reviewed [brace-expansion advisory](https://github.com/advisories/GHSA-mh99-v99m-4gvg).

The architecture should replace “preserves the shipped toolchain until a decision requires change” with a security-qualified rule: preserve behavior, but refresh exact resolutions when a supported non-breaking patch closes a known advisory. Existing semver ranges in the dependency tree already admit `ws 8.21.1`, `protobufjs 7.6.5`, and `brace-expansion 2.1.4`; `npm audit fix --omit=dev --dry-run` identified those exact lockfile changes without requiring a major dependency migration.

## Upgrade the unsupported lint tuple as one compatibility unit

**Severity: high.** The spine names TypeScript `5.9.3`, which is the exact lockfile resolution, but it omits ESLint `8.57.1` and `@typescript-eslint/parser` plus `eslint-plugin` `6.21.0`. That omission makes the “shipped toolchain” inventory incomplete. The archived v6 compatibility page states that v6 supports TypeScript only in `>=3.3.1 <5.2.0`, so the locked TypeScript `5.9.3` sits outside that tested range. The project now states that older typescript-eslint majors are never maintained or supported and may crash with newer TypeScript versions. See the official [v6 dependency matrix](https://v6--typescript-eslint.netlify.app/users/dependency-versions/) and [typescript-eslint release policy](https://typescript-eslint.io/users/releases/).

ESLint `8.57.1` is independently end-of-life: the ESLint project records v8 maintenance ending on 2024-10-05 and says EOL lines receive no further updates. See the official [ESLint version-support table](https://eslint.org/version-support/).

`npm run lint` currently completes with one warning and no errors, but a passing invocation does not restore upstream support. Select and verify a supported ESLint, parser, plugin, and TypeScript tuple together; do not independently jump TypeScript to the registry's latest major because the current typescript-eslint support window must remain the controlling constraint. The current typescript-eslint documentation lists its supported TypeScript and ESLint ranges on the official [dependency-version page](https://typescript-eslint.io/users/dependency-versions/).

## Align the VS Code compatibility promise with compile-time API and Node types

**Severity: high.** `package.json` declares `engines.vscode: ^1.85.0`, which is a promise that the extension remains installable on VS Code 1.85 and later. Microsoft defines that field as the minimum VS Code API compatibility boundary, while `@types/vscode` declares the API available to the compiler. See the official [publishing compatibility guidance](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) and [extension anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy).

The manifest asks for `@types/vscode ^1.85.0`, but the lockfile resolves `1.109.0`. That allows new code to compile against APIs introduced well after the claimed 1.85 floor without any compiler signal. The present source may happen to use only older APIs, but the repository has no minimum-version extension-host test that proves it, and the architecture proposes new projection, storage, terminal, and diagnostics adapters that will widen API use.

The same gap exists for Node APIs. CI runs Node 22 and the lockfile resolves `@types/node 20.19.35`, while VS Code 1.85 belongs to the extension-host generation that moved from Node 16 to Node 18 in VS Code 1.82. Microsoft documents that extension code runs in a Node extension host and that VS Code 1.82 performed the Node 18 transition. See the official [extension-host runtime guide](https://code.visualstudio.com/api/advanced-topics/extension-host) and [VS Code 1.82 runtime update](https://code.visualstudio.com/updates/v1_82).

Choose the real compatibility floor before implementation. Either pin `@types/vscode` and `@types/node` to what that floor supplies and test the packaged extension on the minimum host, or raise `engines.vscode` to the oldest host the project will actually support. Continue testing a current host as well; CI Node 22 alone does not exercise VS Code's extension runtime.

## Treat the stack table as an evidence inventory instead of one undifferentiated version list

The table mixes exact lockfile resolutions, a floating major CI policy, a semver compatibility range, installer metadata, and a service-side model identifier. All claims are traceable, but the word “Version” makes their different meanings invisible. Add columns for role, source of truth, pin semantics, and current support status.

| Spine entry | Repository grounding | Current reality on 2026-08-03 | Disposition |
|---|---|---|---|
| TypeScript `5.9.3` | Exact `package-lock.json` resolution from manifest range `^5.3.2` | Runnable, materially behind registry latest `7.0.2`, and incompatible with the locked typescript-eslint v6 support matrix | Keep only as part of a newly supported lint tuple |
| Node.js CI runtime `22` | `.github/workflows/ci.yml` uses floating major `22` | Node 22 is still an official LTS line, so it is supported rather than obsolete; Node recommends Active or Maintenance LTS for production | Keep, but label CI-only and add extension-host compatibility coverage; see [Node releases](https://nodejs.org/en/about/previous-releases) |
| VS Code extension engine `^1.85.0` | Exact `package.json` compatibility range | Valid as a minimum-version declaration, but not proven against locked API and Node types | Pin matching types and test 1.85, or raise the floor |
| esbuild `0.27.3` | Exact lock resolution from range `^0.27.3` | Builds successfully; registry latest is `0.28.1`; no unsupported status established | Maintenance update candidate, not a blocker |
| Mocha `10.8.2` | Exact lock resolution from range `^10.7.0` | All 182 tests pass; registry latest stable is `11.8.0`; no support guarantee for v10 was found | Plan a tested major update, but do not block the architecture on age alone |
| Sinon `17.0.1` | Exact lock resolution from range `^17.0.0` | Tests pass; registry latest is `22.1.0`; old but no explicit upstream EOL policy was found | Plan a tested major update with Mocha |
| `ws 8.19.0` | Exact lock resolution from range `^8.14.2`; bundled runtime dependency | Known high and moderate advisories; patched same-major releases exist | Block until `8.21.0` or newer is locked and audited |
| `@google-cloud/speech 7.4.0` | Exact lock resolution from range `^7.4.0`; bundled runtime dependency | Registry latest is `7.5.0`; current transitive protobufjs is advisory-affected | Refresh the dependency tree and re-audit before freezing |
| BMAD Method `6.10.0` | `_bmad/_config/manifest.yaml` installation and module metadata | Matches the npm stable release returned by `npm view bmad-method version` | Verified current |
| BMAD TEA `1.19.1` | `_bmad/_config/manifest.yaml` external module metadata and commit SHA | Matches the npm stable release returned by `npm view bmad-method-test-architecture-enterprise version` | Verified current |
| `gemini-3.6-flash` | Architecture decision only; no SDK or manifest dependency | Google documents the exact model code as stable and GA, updated July 2026 | Valid initial model candidate; retain implementation-time availability and quota verification |

The registry-current values above came from live `npm outdated --long` and `npm view` queries rather than memory. Direct official registry records are available for [TypeScript](https://registry.npmjs.org/typescript/latest), [esbuild](https://registry.npmjs.org/esbuild/latest), [Mocha](https://registry.npmjs.org/mocha/latest), [Sinon](https://registry.npmjs.org/sinon/latest), [ws](https://registry.npmjs.org/ws/latest), [Google Cloud Speech](https://registry.npmjs.org/%40google-cloud%2Fspeech/latest), [BMAD Method](https://registry.npmjs.org/bmad-method/latest), and [BMAD TEA](https://registry.npmjs.org/bmad-method-test-architecture-enterprise/latest). The comparison is evidence of maintenance distance, not an instruction to install every latest major without compatibility testing.

## Keep Gemini, Node 22, and the installed BMAD versions as verified claims

The model identifier `gemini-3.6-flash` is not speculative. Google lists that exact code as a stable Gemini 3.6 Flash version and describes it as generally available for production use. The spine correctly defers SDK and authentication choice and correctly requires availability to be reverified at implementation time. See Google's official [Gemini 3.6 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash) and [latest-model guidance](https://ai.google.dev/gemini-api/docs/latest-model).

Node 22 remains on the official LTS line, even though Node 24 is the newer LTS and Node 26 is Current. Keeping Node 22 for deterministic CI is supported today; the table should not imply that this is the extension-host runtime.

BMAD Method `6.10.0` and TEA `1.19.1` are fully grounded in the installed manifest, including the TEA source repository and commit SHA, and live npm stable tags match both versions. No update or support problem was found for these entries.

## Add FFmpeg as an explicit external-runtime contract

**Severity: medium.** The diagrams and current source name FFmpeg as the audio adapter, but the stack table omits it because it is a system executable rather than an npm package. `AudioCapture.initialize()` accepts any executable whose `ffmpeg -version` exits successfully; it does not parse a version or verify `avfoundation`, `alsa`, or `dshow` availability. Unit tests mock the process and therefore do not establish real platform compatibility. The reviewing machine has FFmpeg `8.1.2`, but that local installation is not a project constraint.

The spine should classify FFmpeg as an unbundled prerequisite and bind an activation-time capability probe plus a tested support matrix by operating system. An exact global pin is unnecessary, but an omitted version and capability policy makes the stack description incomplete and leaves future adapter failures outside the typed failure design.

## Passing local checks confirm coherence but not acceptance readiness

- `npm test` compiled TypeScript and passed 182 tests on Node `22.23.0`.
- `npm run lint` completed with one existing unused-variable warning and no errors.
- `npm run esbuild-base` produced a `6.1 MB` bundle successfully.
- Bundle inspection confirmed `ws` and `protobufjs` are shipped and `brace-expansion` is not present.
- `npm audit --omit=dev` reported three advisory-affected production packages: two high-severity findings and one moderate finding.

These checks support the architectural choice to evolve the existing codebase rather than replace it. They do not support preserving the exact current dependency resolutions or claiming compatibility with VS Code 1.85 without a minimum-host test.

## Resolve the technology blockers before accepting the spine

- Lock `ws 8.21.0` or newer, refresh the Google client dependency tree to patched transitive versions, rebuild, and require a clean production audit or an explicit reachability exception backed by bundle evidence.
- Upgrade ESLint and both typescript-eslint packages as one supported tuple with the chosen TypeScript version; include them in the stack inventory.
- Align `engines.vscode`, `@types/vscode`, `@types/node`, and extension-host tests around one declared minimum runtime.
- Recast the stack table to distinguish exact lock resolutions, semver ranges, CI majors, system prerequisites, installer metadata, and service-side model identifiers.
- Add FFmpeg capability and operating-system support evidence to the adapter contract.

After those corrections, no named technology in the spine is inherently unavailable or unsuitable for the proposed ports-and-adapters migration.
