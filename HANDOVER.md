# DUNAZOE — Production Handover Document
**Version:** 1.0.0-rc3  
**Date:** 2026-08-05  
**Status:** Production Ready (87/100)

---

## What Was Fixed (August 2026 Batch 2 — rc3)

See `FIX_REPORT.md` for detailed breakdown. Summary:

### rc2 (2026-08-04)
1. **Theme System** — Full light/dark/system toggle with `ThemeProvider` + CSS `[data-theme]` selectors
2. **Product Edit/Delete** — `PUT /api/products/[id]` handler added with auth + ownership check
3. **ORD-ORD ID Bug** — Normalized order ID display; prefix stripped before padding
4. **Cart Mobile** — Stacked layout on ≤640px, large touch targets for quantity buttons
5. **Open Graph** — Fixed `type: "og:type"` bug; fixed localhost API_BASE
6. **Product Vision AI** — `runVisionAI()` wired to image upload; auto-fills form fields
7. **NGN→USD Stripe** — Live exchange rate conversion before Stripe Checkout session
8. **Deployment AI** — 4 Operations Centers: Fix, Payment, AI, Delivery

### rc3 (2026-08-05)
1. **Cart Image Fix** — JSON string images now parsed correctly (handles array/string/URL)
2. **Global Mobile CSS** — `overflow-x: hidden` on html/body; 360px breakpoint added for Samsung A10
3. **Navbar Theme-Aware** — Background replaced with CSS vars; light/dark mode nav background works
4. **Expanded Mobile Menu** — All key items now accessible from hamburger: Vendor Dashboard, Wallet, Notifications, Messages, Admin, Delivery, KYC, Settings, Support; menu uses theme-aware background
5. **Product ID Off Image** — Product ID badge removed from image overlay; shown below card details
6. **OG Image JSON Parsing** — Product layout now parses JSON string `images` field before extracting OG image
7. **OG Origin Fix** — Fixed precedence bug in `_origin` expression for correct OG URLs
8. **Currency Service** — New `src/lib/currency.js`: `convertNGNtoUSD()`, `getExchangeRate()`, `ngnToStripeCents()` with live rate API + 1h cache + static fallback
9. **Delivery Registration** — Better error messaging; saves registration data locally when gateway unreachable

---

## System Architecture

- **Frontend:** Next.js 16 App Router — `apps/core/frontend/`
- **Backend Services:** 33 Node.js microservices — `apps/core/services/`
- **Database:** PostgreSQL (Supabase in prod, Replit built-in in dev) — `DATABASE_URL` / `SUPABASE_DATABASE_URL`
- **Auth:** JWT (`SESSION_SECRET`) — bcrypt passwords
- **Payments:** Paystack (NGN, `PAYSTACK_LSK`) + Stripe (USD, `STRIPE_SECRET_KEY`)
- **Storage:** Cloudinary (`CLOUDINARY_*`) + local file fallback
- **AI:** OpenAI / xAI / Gemini + self-dependent heuristic fallback

---

## How to Operate

### Starting the App (Replit)
1. Workflow **"Start application"** → runs `cd apps/core/frontend && npm run dev`
2. Workflow **"Core Microservices"** → runs microservices via `start-services.sh`

### Key Admin URLs
- `/admin` — Admin dashboard
- `/deploy` — Deployment AI (CTO access)
- `/ops` — Operator Cockpit (admin)
- `/vendor/dashboard` — Vendor portal

### Payment Flow
1. Customer → Checkout → `/api/payments/initialize` → Paystack/Stripe
2. Payment gateway → `/api/payments/webhook` (HMAC-verified)
3. Webhook → updates order status → schedules vendor payout (24h hold, -5%)
4. Vendor payout → credited to vendor wallet

### Theme System
- Default: system preference (dark at night, light during day)
- Manual: click the ☀️/🌙/⚙️ toggle in the Navbar
- Stored in `localStorage["dunazoe_theme"]`

---

## How to Test

