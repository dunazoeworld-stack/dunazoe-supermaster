# PRODUCTION CHECKLIST
**Project:** DUNAZOE Supermaster v1.0.0-rc1  
**Date:** 2026-06-16  
**Authority:** Operator completes this before going live.

---

## PRE-DEPLOY (Complete Before Touching Deploy Button)

### Secrets
- [ ] `DATABASE_URL` — live database, not localhost default
- [ ] `JWT_SECRET` — 64-char random hex (openssl rand -hex 32)
- [ ] `INTERNAL_SECRET` — 64-char random hex (different from JWT)
- [ ] `PAYSTACK_SECRET_KEY` — live key (sk_live_...)
- [ ] `PAYSTACK_PUBLIC_KEY` — live key (pk_live_...)
- [ ] `PAYSTACK_WEBHOOK_SECRET` — from Paystack dashboard
- [ ] `STRIPE_SECRET_KEY` — live key (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard
- [ ] `REDIS_URL` — live Redis
- [ ] `RABBITMQ_URL` — live RabbitMQ
- [ ] `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET`
- [ ] `TERMII_API_KEY`
- [ ] `SHIPBUBBLE_API_KEY`
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_API_URL=https://dunazoe.com`
- [ ] `ALLOWED_ORIGINS=https://dunazoe.com,https://www.dunazoe.com`

### Database
- [ ] PostgreSQL accessible from deployment host
- [ ] `schema.sql` executed (base tables)
- [ ] `schema-phase3-4.sql` executed
- [ ] `schema-phase5-8.sql` executed
- [ ] `schema-phase9.sql` executed
- [ ] `schema-phase10.sql` executed
- [ ] Backup taken: `pg_dump $DATABASE_URL > pre_launch.sql`

### GitHub
- [ ] Branch `release/v1-go-live` pushed
- [ ] Tag `v1.0.0` created and pushed
- [ ] Commit: "FINAL RC HANDOVER — DUNAZOE v1.0.0-rc1"
- [ ] GitHub shows latest files (monitor page, clean docker-compose, all reports)

---

## DEPLOY (In Order)

- [ ] Open `/deploy` dashboard
- [ ] Login as admin
- [ ] Run **System Audit** — all scores ≥85
- [ ] Press 🚀 **Deploy**
- [ ] Follow generated deployment steps
- [ ] Wait for "DEPLOYMENT SUCCESSFUL" confirmation

---

## POST-DEPLOY VALIDATION (Run Within 30 Minutes)

### Health Check All Services
- [ ] `GET /health` → `{"status":"ok"}` (gateway)
- [ ] `GET /auth/health` → `{"status":"ok"}`
- [ ] `GET /payments/health` → `{"status":"ok"}`
- [ ] `GET /activation/health` → `{"status":"ok"}`
- [ ] `GET /deployment/health` → `{"status":"ok"}`

### Smoke Tests (Browser)
- [ ] Homepage loads — logo visible, products listed
- [ ] `/register` — form renders, account created
- [ ] `/login` — redirects to dashboard after login
- [ ] `/deploy` — deployment dashboard visible
- [ ] `/deploy/monitor` — shows 🟢 HEALTHY, metrics updating
- [ ] PWA install prompt appears in Chrome

### Payment Test
- [ ] Paystack test payment completes → order status = `paid`
- [ ] Webhook log: `SELECT COUNT(*) FROM webhook_log WHERE created_at > NOW() - INTERVAL '1 hour';`

### Activation Engine
- [ ] `GET /activation/features` returns 15 features
- [ ] `payments` state = `ON`
- [ ] `wallet` state = `OFF` (will auto-activate at 100 users)

---

## 72-HOUR WATCH

- [ ] `/deploy/monitor` bookmarked on phone
- [ ] Alerts configured (WhatsApp group ready)
- [ ] Beta vendors invited (max 10)
- [ ] Beta users registered (track toward 100 for wallet auto-activation)

---

## GO / NO-GO DECISION

| Gate | Requirement | ✓/✗ |
|---|---|---|
| All 17 secrets set | 100% | ⬜ |
| 5 database schemas migrated | 100% | ⬜ |
| Deploy audit all ≥85 | 100% | ⬜ |
| `/health` returns OK | 100% | ⬜ |
| Register + login works | 100% | ⬜ |
| Test payment processed | 100% | ⬜ |
| Monitor shows 🟢 | 100% | ⬜ |
| GitHub branch pushed | 100% | ⬜ |

**All 8 ✓ = GO.  Any ✗ = STOP AND FIX.**

---

*Generated: 2026-06-16 — DUNAZOE Chief Release Manager*
