# FINAL RECOVERY PLAN
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  

---

## Rollback Points

| Point | How to Reach | When to Use |
|---|---|---|
| Replit checkpoint `00fdfee` | Replit → History → Restore | PWA + all reports intact — before Session 3 changes |
| Replit checkpoint `ad622ab` | Replit → History → Restore | Session 2 state |
| Replit checkpoint `82e538a` | Replit → History → Restore | Session 1 state — all original fixes |
| Git commit `f5ad07c` | `git checkout f5ad07c` | Pre-release state — original import |

---

## Scenario 1 — Gateway Won't Start

**Symptom:** `[Gateway] JWT_SECRET env var is required` on startup

**Fix (30 seconds):**
```bash
# Set in Replit Secrets (production)
# OR in .env.docker (VPS):
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env.docker
docker-compose restart gateway
```

---

## Scenario 2 — Database Connection Refused

**Symptom:** Services log `ECONNREFUSED` or `password authentication failed`

**Fix:**
```bash
# Verify DATABASE_URL is set correctly
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# If PostgreSQL container is down (Docker deploy):
docker-compose up -d postgres
sleep 10
docker-compose restart
```

---

## Scenario 3 — All Services Down After Reboot

**Symptom:** VPS rebooted, site unreachable

**Fix:**
```bash
# SSH to VPS
cd dunazoe-supermaster/apps/core
docker-compose up -d
# Wait 60 seconds
curl http://localhost:3000/health
```

All containers have `restart: unless-stopped` — they should auto-start. If not, run the above.

---

## Scenario 4 — Payment Webhook Not Processing

**Symptom:** Paystack sends webhook, orders stay in `pending`, no escrow funded

**Fix:**
1. Check `PAYSTACK_WEBHOOK_SECRET` is set correctly
2. Check `PAYSTACK_SECRET_KEY` is live (not test) key
3. Check gateway allows `POST /payments/webhook` without auth (it does — public route)
4. Check payment-service logs: `docker logs dunazoe-payment --tail 50`
5. If signature mismatch: regenerate webhook secret in Paystack dashboard, update env var, restart payment-service

---

## Scenario 5 — Images Not Loading

**Symptom:** Product images broken / blocked by Next.js

**Fix:**
```bash
# Verify next.config.js has the domain
cat apps/core/frontend/next.config.js
# Should show: domains: ['res.cloudinary.com']

# Verify Cloudinary secrets
echo $CLOUDINARY_CLOUD_NAME
```

If secrets are missing — set them, then rebuild frontend.

---

## Scenario 6 — Register Page Crashes

**Symptom:** White screen or 404 at `/register`

**Fix:**
1. Confirm file exists: `apps/core/frontend/src/app/register/page.jsx` ✅ Created this session
2. Rebuild frontend: `npm run build`
3. If `Navbar` component missing → check `apps/core/frontend/src/components/Navbar.jsx`

---

## Scenario 7 — Full Rollback (Last Resort)

**When:** Multiple services down, build broken, cannot identify root cause.

```bash
# On VPS
cd dunazoe-supermaster
git stash
git checkout f5ad07c
cd apps/core
docker-compose down
docker-compose up --build -d
```

**In Replit:**
1. Click **History** (left panel)
2. Find checkpoint `82e538a` — "Fix critical issues and generate all project reports"
3. Click **Restore**
4. Restart workflow

---

## Monitoring During Beta

```bash
# Health check (run from anywhere)
curl https://dunazoe.com/api/health

# Service status
docker-compose ps

# Error logs
docker logs dunazoe-gateway --tail 100 --follow

# Cost / traffic report
curl https://api.dunazoe.com/reliability/costs?days=1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Contacts

- GitHub Issues: `https://github.com/dunazoeworld-stack/dunazoe-supermaster/issues`
- Paystack Dashboard: `https://dashboard.paystack.com`
- Cloudinary Console: `https://cloudinary.com/console`

---

*Generated: 2026-06-15 — DUNAZOE CTO / SRE Lead*
