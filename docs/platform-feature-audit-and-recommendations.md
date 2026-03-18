# Rental Platform Feature Audit And Recommendations

## Purpose

This document captures three things:

1. What the current codebase already supports.
2. How major rental and rental-software platforms handle comparable operational requirements.
3. A detailed recommendation backlog for this product.

Review date: 2026-03-18

## Benchmark Sources Reviewed

- Turo host pages:
  - `https://turo.com/us/en/list-your-car`
  - `https://turo.com/us/en/car-rental/united-states/host-tools`
- HQ Rental Software:
  - `https://www.hqrentalsoftware.com/`
- Rent Centric:
  - `https://www.rentcentric.com/products/car-rental-software/`
  - `https://www.rentcentric.com/products/technology-add-ons/automated-tolls-and-billing/`
- RENTALL:
  - `https://www.rentallsoftware.com/`

## Executive Read

This codebase is already much further along than a simple rental dashboard MVP.

It has a solid internal-operations core:

- multi-tenant auth and organization switching
- role and permission gating
- branch-scoped access control
- customer records with verification metadata and notes
- vehicle catalog management
- live fleet telemetry views
- rental creation, payment, handover, return, extension, inspections, damage-related charges, and deposit handling
- Stripe-backed payment ledger, webhook monitoring, and billing-attention workflows
- real-time workspace alerts

The biggest product gaps are not the internal basics. The biggest gaps are the higher-leverage features that strong rental platforms use to grow revenue, reduce manual work, and reduce operational risk:

- customer-facing booking and self-service
- automated tolls, fines, and ancillary charge ingestion
- maintenance and turnaround operations
- richer damage and claims workflows
- delivery and airport workflows
- dynamic pricing and commercial controls
- messaging, reminders, and customer communications
- advanced analytics and profitability reporting
- split billing and insurer or corporate account flows

## Current Product Understanding

### 1. Auth, onboarding, identity, and workspace setup

Observed behavior:

- Email and password sign-up and sign-in flows exist.
- Invitation acceptance and invitation-first password setup flows exist.
- Two-factor challenge is part of the auth surface.
- Workspace setup creates the first organization after sign-up.
- The app has a canonical auth-context endpoint and client query pattern.
- Organization switching is built into the workspace shell.

What this means operationally:

- The product is designed for multi-tenant internal use, not a single-location tool.
- Session, active organization, permissions, and organization capabilities are already modeled correctly for a serious ops system.

### 2. RBAC, permissions, and organization controls

Observed behavior:

- Permission keys exist for dashboard, organization settings, gallery, employees, branches, customers, fleet, bookings, reports, payments, and billing attention.
- Server-side permission checks guard protected pages and APIs.
- Organization settings include name, slug, logo, support contact fields, visibility, and organization deletion.
- Hidden-organization behavior is already handled.

What this means operationally:

- The codebase already supports a strong server-authoritative permission model.
- This is a good foundation for future branch managers, finance staff, dispatchers, and head-office roles.

### 3. Employee management and internal access

Observed behavior:

- Employee invitation flows are implemented.
- Member listing and role assignment are implemented.
- Employee removal is implemented.
- Branch access assignment and revocation exist separately from role assignment.

What this means operationally:

- The platform already distinguishes between what a user can do and where they can do it.
- That is important for multi-branch rental operations.

### 4. Branches and location access

Observed behavior:

- Branch CRUD is implemented.
- Branch active or inactive state is supported.
- Branch-specific member access is managed explicitly.
- Branch scoping is used in rentals, vehicles, payments, and dashboard queries.

What this means operationally:

- The product already thinks in terms of operational locations instead of only organization-wide records.
- This is the correct direction for front-desk, airport, depot, and franchise operations.

### 5. Customer management

Observed behavior:

- Customer records include full name, email, phone, branch association, verification status, and verification metadata.
- Customer notes are supported.
- Customer media is supported.
- Customer lookup exists for rental flows.
- Verification metadata already appears designed for license and ID capture.

What this means operationally:

- The system already has a base customer profile and verification layer.
- It is not yet a full customer risk or CRM platform, but it is beyond a basic contacts table.

