---
description: quick links for the stack we are building in this Next.js monolith.
applyTo: "**"
---

### LLM / Docs Index Files

- Next.js (general): https://nextjs.org/docs/llms-full.txt
- Better Auth (general): https://www.better-auth.com/llms.txt
- Drizzle ORM (full docs index): https://orm.drizzle.team/llms-full.txt
- shadcn/ui (general): https://ui.shadcn.com/llms.txt
- Vercel docs (full LLM index): https://vercel.com/docs/llms-full.txt
- Neon docs (LLM index): https://neon.com/llms.txt
- Stripe docs (LLM index): https://docs.stripe.com/llms.txt
- Resend (email): https://resend.com/docs/llms-full.txt
- TanStack Form docs: https://tanstack.com/form/latest
- TanStack Query docs: https://tanstack.com/query/latest
- TanStack Table: https://tanstack.com/table/latest
- TanStack devtools: https://tanstack.com/devtools/latest

### TanStack libraries

- TanStack Query retries (client/server behavior): https://tanstack.com/query/latest/docs/framework/react/guides/query-retries
- TanStack Query query keys: https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
- TanStack Query invalidation from mutations: https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations
- TanStack Query dependent queries (`enabled`): https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries
- TanStack Table docs: https://tanstack.com/table/docs
- TanStack React Table adapter docs: https://tanstack.com/table/latest/docs/framework/react/react-table

### Forms (Decision: TanStack Form)
- TanStack Form docs home: https://tanstack.com/form/latest
- TanStack Form React guide: https://tanstack.com/form/latest/docs/framework/react/quick-start
- TanStack Form validation guide: https://tanstack.com/form/latest/docs/framework/react/guides/validation
- Zod for form validation: https://zod.dev/

### Better Auth (Authentication)

- Better Auth installation: https://www.better-auth.com/docs/installation
- Better Auth Next.js integration: https://www.better-auth.com/docs/integrations/next
- Better Auth Drizzle adapter: https://www.better-auth.com/docs/adapters/drizzle
- Better Auth passkey plugin: https://www.better-auth.com/docs/plugins/passkey
- Better Auth 2FA plugin: https://www.better-auth.com/docs/plugins/2fa

### Drizzle ORM (Database / ORM)

- Drizzle docs home: https://orm.drizzle.team/
- Drizzle get started: https://orm.drizzle.team/docs/get-started
- Drizzle docs (LLM full index): https://orm.drizzle.team/llms-full.txt

### shadcn/ui (UI Components)

- shadcn/ui docs home: https://ui.shadcn.com/
- shadcn/ui docs LLM index: https://ui.shadcn.com/llms.txt

### Extra UI / UX Libraries (Optional)

- `react-easy-crop` docs: https://github.com/ValentinH/react-easy-crop
- `react-easy-crop` package: https://www.npmjs.com/package/react-easy-crop
- `boring-avatars` package: https://www.npmjs.com/package/boring-avatars
- `avvvatars-react` package: https://www.npmjs.com/package/avvvatars-react

- React Wheel Picker docs (canonical): https://react-wheel-picker.js.org/docs/getting-started
- React Wheel Picker docs (provided URL / MDX page): https://react-wheel-picker.chanhdai.com/docs/getting-started.mdx
- React Wheel Picker component examples (chanhdai site): https://chanhdai.com/components/react-wheel-picker
- React Wheel Picker package: https://www.npmjs.com/package/@ncdai/react-wheel-picker
- React Wheel Picker LLM docs: not identified yet (no official `llms.txt` link recorded)

- `qrcode` package (TOTP setup QR rendering): https://www.npmjs.com/package/qrcode

- mapcn docs home / introduction: https://mapcn.vercel.app/docs
- mapcn installation docs: https://mapcn.vercel.app/docs/installation
- mapcn API reference: https://mapcn.vercel.app/docs/api-reference
- mapcn maps catalog root (shadcn registry style): https://mapcn.vercel.app/
- mapcn LLM docs: not identified yet (no official `llms.txt` link recorded)

### Vercel (Deployment / Hosting / Storage)

