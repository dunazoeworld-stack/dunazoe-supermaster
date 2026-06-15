# OPERATOR GUIDE
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  
**Audience:** Complete beginner — phone-friendly  

---

## How to Restart the App

### If using Replit (Frontend only)

1. Open Replit on your phone
2. Tap **Run** (the ▶ button)
3. Wait 30–60 seconds
4. Open `https://dunazoe.com` — should be live

### If using VPS (Full stack)

1. Open **Termius** or **JuiceSSH** on your phone
2. Connect to your server
3. Type these commands one at a time:

```bash
cd dunazoe-supermaster/apps/core
docker-compose restart
```

Wait 60 seconds, then check: `curl http://localhost:3000/health`

---

## How to Rollback

If something breaks badly, go back to the safe version:

```bash
cd dunazoe-supermaster
git checkout f5ad07c
cd apps/core
docker-compose down
docker-compose up --build -d
```

Or in Replit: tap **History** → find checkpoint `82e538ab` → tap **Restore**.

---

## How to Update (Deploy New Code)

```bash
# On your server
cd dunazoe-supermaster
git pull origin main
cd apps/core
docker-compose down
docker-compose up --build -d
```

**Always pull from `main` for updates.**  
**Never edit files directly on the server — make changes in Replit, commit, then pull.**

---

## How to Monitor

### Check if everything is running

```bash
docker-compose ps
```

All services should show `Up`. If any show `Exit`, restart that service:

```bash
docker-compose restart <service-name>
# Example:
docker-compose restart gateway
docker-compose restart auth
```

### Check for errors

```bash
# Gateway errors
docker logs dunazoe-gateway --tail 50

# Any service errors
docker logs dunazoe-auth --tail 50

# All logs live
cd apps/core && npm run logs
```

### Admin dashboard (phone browser)

1. Open `https://dunazoe.com/admin`
2. Log in with your admin account
3. View: users, orders, vendors, payments, system health

---

## How to Deploy (First Time)

This is the full first-time setup on a fresh server. Do this once.

**Step 1 — Get a server**
- Buy a Contabo VPS or DigitalOcean Droplet (minimum 4GB RAM)
- Note your server IP address

**Step 2 — Connect to server**
- Install **Termius** on your phone
- Add new host: your server IP, username `root`, your password

**Step 3 — Install Docker**
```bash
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y
```

**Step 4 — Get the code**
```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster.git
cd dunazoe-supermaster/apps/core
cp .env.example .env.docker
nano .env.docker
```
Fill in all real values (database URL, JWT secret, Paystack key, etc.)

**Step 5 — Start everything**
```bash
docker-compose up --build -d
```
Wait 2–3 minutes. Then:
```bash
curl http://localhost:3000/health
```
Should return: `{"status":"ok"}`

**Step 6 — Point domain**
Follow `NAMECHEAP_FINAL.md` — update DNS in Namecheap dashboard.

**Step 7 — Get SSL**
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d dunazoe.com -d www.dunazoe.com -d api.dunazoe.com
```

**Done.** Open `https://dunazoe.com` on your phone.

---

## Common Problems and Fixes

| Problem | Fix |
|---|---|
| Site not loading | Check DNS — `nslookup dunazoe.com` should show your IP |
| "JWT_SECRET required" error | Set `JWT_SECRET` in your `.env.docker` — restart |
| Database connection error | Check `DATABASE_URL` in `.env.docker` — verify Postgres is running |
| Payment not working | Check `PAYSTACK_SECRET_KEY` in `.env.docker` |
| Images not showing | Check `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Service keeps restarting | Run `docker logs dunazoe-<service> --tail 100` to see the error |

---

## Emergency Contact

If you cannot fix an issue:
- Open GitHub Issues: `https://github.com/dunazoeworld-stack/dunazoe-supermaster/issues`
- Post the error message from `docker logs dunazoe-gateway --tail 50`

---

*Generated: 2026-06-15 — DUNAZOE CTO*