### 6. Media and gallery management

Observed behavior:

- Organization gallery media exists.
- General media upload, finalize, list, fetch, private access, and delete flows exist.
- Rental-scoped media upload and finalize routes exist.
- Vehicle and inspection media are part of the core workflows.

What this means operationally:

- Media is treated as a platform capability, not a one-off file field.
- That is important for inspections, branding, customer documents, and evidence capture.

### 7. Vehicle catalog and vehicle configuration

Observed behavior:

- Vehicle catalog list and detail pages exist.
- Vehicle creation, update, delete, and status changes exist.
- Vehicle records include make, model, class, body type, VIN, plate, color, specs, image groups, insurance dates, registration dates, and policy number.
- Vehicles support multiple rate types: daily, weekly, monthly, and distance-based.
- Mileage rules include limited and unlimited mileage.
- Deposit requirements can be configured per rate.

What this means operationally:

- Vehicle data modeling is already strong.
- The platform can support different commercial structures without needing schema redesign.

### 8. Fleet live and telemetry

Observed behavior:

- A privileged fleet-live screen exists.
- Live fleet list, map view, and per-vehicle detail flows exist.
- Telemetry status supports moving, parked, offline, and no-data states.
- Vehicle trail and live position snapshots are modeled.
- Active rental hints are joined into fleet-live payloads.
- Live fleet data can stream over SSE.

What this means operationally:

- This is more advanced than many early rental systems.
- The product is already moving toward dispatch and live-ops workflows, not only static bookings.

### 9. Dashboard and real-time operations layer

Observed behavior:

- Dashboard summary cards exist for active rentals, pickups, returns, awaiting payment, overdue returns, and fleet availability.
- Dashboard agenda items exist for due pickup, due return, overdue return, and awaiting payment.
- Dashboard includes alerts, compliance items, rental-flow charts, fleet-status charts, branch load, and fleet preview.
- Workspace live provider invalidates dashboard, rentals, payments, and billing-attention queries from real-time events.

What this means operationally:

- The dashboard is already an operations console, not just a vanity summary.
- The product is set up well for a stronger dispatcher or duty-manager experience.

### 10. Rentals lifecycle

Observed behavior:

- Rentals list and rental details views exist.
- Rental drafts, availability checks, commit and recommit flows exist.
- Finalize flow exists before activation.
- Handover flow exists.
- Return flow exists.
- Extension flow exists.
- Rental pricing snapshots, payment plans, invoices, schedules, payments, agreements, inspections, damages, charges, deposit events, amendments, and timeline events are modeled.
- Alternative vehicle matching is modeled in availability.
- Rental charges support extension, damage, fine, toll, fuel, cleaning, late return, and other.
- Deposit resolution events include hold, release, retention, apply-to-charge, and refund.

What this means operationally:

- This is a serious rental domain model.
- The core lifecycle is already present, even if some surrounding automation is still missing.

### 11. Inspections and condition capture

Observed behavior:

- Pickup and return inspections have dedicated endpoints.
- Pickup inspection can be optional for condition evidence when unchanged.
- Return inspection requires a condition rating and at least one proof file before completion.
- Vehicle latest condition snapshot is stored as a baseline for future rentals.
- Inspection media, notes, signatures, odometer, fuel, cleanliness, and checklist data are modeled.

What this means operationally:

- The platform already handles one of the hardest rental workflows correctly: evidence-backed return processing.
- This is a strong differentiator if extended into claims and customer self-service.

### 12. Payments and billing

Observed behavior:

- Payments summary, ledger, detail, and webhooks pages exist.
- Stripe webhook ingestion is implemented and appears extensive.
- Billing-attention summary and overview exist.
- Rental payment collection supports cash, card, and AU BECS Direct Debit.
- Stripe Terminal routes exist for connection token, reader list, setup, and payment processing.
- Installment schedules and recurring billing state are modeled.
- Invoices, hosted invoice URLs, invoice PDF URLs, subscriptions, and payment intent or setup intent references are modeled.

What this means operationally:

