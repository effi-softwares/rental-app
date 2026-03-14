---
description: Generic UI/UX design principles and implementation rules for consistent dashboard experiences.
applyTo: "**"
---

## Design Principles (Generic)

### 1) Clarity over decoration
- Prioritize readable structure, explicit labels, and predictable actions.
- Use visual styling to support comprehension, not to add noise.
- Keep interactions obvious and discoverable without relying on hover.

### 2) Touch-first by default
- Design for tablets first, then mobile, then desktop.
- Use large tap targets (`h-12` or larger for primary interactive controls).
- Maintain generous spacing between controls to prevent mis-taps.

### 3) Section-first layout
- Prefer clean sectioned layouts with headings and separators.
- Use two-column patterns where they improve scanability; collapse to one column on smaller screens.
- Avoid dense card-heavy layouts for core management surfaces unless a card is the clearest semantic container.

### 4) Progressive disclosure
- Keep primary screens focused on high-signal information and primary actions.
- Move secondary/advanced edits into drawers or dialogs.
- Default to the simplest interaction path for frequent tasks.

### 5) Consistency across screens
- Keep action placement, labels, and component behavior consistent.
- Reuse shared UI primitives from `components/ui/*`.
- Use consistent status messaging patterns (success, error, loading, empty).

## Interaction Rules

### Confirm risky actions
- Require explicit confirmation for destructive or high-impact mutations.
- Use confirmation dialogs with clear intent language and verb-based action labels.
- Never trigger destructive actions from ambiguous controls.

### Responsive action surfaces
- Prefer responsive drawer/sheet patterns on smaller screens.
- Use dialog-style editing surfaces on larger screens when appropriate.
- Keep forms and action flows thumb-friendly and vertically scannable.

### List and detail ergonomics
- For data management views, prefer list/table-first organization.
- Keep row/record actions clear and prevent accidental action when row navigation is enabled.
- Separate quick actions from navigation affordances with explicit event handling.

## Accessibility & Feedback Rules

### Accessibility baseline
- Ensure keyboard-accessible controls for all interactive elements.
- Do not attach click handlers to non-interactive elements without proper semantics.
- Preserve visible focus states and readable contrast.

### System feedback
- Show inline loading, empty, success, and error states near the relevant context.
- Keep error copy actionable and concise.
- Disable controls during pending mutations where repeat submission is unsafe.

## Implementation Constraints

- Keep UI changes minimal and scoped to user-visible requirements.
- Do not introduce new visual themes, custom colors, or component systems unless explicitly requested.
- Prefer existing utilities, primitives, and architectural patterns in this repository.
