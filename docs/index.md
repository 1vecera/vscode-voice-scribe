# The documentation separates shipped behavior from proposed change

This index is the entry point for Voice Scribe's brownfield knowledge base. Files in `docs/` describe the shipped v0.6.1 extension as implemented. Files in `_bmad-output/planning-artifacts/` describe the proposed next iteration and are not product claims.

## The current product is documented from code and repository evidence

- [Project overview](project-overview.md) explains the product boundary, users, capabilities, and constraints.
- [Architecture](architecture.md) describes the runtime shape, state ownership, data flow, and failure handling.
- [Integration architecture](integration-architecture.md) records the contracts with ffmpeg, ElevenLabs, Google Cloud, Claude Code, and VS Code.
- [Component inventory](component-inventory.md) maps source modules to responsibilities and tests.
- [Source tree analysis](source-tree-analysis.md) explains repository organization and high-change areas.
- [Development guide](development-guide.md) records the local workflow, tests, build, and extension-host debugging.
- [Deployment guide](deployment-guide.md) records CI, packaging, credentials, and release constraints.
- [Scan report](project-scan-report.json) provides the machine-readable exhaustive-scan record.

## Existing product-facing documents remain authoritative for usage and release history

- [README](../README.md) is the user-facing setup and usage guide.
- [CHANGELOG](../CHANGELOG.md) is the release history.
- [CLAUDE](../CLAUDE.md) contains repository-specific coding guidance.

## BMAD planning artifacts define the next iteration

- [BMAD operating guide](bmad-operating-guide.md) explains which artifact controls each decision and how work moves from an idea to a reviewed story.
- [Product brief](../_bmad-output/planning-artifacts/briefs/brief-voice-scribe-2026-08-03/brief.md) captures the problem, users, outcomes, and product scope.
- [Product requirements](../_bmad-output/planning-artifacts/prds/prd-voice-scribe-2026-08-03/prd.md) defines functional and non-functional requirements.
- [Experience design](../_bmad-output/planning-artifacts/ux-designs/ux-voice-scribe-2026-08-03/EXPERIENCE.md) defines journeys, states, and interaction rules.
- [Interface design](../_bmad-output/planning-artifacts/ux-designs/ux-voice-scribe-2026-08-03/DESIGN.md) defines the proposed panel and component behavior.
- [Architecture decisions](../_bmad-output/planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/ARCHITECTURE-SPINE.md) defines the target technical shape and binding implementation rules.
- [Architecture consistency review](../_bmad-output/planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/review-adversarial-consistency.md) challenges ownership, ordering, privacy, and failure semantics.
- [Technology reality review](../_bmad-output/planning-artifacts/architecture/architecture-voice-scribe-2026-08-03/review-technology-reality.md) checks the design against current platforms, dependencies, and advisories.
- [Epics and stories](../_bmad-output/planning-artifacts/epics.md) turns the proposed scope into implementation-sized work.
- [Implementation readiness](../_bmad-output/planning-artifacts/implementation-readiness-report-2026-08-03.md) records alignment gaps and the delivery verdict.
- [Project context](../_bmad-output/project-context.md) gives implementation agents the concise rules they must preserve.
- [Sprint status](../_bmad-output/implementation-artifacts/sprint-status.yaml) is the machine-readable delivery ledger.

## TEA artifacts make quality risk explicit

- [Architecture test design](../_bmad-output/test-artifacts/test-design/test-design-architecture.md) defines the testability contracts required by the target architecture.
- [QA test design](../_bmad-output/test-artifacts/test-design/test-design-qa.md) prioritizes future testing by impact and likelihood.
- [Current test review](../_bmad-output/test-artifacts/test-reviews/current-test-review.md) assesses the shipped automated suite.
- [Traceability and quality gate](../_bmad-output/test-artifacts/traceability/traceability-matrix.md) maps requirements to planned verification and gives the readiness decision.
- [Non-functional requirements assessment](../_bmad-output/test-artifacts/traceability/nfr-assessment.md) evaluates security, performance, reliability, and maintainability evidence.
