# PHONE DEPLOYMENT GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Phase:** 33 — Phone Deploy Mode  

---

## WHAT YOU CAN DO FROM YOUR PHONE

✅ Deploy to production (one tap)  
✅ Rollback (one tap)  
✅ Run audit (one tap)  
✅ Check 14 service health statuses  
✅ View deployment logs  
✅ See release history  
✅ Copy GitHub push commands  
✅ Monitor live traffic  
✅ Check credit usage  
✅ View go-live checklist  

---

## DEPLOY MODE (Android / iOS)

### Option A: Replit App (Easiest)
1. Download Replit from Play Store / App Store
2. Open your DUNAZOE repl
3. Navigate to preview → `/deploy`
4. Login with admin credentials
5. Tap **🔍 Run Audit** → wait (~30 seconds)
6. Tap **🚀 DEPLOY TO PRODUCTION**
7. Follow the step checklist (tap each to mark done)

### Option B: Browser (Any Phone)
1. Open Chrome / Safari
2. Go to `https://[your-repl].replit.app/deploy`
3. Login → Audit → Deploy
4. Works on any 4G connection

---

## ONE-TAP ACTIONS FROM PHONE

| Action | URL | Tap |
|---|---|---|
| Deploy | `/deploy` | 🚀 DEPLOY button |
| Rollback | `/deploy` → API | POST /deployment/rollback |
| Restart service | Replit app → Workflows | Restart workflow |
| View monitor | `/deploy/monitor` | Auto-refreshes |
| Run smoke tests | Replit Shell | `./smoke-tests/run.sh` |
| Check health | `/deploy/health` | Refresh button |

---

## CONTABO DEPLOY FROM PHONE (Using Termius App)

### Install Termius
Download: play.google.com → search "Termius"

### Connect to Contabo VPS
1. Termius → New Host
2. Host: `[your-contabo-ip]`
3. Port: 22
4. Username: root
5. Password: `[your-contabo-password]`
6. Save → Connect

### First Time Deploy
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repo
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster /opt/dunazoe

# Setup env
cd /opt/dunazoe/apps/core
cp apps/core/.env.docker.example .env.docker
nano .env.docker    # tap to edit, fill in secrets

# Start (beta mode — 8 services only)
docker compose up -d

# Verify
curl http://localhost:3000/health
```

### Subsequent Deploys (After Code Update)
```bash
cd /opt/dunazoe
git pull origin release/v1-go-live
cd apps/core
docker compose up -d --build payment auth
# Only rebuild changed services
```

---

## MONITOR FROM PHONE (24/7)

Bookmark these URLs on your home screen:
- `https://[url]/deploy/monitor` — live health
- `https://[url]/deploy/status` — quick status
- `https://[url]/deploy/checklist` — go/no-go

**Add to home screen:**
1. Chrome → share button → "Add to Home Screen"
2. Name: "DUNAZOE Monitor"
3. Now works like an app

---

## EMERGENCY ROLLBACK FROM PHONE

### Method 1: Replit (2 minutes)
1. Open Replit app
2. Your repl → History
3. Find checkpoint `a20abd7c`
4. Tap Restore

### Method 2: API (from phone browser)
```
POST [url]/deployment/rollback
Authorization: Bearer [your-admin-token]
Content-Type: application/json
{"reason": "P0 emergency"}
```

### Method 3: Termius (5 minutes)
```bash
cd /opt/dunazoe/apps/core
docker compose down
git checkout v1.0.0
docker compose up -d
```

---

*Generated: 2026-06-16 — DUNAZOE Mobile Operations Lead*
