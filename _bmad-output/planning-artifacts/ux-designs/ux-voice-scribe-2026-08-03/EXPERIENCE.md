---
name: Voice Scribe next iteration
status: draft
created: 2026-08-03
updated: 2026-08-03
sources:
  - ../../../prds/prd-voice-scribe-2026-08-03/prd.md
  - DESIGN.md
  - imports/panel-reference.md
---

# Voice Scribe should keep capture immediate while making every transformation legible

## The experience remains a keyboard-first VS Code desktop workflow

Voice Scribe is a VS Code extension for one local operator. It inherits the host's command palette, keyboard access, focus model, theme, notifications, and editor or terminal destinations. [DESIGN.md](DESIGN.md) owns visual identity; this document owns surfaces, behavior, states, and interaction contracts.

The supplied panel is a directional reference. The experience requires a persistent control-and-preview surface, but the final choice among a native view, webview view, or another VS Code-supported container remains an architecture and prototype decision.

## The information architecture keeps live work separate from retained work

| Surface | Reached from | Purpose | Leaves the user with |
|---|---|---|---|
| Live session | Status bar, command, or Voice Scribe view | Select Mode Profile, privacy, providers, start capture, inspect Raw Text and Cleanup Revisions | Published output and an ended or active Transcript Session |
| Session history | Voice Scribe view navigation | Find locally retained Notes, Meetings, and Task Specs | A selected stored session or an empty-history explanation |
| Session detail | History row | Review provenance, compare or copy representations, delete the session | A retained or deleted session |
| Settings | Gear or VS Code Settings | Configure speech, cleanup, Voice Profile, storage, shortcuts, and diagnostics | Validated configuration and capability status |
| Editor or terminal | Existing VS Code destination | Receive the selected published representation | Editable text in the working destination |

The Live session surface is the operational center. History is absent as a write destination while Incognito is active. Settings may explain missing configuration but must return focus to the initiating control after the issue is resolved.

## Microcopy states the capability and the consequence

| Prefer | Avoid |
|---|---|
| “Cleanup unavailable. Raw dictation will continue.” | “AI error.” |
| “Incognito: this session will not be saved by Voice Scribe.” | “Private mode.” |
| “Rewrite failed. Raw text kept.” | “Something went wrong.” |
| “Waiting for an earlier segment.” | “Processing…” when the result already exists |
| “Task Spec needs a goal. Add it or keep the draft with an open question.” | Fabricating a goal from nearby text |

Provider retention language must distinguish extension-owned persistence from external processing. Avoid “never stored” unless the claim names exactly which boundary and has evidence.

## Components reuse the same behavior across every Mode Profile

| Component | Behavioral contract |
|---|---|
| Mode selector | Single selection before recording; change during recording requires an explicit session boundary rather than silently changing prompt and persistence policy midstream |
| Recording control | Supports idle, starting, recording, stopping, and error; repeated activation is idempotent; stopping remains available while cleanup drains |
| Incognito control | Set before recording; visible and locked for the active session; explanation names extension-owned persistence only |
| Transcript segment | Owns stable identity, Raw Text, cleanup state, selected representation, compare, retry, and revert; does not remount or jump position on revision |
| Cleanup queue indicator | Shows pending work without becoming the main status; distinguishes active cleanup from results waiting at the Ordered Publication Barrier |
| Provider warning | Names speech or cleanup capability separately and offers the shortest recovery action |
| Session history row | Opens detail, supports keyboard deletion through a confirmable action, and labels partial or failed sessions |
| Task Spec preview | Shows structured sections, unresolved questions, source traceability, copy or insert actions, and no run button |

## Segment states always preserve a readable representation

| State | Trigger | Visible representation | Available action | Exit |
|---|---|---|---|---|
| Raw | Stable recognition arrives with cleanup skipped or not yet queued | Raw Text | Copy, inspect | Cleanup queued, session publishes raw, or session ends |
| Rewriting | Cleanup Provider accepts work | Raw Text plus rewriting label | Cancel session; continue speaking | Ready, failed, cancelled, or timeout |
| Waiting to publish | Revision completed before an earlier segment | Raw Text plus ordered-wait label | Inspect raw | Earlier segment reaches terminal state |
| Ready | Revision crosses the Ordered Publication Barrier | Cleanup Revision with raw comparison available | Compare, revert, copy | User reverts or session ends |
| Failed | Provider returns typed failure or timeout | Raw Text plus failure label | Retry when allowed | Retry enters rewriting or raw remains final |
| Cancelled | Session stop cancels queued work | Raw Text | None beyond normal editing | Session ends |

