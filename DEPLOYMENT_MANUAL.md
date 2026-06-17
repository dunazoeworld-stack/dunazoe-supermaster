# DEPLOYMENT MANUAL
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Date:** 2026-06-16  

---

## LEVEL 1 — REPLIT (Do This First)

### Step 1: Set Secrets
Replit → 🔐 Secrets → add from `HANDOVER_PACKAGE/SECRETS_TEMPLATE.md`

### Step 2: Create Workflows

**Gateway (most important — do first):**
```
Name: Gateway
Command: cd apps/core/gateway && npm install && node index.js
Port: 3000
```

**Core Services (one workflow each):**
```
Auth:              cd apps/core/services/auth-service && npm install && node index.js
Payment:           cd apps/core/services/payment-service && npm install && node index.js
Order:             cd apps/core/services/order-service && npm install && node index.js
Product:           cd apps/core/services/product-service && npm install && node index.js
Notification:      cd apps/core/services/notification-service && npm install && node index.js
KYC:               cd apps/core/services/kyc-service && npm install && node index.js
Deployment AI:     cd apps/core/services/deployment-ai-service && npm install && node index.js
Activation Engine: cd apps/core/services/activation-engine && npm install && node index.js
```

**Frontend (do last):**
```
Name: Frontend
Command: cd apps/core/frontend && npm install && npm run build && npm start
Port: 5000
```

### Step 3: Database Migration
In the Gateway or Auth service terminal:
```bash
psql $DATABASE_URL < apps/core/shared/schema.sql
psql $DATABASE_URL < apps/core/shared/schema-phase3-4.sql
psql $DATABASE_URL < apps/core/shared/schema-phase5-8.sql
psql $DATABASE_URL < apps/core/shared/schema-phase9.sql
psql $DATABASE_URL < apps/core/shared/schema-phase10.sql
```

### Step 4: Deploy
Replit → Deploy → Autoscale → Configure → Deploy

### Step 5: Verify
```bash
curl https://[repl].replit.app/health
# Expected: {"status":"ok","service":"gateway"}
```

---

## LEVEL 2 — CONTABO VPS (After 50 Orders + 72h)

### Requirements
- Ubuntu 22.04
- 4GB+ RAM, 2+ vCPU
- Docker + Docker Compose

### Install
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER && newgrp docker
```

### Deploy
```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster /opt/dunazoe
cd /opt/dunazoe/apps/core
cp apps/core/.env.docker.example .env.docker
nano .env.docker            # fill in all 17 secrets
docker compose up --build -d
sleep 90
curl http://localhost:3000/health
```

### Beta Mode (recommended — only 8 core services):
```bash
docker compose up              # uses docker-compose.override.yml automatically
```

### Full Stack:
```bash
docker compose --profile full up
```

---

## ENVIRONMENT VARIABLES (set ALL before starting)

```
DATABASE_URL          postgresql://user:pass@host:5432/dunazoe_db
JWT_SECRET            64-char hex
INTERNAL_SECRET       64-char hex (different from JWT)
PAYSTACK_SECRET_KEY   sk_live_...
PAYSTACK_PUBLIC_KEY   pk_live_...
PAYSTACK_WEBHOOK_SECRET
STRIPE_SECRET_KEY     sk_live_...
STRIPE_WEBHOOK_SECRET whsec_...
REDIS_URL             redis://localhost:6379
RABBITMQ_URL          amqp://guest:guest@localhost:5672
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
TERMII_API_KEY
SHIPBUBBLE_API_KEY
NODE_ENV              production
NEXT_PUBLIC_API_URL   https://dunazoe.com
```

---

## WEBHOOK REGISTRATION

**Paystack:**  
Dashboard → Settings → Webhooks → `https://dunazoe.com/payments/webhook/paystack`

**Stripe:**  
Dashboard → Developers → Webhooks → `https://dunazoe.com/payments/webhook/stripe`  
Events: `payment_intent.succeeded`, `payment_intent.payment_failed`

---

## VALIDATE DEPLOYMENT

```bash
./smoke-tests/run.sh https://[your-url]
```
Pass threshold: 95% (16 test cases)

---

*Generated: 2026-06-16 — DUNAZOE Chief DevOps Engineer*
