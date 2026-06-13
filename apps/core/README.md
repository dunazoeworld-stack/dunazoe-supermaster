# DUNAZOE OS v3 + Update #93

> **⚠️ This document predates Updates #94–#96.** For current status
> (31 services, beta-mode with 10 active services, kill switches, launch
> gate), see the repo root `README.md` and `docs/branching/migration-notes.md`.
> This file is retained as deep technical reference for the core services.

## Nigeria's AI-Powered Commerce + Fintech Operating System

```
╔══════════════════════════════════════════════════════════════════╗
║  DUNAZOE — Buy Anything · Sell Everything · Ship Worldwide       ║
║  CEO: Temidayo-Niwajuoluwa Folorunso | dunazoe.com               ║
╚══════════════════════════════════════════════════════════════════╝
```

## What is DUNAZOE OS?

A banking-grade, AI-powered Nigerian super e-commerce + fintech platform comparable to:
- **Commerce:** Shopify + Amazon Marketplace + Jumia
- **Fintech:** Moniepoint + OPay + Paystack
- **Thrift:** Ajo savings bank + Credit engine

## Architecture: 25 Microservices + API Gateway

| Service | Port | Purpose |
|---|---|---|
| gateway | 3000 | API Gateway — all traffic enters here |
| auth | 4001 | JWT auth, progressive throttling, impossible travel |
| user | 4002 | User profiles |
| vendor | 4003 | Vendor onboarding + type management |
| product | 4004 | Products, copytrading (6%), AI pricing |
| inventory | 4005 | Stock reservation with FOR UPDATE locks |
| order | 4006 | Order orchestrator (fraud→stock→escrow) |
| escrow | 4007 | Escrow state machine |
| fraud | 4008 | 6-rule fraud engine |
| wallet | 4009 | NGN+USD wallets, double-entry ledger |
| thrift | 4010 | Ajo savings bank |
| trust | 4011 | Trust score engine |
| loan | 4012 | Credit engine (max=total_contributed HARD RULE) |
| commission | 4013 | 2% delivery + 6% copytrader + ₦5k milestone |
| ai | 4014 | AI pricing, marketing copy, recommendations |
| payment | 4015 | Paystack + Stripe + webhook double-verification |
| dispute | 4016 | Dispute resolution |
| notification | 4017 | SMS→WhatsApp→Push→Email graceful fallback |
| logistics | 4018 | Haversine routing, Shipbubble, delivery proofs |
| feature-flag | 4019 | 15 feature flags, Redis-cached |
| upload | 4020 | Cloudinary + magic bytes validation |
| realtime | 4021 | Socket.IO + GPS tracking + chat |
| search | 4022 | PostgreSQL FTS + autocomplete |
| kyc | 4023 | Risk-based KYC Level 0–3 |
| reconciliation | 4024 | Ledger vs Paystack vs bank reconciliation |
| reliability | 4025 | Update #93 — AI reliability engine |

## Business Rules (Hardcoded — Never Override)

```
✅ max_loan_amount = total_contributed_amount (ABSOLUTE RULE)
✅ 5% customer charge + 5% vendor charge (not 10% flat)
✅ Stock reserved BEFORE payment (FOR UPDATE locks)
✅ Escrow locked IMMEDIATELY on dispute
✅ No cash on delivery (blocked at service + DB level)
✅ Delivery photo REQUIRED to mark delivered
✅ Outgoing funds ONLY to verified bank accounts (48h cooling-off)
✅ Ajo +10% surcharge if schedule > 14 days
✅ 2% thrift charge if loan ≥ 90% of contribution
✅ 6% copytrader markup (self-referral blocked)
✅ ₦5,000 milestone bonus every 100 deliveries
✅ Biweekly payouts (every 14 days)
✅ NEVER credit on webhook alone — always verify with provider API
✅ Idempotency key required on ALL money endpoints
```

## Quick Start

```bash
# 1. Clone and setup
cp .env.example .env
# Fill in: DATABASE_URL, JWT_SECRET, PAYSTACK_SECRET_KEY, etc.

# 2. Install all service dependencies
npm run install:all

# 3. Run database migrations
npm run schema

# 4. Start all 25 services + gateway
npm start

# OR Docker (recommended — 28 containers)
cp .env.example .env.docker
# Update docker hostnames (localhost → service names)
docker-compose up --build
```

## Testing

```bash
# Unit tests (business rules, fraud, ledger, trust)
npx jest tests/unit/core.test.js --verbose

# Integration tests (requires services running)
npx jest tests/integration/api.test.js --verbose --runInBand

# Security tests
npx jest tests/security/security.test.js --verbose

# E2E tests (requires frontend + backend running)
npx playwright test tests/e2e/dunazoe.spec.js

# Performance tests (requires k6)
k6 run tests/performance/load.test.js
```

## Monitoring

```bash
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3000 (admin/admin)
# RabbitMQ:   http://localhost:15672 (guest/guest)

# Platform health
curl http://localhost:3000/health

# Full status dashboard (CEO view)
curl http://localhost:4025/reliability/status-dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## Key Financial Controls (Update #93)

- **Double-entry ledger** — every money movement has debit + credit
- **Idempotency** — duplicate payments/orders automatically detected
- **Webhook double-verification** — NEVER credit on webhook alone
- **Reconciliation** — daily comparison: internal ledger vs Paystack vs bank
- **Anti-replay** — nonce + timestamp validation on all financial APIs
- **KYC gates** — withdrawal limits enforced by KYC level

## Update #93 Compliance: 47/52 requirements implemented (90.4%)

See `docs/UPDATE_93_COMPLIANCE.md` for full checklist.

---

*DUNAZOE OS — Built for Nigerian realities. Designed for global scale.*
*CEO: Temidayo-Niwajuoluwa Folorunso | dunazoe.com | Dunazoeworld@gmail.com*
