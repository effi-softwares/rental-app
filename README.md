# Rental App (Vehicle Rental Ops SaaS)

Internal-only multi-tenant dashboard for vehicle rental operators.

## Stack

- Next.js App Router (monolith)
- Drizzle ORM + Neon Postgres
- shadcn/ui
- Better Auth (email/password + organization + admin plugins)

## Getting Started

1) Install dependencies

```bash
pnpm install
```

2) Create env file

```bash
cp .env.example .env.local
```

3) Set required environment values:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET` (must be a real random secret, not a placeholder)
- `NEXT_PUBLIC_PLATFORM_SIGNUP_ENABLED` (`true` to enable self-service owner sign-up and multi-organization switching; omit or set to `false` to hide them)
- `RESEND_API_KEY` (required for invitation emails)
- `RESEND_FROM_EMAIL` (sender address for invitation emails)

4) Generate Better Auth schema and run migrations

```bash
pnpm auth:generate
pnpm db:generate
pnpm db:migrate
```

5) Start development server

```bash
pnpm dev
```

Open http://localhost:4500

## Database Commands

- `pnpm auth:generate` - generate Better Auth Drizzle schema from `lib/auth.ts`
- `pnpm db:generate` - generate SQL migrations from Drizzle schema
- `pnpm db:migrate` - apply generated migrations
- `pnpm db:studio` - open Drizzle Studio

## UUID ID Policy

- Better Auth ID strategy is controlled in `lib/auth.ts` via `advanced.database.generateId: "uuid"`.
- `drizzle.config.ts` does not provide a global primary-key ID strategy setting.
- Keep this generation order to avoid drift:
	1. `pnpm auth:generate`
	2. `pnpm db:generate`
	3. `pnpm db:migrate`

## Current Phase

- Foundations and auth baseline are implemented (Drizzle/Neon + Better Auth + onboarding + dashboard shell).
- Dashboard modules currently implemented: employees, branches, customers, gallery, organization settings/visibility, and profile security.
- Canonical client data layer is TanStack Query with key-factory and invalidation conventions.
- Organization hidden-state handling and role/permission gating are active across app shell and API layers.

## Next Phases Roadmap

- Detailed execution checklist: `docs/phases-8-12-detailed-todo.md`

- [x] Phase 5: role policies and permission-gated feature modules
- [x] Phase 6: branch/location management and location-scoped access control
- [x] Phase 7: customer management (profiles, verification metadata, notes)
- [ ] Phase 8: vehicle/fleet management (categories, availability, maintenance states)
- [ ] Phase 9: bookings & rental lifecycle (create, check-out, check-in, extensions)
- [ ] Phase 10: payments, invoices, deposits, and refund handling
- [ ] Phase 11: reporting dashboard (utilization, revenue, overdue returns)
- [ ] Phase 12: audit logs, security hardening, and production readiness

## Implemented Routes

- `/sign-up` - owner account creation
- `/sign-in` - owner sign in
- `/onboarding` - first organization setup
- `/setup-password` - first-login password setup for temporary-password accounts
- `/two-factor` - 2FA challenge flow during sign-in
- `/app` - protected app shell with active organization switcher
- `/app/profile` - user profile and account security controls
- `/app/settings` - organization settings, visibility, and danger-zone actions
- `/app/gallery` - organization gallery media management
- `/app/branches` - branch setup and location-scoped member access controls
- `/app/customers` - customer profiles, verification metadata, and internal notes
- `/app/employees` - member list, invitation list, and employee invite actions
- `/organization-hidden` - hidden-organization fallback guidance screen
- `/accept-invitation/[invitationId]` - invitation acceptance and first-password setup flow



stripe listen \
  --events payment_intent.processing,payment_intent.requires_action,payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,setup_intent.requires_action,setup_intent.succeeded,setup_intent.setup_failed,setup_intent.canceled,invoice.created,invoice.finalized,invoice.finalization_failed,invoice.paid,invoice.payment_action_required,invoice.payment_failed,invoice.marked_uncollectible,invoice.voided,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed,charge.refunded,charge.dispute.created,charge.dispute.updated,charge.dispute.closed \
  --forward-to localhost:4500/api/stripe/webhook


  stripe listen \
  --events terminal.reader.action_succeeded,terminal.reader.action_failed \
  --forward-to localhost:4500/api/stripe/webhook/terminal
