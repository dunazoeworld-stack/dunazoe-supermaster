---
name: Auth routes & missing pages audit (July 2026)
description: All missing API routes and pages found and fixed in the July 23 2026 session; sign-in flow verified end-to-end.
---

# Auth & Page Audit — July 23 2026

## Sign-in flow
- Login (`/api/auth/login`) and register (`/api/auth/register`) are solid — JWT+bcrypt, sessions table.
- Wallet column is `balance_ngn` (not `balance`) in the `wallets` table. Fix already applied to `/api/wallet/balance`.
- Auth guard in PageShell redirects to `/login` if no token — correct behaviour.

## Missing routes created
| Route | Notes |
|-------|-------|
| `/api/auth/forgot-password` | Anti-enumeration; stores pwd_reset token in sessions table |
| `/api/auth/profile` (PATCH) | Updates name/email/phone/state/city/town |
| `/api/auth/change-password` (POST) | Verifies current pw, rehashes new pw |
| `/api/admin/stats` | Requires admin/super_admin/coordinator role; returns zeros to non-admins |
| `/api/wallet/balance` | Reads `balance_ngn` from wallets table |
| `/api/loans` | Proxies to gateway; returns [] offline |
| `/api/trust/score` | Proxies to gateway; returns 0 offline |
| `/api/notifications/[id]/read` | Dynamic route (was missing) |
| `/api/notifications/read-all` | Was being incorrectly routed through /:id/read |

## Missing pages created
- `/profile` — personal info + change-password, auth-guarded
- `/loans` — loan history + trust score card, links to /loans/apply

## DB schema
- Run all schema phases 1, 3-4, 5-8, 9, 10 to get full table set.
- Tables now present: users, sessions, vendors, products, inventory, orders, wallets, wallet_transactions, loans, disputes, thrift_* tables.

**Why:** Admin page was showing 404 for stats; dashboard was calling /api/wallet/balance which didn't exist; profile link in navbar went nowhere.