- Vercel docs home: https://vercel.com/docs
- Vercel docs LLM full index: https://vercel.com/docs/llms-full.txt
- Vercel deployment docs: https://vercel.com/docs/deployments
- Vercel environment variables docs: https://vercel.com/docs/environment-variables
- Vercel Blob docs: https://vercel.com/docs/vercel-blob
- Vercel Blob SDK package (npm): https://www.npmjs.com/package/@vercel/blob

### Neon (Database Hosting - Postgres)

- Neon home: https://neon.com/
- Neon docs home: https://neon.com/docs
- Neon docs LLM index: https://neon.com/llms.txt
- Neon + Vercel integration docs (useful for deploy setup): https://neon.com/docs/guides/vercel
- Neon connection strings / connect docs: https://neon.com/docs/connect/connect-from-any-app

### Stripe (Payments / Billing / In-person POS)

- Stripe docs home: https://docs.stripe.com/
- Stripe docs LLM index: https://docs.stripe.com/llms.txt
- Stripe Node SDK (npm): https://www.npmjs.com/package/stripe

- Stripe subscriptions overview (recurring billing lifecycle): https://docs.stripe.com/billing/subscriptions/overview
- Stripe subscriptions with Checkout Sessions (quick path): https://docs.stripe.com/payments/subscriptions
- Stripe Payment Intents guide (one-time / custom flows): https://docs.stripe.com/payments/payment-intents
- Stripe Setup Intents guide (save payment methods for future use): https://docs.stripe.com/payments/setup-intents

- Stripe Terminal overview (in-person/POS payments): https://docs.stripe.com/terminal
- Stripe Terminal reader selection / availability: https://docs.stripe.com/terminal/payments/setup-reader
- Stripe Terminal regional considerations: https://docs.stripe.com/terminal/payments/regional
- Stripe Terminal global availability + supported brands (includes AU/eftpos support details): https://docs.stripe.com/terminal/payments/collect-card-payment/supported-card-brands
- Stripe Terminal save card details from in-person reader for future online charges (SetupIntents / generated_card): https://docs.stripe.com/terminal/features/saving-payment-details/save-directly

- Australia BECS Direct Debit overview: https://docs.stripe.com/payments/au-becs-debit
- Australia BECS Direct Debit: save details for future payments (SetupIntents): https://docs.stripe.com/payments/au-becs-debit/set-up-payment

- Stripe subscriptions webhooks guide (important for recurring billing state sync): https://docs.stripe.com/billing/subscriptions/webhooks
- Stripe Workbench webhooks / event destinations: https://docs.stripe.com/workbench/webhooks

### Notes For This Project

- We are using Next.js as a monolith (frontend + backend in one app).
- Since this is primarily a dashboard product, default to a client-side-first approach for dashboard data flows.
- Use `TanStack Query` as the default client data layer for fetching, caching, retries, and invalidation on dashboard features.
- Use a canonical auth-context query pattern for global user state (session, active org, permissions).
- Use Drizzle only in server-side code.
- Use Better Auth with the Next.js integration https://www.better-auth.com/docs/integrations/next.
- Use TanStack Form for new complex forms with Zod.
- Deploy on Vercel.
- Use Neon Postgres as the primary database.
- Use Vercel Blob for file storage/uploads.
- Use Stripe for payments (one-time and subscription-first recurring billing).
- Use better auth Stripe integration documentation: https://www.better-auth.com/docs/plugins/stripe
- For in-person card collection / POS-style flows, evaluate Stripe Terminal first (readers or Tap to Pay) instead of building a custom card-entry flow.
- If we need to collect a card in person and charge later (rental/security/renewal scenarios), use Stripe Terminal + SetupIntents + saved payment method flow.
- For Australia direct debit, use Stripe Australia BECS Direct Debit (mandate/DDR required; async settlement and webhook handling required).
- Stripe webhooks are required for reliable subscription and async payment state updates (for example BECS Direct Debit and subscription invoice events).
- Keep payment domain logic provider-agnostic in our app (`payment_provider`, `payment_method_type`, `external_payment_id`) so future payment methods can be added without schema rewrites.

### Dependency Maintenance Note

- 2026-03-01 docs alignment pass introduced no new third-party libraries.
- If a new external package is added later, append its official docs and package links to this file in the relevant section.
