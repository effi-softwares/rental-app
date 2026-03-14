# Copilot Instructions for rental-app

## Instruction Sources (use these first)
- Read these before planning or coding:
  - `.github/instructions/rules.instructions.md`
  - `.github/instructions/design-principles.instructions.md`
  - `.github/instructions/folder-architecture-guide.instructions.md`
  - `.github/instructions/stack-preference.instructions.md`
- Apply `src/*` architecture guidance to this repo’s current top-level layout (`app/`, `components/`, `features/`, `lib/`, `types/`, `zod/`).

## Big Picture
- Next.js App Router monolith for a multi-tenant internal dashboard.
- Routes and handlers live in `app/`; reusable domain logic belongs in `features/` and cross-cutting utilities in `lib/`.
- Dashboard UX is client-side first with TanStack Query hitting `app/api/*` route handlers.
- Server-side code handles auth/session, RBAC, DB access, and integration boundaries (email/storage).

## Core Architecture Patterns
- Better Auth setup is in `lib/auth.ts` and exposed by `app/api/auth/[...all]/route.ts`.
- Protected API route pattern:
  1. `const viewer = await getContext()`
  2. return `401` if missing viewer/org
  3. `await viewerHasPermission(viewer, "...")`
  4. return `403` if denied
  5. execute DB logic (example: `app/api/customers/route.ts`).
- API error payloads use `{ error: string }` (avoid custom shapes unless required).
- Permission gating is done both server-side (`app/app/layout.tsx`) and client-side (`app/app/(main)/_components/dashboard-shell.tsx`).
- Always use `config/routes.ts` route constants instead of hard-coded paths.

## Global User State Pattern (Required)
- Maintain one canonical viewer/auth-context flow for dashboard clients (session + user + active org + permissions).
- Keep server as source of truth in API/context builders; client cache is TanStack Query only.
- Preferred query-key shape: `['auth-context']`, `['permissions', orgId]`, `['org', orgId]`.
- Invalidate auth-context + org-scoped keys after sign-in, sign-out, org switch, invitation acceptance, or role changes.
- Keep authorization checks server-side (`getContext` + `viewerHasPermission`); client checks are UX-only.

## Data + DB Conventions
- Drizzle Neon HTTP client in `lib/db/index.ts`; schemas in `lib/db/schema/*`.
- UUID-only IDs are mandatory for PKs/FKs (`uuid(...).defaultRandom().primaryKey()`).
- Better Auth schema UUID patch/verify scripts are part of normal workflow:
  - `scripts/patch-auth-schema-uuid.mjs`
  - `scripts/verify-auth-schema-uuid.mjs`
- Migration order is strict: `pnpm auth:generate` -> `pnpm db:generate` -> `pnpm db:migrate`.

## Frontend Conventions
- Use `components/ui/*` (shadcn-based) primitives and keep controls touch-friendly (larger tap targets, avoid dense hover-only UI).
- Use TanStack Query defaults from `providers/query-provider.tsx` (`retry: 2`, `staleTime: 30s`, no window focus refetch).
- Prefer feature hooks in `features/*/{queries,mutations}` for reusable server-state logic.
- Use TanStack Form for new complex forms; keep existing local-state/`FormData` forms unless explicitly refactoring.

## Integrations
- Resend email adapters live in `lib/email/resend`.
- Storage uses adapter abstraction in `lib/storage/index.ts`; active implementation is Vercel Blob.
- Media upload uses token + completion/finalize flow (`app/api/media/upload/route.ts`, `app/api/media/finalize/route.ts`).
- `next.config.ts` remote image host relies on `NEXT_PUBLIC_BLOB_HOSTNAME`.

## Developer Workflow
- `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm start`
- `pnpm lint`, `pnpm lint:fix` (Biome: tabs, double quotes, no semicolons)
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`

## Fit Check for Imported Instructions
- Good fit now: client-side-first dashboard flow, TanStack Query usage, shadcn touch-first UI, generic design-principles guidance, UUID DB policy, feature-first placement rules.
- Needs repo-aware interpretation: `src/*` examples map to this repo’s top-level folders.
- Roadmap-only today: Stripe/payment guidance in stack preferences is mostly future phase work (see `docs/phases-8-12-detailed-todo.md`).
