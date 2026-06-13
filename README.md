# DUNAZOE Supermaster

**Repository:** `dunazoe-supermaster`
**Type:** Monorepo — wraps the existing DUNAZOE OS v4 platform plus future apps (mobile, admin dashboard)

> **Status note:** This repo does **not** rewrite the existing platform. `apps/core` is the
> existing production-ready DUNAZOE OS v4 (31 microservices + gateway, Node.js/Express,
> PostgreSQL, Redis, RabbitMQ, Next.js frontend) carried over as-is. New work (mobile app,
> standalone admin dashboard, CI/CD, branch governance) is layered on top.

---

## Monorepo Layout

```
dunazoe-supermaster/
├── apps/
│   ├── core/              # Existing DUNAZOE OS v4 (31 services + gateway + frontend)
│   │   ├── gateway/
│   │   ├── services/      # auth, vendor, order, escrow, wallet, thrift, ...
│   │   ├── shared/         # ledger engine, fintech OS, reliability engine, RBAC
│   │   ├── frontend/        # Next.js web app
│   │   ├── tests/           # Jest unit/integration/security + Playwright e2e + k6
│   │   ├── monitoring/       # Prometheus, Grafana, nginx, pgbouncer
│   │   └── docs/              # threat model, incident response, legal docs
│   │
│   ├── mobile/             # React Native (Expo) — SCAFFOLD ONLY, not yet built
│   │
│   └── admin-dashboard/    # Standalone admin/superuser web app — SCAFFOLD ONLY
│
├── .github/
│   ├── workflows/          # CI pipelines (lint, test, build per branch)
│   └── PULL_REQUEST_TEMPLATE/
│
├── docs/
│   ├── git/                # Git command reference (manual push instructions)
│   └── branching/          # Branch policy, release policy
│
└── scripts/
    └── git/                # Shell scripts to set up branches locally
```

---

## Modules (per project spec)

| Module | Location | Status |
|---|---|---|
| Marketplace | `apps/core/services/{product,vendor,order,inventory}-service` | ✅ Built |
| Wallet Ledger | `apps/core/shared/fintech/fintechOS.js`, `services/wallet-service` | ✅ Built |
| Thrift Savings | `apps/core/services/thrift-service` | ✅ Built |
| DUNAZOE Express | `apps/core/services/logistics-service` | ✅ Built |
| Delivery Vendor Network | `apps/core/services/self-delivery-service` | ✅ Built |
| Courier Aggregation | `apps/core/services/logistics-service` | ✅ Built |
| Chat System | `apps/core/services/realtime-service` | ✅ Built |
| Notification System | `apps/core/services/notification-service` | ✅ Built |
| Marketing AI | `apps/core/services/social-media-service` | ✅ Built |
| Support AI | `apps/core/services/ai-service` | ✅ Built |
| Cybersecurity AI | `apps/core/services/security-ai-service` | ✅ Built |
| Deployment AI | `apps/core/services/deployment-ai-service` | ✅ Built |
| Shareholder System | — | 📋 Planned |
| Admin System | `apps/core/services/admin-override-service` | ✅ Built |
| Fintech Middleware Layer | `apps/core/shared/fintech/fintechOS.js` | ✅ Built |
| Future Banking Layer | `apps/core/shared/fintech/fintechOS.js` (ledger-ready) | 🏗️ Foundation laid |
| Mobile App (Expo) | `apps/mobile/` | 📋 Scaffold only |

---

## User Types & Roles (RBAC)

Implemented in `apps/core/shared/rbac.js`:

- Customer (User)
- Direct Vendor / Copytrader Vendor / Delivery Vendor / Hybrid Vendor
- Shareholder *(role reserved — system pending)*
- Admin (Head of Store, Head of Vendors, Head of Logistics, Head of Marketing, Regional Coordinator)
- Super Admin / CTO / Cybersecurity Officer
- CEO *(maps to `super_admin` permission tier)*

---

## Stack Mapping (Spec vs Implemented)

| Spec Requirement | Implemented As |
|---|---|
| Node.js + Express | ✅ All 31 services |
| TypeScript | ⚠️ Currently JavaScript — migration path documented in `docs/branching/typescript-migration.md` |
| Next.js (frontend) | ✅ `apps/core/frontend` |
| React Native Expo (mobile) | 📋 Scaffolded in `apps/mobile`, not yet built |
| PostgreSQL | ✅ `apps/core/shared/schema*.sql` |
| Supabase | ⚠️ Plain PostgreSQL currently — Supabase is Postgres-compatible, migration documented |
| Redis | ✅ `apps/core/shared/rateLimiter.js`, reliability engine |
| BullMQ | ⚠️ RabbitMQ + custom `async_jobs` table currently used — BullMQ migration documented |
| Cloudinary | ✅ `apps/core/services/upload-service` |
| Paystack / Stripe | ✅ `apps/core/services/payment-service` |
| Prometheus / Grafana / OpenTelemetry | ✅ `apps/core/monitoring/` |
| Replit / Contabo hosting | ✅ `apps/core/services/deployment-ai-service` (universal deployment) |
| Namecheap domain | ✅ documented in deployment guides |

See `docs/branching/migration-notes.md` for the honest gap analysis between this spec
and what's currently running, with effort estimates for each "⚠️" item.

---

## Quick Start (Local Dev)

```bash
cd apps/core
cp .env.example .env        # fill in real secrets
./scripts/start-all.sh       # starts 31 services + gateway
cd frontend && npm run dev   # starts Next.js on :3001
```

Health check: `curl http://localhost:3000/health`

---

## Next Steps

1. Read `docs/branching/BRANCH_POLICY.md` — branch/release rules
2. Read `docs/git/GIT_SETUP.md` — commands to initialize this repo and push to GitHub
3. Read `.github/workflows/` — CI pipelines that run on every PR
4. When ready to build the mobile app, start from `apps/mobile/README.md`
