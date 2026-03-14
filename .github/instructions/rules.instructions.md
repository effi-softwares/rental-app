---
description: This document is the default checklist to review before any prompt response, planning, or implementation work.
applyTo: "**"
---
## Non-Negotiable Rules

1. Always read documentation first before planning or implementation, using the links and LLM references in `stack-preference.instructions.md`.
2. Use `shadcn/ui` for UI components by default. You can use shadcn blocks if needed, but prefer custom touch-friendly patterns over desktop-only ones. Avoid dense, hover-only interactions.
3. Always design and implement touch-friendly, fat-finger-friendly UI.
4. Default to client-side-first UX/data flow for dashboard features.
5. Define APIs and use `TanStack Query` for client data operations and retries.
6. Use server-side rendering/logic only when needed (auth, security, secrets, webhooks, DB writes, privileged operations, SEO-unimportant exceptions).
7. Follow official documentation first, using the links and LLM references in `stack-preference.instructions.md`.
8. Keep project docs in `docs/` aligned with major decisions and implementation changes.
9. All database table IDs must use UUID (never text IDs for primary keys). For Better Auth, enforce `advanced.database.generateId: "uuid"`; for Drizzle tables, use UUID columns and UUID foreign keys consistently.
10. Apply clean code principles: Single Responsibility Principle (SRP), clear module boundaries, minimal duplication, and explicit naming.
11. Manage session/org/permission state through a single server-authoritative viewer context flow (no client-only auth truth).
12. Use TanStack Form for new complex forms; keep existing local-state forms unless a refactor is explicitly requested.

## UI Rules (Touch-First)

- Tablet first, mobile second, laptop third, large display last.
- Large tap targets and spacing (fat-finger safe).
- Prefer tap-friendly controls over small text inputs/selects.
- Minimize text entry where possible.
- Prefer patterns like:
  - bottom sheets
  - segmented controls
  - chips / pills
  - wheel pickers
  - card-based selection
  - action drawers
- Avoid dense desktop-only interactions (tiny icons, cramped rows, hover-only actions).

## Frontend Data Rules (Dashboard First)

- Build interactive dashboard flows client-side first.
- Expose app data via API routes/server handlers.
- Use `TanStack Query` for:
  - fetching
  - caching
  - retries
  - invalidation
  - mutation status handling
- Keep server functions/routes focused on:
  - authentication/authorization
  - database access
  - payment/webhook processing
  - file upload signing / storage operations
  - validation and business rules that must be enforced server-side

## Global User State Rules (Production Baseline)

- Create/maintain a canonical auth-context endpoint for dashboard clients (session + user + active org + permissions + org capabilities).
- Use TanStack Query as the only client cache for this context and related org-scoped state.
- Scope query keys by organization (`["auth-context"]`, `["permissions", orgId]`, `["org", orgId]`).
- On auth/org mutations (sign-in, sign-out, org switch, invitation acceptance), invalidate auth-context and related org keys.
- Keep authorization enforcement server-side (`getContext` + `viewerHasPermission`); client-side checks are UX-only.
- API error payload shape for this flow should remain `{ error: string }`.

## Documentation Rules

- Before planning/implementation, check:
  - `rules.instructions.md`
  - `design-principles.instructions.md`
  - `folder-architecture-guide.instructions.md`
  - `stack-preference.instructions.md`
- Prefer official docs and LLM references listed in `stack-preference.instructions.md`.
- If a new library/integration is introduced, add it to `stack-preference.instructions.md`.
- If a design/architecture decision changes, update the relevant file in `docs/`.

## Default Implementation Checklist (Pre-Work)

1. Confirm feature scope and affected org/RBAC rules.
2. Review this file (`rules.instructions.md`).
3. Review generic UI/UX guidance from `design-principles.instructions.md`.
4. Review relevant official docs from `stack-preference.instructions.md`.
5. Review placement guidance from `folder-architecture-guide.instructions.md`.
6. Apply touch-first UI approach (`shadcn/ui` + touch-friendly patterns).
7. Design client-side-first flow and `TanStack Query` data layer.
8. Add server endpoints/functions only where required.
9. Update docs if the change introduces a new rule/decision/dependency.
10. Confirm global user-state behavior for the change (session, active org, permissions, invalidation impact).

