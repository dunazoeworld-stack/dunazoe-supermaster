# DEPLOYMENT GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-rc1  

---

## LEVEL 1 — REPLIT (Beta, Start Here)

### Step 1: Secrets
Replit sidebar → 🔐 Secrets → add each:
```
DATABASE_URL           postgresql://user:pass@host:5432/dunazoe_db
JWT_SECRET             [64-char hex: openssl rand -hex 32]
INTERNAL_SECRET        [64-char hex: openssl rand -hex 32]
PAYSTACK_SECRET_KEY    sk_live_...
PAYSTACK_PUBLIC_KEY    pk_live_...
PAYSTACK_WEBHOOK_SECRET  [from Paystack dashboard]
STRIPE_SECRET_KEY      sk_live_...
STRIPE_WEBHOOK_SECRET  whsec_...
REDIS_URL              redis://localhost:6379
RABBITMQ_URL           amqp://guest:guest@localhost:5672
CLOUDINARY_CLOUD_NAME  [your cloud name]
CLOUDINARY_API_KEY     [your key]
CLOUDINARY_API_SECRET  [your secret]
TERMII_API_KEY         [your key]
SHIPBUBBLE_API_KEY     [your key]
NODE_ENV               production
NEXT_PUBLIC_API_URL    https://[your-repl].replit.app
ALLOWED_ORIGINS        https://[your-repl].replit.app
```

### Step 2: Create Workflow — Gateway
```
Name: Gateway
Command: cd apps/core/gateway && npm install && node index.js
Port: 3000
```

### Step 3: Create Workflow — Frontend
```
Name: Frontend
Command: cd apps/core/frontend && npm install && npm run build && npm start
Port: 5000
```

### Step 4: Create Workflows — Core Services (priority order)
Create in this order (each: `cd apps/core/services/[name] && npm install && node index.js`):

| Priority | Service | Port |
|---|---|---|
| 1 | auth-service | 4001 |
| 2 | payment-service | 4015 |
| 3 | order-service | 4006 |
| 4 | product-service | 4004 |
| 5 | notification-service | 4017 |
| 6 | kyc-service | 4023 |
| 7 | deployment-ai-service | 4027 |
| 8 | activation-engine | 4033 |
| 9+ | remaining 25 services | 4002–4033 |

### Step 5: Deploy
Replit → Deploy → Autoscale → Configure → Deploy

### Step 6: Audit + Launch
1. Open `https://[your-repl].replit.app/deploy`
2. Login as admin
3. Run Deployment Audit → all scores ≥85
4. Press 🚀 Deploy

---

## LEVEL 2 — CONTABO VPS (After 50 orders + 72h stable)

### Prerequisites
- Contabo VPS: min 4GB RAM, 2 vCPU, 80GB SSD
- Ubuntu 22.04
- Docker + Docker Compose installed

### Install Docker on Contabo
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
newgrp docker
docker --version
```

### Deploy
```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster.git /opt/dunazoe
cd /opt/dunazoe/apps/core
cp .env.docker.example .env.docker
nano .env.docker  # fill in all 17 secrets
docker-compose up --build -d
sleep 90
curl http://localhost:3000/health
```

### SSL (Nginx + Certbot)
```bash
docker-compose exec certbot certbot --nginx \
  -d dunazoe.com -d www.dunazoe.com \
  --non-interactive --agree-tos -m admin@dunazoe.com
```

---

## STARTUP ORDER (Both Levels)

```
1. PostgreSQL (wait for healthy)
2. Redis (wait for healthy)
3. RabbitMQ (wait for healthy)
4. auth-service (other services need JWT validation)
5. payment-service
6. All remaining microservices
7. gateway (needs all services up)
8. frontend (needs gateway)
9. nginx (needs frontend + gateway)
```

---

*Generated: 2026-06-16 — DUNAZOE Chief DevOps Lead*
