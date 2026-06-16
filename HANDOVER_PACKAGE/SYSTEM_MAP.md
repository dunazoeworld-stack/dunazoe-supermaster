# DUNAZOE SYSTEM MAP
**Version:** v1.0.0-rc1  
**Date:** 2026-06-16  

---

## ARCHITECTURE OVERVIEW

```
USER (Browser / Mobile)
        ↓ HTTPS
  dunazoe.com:443  (Nginx → Certbot SSL)
        ↓
  Frontend   :5000  (Next.js 14 App Router)
        ↓
  Gateway    :3000  (Express Proxy — 33 routes)
        ↓
  ┌─────────────────────────────────────────────┐
  │           33 MICROSERVICES                  │
  │   auth:4001    user:4002    vendor:4003     │
  │   product:4004 inventory:4005 order:4006   │
  │   escrow:4007  fraud:4008   wallet:4009    │
  │   thrift:4010  trust:4011   loan:4012      │
  │   commission:4013 ai:4014   payment:4015   │
  │   dispute:4016 notification:4017           │
  │   logistics:4018 flags:4019 upload:4020    │
  │   realtime:4021 search:4022 kyc:4023       │
  │   reconciliation:4024 reliability:4025     │
  │   security-ai:4026 deployment-ai:4027      │
  │   self-delivery:4028 admin-override:4029   │
  │   social-media:4030 payments-ai:4031       │
  │   dunazoe-express:4032                     │
  │   activation-engine:4033                   │
  └─────────────────────────────────────────────┘
        ↓
  ┌──────────────────────────────────┐
  │         INFRASTRUCTURE           │
  │  PostgreSQL:5432 (via PgBouncer) │
  │  Redis:6379 (cache + sessions)   │
  │  RabbitMQ:5672 (event bus)       │
  │  Prometheus:9090 + Grafana:3100  │
  └──────────────────────────────────┘
```

---

## PORT REFERENCE

| Service | Port | Purpose |
|---|---|---|
| nginx | 80, 443 | Reverse proxy, SSL |
| frontend | 5000 | Next.js SSR |
| gateway | 3000 | API proxy router |
| auth | 4001 | JWT auth, sessions |
| user | 4002 | User profiles |
| vendor | 4003 | Vendor registration, KYB |
| product | 4004 | Product catalogue |
| inventory | 4005 | Stock management |
| order | 4006 | Order lifecycle |
| escrow | 4007 | Payment escrow hold/release |
| fraud | 4008 | Fraud detection |
| wallet | 4009 | NGN digital wallet |
| thrift | 4010 | Ajo (savings club) — OFF |
| trust | 4011 | Vendor trust scores |
| loan | 4012 | Micro-loans — OFF |
| commission | 4013 | Platform commission |
| ai | 4014 | General AI assistant |
| payment | 4015 | Paystack + Stripe |
| dispute | 4016 | Dispute resolution |
| notification | 4017 | SMS (Termii) + email |
| logistics | 4018 | Shipbubble + DHL |
| flags | 4019 | Feature flag cache |
| upload | 4020 | Cloudinary uploads |
| realtime | 4021 | WebSocket (Socket.IO) |
| search | 4022 | Product search + Redis |
| kyc | 4023 | ID verification |
| reconciliation | 4024 | Financial reconciliation |
| reliability | 4025 | Circuit breakers, health |
| security-ai | 4026 | Security monitoring AI |
| deployment-ai | 4027 | Deploy / rollback / audit |
| self-delivery | 4028 | Vendor self-courier |
| admin-override | 4029 | Admin manual override |
| social-media | 4030 | Social commerce |
| payments-ai | 4031 | Payment optimization AI |
| dunazoe-express | 4032 | Logistics aggregator |
| activation-engine | 4033 | Feature activation lifecycle |
| pgbouncer | 5433 | DB connection pooler |
| rabbitmq | 5672, 15672 | Event bus + admin UI |
| prometheus | 9090 | Metrics |
| grafana | 3100 | Dashboards |

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React 18, App Router |
| Services | Node.js 20 + Express |
| Database | PostgreSQL 16 + PgBouncer |
| Cache | Redis 7.2 |
| Queue | RabbitMQ 3.13 |
| Payments | Paystack (NGN), Stripe (USD) |
| SMS | Termii |
| Storage | Cloudinary |
| Monitoring | Prometheus + Grafana |
| Proxy | Nginx 1.26 |
| SSL | Certbot (Let's Encrypt) |
| Auth | JWT (HS256, 7d expiry) |
| Deployment | Docker Compose (host network) |

---

## HEALTH ENDPOINTS

All services expose `GET /health` returning `{ "status": "ok", "service": "...", "port": ... }`.

Test all services:
```bash
for port in 3000 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 \
  4011 4012 4013 4014 4015 4016 4017 4018 4019 4020 4021 4022 4023 \
  4024 4025 4026 4027 4028 4029 4030 4031 4032 4033; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | grep -o '"ok"' || echo "DOWN"
done
```

---

## KEY ADMIN ROUTES

| Route | Purpose |
|---|---|
| `/deploy` | Deployment AI dashboard |
| `/deploy/monitor` | Real-time production monitor (30s poll) |
| `/activation/features` | List all 15 feature states |
| `/deployment/audit` | Pre-deploy audit (POST) |
| `/deployment/deploy` | Execute deploy (POST) |
| `/deployment/rollback` | Rollback (POST) |
| `/deployment/monitor` | Health API (GET) |

---

*Generated: 2026-06-16 — DUNAZOE Chief Platform Architect*