The editor and panel observe the same published representation. A panel may show more provenance than the editor, but it cannot claim Ready while the editor still shows an unrelated state.

## Session states make lifecycle transitions explicit

Starting disables conflicting configuration changes but keeps cancellation available. Recording accepts audio and segment events. Stopping ends capture before draining recognition and cleanup within bounded windows. Ended sessions either persist through the Note Store or disappear from extension-owned durable state under Incognito. A fatal speech-provider error ends capture; a cleanup-provider error does not.

Late callbacks from an ended session produce no visual mutation. If the extension host reloads during a non-incognito session, recovery behavior depends on the chosen storage checkpoint policy and remains an open design decision. Incognito sessions never recover from durable state.

## Interaction primitives remain complete without a pointer

- Every action is reachable through VS Code commands or standard focus navigation.
- Start and stop preserve the existing configurable shortcut and command-palette paths.
- Mode Profile selection uses arrow-key single selection and announces the selected label.
- Segment actions appear in focus order after the segment content and never require hover.
- Escape closes transient menus but never silently discards a recording or stored note.
- Delete requires a clear confirmation naming the local session; Incognito needs no delete action because nothing was persisted.
- Focus returns to the initiating control after settings, retry, compare, or confirmation closes.

## Accessibility starts with host semantics and adds state announcements

- Use VS Code-native controls where possible and preserve the active high-contrast theme.
- Recording, Incognito, mode, and cleanup states expose text labels and programmatic state, not color alone.
- Announce stable segment arrival without reading every interim token; announce cleanup failure and session-ending errors with polite live-region behavior.
- Do not move keyboard focus when a Cleanup Revision becomes ready.
- Compare view has explicit Raw Text and Cleanup Revision headings and a deterministic reading order.
- Motion is unnecessary for understanding and must respect reduced-motion preferences if used as subtle progress feedback.
- Truncation never hides Mode Profile, privacy, provider, or error meaning.

## `UJ-LIVE-CLEANUP` lands when Daniel keeps speaking and still trusts the text

Daniel opens Live session in a prose file, confirms Dictate and non-incognito state, then starts recording from the keyboard. Raw partial text appears with the existing immediacy. Stable segments remain readable while cleanup begins. A later segment finishes cleanup early and visibly waits rather than jumping ahead. The earlier segment resolves, both revisions publish in capture order, and the editor updates without moving Daniel's focus. The climax is continued speech without manual pause and with a visible path to each Raw Text source. If cleanup times out, the affected segment shows “Rewrite failed. Raw text kept.” while recording continues.

## `UJ-TASK-SPEC` lands in a review surface rather than autonomous action

Daniel selects Task Spec before capture and speaks the goal, constraints, acceptance signals, and doubts in any order. Segments progress through the same live states. On stop, the Task Spec preview groups only supported content, preserves unresolved questions, and links each derived section to source segments. The climax is a brief Daniel can review, edit, copy, or insert without wondering what the model invented. Missing goal information appears as an explicit open question.

## `UJ-NOTE-RECOVERY` lands only when persistence was intentional

Daniel records in Notes mode with Incognito visibly off. After the session ends, History shows a locally retained row with mode, time, and terminal status. Session detail exposes Raw Text and Cleanup Revisions separately and offers deletion. The climax is recovering a useful note without searching editor history. In the privacy branch, Daniel enables Incognito before recording; History receives no row, settings cannot change that policy mid-session, and the ended session leaves no extension-owned durable artifact.

## Prototype decisions remain open where layout changes behavior

- Compare a side-by-side raw and cleaned layout with an inline evolving segment at narrow and wide VS Code view widths.
- Confirm the VS Code surface technology that can satisfy accessible live updates and stable editor integration.
- Decide whether history is global, workspace-scoped, or selectable.
- Define restart recovery for non-incognito sessions and the status shown for incomplete cleanup.
- Confirm which Task Spec sections are required before the preview can be considered complete.
