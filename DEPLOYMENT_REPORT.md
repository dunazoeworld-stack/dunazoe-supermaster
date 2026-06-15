# DEPLOYMENT REPORT
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 7 — Deployment  

---

## Deployment Target

**Recommended path:** Contabo VPS (lowest cost, full Docker Compose control)  
**Alternative:** Any Linux VPS with Docker + Docker Compose support  
**Replit deployment:** Replit Reserved VM — suitable for the Next.js frontend only (not the full 31-service stack)

---

## Deployment Architecture

```
Internet
    │
    ▼
Nginx (reverse proxy + SSL termination)
    │
    ├─► Next.js frontend          :3001
    └─► API Gateway (Express)     :3000
            │
            ├─► auth-service      :4001
            ├─► user-service      :4002
            ├─► vendor-service    :4003
            ├─► product-service   :4004
            ├─► ... (27 more)
            └─► admin-override    :4029
```

---

## Deployment Steps (VPS — Docker Compose)

```bash
# 1. SSH into VPS
ssh root@<your-vps-ip>

# 2. Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# 3. Clone repo
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster.git
cd dunazoe-supermaster/apps/core

# 4. Set environment
cp .env.example .env.docker
nano .env.docker  # Fill in all real values

# 5. Run schema migrations
docker-compose up postgres -d
sleep 10
for f in shared/schema.sql shared/schema-phase3-4.sql shared/schema-phase5-8.sql shared/schema-phase9.sql shared/schema-phase10.sql; do
  docker exec dunazoe-postgres psql -U dunazoe_user -d dunazoe_db -f /docker-entrypoint-initdb.d/$f
done

# 6. Start all services
docker-compose up --build -d

# 7. Verify gateway health
curl http://localhost:3000/health
```

---

## Replit Deployment (Frontend Preview Only)

For serving the Next.js frontend via Replit Reserved VM:

1. Create workflow: **"Start Frontend"**
   - Command: `cd apps/core/frontend && npm install && npm run dev`
   - Port: `5000`
2. Set all `NEXT_PUBLIC_*` secrets in Replit Secrets
3. Click **Deploy** → Reserved VM

> The full 31-service microservice stack requires a VPS — it cannot run on Replit free tier.

---

## Health Checks

| Check | Endpoint | Expected |
|---|---|---|
| Gateway health | `GET /health` | `{"status":"ok"}` |
| Auth service | `GET /auth/health` | `{"status":"ok"}` |
| HTTPS | `curl -I https://dunazoe.com` | `HTTP/2 200` |
| Environment vars | Gateway startup | No `JWT_SECRET` error thrown |

---

## Rollback Procedure

```bash
# Stop current containers
docker-compose down

# Restore previous image tag or git checkout
git checkout f5ad07c
docker-compose up --build -d
```

---

## Post-Deployment Verification

- [ ] `GET https://dunazoe.com` → 200 OK
- [ ] `GET https://dunazoe.com/api/health` → `{"status":"ok"}`
- [ ] HTTPS certificate valid (Let's Encrypt via Certbot or Nginx)
- [ ] No `JWT_SECRET` error in gateway logs
- [ ] Login page loads and accepts credentials
- [ ] Vendor dashboard accessible

---

*Generated: 2026-06-15 — DUNAZOE Release Manager (Replit 4)*
