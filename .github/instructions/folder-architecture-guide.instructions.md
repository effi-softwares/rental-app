---
description: This guide explains a scalable folder architecture for a Next.js App Router codebase using a feature-first domain layer. It describes **where files should go** and **why**, without relying on any specific business logic.
applyTo: "**"
---

## Current Repo Mapping (Important)

- This guide uses `src/*` as the target architecture language.
- In this repository, equivalent folders are currently top-level (`app/`, `components/`, `lib/`, `docs/`, `drizzle/`).
- Apply these placement rules by scope first; folder names can be migrated to `src/*` incrementally.

## Core Principles

- Keep route concerns in `src/app`.
- Keep business/domain concerns in `src/features`.
- Keep cross-feature/shared UI in `src/components`.
- Keep cross-cutting utilities and platform code in `src/lib`.
- Keep contracts and validation centralized (`src/types`, `src/zod`, and feature-local schemas).
- Prefer co-location for files used only by one route/segment (`_components`, `_actions`).

---

## High-Level `src/` Structure

- `app/` — Routing, layouts, pages, route handlers.
- `features/` — Domain modules (queries, mutations, schemas, types, optional UI).
- `components/` — Reusable shared UI building blocks.
- `config/` — Application-level configuration and constants.
- `providers/` — React context/providers wired at app/layout boundaries.
- `lib/` — Shared utilities, adapters, helpers, and integrations.
- `types/` — Shared TypeScript contracts used across modules.
- `zod/` — Shared Zod schemas/validators not owned by a single feature.
- `db/` — Database connection, schema definitions, migrations.

---

## `src/app` (App Router Layer)

Use this folder for URL-driven concerns and composition of feature modules.

### What belongs here

- Route segments and groups (folders that map to URLs or route groups).
- Route files such as:
  - `page.tsx` (page entry)
  - `layout.tsx` (segment layout)
  - `loading.tsx` / `error.tsx` / `not-found.tsx` (segment states)
  - `route.ts` (HTTP handlers)
- Top-level app wrappers (global layout composition and provider mounting).
- Thin route-level orchestration that calls into `features/*`.

### What should NOT live here

- Heavy business logic.
- Reusable domain data hooks and mutations.
- Cross-route reusable utilities.

### Route-local private folders

#### `_components/`
Use for components that are private to one route segment.

Typical files:
- Page-specific table/list/panel components.
- Route-only dialogs and forms.
- Segment-specific view helpers.

Rule of thumb:
- If a component is reused in multiple routes, promote it to `src/components` or a feature module.

#### `_actions/`
Use for route-local server actions that are tightly coupled to one page/segment.

Typical files:
- Server actions for submit/update/delete operations used by one route.
- Action wrappers that perform route-specific redirects/revalidation.

Rule of thumb:
- If an action becomes domain-reusable, move it to the feature module (e.g., mutation layer) and keep route action wrappers minimal.

---

## `src/features` (Domain/Feature Layer)

Each subfolder represents one domain area. This is the main home for business logic and server-state access.

### Recommended feature module shape

Inside each feature folder, use only the parts you need:

- `queries/` — Data-fetching hooks and read-side API access.
- `mutations/` — Write operations and state-changing commands.
- `schemas/` — Feature-owned Zod schemas (form/input/API payload validation).
- `types/` — Feature-owned TypeScript types/interfaces.
- `components/` — Feature-specific reusable UI (used across multiple routes).
- `actions/` (optional) — Feature-level server actions when needed.
- `index.ts` (optional) — Public exports for a clean import surface.

### Feature boundaries

- Features should expose clear APIs (exports) and avoid leaking internal files.
- Cross-feature imports should use public exports where possible.
- Keep feature logic cohesive: avoid mixing unrelated domains in one feature folder.

### Global user-state placement (session/org/permissions)

Use a dedicated feature module for viewer context (for example `features/main` or `features/auth-context`) with:

- `queries/` — auth-context query hook(s), permission query helpers, org-scoped key factories.
- `mutations/` — active-organization switch, sign-out/session-reset hooks with cache invalidation.
- `types/` — viewer-context contracts used by UI and feature hooks.

Keep responsibilities split by layer:

- `app/api/*` — server-authoritative context payload assembly and permission checks.
- `features/*` — client cache orchestration via TanStack Query.
- `app/**/_components` — route-local consumption only (no duplicated auth-context fetching logic).

---

## `src/components` (Shared UI Layer)

Use for UI reused across multiple features/routes.

What belongs here:
- Primitive UI wrappers and common controls.
- Layout shell components (navigation/header scaffolding).
- Shared form controls and generic dialog/drawer wrappers.
- Design-system-level utilities.

What does not belong here:
- Domain-specific behavior tightly tied to one feature.

---

## `src/config` (Configuration)

Use for stable app-wide configuration and route/path constants.

Typical files:
- App metadata/config objects.
- Navigation/route constants.
- Feature flags and environment-backed config mapping.

Guidelines:
- Keep config declarative.
- Avoid runtime side effects in config files.

---

## `src/providers` (React Providers)

Use for app-wide context/provider setup and composition.

Typical files:
- Query client provider.
- Auth/session provider.
- UI/global state providers.
- Provider composition wrappers used in layout entry points.

Guidelines:
- Providers should focus on wiring, not feature business logic.

---

## `src/lib` (Shared Logic & Integrations)

Use for cross-cutting utilities and integration helpers.

Typical files/folders:
- `utils` helpers.
- Integration clients (e.g., payment, storage, auth, telemetry).
- Mappers/transformers between API, DB, and UI contracts.
- Utility hooks that are not feature-owned.

Guidelines:
- Keep `lib` generic and reusable.
- If logic is domain-specific, prefer `features/<domain>`.

---

## `src/types` (Shared Type Contracts)

Use for globally shared TypeScript contracts.

Typical files:
- API request/response interfaces.
- Auth/session/user contracts.
- Cross-feature form and navigation types.
- Ambient type declarations (`*.d.ts`).

Guidelines:
- Keep types framework-agnostic when possible.
- If a type is only used by one feature, keep it in that feature’s `types/`.

---

## `src/zod` (Shared Validation Schemas)

Use for shared Zod schemas reused across multiple features/routes.

Typical files:
- Common form validators.
- Shared auth/input validation schemas.
- Reusable parsing/normalization schemas.

Guidelines:
- Feature-specific schemas should stay in `features/<domain>/schemas`.
- Promote to `src/zod` only when reused broadly.

---

## Practical Placement Rules

When adding a new file, choose location by scope:

- **Only one route needs it** → `app/.../_components` or `app/.../_actions`.
- **One domain/feature owns it** → `features/<domain>/*`.
- **Multiple domains/routes reuse it** → `components`, `lib`, `types`, or `zod`.
- **It defines app-level behavior/config** → `config` or `providers`.

This keeps routing simple, features cohesive, and shared layers clean.