- Payments are already more mature than the README suggests.
- The platform has the start of a finance-ops console, not just a payment button.

### 13. Billing attention and exception handling

Observed behavior:

- Billing attention tracks open attention, rentals awaiting payment, requires-action payments, failed payments, pending direct debit, and webhook health.
- Stripe webhook outcomes are converted into real-time attention events.
- Workspace live notifications propagate billing problems back into the app shell.

What this means operationally:

- The product already recognizes that payment operations need exception queues, not just transaction history.
- This is a strong direction and should be expanded.

### 14. Profile and account security

Observed behavior:

- Profile editing exists.
- Password change exists.
- Passkey listing, add, rename, and delete flows exist.
- 2FA enablement supports email and TOTP steps.
- Backup codes exist.
- Account deletion exists.

What this means operationally:

- Internal staff security is in good shape for an operations dashboard.

## Current Gaps Or Partial Areas

These are the main areas that do not appear complete or do not appear present in the codebase.

### 1. No customer-facing booking engine

There is strong internal reservation support, but no obvious public reservation site, quote widget, partner booking UI, or customer self-service booking flow.

### 2. No self-service renter journey

The app has internal handover and return tools, but no visible guest-side journey for:

- self check-in
- remote ID confirmation
- remote agreement signing
- self return with guided photos
- customer payment retries or payment method updates

### 3. No maintenance operations module

Vehicles support maintenance status and compliance dates, but there is no visible maintenance work-order, service scheduling, vendor tracking, or downtime planning module.

### 4. No automated tolls and fines pipeline

Rental charges support tolls and fines, but there is no visible ingestion, matching, retry, or fee automation layer for them.

### 5. No delivery, airport, or pickup logistics module

There is no visible workflow for airport delivery, after-hours pickup, location instructions, or delivery fee logic.

### 6. No advanced claims workflow

Damage evidence exists, but there is no visible claims board for:

- estimate review
- insurer workflow
- customer liability review
- recovery tracking
- dispute resolution

### 7. No rich communications engine

There is no visible automated SMS or email orchestration for reminders, overdue events, payment failures, or pickup instructions.

### 8. No dedicated reports module yet

The permission model includes reports, and dashboard analytics exist, but no dedicated reporting center appears to be shipped.

### 9. No split billing or insurer or corporate account management

This is important for replacement rentals, B2B accounts, and invoice allocation.

### 10. No dynamic pricing or revenue controls

Current pricing looks fixed-rate and manually configured, not rule-driven.

## Benchmark Takeaways From External Platforms

### Turo

What Turo emphasizes:

- mobile-first host operations
- pricing tweaks and host performance monitoring in the app
- contactless check-in guidance
- airport delivery as a growth lever
- monthly trips as a lower-touch revenue strategy
- host education, tools, and marketplace optimization
- trust, protection, and incident guidance

What matters for this product:

- strong rental platforms do not stop at ops tooling; they also help operators grow utilization and reduce handoff friction.
- customer and host self-service are core product advantages, not extras.

### HQ Rental Software

What HQ emphasizes:

- online reservations and online payments
- fleet availability, repairs, and finances in one system
- paperless agreements
- mobile checkout with photo capture and digital signature
- damages overview
- long-term rental payment schedules
- advanced reporting
- mobile access and integrations

What matters for this product:

- your codebase already overlaps with parts of this, especially inspections and payment schedules.
- the missing step is packaging those capabilities into a more complete operations and customer workflow.

### Rent Centric

What Rent Centric emphasizes:

- end-to-end fleet, customer, employee, and revenue management
- fast contract open and close workflows
- driver-license and credit-card scanning
- multiple stored cards per customer
- customer history, notes, and marketing support
- online reservation intake
- self-service unlock, locate, and fuel monitoring
- customizable agreement generation
- split billing
- advanced reporting with ROI, receivables, and employee metrics
- automated toll processing with retries and fee logic

What matters for this product:

- the clearest opportunity is post-rental monetization automation and customer data enrichment.
- automated ancillary charge collection is a major operational win.

### RENTALL

What RENTALL emphasizes:

