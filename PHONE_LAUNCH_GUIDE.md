# PHONE LAUNCH GUIDE
**DUNAZOE v1.0.0-rc1 — Samsung A10 / Infinix / Any Android**  
**Date:** 2026-06-15  

This guide is written specifically for low-RAM Android phones.  
Every step is tested to work on Chrome, Termius, and the Replit app.

---

## APPS TO INSTALL (all free)

| App | Download | Use |
|---|---|---|
| **Termius** | Play Store → "Termius SSH client" | SSH into Contabo VPS |
| **GitHub** | Play Store → "GitHub" | Verify push |
| **Namecheap** | browser → namecheap.com | DNS update |
| **Chrome** | Already installed | Test the live site |
| **Replit** | Play Store → "Replit" OR browser → replit.com | Push code |

---

## PHASE 1 — PUSH CODE FROM PHONE (5 min)

### Option A: Replit App
1. Open Replit app → open DUNAZOE project
2. Tap **⋮ menu** → **Version Control**
3. Tap **New Branch** → type `release/v1-go-live`
4. Tap **Stage All** → **Commit** → `DUNAZOE RC1 FINAL HANDOVER`
5. Tap **Push**

### Option B: Replit Browser (Chrome)
1. Open `replit.com` in Chrome → open your DUNAZOE repl
2. Same steps as above via left panel

### Verify on GitHub app:
- Open GitHub app → `dunazoe-supermaster`
- Branch `release/v1-go-live` should appear ✅

---

## PHASE 2 — SET SECRETS IN REPLIT (5–10 min)

1. In Replit → tap 🔐 **Secrets** (left panel or ⋮ menu)
2. Add each secret one by one:

```
DATABASE_URL
JWT_SECRET          → openssl rand -hex 32 (run in Termius first)
INTERNAL_SECRET     → openssl rand -hex 32
PAYSTACK_SECRET_KEY → from paystack.com/dashboard
PAYSTACK_PUBLIC_KEY → from paystack.com/dashboard  
STRIPE_SECRET_KEY   → from dashboard.stripe.com
REDIS_URL           → redis://your-redis-host:6379
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
TERMII_API_KEY
SHIPBUBBLE_API_KEY
NODE_ENV            → production
NEXT_PUBLIC_API_URL → https://dunazoe.com
```

💡 **Tip for Samsung A10 / Infinix:** If the secrets panel is slow, reload the page. Use landscape mode for wider input fields.

---

## PHASE 3 — SSH INTO CONTABO FROM TERMIUS (15 min)

### Connect:
1. Open Termius → **+** → **New Host**
2. Fill in:
   ```
   Alias:    DUNAZOE Production
   Hostname: YOUR_CONTABO_IP
   Username: root
   Password: YOUR_CONTABO_VPS_PASSWORD
   Port:     22
   ```
3. Tap **Save** → tap **Connect**

### If connection fails:
- Check VPS is running in Contabo control panel
- Try switching from WiFi to mobile data

### Generate secure secrets (run this first):
```bash
echo "JWT_SECRET=$(openssl rand -hex 32)"
echo "INTERNAL_SECRET=$(openssl rand -hex 32)"
```
Copy the output → paste into Replit Secrets.

---

## PHASE 4 — DEPLOY ON CONTABO (20 min)

Copy-paste each block into Termius:

**4A — Install Docker:**
```bash
apt update -y && apt install -y docker.io docker-compose git curl
systemctl enable docker && systemctl start docker
docker --version
```

**4B — Clone repo:**
```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster /opt/dunazoe
cd /opt/dunazoe/apps/core
```

**4C — Create env file:**
```bash
cp .env.example .env.docker
```

Edit it:
```bash
nano .env.docker
```
- Use volume buttons to scroll on Termius mobile
- Replace ALL placeholder values with real ones
- `Ctrl+X` → `Y` → `Enter` to save

**4D — Run database migrations:**
```bash
export DATABASE_URL="postgresql://dunazoe_user:your_password@localhost:5432/dunazoe_db"
psql $DATABASE_URL -f shared/schema.sql
psql $DATABASE_URL -f shared/schema-phase3-4.sql
psql $DATABASE_URL -f shared/schema-phase5-8.sql
psql $DATABASE_URL -f shared/schema-phase9.sql
psql $DATABASE_URL -f shared/schema-phase10.sql
```

