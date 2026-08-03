# BMAD now governs discovery, planning, implementation, and quality for Voice Scribe

Voice Scribe uses BMAD Method for product planning and Test Architecture Enterprise for risk-driven verification. The retrofit captures the shipped v0.6.1 product from repository evidence, then establishes a separate planning record for the proposed cleanup, live preview, Task Spec, note-store, Incognito, and extensibility work.

The distinction between evidence and intent is binding: `docs/` describes what exists, while `_bmad-output/planning-artifacts/` describes what may be built. A proposed behavior is not a product capability until its story is implemented, verified, and reflected back into the brownfield documentation.

## Installed integrations make the same BMAD workflows available across coding agents

BMAD Method 6.10.0 and Test Architecture Enterprise 1.19.1 are installed under `_bmad/`. Agent-facing skills are installed for Codex, Claude Code, Cursor, and Hermes so a workflow can continue without translating its artifact contract between tools.

| Integration | Repository location | Purpose |
| --- | --- | --- |
| BMAD core, BMM, and TEA | `_bmad/` | Versioned workflows, templates, configuration, scripts, and manifests |
| Codex, Cursor, and Hermes skills | `.agents/skills/` | Universal agent discovery and workflow invocation |
| Claude Code skills | `.claude/skills/` | Claude Code workflow invocation |
| Shipped-product knowledge | `docs/` | Current implementation evidence used by brownfield planning |
| Planning artifacts | `_bmad-output/planning-artifacts/` | Product intent, requirements, UX, architecture, work breakdown, and readiness |
| Implementation artifacts | `_bmad-output/implementation-artifacts/` | Sprint status and just-in-time story files |
| Test artifacts | `_bmad-output/test-artifacts/` | Test strategy, review, traceability, non-functional assessment, and gate state |

Local BMAD user overrides remain untracked in `_bmad/config.user.toml` and `_bmad/custom/config.user.toml`. Shared configuration, manifests, workflows, and output are versioned.

## The artifact chain provides one decision owner at each level

| Decision | Controlling artifact | Update trigger |
| --- | --- | --- |
| What problem and outcome matter | Product brief | A material change to the target user, problem, or success outcome |
| What the product must do | PRD | A requirement, scope, metric, or non-functional target changes |
| How the experience behaves | Experience and interface design | A journey, state, interaction, content, or accessibility rule changes |
| How the system preserves correctness | Architecture spine | A boundary, invariant, lifecycle, failure policy, or technology decision changes |
| What can be implemented independently | Epics and stories | Requirements or architecture change the delivery breakdown |
| Whether planning is implementable | Implementation readiness report | The planning set changes enough to alter its alignment or unresolved decisions |
| What an implementation agent must preserve | Project context | A stable repository-wide implementation rule changes |
| What work is active | Sprint status | A story or epic changes lifecycle state |
| What evidence is required | TEA artifacts | Risk, requirement coverage, implementation, or quality evidence changes |

Run-scoped brief, PRD, UX, and architecture workspaces keep append-only `.memlog.md` files beside their rendered artifacts. BMAD updates those logs through `_bmad/scripts/memlog.py`; agents must not rewrite history by hand.

## New work moves from intent to a story without bypassing readiness

- Start in the brief when the user problem or desired outcome is changing; start in the PRD when the outcome is settled and only requirements are changing.
- Update UX and architecture whenever a requirement changes visible behavior, state ownership, failure handling, privacy, persistence, or an external integration.
- Regenerate the affected epic and story acceptance criteria so each requirement remains traceable to implementation and test evidence.
- Run implementation readiness before promoting dependent stories to `ready-for-dev`.
- Use BMAD create-story just in time for the next eligible backlog item; do not pre-create every story because later implementation evidence should inform later story context.
- Implement from the generated story, run the BMAD code review workflow, and update sprint status only when the lifecycle transition is evidenced.
- Refresh the brownfield documents after behavior ships so the next planning cycle starts from the product that actually exists.

The sprint ledger uses semantic keys instead of hand-maintained ordinals. Its `action_items` section names decisions that require Daniel's product judgment and records which stories they unlock.

## The first implementation slice removes readiness blockers before adding visible scope

The current readiness verdict is not ready for feature implementation. The next action is to create `STORY-BASELINE-HARNESS`, followed by the runtime dependency, host compatibility, and ffmpeg capability stories from `EPIC-TRUSTWORTHY-CLEANUP`.

That sequence is deliberate: baseline measurements supply honest latency thresholds, dependency remediation clears the present production security gate, host compatibility resolves the extension's supported runtime contract, and ffmpeg probing turns an environmental assumption into an actionable diagnostic. Cleanup-provider and projection work then build on known boundaries rather than absorbing those risks invisibly.

The current production dependency audit reports high-severity exposure in `ws` and `brace-expansion` plus a moderate `protobufjs` advisory. The architecture technology review records the affected dependency paths and minimum remediation targets. This BMAD setup does not silently bundle dependency migration into a documentation change; it promotes the remediation to an explicit prerequisite story with acceptance evidence.

## Product decisions remain visible instead of being guessed during implementation

The planning set deliberately leaves these decisions open:

- Gemini authentication and billing ownership
- Task Spec output schema
- Live raw-versus-rewritten comparison pattern
- Note-store retention, scope, location, encryption, deletion, and recovery policy
- Baseline-derived latency and quality thresholds
- Minimum supported VS Code host and its corresponding type/runtime matrix
- Whether the ElevenLabs key moves from ordinary settings to VS Code SecretStorage

Open decisions do not invalidate unrelated prerequisite work. They block only the stories named in sprint status or the relevant artifact, keeping the executable path explicit.

## Quality gates separate the healthy brownfield suite from future-feature evidence

The existing automated suite is a useful regression baseline and passed all 182 tests during the retrofit. It does not yet prove live provider behavior, microphone and extension-host behavior, performance budgets, or any proposed next-iteration requirement.

The TEA traceability gate is therefore `FAIL`, not because the proposed implementation is known to be defective, but because its requirements have no implementation evidence yet and the production dependency audit currently fails. Story completion must add evidence to the traceability matrix; narrative confidence is not a substitute for a passing gate.

## The repository entry points keep future agents on the same path

- Begin with [the documentation index](index.md) for shipped and proposed artifact links.
- Use [the implementation readiness report](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-03.md) before selecting feature work.
- Use [the sprint status ledger](../_bmad-output/implementation-artifacts/sprint-status.yaml) to select the next eligible story.
- Use [the project context](../_bmad-output/project-context.md) for implementation constraints.
- Use [the traceability matrix](../_bmad-output/test-artifacts/traceability/traceability-matrix.md) to see missing quality evidence and the current release gate.
