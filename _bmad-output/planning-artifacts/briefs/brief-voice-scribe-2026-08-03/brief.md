---
title: Voice Scribe next iteration
status: draft
created: 2026-08-03
updated: 2026-08-03
sources:
  - docs/project-overview.md
  - docs/architecture.md
  - backlog.md
  - supplied panel screenshot
---

# Voice Scribe should turn raw dictation into trustworthy working material

Voice Scribe already removes the mechanical gap between speaking and placing text in VS Code. The next iteration should remove the cognitive cleanup gap without hiding what the user actually said. One transcript session should capture speech, expose a live raw record, produce a voice-aware rewrite, and optionally retain a useful note or task brief.

The product remains a personal, keyboard-centric tool rather than a general meeting platform. Its advantage is the combination of immediate editor insertion, visible provenance, Daniel-specific writing cleanup, and mode-shaped outputs inside an environment where technical work already happens.

## Raw dictation is fast but leaves a second job behind

Current transcription is usable in real time, yet the author still has to remove spoken structure, repair phrasing, and reshape material for its destination. Claude paragraph polishing helps after insertion, but it is coupled to one executable, operates after the main transcript path, and does not expose raw and rewritten states together. Notes disappear when the session ends, while a durable history would conflict with privacy unless persistence is explicit and bypassable.

Adding each requested capability directly to the existing coordinator would solve the visible requests while making the underlying product harder to extend. The actual product problem is therefore both experiential and structural: cleanup must feel immediate and trustworthy, and the session pipeline must support new models, modes, stores, and destinations without multiplying special cases.

## One transcript session should carry provenance through every derived output

The proposed experience keeps raw speech readable while stable segments are rewritten in the background. Cleanup jobs may run concurrently within a bounded limit, but rewritten segments appear in capture order. A failed or slow rewrite never blocks the raw transcript. Each segment visibly moves through raw, rewriting, ready, or failed state so the user can understand whether displayed text is source material or a derived revision.

Modes such as Dictate, Command, Notes, Meeting, and Task Spec become profiles over the same session rather than independent implementations. A profile selects prompting, presentation, persistence policy, and output destination. The initial cleanup adapter targets Gemini 3.6 Flash, while the contract remains provider-neutral and can later host local or alternative cloud models.

## The next iteration serves one primary operator and one working context

Daniel is the primary operator: a technical author who dictates implementation notes, prose, commands, meeting thoughts, and task definitions while working in VS Code. Success means he trusts the live output enough to keep speaking, spends materially less time repairing dictated text, and can recover useful non-incognito notes without searching through editor history.

The initial delivery surface remains VS Code on desktop. Broader users, standalone applications, team collaboration, and shared note libraries are deferred until the personal workflow demonstrates repeated value.

## Trust comes from visibility, graceful fallback, and honest privacy

- Raw speech remains available even when cleanup fails, times out, or is cancelled.
- Rewritten text never silently overwrites provenance in persistent storage.
- Incognito disables every extension-owned durable write before recording begins and remains visibly active throughout the session.
- Privacy language distinguishes local persistence from processing or retention by an explicitly selected cloud provider.
- A cleanup-provider outage degrades to current dictation behavior rather than disabling capture.

## The delivery slice focuses on the reusable pipeline and its visible proof

The delivery scope includes a transcript-session model, a provider-neutral cleanup port, bounded concurrent rewriting with ordered publication, live raw and cleaned preview states, a Daniel voice profile, Task Spec as a mode profile, an optional local note store, Incognito enforcement, and VS Code as the initial output sink.

The delivery scope excludes a standalone application, team accounts, cloud note sync, collaborative editing, a general model marketplace, audio-file retention, autonomous execution of generated task specifications, and claims of provider-side zero retention.

## Success must be measured from an observed baseline rather than invented targets

The implementation should establish local, content-free diagnostics for stable-segment cleanup latency, fallback frequency, queue depth, and ordering violations. A manual evaluation set should compare raw and cleaned output for meaning preservation, Daniel voice fit, and correction effort. Product success is repeated weekly use of cleanup and notes without increased transcript loss or privacy surprises. Numeric targets remain a product decision after baseline observation.

## The scalable direction is a small pipeline rather than a larger coordinator

If this iteration works, Voice Scribe becomes a reusable capture-to-output system: speech providers supply source segments; cleanup providers derive revisions; profiles select behavior; projections show state; stores retain permitted sessions; output sinks publish the selected representation. VS Code remains one adapter, which leaves a credible path to a standalone desktop surface without forcing that expansion now.

## Product decisions still needing Daniel's confirmation remain visible

- Choose the cleanup credential and billing path for Gemini.
- Define the Task Spec output contract and whether it is Markdown only or also structured data.
- Set note-retention defaults, deletion controls, storage location, and any encryption requirement.
- Choose whether live raw and rewritten content appear side by side or as one inline evolving surface.
- Establish baseline-derived latency and quality thresholds before implementation readiness can become unconditional.