- broad configurability
- cloud and mobile access
- suitability across many rental business shapes
- customization and tailored workflows

What matters for this product:

- flexibility is important, but flexibility alone is not enough.
- this product should keep its current strong domain model and add configurable business rules on top.

## Recommendation Backlog

The best path is not to add random features. The best path is to strengthen the platform in the order that most improves revenue, automation, and risk control.

## Priority 1: Finish The Commercial And Operational Core

### 1. Customer-facing reservations and quote engine

Current state:

- internal rental creation and availability are implemented
- no visible public booking channel exists

Recommendation:

- add a customer-facing reservation flow with live availability, quote breakdown, deposit rules, add-ons, payment capture, and booking confirmation
- support embedded booking widgets for operator websites

Why this matters:

- HQ and Rent Centric both push online reservations as table stakes
- this is the most direct path from internal ops platform to revenue platform

### 2. Contactless guest check-in and check-out

Current state:

- internal handover and return flows are implemented
- inspections and evidence are already modeled well

Recommendation:

- add guest-side flows for remote agreement acceptance, ID confirmation, pickup instructions, proof photos, and self-return evidence
- keep staff override tools for assisted handovers

Why this matters:

- Turo and Rent Centric both highlight contactless and self-service flows
- your current inspection model is a strong base for this

### 3. Delivery and airport operations

Current state:

- branch operations exist
- no visible delivery or airport workflow exists

Recommendation:

- support delivery addresses, airport pickup logic, parking and gate instructions, after-hours handoff windows, and delivery fees
- allow rentals to be branch-based, delivery-based, or airport-based

Why this matters:

- Turo explicitly treats airport delivery as a growth lever
- many operators win bookings on convenience, not only price

### 4. Split billing and account billing

Current state:

- strong rental payments exist
- no visible insurer, corporate, or mixed-party billing exists

Recommendation:

- support billing splits between renter, insurer, employer, and broker
- support direct-bill accounts with terms, limits, contacts, and invoice routing

Why this matters:

- Rent Centric treats split billing as a first-class feature
- this opens insurance replacement and B2B fleet opportunities

### 5. Automated customer communications

Current state:

- no visible communications center exists

Recommendation:

- add templates and triggers for:
  - reservation confirmation
  - payment reminders
  - pickup instructions
  - overdue return reminders
  - failed payment recovery
  - inspection or damage follow-up

Why this matters:

- this reduces staff workload and missed handoffs
- it is one of the fastest operational ROI features

## Priority 2: Automate Revenue Recovery And Exceptions

### 6. Automated toll and fine ingestion

Current state:

- toll and fine charges exist as manual rental charge types
- no visible ingestion or matching automation exists

Recommendation:

- ingest tolls and fines from providers or imported files
- auto-match them to rentals
- charge admin fees automatically
- retry collection until settled
- surface exceptions in billing attention

Why this matters:

- Rent Centric treats this as a major product area for a reason
- it prevents real leakage in rental operations

### 7. Dunning and payment recovery rules

Current state:

- billing attention and Stripe webhook handling are strong
- requires-action and failed cases are surfaced

Recommendation:

- add rule-based retries, reminder cadences, fallback payment methods, customer self-pay links, and escalation states

Why this matters:

- the current exception layer is good, but it still depends too much on manual handling

### 8. Stored payment methods per customer

Current state:

- rental-level payment setup exists
- customer-level wallet behavior is not obvious

Recommendation:

- store and manage reusable payment methods at the customer profile level
- support preferred payment method, backup card, and payment authorization history

Why this matters:

- Rent Centric highlights multiple stored cards per customer
- repeat renters and post-rental charging get much easier

### 9. Charge automation for fuel, cleaning, late return, and damages

Current state:

- the rental model already supports these charge types

Recommendation:

- add guided calculators and policy rules that suggest or generate charges based on return evidence, timing, fuel delta, and branch policy

Why this matters:

- your data model is already ready for this
- this removes manual judgment drift across branches

### 10. Finance operations workboard

Current state:

- payments ledger and billing attention pages exist

Recommendation:

