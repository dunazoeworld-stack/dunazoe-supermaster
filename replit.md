# DUNAZOE Platform — Project Overview & Handover

## What This Is
Nigeria's AI-powered super marketplace — 34-service Node.js/Next.js fintech platform.
Buy anything, sell everything, ship worldwide. Built for the Nigerian market with Paystack,
escrow protection, Ajo group savings, logistics AI, and a full vendor ecosystem.

**Version:** 2.1.0 (July 2026 — Batch 2 fixes)
**Architecture:** Frozen at v1.0.0-rc1 — never add business features without CTO sign-off
**Repo:** https://github.com/dunazoeworld-stack/dunazoe-supermaster

---

## Quick Access — Live URLs

| Environment | URL |
|---|---|
| **Dev preview** | https://5eb81cff-0872-4cc0-8b13-6006abfa922b-00-3cwds51n136l2.janeway.replit.dev |
| **Deployed (prod)** | https://dunazoeworld-stack.dunazoeworld.replit.app *(deploy to activate)* |

---

## Superuser / Operator Access

| Role | Email | Access |
|---|---|---|
| **Superuser 1** | `dunazoeworld@gmail.com` | Full `/ops` cockpit, all tabs |
| **Superuser 2** | `comfortwins@gmail.com` | Full `/ops` cockpit, all tabs |

**How to access the Ops Cockpit:**
1. Go to `/login`
2. Sign in as `dunazoeworld@gmail.com` or `comfortwins@gmail.com`
3. Navigate to `/ops`
4. You'll see tabs: Overview · Secrets · Webhooks · STAE · Product AI · Site Tests · Deploy · Distribution · Activation · **Services** · **Accounts**

### Ops Cockpit Tabs
- **Services** — All 34 microservices with port, tier, health status
- **Accounts** — Activate/deactivate any user/vendor/admin account
- **Activation** — Feature flags (turn features ON/OFF without redeploying)
- **STAE** — Smart Traffic & Auto-scaling Engine controls
- **Product AI** — AI demand forecasting and pricing analysis
- **Site Tests** — Live health checks against dev and deployed URLs
- **Deploy** — Deployment AI control panel and readiness score
- **Secrets** — Which env vars are configured vs missing

---

## Architecture

### Frontend (Next.js 16 — App Router)
```
apps/core/frontend/
├── src/app/               ← Pages (app router)
│   ├── api/               ← API routes (proxy + fallback)
│   ├── dashboard/         ← Buyer dashboard
│   ├── vendor/            ← Vendor dashboard, onboard, marketing
│   ├── ops/               ← Superuser cockpit
│   ├── checkout/          ← Cart → checkout → payment
│   ├── payment/verify/    ← Paystack callback handler
│   ├── wallet/            ← Digital wallet + withdraw
│   ├── orders/            ← Order tracking
│   └── ...
└── src/components/        ← Navbar, PageShell, ChatWidget, etc.
```

### Microservices (Node.js — 34 services)
```
apps/core/services/
├── gateway/               ← Port 3000 — API gateway + router
├── auth-service/          ← Port 4001 — JWT auth
├── user-service/          ← Port 4002 — User profiles
├── vendor-service/        ← Port 4003 — Vendor management
├── product-service/       ← Port 4004 — Product catalog
├── order-service/         ← Port 4006 — Order lifecycle
├── payment-service/       ← Port 4015 — Paystack + Stripe
├── upload-service/        ← Port 4020 — Cloudinary uploads
└── ... (26 more services)
```

---

## Service Charge Policy
- **Rate:** 5% of product subtotal (NOT delivery fee)
- **Who pays:** Buyer (shown as "Service charge" line in checkout)
- **Vendor payout:** Gross product price minus 5% service charge, credited within 24h of delivery
- **Implementation:** `checkout/page.jsx` shows the 5% line; `webhook/route.js` schedules vendor payout

---

## Payment Flows

### NGN Payments (Paystack)
1. Buyer adds to cart → checkout → `POST /api/orders`
2. Orders API tries gateway → if down, falls back to direct Paystack init
3. Buyer redirected to `payment_url` → pays on Paystack
4. Paystack webhook hits `POST /api/payments/webhook` → marks order paid
5. Buyer redirected to `/payment/verify?ref=DZ-xxx` → confirms payment

### International (Stripe) — REQUIRES STRIPE_SECRET_KEY
1. Same flow but `currency=USD` → routes to Stripe Checkout session
2. Set `STRIPE_SECRET_KEY` as a Replit Secret to activate

### Webhook URL for Paystack dashboard
```
https://dunazoeworld-stack.dunazoeworld.replit.app/api/payments/webhook
```

---

## Environment Variables & Secrets

