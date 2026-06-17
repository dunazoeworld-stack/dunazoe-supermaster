# DEPLOYMENT GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1

---

## PHASE 1: REPLIT (Do This First — Today)

### One-Tap Phone Deploy
1. Replit app → your repl → Preview → open `/deploy`
2. Login with admin credentials
3. Tap **🔍 Run Deployment Audit** → all scores ≥85
4. Tap **🚀 DEPLOY TO PRODUCTION**
5. Follow the 7 generated steps (tap each to mark done)

### Manual Workflow Setup
Create 10 workflows in Replit sidebar → Run:

```
Gateway:              cd apps/core/gateway && npm install && node index.js
Auth:                 cd apps/core/services/auth-service && npm install && node index.js
Payment:              cd apps/core/services/payment-service && npm install && node index.js
Order:                cd apps/core/services/order-service && npm install && node index.js
Product:              cd apps/core/services/product-service && npm install && node index.js
Notification:         cd apps/core/services/notification-service && npm install && node index.js
KYC:                  cd apps/core/services/kyc-service && npm install && node index.js
Deployment AI:        cd apps/core/services/deployment-ai-service && npm install && node index.js
Activation Engine:    cd apps/core/services/activation-engine && npm install && node index.js
Frontend:             cd apps/core/frontend && npm install && npm run build && npm start
```

### Validate
```bash
./smoke-tests/run.sh https://[repl].replit.app
# Expected: ✅ PASS (≥95%)
```

---

## PHASE 2: CONTABO VPS (After 50 Orders + 72h)

### First-Time Setup
```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh && usermod -aG docker $USER

# 2. Clone
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster /opt/dunazoe

# 3. Configure
cd /opt/dunazoe/apps/core
cp .env.docker.example .env.docker
nano .env.docker  # fill in all 17 secrets

# 4. Start (beta mode — 8 core services)
docker compose up --build -d

# 5. Verify
sleep 90 && curl http://localhost:3000/health
```

### SSL Setup
```bash
docker compose exec certbot certbot --nginx \
  -d dunazoe.com -d www.dunazoe.com \
  --non-interactive --agree-tos -m admin@dunazoe.com
```

### Subsequent Deploys
```bash
cd /opt/dunazoe
git pull origin release/v1-go-live
cd apps/core
# Only rebuild what changed:
docker compose up -d --build payment auth
```

---

## PHASE 3: DUNAZOE.COM (After Contabo Stable)

1. Renew Namecheap domain (dunazoe.com)
2. Namecheap → Advanced DNS → A Record `@` → Contabo IP
3. Namecheap → Advanced DNS → A Record `www` → Contabo IP
4. Wait 24h for DNS propagation
5. Run: `certbot --nginx -d dunazoe.com`
6. Verify: `curl https://dunazoe.com/health`

---

## DOCKER COMPOSE COMMANDS

```bash
# Start (beta mode — 8 services, uses override)
docker compose up -d

# Start (full 33 services)
docker compose --profile full up -d

# Start (beta standalone)
docker compose -f docker-compose.beta.yml up -d

# Stop all
docker compose down

# Restart one service
docker compose restart payment

# View logs
docker logs dunazoe-payment --tail 100 -f

# Check status
docker compose ps
```

---

*DUNAZOE Deployment Guide v1.0.0-RC1 — 2026-06-16*
