# FINAL DEPLOYMENT CHECKLIST
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  

Complete every item in order. Do not skip steps.

---

## PRE-DEPLOY (Complete Before Any Deploy Button)

### Secrets
- [ ] `DATABASE_URL` set in Replit Secrets / `.env.docker`
- [ ] `JWT_SECRET` set — min 32 chars, no placeholder (`openssl rand -hex 32`)
- [ ] `INTERNAL_SECRET` set — min 32 chars
- [ ] `PAYSTACK_SECRET_KEY` set (live key)
- [ ] `PAYSTACK_PUBLIC_KEY` set (live key)
- [ ] `PAYSTACK_WEBHOOK_SECRET` set
- [ ] `STRIPE_SECRET_KEY` set (sk_live_...)
- [ ] `STRIPE_WEBHOOK_SECRET` set (whsec_...)
- [ ] `REDIS_URL` set
- [ ] `RABBITMQ_URL` set
- [ ] `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` set
- [ ] `TERMII_API_KEY` set
- [ ] `SHIPBUBBLE_API_KEY` set
- [ ] `NODE_ENV=production` set
- [ ] `NEXT_PUBLIC_API_URL=https://dunazoe.com` set
- [ ] `ALLOWED_ORIGINS=https://dunazoe.com,https://www.dunazoe.com` set

### Database
- [ ] PostgreSQL instance provisioned (min 10GB storage)
- [ ] Run schemas in order:
  ```bash
  psql $DATABASE_URL -f apps/core/shared/schema.sql
  psql $DATABASE_URL -f apps/core/shared/schema-phase3-4.sql
  psql $DATABASE_URL -f apps/core/shared/schema-phase5-8.sql
  psql $DATABASE_URL -f apps/core/shared/schema-phase9.sql
  psql $DATABASE_URL -f apps/core/shared/schema-phase10.sql
  ```
- [ ] Verify tables created: `psql $DATABASE_URL -c "\dt"`

### Code
- [ ] `apps/core/frontend/next.config.js` present ✅
- [ ] `apps/core/frontend/public/manifest.json` present ✅
- [ ] `apps/core/frontend/public/sw.js` present ✅
- [ ] Gateway JWT fix applied ✅
- [ ] dunazoe-express port 4032 ✅
- [ ] dunazoe-express axios in package.json ✅
- [ ] `/register` page created ✅
- [ ] Service worker registered in homepage ✅

---

## DEPLOY (VPS — Docker)

- [ ] VPS provisioned (min 4GB RAM, 2 vCPU)
- [ ] Docker installed: `curl -fsSL https://get.docker.com | sh`
- [ ] Repo cloned: `git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster`
- [ ] `.env.docker` filled with all real values
- [ ] Services built: `docker-compose up --build -d`
- [ ] All containers showing `Up`: `docker-compose ps`
- [ ] Gateway responding: `curl http://localhost:3000/health`

## DEPLOY (Frontend — Replit)

- [ ] Workflow created: `cd apps/core/frontend && npm install && npm run build && npm start`
- [ ] Port set to 5000
- [ ] `PORT=5000` in Replit Secrets
- [ ] Replit Deploy → Autoscale / Reserved VM

---

## POST-DEPLOY VERIFICATION

- [ ] `curl -I https://dunazoe.com` → 200 OK
- [ ] `curl https://dunazoe.com/api/health` → `{"status":"ok"}`
- [ ] Homepage loads in browser — no white screen
- [ ] `/register` page renders
- [ ] `/login` page renders
- [ ] Register new customer account — succeeds
- [ ] Register vendor account — succeeds, shows business_name field
- [ ] Login with credentials — JWT stored, redirect works
- [ ] Products page loads
- [ ] Add product to cart
- [ ] Checkout renders
- [ ] Wallet balance endpoint: `GET /wallets/balance` → returns balance
- [ ] Admin login → redirects to `/admin`
- [ ] HTTPS padlock visible — no certificate warning
- [ ] PWA install prompt shown on mobile Chrome

---

## DNS

- [ ] Namecheap A record `@` → VPS IP
- [ ] Namecheap A record `www` → VPS IP
- [ ] Namecheap A record `api` → VPS IP
- [ ] DNS propagated: `nslookup dunazoe.com` → VPS IP
- [ ] SSL: `certbot --nginx -d dunazoe.com -d www.dunazoe.com`

---

## LAUNCH GATE

All 10 verification items above must be ✅ before inviting beta users.

---

*Generated: 2026-06-15 — DUNAZOE CTO / DevOps Lead*