### ✅ Configured
| Key | Type | Purpose |
|---|---|---|
| `PAYSTACK_LSK` | Secret | Paystack live secret key |
| `DATABASE_URL` | Secret | PostgreSQL connection string |
| `SESSION_SECRET` | Secret | JWT session signing |
| `CLOUDINARY_CLOUD_NAME` | Env | `dtx17sg1m` |
| `CLOUDINARY_API_KEY` | Env | `634966339231127` |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Env | Live Paystack public key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Env | Stripe test publishable key |
| `NEXT_PUBLIC_SUPABASE_URL` | Env | Supabase project URL |

### ❌ Missing — Must Add to Activate Features
| Key | Type | Purpose | Impact |
|---|---|---|---|
| `CLOUDINARY_API_SECRET` | **Secret** | Signs upload requests | **Image upload broken without this** |
| `STRIPE_SECRET_KEY` | **Secret** | Stripe server-side | International USD payments broken |

**To add secrets:** In Replit → Secrets tab → add key + value

---

## Running the Platform

### Start Frontend
```bash
cd apps/core/frontend && npm run dev
```
Or use the "Start application" workflow (port 5000).

### Start Microservices
```bash
bash start-services.sh
```
Or use the "Core Microservices" workflow.

### Service Health
- Gateway: `curl http://localhost:3000/health`
- Any service: `curl http://localhost:4001/health`
- Logs: `logs/services/<service-name>.log`

---

## Key Pages

| Page | URL | Auth |
|---|---|---|
| Homepage | `/` | Public |
| Products | `/products` | Public |
| Product detail | `/products/:id` | Public |
| Cart | `/cart` | Public |
| Checkout | `/checkout` | Auth required |
| Payment verify | `/payment/verify` | Public |
| Orders | `/orders` | Auth required |
| Dashboard | `/dashboard` | Auth required |
| Wallet | `/wallet` | Auth required |
| Ajo/Thrift | `/thrift` | Auth required |
| Vendor onboard | `/vendor/onboard` | Auth required |
| Vendor dashboard | `/vendor/dashboard` | Vendor only |
| Marketing AI | `/vendor/marketing` | Vendor/Admin only |
| **Ops Cockpit** | `/ops` | **Superuser only** |
| Admin | `/admin` | Admin only |
| Trust Score | `/trust` | Public |
| Track Order | `/track` | Public |

---

## Key API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Sign in |
| `/api/auth/register` | POST | Sign up |
| `/api/products` | GET/POST | List/create products |
| `/api/products/:id` | GET | Product detail |
| `/api/vendors` | GET | List vendors |
| `/api/orders` | GET/POST | List/create orders |
| `/api/orders/:id` | GET | Order detail |
| `/api/payments/initialize` | POST | Start payment (Paystack/Stripe) |
| `/api/payments/verify` | GET | Verify payment reference |
| `/api/payments/webhook` | POST | Paystack webhook (HMAC-signed) |
| `/api/wallet/balance` | GET | Wallet balance |
| `/api/wallet/deposit` | POST | Deposit funds |
| `/api/wallet` | POST | Withdraw/transfer |
| `/api/upload/product-image` | POST | Cloudinary image upload |
| `/api/logistics/quote` | POST | Shipping quotes (all 36 NG states) |
| `/api/ops/status` | GET | Ops cockpit status (superuser) |
| `/api/ops/accounts` | GET | List all accounts (superuser) |
| `/api/ops/accounts/:id/activate` | POST | Activate account (superuser) |
| `/api/ops/accounts/:id/deactivate` | POST | Deactivate account (superuser) |
| `/api/activation/features` | GET | Feature flags |

---

## Local Data Fallback
When the gateway/microservices are down, the frontend falls back to:
- `local_data/products.json` — product catalog cache
- `localStorage:dunazoe_products_store` — vendor-published products (client-side)
- Direct PostgreSQL queries via `DATABASE_URL` for wallet, orders, users

---

## Missing Microservices (No index.js)
These services appear in `start-services.sh` but don't have an implementation yet:
- `cart-service` (4008) — cart managed client-side instead
- `review-service` (4012)
- `chat-service` (4016) — chat widget uses REST polling via realtime-service
- `analytics-service` (4024)
- `marketing-service` (4025) — handled via AI route in frontend
- `ops-service` (4034) — ops handled directly in Next.js API routes
- `stae-service` (4035) — STAE service managed via `/api/stae` route

---

## User Preferences
- Never add business features outside of CTO sign-off (architecture frozen at v1.0.0-rc1)
- Always use gateway-first + direct DB/Paystack fallback pattern for all API routes
- Paystack for NGN, Stripe for USD — never mix
- Service charge is 5% of product subtotal only (NOT delivery fee)
- Vendor payout = product price - 5%, credited 24h after delivery confirmation
- Marketing AI is vendor/admin only — never visible to customer accounts
- All product IDs formatted as PRD-XXXXX, vendor IDs as VND-XXXXX, order IDs as ORD-XXXXX
