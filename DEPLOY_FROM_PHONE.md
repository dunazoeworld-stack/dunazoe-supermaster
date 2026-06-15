# DEPLOY FROM PHONE — DUNAZOE v1.0.0-rc1
**CTO Guide — Contabo VPS + dunazoe.com**  
**Date:** 2026-06-15  

This guide lets you take DUNAZOE from Replit → live on dunazoe.com **entirely from your phone.**

---

## APPS YOU NEED ON YOUR PHONE (install now)

| App | Use | Download |
|---|---|---|
| **Termius** | SSH into Contabo VPS | termius.com |
| **GitHub** | Verify push / check branch | github.com |
| **Namecheap** | DNS update | namecheap.com |
| **Chrome / Safari** | Test dunazoe.com at the end | — |

---

## STEP 1 — FREEZE CODE IN REPLIT (2 min)

1. Open Replit on phone
2. Tap **Version Control** (left panel)
3. Tap **Branch** → type `release/v1-go-live` → tap **Create**
4. Tap **Commit** → message: `DUNAZOE RC1 FINAL HANDOVER`
5. Tap **Push**

**Verify:** Open GitHub app → check `dunazoe-supermaster` → branch `release/v1-go-live` exists ✅

---

## STEP 2 — SET SECRETS IN REPLIT (5 min)

Replit → **Secrets (🔐)** → Add each:

```
DATABASE_URL         postgresql://user:pass@host:5432/dunazoe
JWT_SECRET           (run: openssl rand -hex 32 → paste result)
INTERNAL_SECRET      (run: openssl rand -hex 32 → paste result)
PAYSTACK_SECRET_KEY  sk_live_...
PAYSTACK_PUBLIC_KEY  pk_live_...
PAYSTACK_WEBHOOK_SECRET  (from Paystack dashboard)
STRIPE_SECRET_KEY    sk_live_...
STRIPE_WEBHOOK_SECRET    whsec_...
REDIS_URL            redis://localhost:6379
RABBITMQ_URL         amqp://localhost:5672
CLOUDINARY_CLOUD_NAME   dunazoe
CLOUDINARY_API_KEY      (from Cloudinary)
CLOUDINARY_API_SECRET   (from Cloudinary)
TERMII_API_KEY          (from Termii)
SHIPBUBBLE_API_KEY      (from Shipbubble)
NODE_ENV             production
NEXT_PUBLIC_API_URL  https://dunazoe.com
```

> ⚠️ If ANY of these are missing, the gateway will crash on startup.

---

## STEP 3 — DEPLOY ON CONTABO VPS (15 min)

### 3A. Connect to VPS via Termius

```
Open Termius → New Host
IP: YOUR_CONTABO_IP
Username: root
Password: YOUR_CONTABO_PASSWORD
Port: 22
```

### 3B. Install Docker (one time only)

```bash
apt update -y && apt install -y docker.io docker-compose git
systemctl enable docker && systemctl start docker
```

### 3C. Clone Your Repo

```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster
cd dunazoe-supermaster/apps/core
```

### 3D. Create Your .env File

```bash
cp .env.example .env.docker
nano .env.docker
```

Fill in every value. Save with `Ctrl+X → Y → Enter`

> 💡 On phone keyboard in Termius: hold keys for special characters.

### 3E. Run Database Migrations

```bash
export DATABASE_URL="postgresql://..."
psql $DATABASE_URL -f shared/schema.sql
psql $DATABASE_URL -f shared/schema-phase3-4.sql
psql $DATABASE_URL -f shared/schema-phase5-8.sql
psql $DATABASE_URL -f shared/schema-phase9.sql
psql $DATABASE_URL -f shared/schema-phase10.sql
```

### 3F. Start All 32 Services

```bash
docker-compose up --build -d
```

> First build takes ~5–10 min. Coffee time. ☕

### 3G. Verify All Running

```bash
docker-compose ps
```

All rows should show `Up`. If any show `Exit`:

```bash
docker logs dunazoe-[service-name] --tail 30
```

### 3H. Test Gateway

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","services":32}`

---

## STEP 4 — OPEN DEPLOYMENT AI DASHBOARD (On Phone Browser)

Navigate to:
```
http://YOUR_CONTABO_IP:5000/deploy
```

1. Login with your **admin** email + password
2. Tap **Run Deployment Audit** — wait ~10 seconds
3. All scores should be ≥90 (GREEN)
4. Tap **🚀 DEPLOY TO PRODUCTION**
5. Work through the step checklist — tap each step as you complete it

> The Deployment AI will WhatsApp you when the audit passes.

---

## STEP 5 — CONNECT DOMAIN (Namecheap — 3 min)

1. Open namecheap.com on phone → login
2. Tap **Domain List** → find `dunazoe.com` → tap **Manage**
3. Tap **Advanced DNS**
4. Edit/Add these records:

| Type | Host | Value |
|---|---|---|
| A Record | `@` | `YOUR_CONTABO_IP` |
| A Record | `www` | `YOUR_CONTABO_IP` |
| A Record | `api` | `YOUR_CONTABO_IP` |

5. Tap **Save** — DNS propagates in 1–48 hours

---

## STEP 6 — SSL CERTIFICATE (2 min after DNS propagates)

Back in Termius:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dunazoe.com -d www.dunazoe.com
```

Follow prompts → enter email → agree → done.

---

## STEP 7 — VERIFY LIVE (The Best Part)

Open Chrome on your phone:

```
https://dunazoe.com
```

Test in this order:
- [ ] Homepage loads (DUNAZOE logo, products grid)
- [ ] `/register` — create customer account
- [ ] `/login` — sign in with that account
- [ ] `/register?role=vendor` — create vendor account
- [ ] Install PWA prompt appears (Chrome → "Add to Home Screen")
- [ ] Admin login → go to `/deploy` → audit shows GREEN

**If all pass: YOU ARE LIVE. 🎉**

---

## EMERGENCY COMMANDS (Termius, if anything goes wrong)

```bash
# Restart everything
docker-compose down && docker-compose up -d

# Check gateway logs
docker logs dunazoe-gateway --tail 50

# Check a specific service
docker logs dunazoe-payment --tail 50

# See all container statuses
docker-compose ps

# Rollback to last git commit
git stash && git checkout f5ad07c && docker-compose up --build -d
```

---

## TAG THE RELEASE (Final Step)

```bash
git tag v1.0.0-rc1
git push origin v1.0.0-rc1
```

Done. DUNAZOE v1.0.0-rc1 is tagged and live.

---

## DEPLOYMENT AI — What It Does After You Deploy

The service at `/deployment` runs a **72-hour post-deployment monitor**:

| Hour | Check |
|---|---|
| 0–2h | Error rate, response times, gateway health |
| 2–24h | Payment webhook reliability |
| 24–48h | Database connection pool stability |
| 48–72h | Memory + uptime |

Any critical issue → WhatsApp alert to admin phone.

---

*Generated: 2026-06-15 — DUNAZOE CTO*  
*Dashboard: dunazoe.com/deploy*
