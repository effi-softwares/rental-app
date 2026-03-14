## Summary

- What changed:
- Why:

## Validation

- [ ] `pnpm lint` (or scoped equivalent)
- [ ] `pnpm build` (or reason not run)
- [ ] Manual verification completed for changed screens

## Touch-First UI Checklist (Required)

- [ ] Primary interactive controls are touch-safe (`h-11` or equivalent ~44px target)
- [ ] No critical action is hover-only; actions are visible and tappable
- [ ] Dense rows/lists use tap-friendly layouts (stack/wrap/sheet/drawer where needed)
- [ ] Mobile/tablet flows are usable without precision taps

## Data/Auth/RBAC Checklist

- [ ] Dashboard server-state uses TanStack Query (queries/mutations/invalidation)
- [ ] Protected API paths enforce server-side auth/RBAC checks
- [ ] Error payload contract remains `{ error: string }` where applicable
- [ ] Org-scoped query keys/invalidation are handled for changed features

## Architecture and Docs

- [ ] File placement follows feature-first guidance (`app`/`features`/`components`/`lib`)
- [ ] Route constants used instead of hard-coded app paths
- [ ] Docs updated for new decisions, policies, or dependencies