**4E — Start all services:**
```bash
docker-compose up --build -d
```

> ⏳ First build = 10–15 min on a new VPS. Leave Termius open. Screen won't timeout if you tap it occasionally.

**4F — Check all running:**
```bash
docker-compose ps | grep -v "Up" | grep -v "NAME"
```
Should show nothing (all containers are Up).

**4G — Test gateway:**
```bash
curl http://localhost:3000/health
```
Expected: `{"status":"ok","services":34}` (32 + activation-engine + dunazoe-express)

---

## PHASE 5 — DNS ON NAMECHEAP (3 min)

1. Open Chrome → `ap.www.namecheap.com` → login
2. Tap **Domain List** → find `dunazoe.com` → **Manage**
3. Tap **Advanced DNS**
4. Add/Edit:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `YOUR_CONTABO_IP` | Auto |
| A Record | `www` | `YOUR_CONTABO_IP` | Auto |

5. Tap **Save All Changes** ✅

DNS takes 1–48 hours. While waiting, test on IP directly.

---

## PHASE 6 — SSL CERTIFICATE (2 min — after DNS propagates)

Back in Termius:
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d dunazoe.com -d www.dunazoe.com --non-interactive --agree-tos -m admin@dunazoe.com
```

---

## PHASE 7 — OPEN DEPLOYMENT AI DASHBOARD

In Chrome on your phone:
```
https://dunazoe.com/deploy
```

1. Login with your admin credentials
2. Tap **Run Deployment Audit**
3. Wait ~15 seconds for scores
4. If all scores GREEN → tap **🚀 DEPLOY TO PRODUCTION**
5. Work through the step checklist

---

## PHASE 8 — TEST THE LIVE SITE (From Your Phone)

Open Chrome → `dunazoe.com`:

| Test | What to do | Expected |
|---|---|---|
| Homepage | Open `dunazoe.com` | Logo + products grid visible |
| Register | Open `/register` | Form appears, submit works |
| Login | Open `/login` | JWT stored, redirect works |
| Vendor register | Open `/register?role=vendor` | Business name field appears |
| PWA install | Chrome menu → "Add to Home Screen" | DUNAZOE icon appears on homescreen |
| Activation Engine | Open `/activation/features` | Feature list in JSON |
| Deploy dashboard | Open `/deploy` | Audit scores visible |

---

## PHASE 9 — BETA CONTROL (Do NOT open publicly yet)

Invite **10 vendors only**:
1. Send each a personal invite link: `dunazoe.com/register?role=vendor&invite=YOURCODE`
2. Monitor in Termius: `docker logs dunazoe-gateway --tail 50 --follow`
3. Check activation engine: `curl https://dunazoe.com/activation/features`

**Success criteria before public launch:**
- [ ] 50 orders placed
- [ ] 20 payouts processed
- [ ] 0 critical incidents in 72 hours
- [ ] Activation Engine auto-promotes wallet (after 100 users)

---

## QUICK TROUBLESHOOT (Termius commands)

```bash
# A service crashed?
docker-compose ps
docker logs dunazoe-[service] --tail 40

# Restart everything
docker-compose restart

# Full restart
docker-compose down && docker-compose up -d

# Check disk space (if build fails)
df -h

# Check RAM
free -m
```

---

## BATTERY-SAVING TIPS FOR LONG DEPLOY SESSIONS

- Keep Termius in **Split Screen** with Chrome (Android multi-window)
- On Infinix: Settings → Battery → App Battery Manager → Termius → **No restrictions**
- On Samsung A10: Settings → Apps → Termii/Termius → Battery → **Unrestricted**
- Keep charger plugged in during docker-compose build

---

## WHAT DEPLOYMENT AI DOES AFTER LAUNCH

The `/deployment` service monitors for 72 hours automatically:
- Every 30 min: checks error rates, payment webhook reliability
- Auto-WhatsApp alert if error_count > 5 in 1 hour
- Check status anytime: `dunazoe.com/deploy` → Last Deployment tile

---

*Generated: 2026-06-15 — DUNAZOE Chief Release Engineer*  
*For: Samsung A10, Infinix, Chrome, Replit App, Termius*
