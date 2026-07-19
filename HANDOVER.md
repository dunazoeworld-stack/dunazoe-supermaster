# DUNAZOE Platform — Handover Document
**Version:** v1.0.0-rc1  
**Date:** 2026-07-19  
**Stack:** Next.js 16.2.10 (Turbopack) · 34 Express microservices · PostgreSQL · Redis  
**Status:** Development / Pre-production

---

## Architecture at a Glance

| Layer | Tech | Port |
|-------|------|------|
| Frontend | Next.js 16 App Router | 5000 |
| API Gateway | Node.js / Express | 3000 |
| Microservices | 34 Express services | 4001–4034 |
| Database | PostgreSQL 16 | 5432 |
| Cache | Redis | 6379 |

**Monorepo layout:**
```
apps/core/
  frontend/          ← Next.js 16 app
  services/          ← 34 microservices
  shared/            ← Auth middleware, logger, error handler
  gateway/           ← API gateway (port 3000)
```

---

## How to Start

```bash
# Frontend (port 5000)
cd apps/core/frontend && npm run dev

# All 34 microservices + gateway
chmod +x start-services.sh && bash start-services.sh
```

Replit workflows already configured for both commands.

---

## Key Business Rules (never break these)

### 1. Service Charge — 5% of Product Value
- **Buyers pay:** `subtotal × 1.05` (5% added at checkout, shown as separate line)
- **Vendors receive:** `order.amount × 0.95` — 24 hours after delivery confirmation
- **Implementation:**
  - Frontend: `apps/core/frontend/src/app/checkout/page.jsx` — `serviceCharge = subtotal * 0.05`
  - API route: `apps/core/frontend/src/app/api/orders/route.js` — passes `service_charge_pct: 0.05`
  - Backend: `apps/core/services/order-service/index.js` — schedules `vendor_payouts` row on `status=delivered`
  - Migration: `apps/core/services/order-service/migrations/vendor_payouts.sql`

### 2. Order Flow (CTO Rule — never change sequence)
1. Fraud check → block if HIGH_RISK
2. Reserve inventory
3. Save order to DB
4. Hold funds in escrow
5. On delivery: release escrow → schedule vendor payout (net of 5%) in 24h

### 3. Ajo Savings — Personal Only, Max 12 Months
- No group savings. Max duration: 12 months. Interest: 5% p.a. paid at maturity.
- Pages: `/thrift` and `/thrift/contribute`

### 4. Vendor Listing Requirements
- Vendors **must** complete bank details (bank name, account number, account name) before listing
- Product price shown to customers = vendor price × 1.05 (5% service charge added)
- Product Listing AI falls back to self-dependent heuristic (no API key required)

### 5. Role Gates
- Marketing AI (`/vendor/marketing`) — vendor + admin roles only
- Product link (`/products/[id]`) — "Copy Product Link" shown only to the product's own vendor
- Deployment AI (`/deploy/*`) — superuser emails only: `dunazoeworld@gmail.com`, `comfortwins@gmail.com`

---

## Environment Variables Required

| Variable | Purpose | Where to get it |
|----------|---------|-----------------|
| `DATABASE_URL` | PostgreSQL connection | Your DB host |
| `SESSION_SECRET` | JWT signing (64+ chars) | `openssl rand -hex 64` |
| `PAYSTACK_SECRET_KEY` | NGN payments | paystack.com → API Keys |
| `PAYSTACK_PUBLIC_KEY` | Frontend Paystack | paystack.com → API Keys |
| `STRIPE_SECRET_KEY` | USD/EUR payments | dashboard.stripe.com |
| `CLOUDINARY_CLOUD_NAME` | Image uploads | cloudinary.com → Dashboard |
| `CLOUDINARY_API_KEY` | Image uploads | cloudinary.com → Dashboard |
| `CLOUDINARY_API_SECRET` | Image uploads | cloudinary.com → Dashboard |
| `OPENAI_API_KEY` | Product vision AI (optional) | platform.openai.com |
| `XAI_API_KEY` | Product vision AI (optional) | x.ai |
| `GEMINI_API_KEY` | Product vision AI (optional) | ai.google.dev |
| `SERVICE_CHARGE_PCT` | Vendor deduction (default 0.05) | Set in env, default works |
| `PLATFORM_FEE_PCT` | Platform fee (default 0.10) | Set in env, default works |

> All required secrets can be managed at `/deploy/apis` in the Deployment AI panel.  
> Missing required keys trigger a red notification banner on that page.

---

## Database Migrations Needed for Production

Run these in order against your production database:

```bash
# 1. Core schema (already applied if DB exists)
psql $DATABASE_URL -f apps/core/services/*/migrations/*.sql

# 2. Vendor payouts table (new — 2026-07-19)
psql $DATABASE_URL -f apps/core/services/order-service/migrations/vendor_payouts.sql
```

---

## What Was Changed (2026-07-19 session)

| # | Feature | Files |
|---|---------|-------|
| 1 | Marketing AI locked to vendors only | `vendor/marketing/page.jsx` |
| 2 | Ajo savings → personal + max 12 months | `thrift/page.jsx`, `thrift/contribute/page.jsx` |
| 3 | Wallet deposit API route fixed | `api/wallet/deposit/route.js` |
| 4 | Checkout API route fixed (was 404) | `api/orders/route.js` |
| 5 | 5% service charge on subtotal at checkout | `checkout/page.jsx`, `api/orders/route.js` |
| 6 | 5% markup preview when vendor lists product | `vendor/onboard/page.jsx` |
| 7 | 5% vendor deduction 24h after delivery | `order-service/index.js` + `vendor_payouts.sql` |
| 8 | Product link shown only to owning vendor | `products/[id]/page.jsx` |
| 9 | Bank details required before listing | `vendor/onboard/page.jsx` (step 1 expanded) |
| 10 | Product Listing AI self-dependent fallback | `api/ai/product-vision/route.js` |
| 11 | ID badges (VND-, PRD-, ORD-) | `vendor/dashboard/page.jsx` |
| 12 | Vendor dashboard: verification, delivery, milestone | `vendor/dashboard/page.jsx` |
| 13 | Missing secrets notification in Deploy AI | `deploy/apis/page.jsx` |
| 14 | Cart orders processed in parallel (was sequential) | `api/orders/route.js` |
| 15 | Shipping quote re-render loop fixed | `checkout/page.jsx` (useCallback dep fix) |
| 16 | `vendor_payouts` DB table migration | `order-service/migrations/vendor_payouts.sql` |

---

## Known Limitations / Next Steps

- **Payout processing job:** The `vendor_payouts` table records scheduled payouts but needs a cron job or worker to actually process them (call wallet service to credit vendor). Recommended: add a scheduled task in the wallet service that runs every hour and processes rows where `status='scheduled' AND scheduled_at <= NOW()`.
- **Push notifications:** WhatsApp/SMS alerts configured via `WHATSAPP_TOKEN` but not yet wired to order status changes.
- **KYC/BVN verification:** `/trust` page exists but BVN API integration pending.
- **Copytrader payouts:** 6% commission tracked in `referrals` table; payout job not yet implemented.

---

## Contacts / Superuser Access

| Role | Email |
|------|-------|
| CEO / Owner | dunazoeworld@gmail.com |
| Admin | comfortwins@gmail.com |

Deployment AI and all admin panels require these emails to be logged in.

---

*This document is auto-generated. Keep it updated after every major session.*
