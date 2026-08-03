---
name: Voice Scribe
description: A quiet, trustworthy VS Code-native surface for live speech, visible cleanup, and optional notes.
typography:
  interface:
    note: Inherit the active VS Code workbench font and type scale.
  transcript:
    note: Inherit the active VS Code editor font where transcript content is code-adjacent; otherwise inherit the workbench font.
components:
  recording-control:
    note: Use the native VS Code primary-action treatment and expose recording state without relying on color alone.
  mode-control:
    note: Use a VS Code-native single-selection pattern with text labels and an accessible selected state.
  transcript-segment:
    note: Use typography, iconography, and text labels to distinguish raw, rewriting, ready, and failed states.
  incognito-control:
    note: Keep the privacy state persistently visible before and during recording.
status: draft
created: 2026-08-03
updated: 2026-08-03
sources:
  - ../../../prds/prd-voice-scribe-2026-08-03/prd.md
  - imports/panel-reference.md
---

# Voice Scribe should look native, quiet, and explicit about state

## Brand and style inherit the host rather than compete with it

Voice Scribe is a working tool inside VS Code. It should inherit the active theme, platform typography, focus treatment, density, and control vocabulary. Its visual identity comes from legible transcript provenance and calm state transitions, not from a custom color system or decorative chrome.

The supplied panel reference supports a compact control surface with a clear recording action and profile selection. It does not justify freezing the pale surface, blue accent, rounded container, or exact navigation shown there. Those may conflict with VS Code themes and accessibility settings.

## Colors remain semantic and theme-owned

Use VS Code theme tokens for foreground, background, border, focus, disabled, warning, error, and progress states. Never hardcode the screenshot's colors. Raw, rewriting, ready, and failed must remain distinguishable in high-contrast themes and when color perception is limited, so every state also receives a label, icon, or structural cue.

No accent color may simultaneously mean active recording, cleanup success, and selected navigation. The host's destructive and warning semantics remain reserved for actual destructive or warning states.

## Typography separates controls from authored content

Controls use `{typography.interface}`. Transcript content uses `{typography.transcript}` when it benefits from editor-like alignment; prose-oriented notes may use the interface font if that matches the chosen VS Code surface. Raw and cleaned representations use equal base size and weight so styling does not imply that a model-generated revision is more authoritative than source speech.

## Layout and spacing prioritize the live transcript over configuration

The recording action, active Mode Profile, Incognito state, and provider health remain visible without scrolling. Secondary settings collapse behind the settings entry. Once recording begins, transcript content receives the dominant vertical area while stable controls avoid moving.

The exact raw-versus-clean composition is deliberately open. A side-by-side comparison improves provenance but may fail in a narrow panel; an inline evolving segment protects width but can obscure differences. A runnable prototype must settle this before implementation.

## Elevation and shapes follow VS Code surface conventions

Use the host surface's borders, separators, menus, and focus rings. Do not reproduce the screenshot's floating macOS-style card when the feature is hosted as a VS Code view. If a future standalone adapter is built, it receives a separate platform design spine rather than inheriting accidental webview styling.

## Components make state visible without extra chrome

- **Recording control** — `{components.recording-control}` owns idle, starting, recording, stopping, and error labels. The control does not switch position when state changes.
- **Mode control** — `{components.mode-control}` exposes Dictate, Command, Notes, Meeting, and Task Spec through one selection model. Long labels must not truncate into ambiguity.
- **Transcript segment** — `{components.transcript-segment}` keeps Raw Text readable, attaches cleanup state to the same segment identity, and exposes compare, retry, and revert actions only when relevant.
- **Incognito control** — `{components.incognito-control}` combines label, state, and a concise persistence explanation. It cannot be hidden in settings during an active session.
- **Provider health** — A compact warning names the unavailable capability and its impact. It should say cleanup is unavailable while preserving dictation, not imply the entire product is broken.
- **Note history row** — Shows time, Mode Profile, a safe title or excerpt, and terminal status. It never exposes content in a notification or diagnostic surface.

## Hard visual rules protect trust

| Do | Do not |
|---|---|
| Inherit VS Code theme tokens and focus behavior | Hardcode the screenshot's white, blue, gray, or purple palette |
| Label every asynchronous segment state | Encode state through color or animation alone |
| Keep Raw Text and Cleanup Revision visually equal in authority | Style model output as inherently more correct |
| Keep recording, Mode Profile, and Incognito stable during capture | Reflow controls as transcript segments resolve |
| Show one actionable provider warning near the affected capability | Cover the transcript with modal error dialogs |
| Prototype narrow and wide panel widths before fixing composition | Assume side-by-side text fits every host layout |
