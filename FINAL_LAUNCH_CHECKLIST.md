# FINAL LAUNCH CHECKLIST
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  

Complete EVERY item. No shortcuts. This is your go-live gate.

---

## 🔐 SECRETS (Operator — Replit Secrets or .env.docker)

- [ ] `DATABASE_URL` — PostgreSQL connection string
- [ ] `JWT_SECRET` — min 64 chars (`openssl rand -hex 32`)
- [ ] `INTERNAL_SECRET` — min 64 chars
- [ ] `PAYSTACK_SECRET_KEY` — live key (sk_live_...)
- [ ] `PAYSTACK_PUBLIC_KEY` — live key (pk_live_...)
- [ ] `PAYSTACK_WEBHOOK_SECRET` — from Paystack dashboard
- [ ] `STRIPE_SECRET_KEY` — live key (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` — from Stripe dashboard (whsec_...)
- [ ] `REDIS_URL` — redis://host:6379
- [ ] `RABBITMQ_URL` — amqp://host:5672
- [ ] `CLOUDINARY_CLOUD_NAME`
- [ ] `CLOUDINARY_API_KEY`
- [ ] `CLOUDINARY_API_SECRET`
- [ ] `TERMII_API_KEY`
- [ ] `SHIPBUBBLE_API_KEY`
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_API_URL=https://dunazoe.com`

---

## 📦 DATABASE

- [ ] PostgreSQL provisioned (min 10GB)
- [ ] `schema.sql` migrated
- [ ] `schema-phase3-4.sql` migrated
- [ ] `schema-phase5-8.sql` migrated
- [ ] `schema-phase9.sql` migrated
- [ ] `schema-phase10.sql` migrated
- [ ] Test: `psql $DATABASE_URL -c "\dt"` — shows all tables
- [ ] Backup created: `pg_dump $DATABASE_URL > pre_launch_backup.sql`

---

## 🐳 DOCKER / DEPLOY

- [ ] Docker build succeeds: `docker-compose up --build -d`
- [ ] All containers show `Up`: `docker-compose ps`
- [ ] Gateway health: `curl http://localhost:3000/health` → `{"status":"ok"}`
- [ ] Activation engine: `curl http://localhost:4033/health` → `{"status":"ok"}`
- [ ] dunazoe-express: `curl http://localhost:4032/health` → `{"status":"ok"}`
- [ ] Deployment AI: `curl http://localhost:4027/health` → `{"status":"ok"}`

---

## 🌐 DNS + SSL (Contabo only — skip for Replit)

- [ ] Namecheap A Record `@` → Contabo IP
- [ ] Namecheap A Record `www` → Contabo IP
- [ ] DNS propagated: `nslookup dunazoe.com` → correct IP
- [ ] SSL: `certbot --nginx -d dunazoe.com -d www.dunazoe.com`
- [ ] HTTPS works: `curl -I https://dunazoe.com` → 200

---

## 🚀 DEPLOYMENT AI GATE

- [ ] Open `dunazoe.com/deploy` (or Replit preview `/deploy`)
- [ ] Login as admin
- [ ] Run Deployment Audit → all scores GREEN
  - [ ] Security ≥90
  - [ ] Reliability ≥90
  - [ ] Scalability ≥85
  - [ ] Performance ≥85
  - [ ] Readiness ≥90
- [ ] Press 🚀 DEPLOY — step checklist generated

---

## 📱 SMOKE TESTS (Run from phone browser)

- [ ] Homepage loads — logo + products visible
- [ ] `/register` — create customer account — works
- [ ] `/login` — sign in — redirects to dashboard
- [ ] `/register?role=vendor` — vendor form with business_name — works
- [ ] PWA install prompt — Chrome "Add to Home Screen" — icon appears
- [ ] `/deploy` — audit scores visible
- [ ] `/deploy/monitor` — live vitals updating every 30s
- [ ] `/activation/features` — 15 features listed in JSON

---

## 💳 PAYMENT VERIFICATION

- [ ] Paystack webhook URL registered: `https://dunazoe.com/payments/webhook/paystack`
- [ ] Stripe webhook URL registered: `https://dunazoe.com/payments/webhook/stripe`
- [ ] Test payment (Paystack test mode) → order status changes to `paid`
- [ ] Webhook log populated: `SELECT * FROM webhook_log LIMIT 5`

---

## 🔒 GITHUB

- [ ] Branch `release/v1-go-live` pushed
- [ ] Tag `v1.0.0` created and pushed
- [ ] All key files present (see `GITHUB_VERIFICATION.md`)
- [ ] Release notes published on GitHub Releases page

---

## 📊 MONITORING

- [ ] `/deploy/monitor` shows 🟢 HEALTHY
- [ ] Deployment AI 72-hour monitor running
- [ ] Grafana dashboard accessible (if Contabo)
- [ ] Prometheus metrics scraping (if Contabo)

---

## 🧪 BETA CONFIGURATION

- [ ] Feature flags confirm: payments=ON, kyc=ON, wallet=OFF
- [ ] First 10 vendor invites sent
- [ ] Beta WhatsApp group created for incident communication
- [ ] Admin WhatsApp number in Termii for alerts

---

## ✅ FINAL GO / NO-GO

| Gate | Requirement | Status |
|---|---|---|
| Secrets | All 17 set | ⬜ |
| Database | All 5 schemas migrated | ⬜ |
| Services | All Up in docker-compose ps | ⬜ |
| Deployment AI | All scores ≥85 | ⬜ |
| Smoke tests | All 8 pass | ⬜ |
| Payments | Webhook verified | ⬜ |
| Monitor | `/deploy/monitor` showing 🟢 | ⬜ |
| GitHub | Branch + tag pushed | ⬜ |

**All 8 gates ✅ = GO LIVE**  
**Any gate ❌ = STOP — fix and re-verify**

---

## AFTER GO-LIVE

1. Post in beta WhatsApp group: "DUNAZOE is LIVE 🚀"
2. Monitor `/deploy/monitor` for next 72 hours
3. After 100 users: wallet auto-activates (check `/activation/features`)
4. After 50 orders + 20 payouts: promote to Contabo (Level 2)
5. Update `BETA_HEALTH_REPORT.md` with real numbers

---

*Generated: 2026-06-15 — DUNAZOE Chief Release Manager*  
*This is the final gate. Do not deploy until every checkbox is ticked.*