- add queue views for:
  - pending collections
  - failed collections
  - pending direct debits
  - unresolved ancillary charges
  - deposit disputes
  - refund requests

Why this matters:

- the current views are good for lookup
- ops teams also need action-oriented queues

## Priority 3: Strengthen Fleet, Turnaround, And Compliance

### 11. Maintenance work orders and preventive maintenance

Current state:

- vehicle maintenance status exists
- registration and insurance compliance dates exist
- no visible service workflow exists

Recommendation:

- add service schedules by mileage, time, and fault type
- track work orders, vendors, estimated cost, actual cost, downtime, and completion

Why this matters:

- HQ explicitly markets repairs and fleet management together
- this is critical once the fleet grows beyond a small operator size

### 12. Vehicle turnaround board

Current state:

- handover and return flows exist
- no visible dispatch or turnaround board exists

Recommendation:

- add a board for vehicles that are:
  - due back
  - returned and awaiting inspection
  - awaiting cleaning
  - awaiting fueling or charging
  - awaiting maintenance
  - ready for next pickup

Why this matters:

- this becomes essential for same-day turnover and high utilization

### 13. Damage and claims management module

Current state:

- inspections, damage records, media, charges, and deposit events exist

Recommendation:

- add a case-based claims workflow with statuses, estimates, insurer assignment, customer liability review, approvals, attachments, and payout tracking

Why this matters:

- your inspection foundation is already good enough to support claims
- turning evidence into recoverable claims is where the real value sits

### 14. Telematics alerts and rules

Current state:

- live telemetry and map views exist

Recommendation:

- add geofences, unauthorized movement alerts, battery or fuel alerts, device offline alerts, excessive speed events, and branch-return arrival detection

Why this matters:

- live maps are useful, but alerts create operational leverage

### 15. Inter-branch transfers and repositioning

Current state:

- branch scoping exists
- no visible transfer workflow exists

Recommendation:

- add vehicle transfer requests, in-transit status, transfer documents, and branch-to-branch handoff confirmations

Why this matters:

- operators with multiple depots need supply balancing

## Priority 4: Improve Customer Risk, Identity, And Trust

### 16. Rich driver verification workflows

Current state:

- customer verification status and metadata exist

Recommendation:

- formalize ID, license, age, expiry, address, and eligibility rules
- support manual review queues and branch overrides

Why this matters:

- the existing structure is ready for this upgrade
- it reduces rental risk and inconsistent branch decisions

### 17. Duplicate detection and customer risk scoring

Current state:

- customer lookup exists

Recommendation:

- detect duplicate customers across email, phone, license number, or payment fingerprints
- add basic risk flags for failed payments, repeated damage, no-shows, and verification concerns

Why this matters:

- repeat-risk management matters more as volume grows

### 18. Incident packs and legal evidence bundles

Current state:

- inspections and media exist

Recommendation:

- generate exportable evidence packs per rental including agreement, signatures, inspection media, charges, deposit events, and timeline

Why this matters:

- Turo highlights incident guidance and protection
- strong evidence packaging reduces downstream disputes

## Priority 5: Build Better Commercial Controls

### 19. Dynamic pricing and pricing rules

Current state:

- fixed daily, weekly, monthly, and distance-based rates exist

Recommendation:

- add pricing rules for seasonality, weekends, lead time, branch demand, utilization, minimum rental length, and last-minute discounts

Why this matters:

- static pricing leaves money on the table
- Turo heavily emphasizes pricing optimization and earnings management

### 20. Promotions, coupons, and campaign tracking

Current state:

- no visible promo system exists

Recommendation:

- support promo codes, referral incentives, partner campaigns, and redemption tracking

Why this matters:

- necessary once public booking exists

### 21. Add-ons and ancillary inventory

Current state:

- charge line items exist, but add-on inventory is not obvious

Recommendation:

- support extras like child seats, GPS, snow chains, chargers, delivery, insurance upgrades, and fuel plans as structured add-ons

Why this matters:

- structured ancillary revenue is better than ad hoc charges

### 22. Long-term rental and subscription workflows

Current state:

- installment schedules and recurring billing states exist

Recommendation:

- package long-term rental products with recurring billing rules, contract renewals, scheduled inspections, and pause or early-return policies

Why this matters:

- Turo highlights monthly trips
- HQ highlights long-term rental payment schedules
- the codebase is already close to supporting this cleanly

## Priority 6: Expand Reporting And Control Surfaces

### 23. Dedicated reporting center

Current state:

- dashboard analytics exist
- reports permission exists
- no dedicated reports module is visible

Recommendation:

- add report suites for:
  - utilization
  - revenue by branch and vehicle
  - ancillary revenue
  - days sales outstanding
  - failed payment trends
  - vehicle ROI
  - maintenance cost per km
  - employee productivity

Why this matters:

- Rent Centric and HQ both lean heavily on reporting as a core value proposition

### 24. Cohort and customer lifetime reporting

Current state:

- no visible CRM or cohort views exist

Recommendation:

- report first-time vs repeat customers, return rate, average rental length, average damage rate, and payment recovery rate

Why this matters:

- this helps operators understand growth quality, not just transaction count

### 25. Audit and compliance center

Current state:

- rental timeline and webhook logs exist
- no visible global audit center exists

Recommendation:

- add cross-platform audit logs for role changes, permission changes, branch access changes, organization settings updates, manual payment overrides, and sensitive customer edits

Why this matters:

- this becomes important for internal controls and enterprise readiness

## Priority 7: Platform Expansion And Differentiators

### 26. Public customer portal

Current state:

- no visible customer portal exists

Recommendation:

- allow customers to view bookings, upload documents, sign agreements, pay balances, extend rentals, and complete self-return steps

Why this matters:

- reduces support load and improves experience

### 27. Partner and broker integrations

Current state:

- no visible distribution or channel ingestion exists

Recommendation:

- support inbound bookings from partners, brokers, corporate agents, or marketplace channels

Why this matters:

- helps operators diversify demand sources

### 28. Delivery partner and runner workflows

Current state:

- no visible dispatch workforce flow exists

Recommendation:

- support staff assignments, route planning, proof of handoff, and driver task completion for delivered rentals

Why this matters:

- required once delivery or airport operations scale

### 29. White-label and franchise controls

Current state:

- multi-org support exists

Recommendation:

- add organization templates, shared policy packs, brand defaults, and cross-location rollout controls

Why this matters:

- this creates a stronger B2B product story for operators with many brands or franchise groups

### 30. Mobile staff app or strong offline mode

Current state:

- web app is touch-friendly and internal-facing
- no obvious offline-first field workflow is visible

Recommendation:

- add offline-friendly inspection capture, image queueing, and terminal-safe field flows for low-connectivity lots and airport garages

Why this matters:

- this is critical for real-world branch environments

## Recommended Product Roadmap Order

### Phase A

- public reservations and quote engine
- contactless guest flow
- communications engine
- split billing

### Phase B

- toll and fine automation
- payment recovery rules
- stored payment methods
- finance workboard

### Phase C

- maintenance work orders
- turnaround board
- claims module
- telematics alerts

### Phase D

- dynamic pricing
- add-ons and promos
- long-term rental packaging
- dedicated reporting center

### Phase E

- customer portal
- delivery and airport ops
- partner integrations
- white-label and franchise controls

## Product Principles To Keep

As new features are added, the platform should keep the strengths already visible in the codebase:

- keep server-authoritative auth and permissions
- keep branch-scoped access as a first-class concern
- keep TanStack Query as the client state layer for dashboard data
- keep rentals, payments, and live-ops features connected through real-time invalidation and event streams
- keep inspections and media as reusable platform capabilities instead of one-off feature logic
- keep billing attention as a cross-cutting operating system for payment exceptions

## Final Recommendation

The strongest strategic move is this:

- do not rebuild the basics
- do not over-invest in cosmetic dashboard polish
- turn the current strong internal core into a complete rental operations platform by adding customer-facing booking, automation of post-rental charges, maintenance and claims workflows, and stronger communications and reporting

The codebase already has the right foundations for that move.