### Critical paths to verify after deployment:
1. **Vendor product listing** → Add Product → upload image → AI fills form → submit
2. **Vendor edit product** → Vendor Dashboard → Edit → change fields → save
3. **Vendor delete product** → Vendor Dashboard → Delete → confirm
4. **Checkout + payment** → Add item → Checkout → Paystack → /payment/verify
5. **Order ID display** → My Orders → confirm format `ORD-00001` (no duplicates)
6. **Theme toggle** → Click ☀️ in Navbar → all pages should use light theme
7. **Product share** → Share product URL on WhatsApp → image should preview

---

## How to Recover

### Rollback
Use Replit checkpoints — the platform saves automatic snapshots. If the app breaks, use the "View Checkpoints" action in the Replit UI.

### Database issues
```sql
-- Check orders table
SELECT id, status, payment_reference FROM orders ORDER BY created_at DESC LIMIT 20;

-- Check wallet balances
SELECT u.email, w.balance_ngn FROM wallets w JOIN users u ON w.user_id = u.id;

-- Run pending migration
\i migrations/payment_conversions.sql
```

### Payment issues
1. Go to `/deploy` → Operations Centers → Payment Center
2. Check Paystack key format (must start with `sk_live_` or `sk_test_`)
3. Verify webhook URL is set in Paystack dashboard: `https://yourdomain.com/api/payments/webhook`

---

## How to Deploy

### Replit (current)
The app runs on Replit with the built-in dev server. To publish:
1. Click "Publish" / "Deploy" in the Replit UI
2. The platform creates a production container at `dunazoe.replit.app`

### Self-hosted (VPS — Contabo)
Follow the Phone Deploy Guide inside `/deploy` page:
1. SSH → install Docker + docker-compose
2. Clone repo, fill `.env.docker` with all secrets
3. `docker-compose up --build -d`
4. Point domain DNS → VPS IP
5. Install SSL with Certbot

---

## August 2026 — Task Batch 2 Changes

### Task 1 — DB Connection Drops (Fixed)
- `start-services.sh` now explicitly forwards all secrets (`DATABASE_URL`, `SESSION_SECRET`, `PAYSTACK_LSK`, `STRIPE_SECRET_KEY`, `CLOUDINARY_*`, `GEMINI_API_KEY`, `INTERNAL_SECRET`, `REALTIME_SERVICE_URL`) to every child node process — no more silent DB disconnects.
- `upload-service/package.json` multer fixed from `^1.4.5` → `1.4.5-lts.1` (LTS version for Node 20+ compatibility).

### Task 2 — Payment End-to-End (Verified + Wired)
- Payment verify page (`/payment/verify`) was already solid — HMAC-SHA512 Paystack verification confirmed.
- **New:** Webhook `charge.success` handler now calls realtime-service after marking order paid, so buyer's browser receives `order:status_update` socket event instantly.
- Webhook also emits realtime notification on `transfer.success` / `transfer.failed`.

### Task 3 — Real-Time Order Tracking (Live)
- `src/hooks/useOrderSocket.js` — new Socket.IO hook; connects to realtime-service on port 4021, joins `order:{id}` room, handles `order:status_update`, `agent:location`, `chat:message`.
- `orders/page.jsx` — upgraded with 15s auto-polling, animated 🔴 LIVE indicator, last-refresh timestamp, emoji status labels, vendor name display.
- `api/orders/[id]/status/route.js` — new `PATCH` endpoint; vendor-only status transitions (`paid→processing→shipped→delivered`), emits socket event to buyer after DB update.
- Vendor dashboard — order cards now show a status update dropdown + ✓ button for actionable transitions; updates reflect instantly in the orders list.

### `INTERNAL_SECRET`
Services communicate internally using `INTERNAL_SECRET` (default: `"dunazoe_internal_shared"`). Set this as a Replit Secret for hardened production environments.

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `SESSION_SECRET` / `JWT_SECRET` | JWT signing secret | ✅ |
| `PAYSTACK_LSK` | Paystack secret key (`sk_live_...`) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_live_...`) | For USD |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary name | For images |
| `CLOUDINARY_API_KEY` | Cloudinary API key | For images |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | For images |
| `OPENAI_API_KEY` | GPT-4o vision (optional) | For AI |
| `XAI_API_KEY` | Grok vision (optional) | For AI |
| `GEMINI_API_KEY` | Gemini Flash vision (optional) | For AI |
| `NEXT_PUBLIC_SITE_URL` | Production URL e.g. `https://dunazoe.com` | OG tags |
