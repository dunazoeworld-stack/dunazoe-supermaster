# PROJECT STRUCTURE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Date:** 2026-06-16  

---

## TOP-LEVEL LAYOUT

```
dunazoe-supermaster/
├── apps/core/                   Main application
│   ├── docker-compose.yml       Full 43-service stack
│   ├── docker-compose.override.yml  Replit beta (8 services)
│   ├── docker-compose.beta.yml  Phase 11 standalone
│   ├── gateway/                 API proxy → all 33 services
│   ├── frontend/                Next.js 14 App Router
│   ├── services/                33 microservices
│   ├── shared/                  Shared modules
│   └── monitoring/              Nginx, Prometheus, PgBouncer configs
│
├── HANDOVER_PACKAGE/            6-file operator guide
├── FINAL_HANDOVER_PACKAGE/      8-file comprehensive guide
├── smoke-tests/                 Automated test suite
├── docs/                        Extended documentation
├── scripts/                     Utility scripts
│
└── Root docs (60+ .md files)    Release notes, checklists, guides
```

---

## GATEWAY (apps/core/gateway/)

```
gateway/
├── index.js        Express proxy — 33 service routes
│                   http://localhost:3000 → http://localhost:4001-4033
├── Dockerfile
└── package.json
```

**How it works:** Every request to `:3000/auth/*` is proxied to `:4001/auth/*`. Uses `http-proxy-middleware`. All services use `network_mode: host` so localhost URLs work.

---

## FRONTEND (apps/core/frontend/)

```
frontend/
├── src/app/
│   ├── page.jsx              Homepage — product listing
│   ├── layout.jsx            Root layout + PWA meta
│   ├── login/page.jsx        Login form
│   ├── register/page.jsx     Registration form
│   └── deploy/
│       ├── page.jsx          Deployment AI dashboard
│       ├── monitor/page.jsx  Live production monitor (30s)
│       ├── status/page.jsx   14-service health grid
│       ├── health/page.jsx   Deep health check (auto-refresh)
│       ├── audit/page.jsx    Run deployment audit
│       ├── logs/page.jsx     Deployment history from DB
│       ├── releases/page.jsx Tagged release versions
│       ├── github/page.jsx   GitHub push commands
│       ├── credits/page.jsx  RAM/cost savings dashboard
│       └── checklist/page.jsx Live GO/NO-GO gate
├── Dockerfile
├── next.config.js
└── package.json
```

---

## SERVICES (apps/core/services/)

33 microservices, each with the same structure:
```
[service-name]/
├── index.js        Express app — routes, business logic
├── Dockerfile
└── package.json
```

Port map:
```
auth:4001  user:4002  vendor:4003  product:4004  inventory:4005
order:4006  escrow:4007  fraud:4008  wallet:4009  thrift:4010
trust:4011  loan:4012  commission:4013  ai:4014  payment:4015
dispute:4016  notification:4017  logistics:4018  flags:4019
upload:4020  realtime:4021  search:4022  kyc:4023
reconciliation:4024  reliability:4025  security-ai:4026
deployment-ai:4027  self-delivery:4028  admin-override:4029
social-media:4030  payments-ai:4031  dunazoe-express:4032
activation-engine:4033
```

---

## SHARED (apps/core/shared/)

```
shared/
├── middleware/
│   ├── auth.js           JWT verification, requireAuth, requireRole
│   └── errorHandler.js   Global error handler + asyncHandler wrapper
├── identity/
│   └── idGenerator.js    ULID generator for all entity IDs
├── ledger/
│   └── ledgerEngine.js   Double-entry bookkeeping engine
├── fintech/
│   └── fintechOS.js      Payment processing + job queue
├── reliability/
│   └── reliabilityEngine.js  Circuit breakers + health aggregation
├── outbox/
│   └── outboxWorker.js   Transactional outbox pattern
├── logger.js             Structured logging (Winston)
├── rbac.js               Role-based access control
├── envValidator.js       Validates required env vars on startup
├── rateLimiter.js        Rate limiting middleware
├── security.js           CORS, helmet, XSS protection
├── serviceClient.js      Inter-service HTTP client
├── idempotency.js        Payment idempotency keys
├── featureFlags.js       Feature flag checker
├── validators.js         Input validation helpers
├── schema.sql            Base tables
├── schema-phase3-4.sql   Phase 3-4 tables
├── schema-phase5-8.sql   Phase 5-8 tables
├── schema-phase9.sql     Phase 9 tables
└── schema-phase10.sql    Phase 10 tables
```

---

## KEY DESIGN DECISIONS

| Decision | Rationale |
|---|---|
| `network_mode: host` for all app services | Gateway SVC map uses localhost URLs |
| PostgreSQL over MongoDB | Financial data needs ACID guarantees |
| Outbox pattern for events | Ensures event delivery without 2-phase commit |
| Feature flags via Activation Engine | Controlled rollout, no code deploys needed |
| Docker Compose override for Replit | Saves 1.4GB RAM — only 8 services in beta |
| Next.js App Router (not Pages) | Server components + streaming for performance |
| JWT in localStorage (Sprint 1) | HttpOnly cookie migration deferred to v1.1 |

---

*Generated: 2026-06-16 — DUNAZOE Chief Platform Architect*
