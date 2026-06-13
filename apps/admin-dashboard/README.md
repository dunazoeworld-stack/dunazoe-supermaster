# DUNAZOE Admin Dashboard

**Status:** Scaffold only — not yet built as a standalone app.

## Current state

Admin functionality currently lives inside `apps/core/frontend` (Next.js) and is
served by `admin-override-service`, `security-ai-service`, `deployment-ai-service`,
`reliability-service`, `social-media-service`, and `payments-ai-service` — **all of
which are beta-disabled** per Update #96 §1.

## During beta

Admin needs are minimal and covered by the 10 active services directly:

- Order management → `order-service`
- Vendor approval → `vendor-service`
- User account activate/deactivate → `user-service` (governed by Update #96 §4 —
  no raw password/PIN/card access, every action requires `admin_id + reason + audit log`)
- Wallet snapshots/reconciliation → `wallet-service` (`/wallets/reconcile`,
  `/wallets/:id/audit-log`)
- Feature flags / kill switches / launch gate → `feature-flag-service`

These can be operated via:
- Direct API calls (Postman/curl) during early beta
- Simple admin pages added to `apps/core/frontend` as needed

## When to build a standalone admin app

Once the launch gate (Update #96 §12) is cleared and modules like `security-ai`,
`deployment-ai`, `social-media`, and `reconciliation` are flipped on, a dedicated
admin dashboard becomes worthwhile — at that point those services' dashboards
(`/security/dashboard`, `/deployment/status`, `/social/analytics`,
`/reliability/status-dashboard`) have real data to show.

## Suggested stack (when built)

- Next.js (consistent with `apps/core/frontend`)
- Reuses `apps/core/gateway` — no separate backend needed
- Role-gated routes per `shared/rbac.js` (13 roles, 25 permissions)
