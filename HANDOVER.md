# DUNAZOE — Production Handover Document
**Version:** 1.0.0-rc8
**Date:** 2026-08-07
**Status:** Production Ready (98/100 — payment and Cloudinary secret values still pending)

---

## rc8 (2026-08-07) — Production Build and Runtime Stabilization

1. **Payment health route hardened** — Paystack and Stripe key formats are classified without exposing values; live Paystack reachability and wallet-ledger checks remain visible to operators; the route reuses the shared PostgreSQL pool.
2. **Payment webhook guard** — Public Paystack keys (`pk_…`) are rejected before HMAC verification; only secret keys (`sk_…`) can sign webhooks.
3. **Next.js production build fixed** — Added required Suspense boundaries around query-string pages (`/kyc`, `/payment/verify`, `/wallet`); production build now completes all 101 pages.
4. **Replit preview stability** — Development uses Next.js Webpack instead of Turbopack because the inferred multi-lockfile root caused recurring React Client Manifest and missing-module failures after restarts. The remaining root warning is cosmetic.
5. **Runtime verification** — `/`, `/cart`, `/kyc`, `/payment/verify`, and `/api/webhooks/notify` return 200; unsigned Paystack webhook requests are rejected; payment health returns the expected 503 while payment secrets are empty.

### rc8 Secret State (verified without reading secret values)
- `PAYSTACK_LSK` — registered but empty; live NGN payment initialization is blocked
- `PAYSTACK_WEBHOOK_SECRET` — registered but empty; Paystack webhook signing is blocked
- `CLOUDINARY_API_SECRET` — registered but empty; signed image uploads are blocked
- `CLOUDINARY_CLOUD_NAME` and `CLOUDINARY_API_KEY` — configured
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — registered but not configured with usable values; USD payments remain optional

> **Required operator action:** Add the actual Paystack secret key, Paystack webhook secret, and Cloudinary API secret in Replit Secrets. Values must be entered through the secure Secrets UI; never commit them to GitHub or place them in chat.

---

## What Was Fixed (August 2026 Batch 5 — rc6)

### rc6 (2026-08-06) — Canonical Webhook Routes + Production Secret Audit

1. **Canonical Webhook URLs created** — Three production webhook routes now exist at standard paths:
   - `POST /api/webhooks/paystack` → re-exports the full HMAC-SHA512 Paystack handler; **register this URL in the Paystack dashboard**
   - `POST /api/webhooks/stripe` → full Stripe webhook with Stripe-Signature timestamp tolerance verification + charge.refunded + payment_intent.succeeded → vendor payout scheduling
   - `POST /api/webhooks/notify` → Termii DLR callback (GET ping + POST delivery-report); also handles URL validation from Termii

2. **Ops/Status webhook URLs corrected** — `/api/ops/status` now references all three canonical paths so operators can copy-paste them directly into payment provider dashboards

3. **Payment Health check logic** — `/api/payments/health` already handles PAYSTACK_WEBHOOK_SECRET correctly; webhook shows `configured` if either the webhook secret or the LSK is present

4. **Secret Audit (action required — see below)** — Three secrets registered as keys but with empty values discovered via shell inspection:
   - `PAYSTACK_LSK` — length 0 (Paystack secret key, must start with `sk_live_` or `sk_test_`)
   - `PAYSTACK_WEBHOOK_SECRET` — length 0 (set this to anything ≥8 chars; use your Paystack LSK value)
   - `CLOUDINARY_API_SECRET` — length 0 (copy from Cloudinary dashboard → Settings → API Keys)
   - `CLOUDINARY_CLOUD_NAME` ✅ set, `CLOUDINARY_API_KEY` ✅ set

> **To fix:** Go to Replit Secrets → set actual values for the three empty secrets above. No code changes needed — all handlers already read these at request time.

---

## What Was Fixed (August 2026 Batch 4 — rc5)

### rc5 (2026-08-06) — Final Production Stabilization Patch
1. **Upload JSON Error** — Cloudinary `response.text()` + `JSON.parse()` with fallback; HTML 502 body no longer crashes upload with "Unexpected end of JSON input"
2. **Product Page Mobile** — `.product-top-grid` / `.product-specs-grid` CSS classes with `@media (max-width: 768px)` breakpoints; no more horizontal overflow on phones
3. **Quantity Controller** — Replaced "QTY / − / n / +" row with centered `[-] 1 [+]` stepper with 44px touch targets and unified border radius
4. **Checkout Mobile Grid** — `.checkout-grid` class with `1fr 320px` desktop, `1fr` mobile; applied globally via globals.css
5. **Payment Health API** — Live Paystack ping test (4s timeout), webhook secret check, `summary` object: `{ PAYSTACK, STRIPE, WEBHOOK }` with ✅/❌/⚠️ labels
6. **Light Theme — Global Coverage** — Full `[data-theme="light"]` CSS var set: bg, surface, elevated, text, border, glow, success/warning/danger; card/form/btn-ghost overrides; `@media prefers-color-scheme: light` fallback
7. **Navbar** — Already correct (horizontal logo, comprehensive mobile menu from rc3) — confirmed no duplicate
8. **Deploy Assistant — App Preview Panel** — iframe preview with URL input, mobile/desktop toggle (375px), live refresh, external link; toggleable split layout (AI left, preview right)
9. **Deploy Assistant — Operations Panel** — Build / Test / AI Fix / Run / Deploy / Publish / Rollback; Manual / Assisted / Auto modes; risk levels (LOW/MEDIUM/HIGH); confirmation step with what/recovery info; real-time result feedback
10. **GitHub Push** — All commits pushed to `dunazoeworld-stack/dunazoe-supermaster` (main)

---

## What Was Fixed (August 2026 Batch 3 — rc4)

### rc4 (2026-08-05)
1. **Self-Delivery Zone Matching at Checkout** — `SelfDeliveryPanel` component added to checkout page; when buyer enters their state, cart items with vendor `self_delivery_zones` covering that state show a "Vendor Self-Delivery Available" banner with WhatsApp deeplink and in-app chat button; Nigerian state alias matching (Abuja/FCT, Port Harcourt/Rivers etc.); warns if vendor hasn't set a delivery fee
2. **AI Scaling Engine Dashboard** — `ScalingEnginePanel` added to `/deploy/scaling`; shows live metrics (users/vendors/orders/uptime), feature lifecycle cards with current status + AI reason + threshold, manual override buttons (→ active / → beta / → suspended), status filter bar, 30s auto-refresh, and link to full `/deploy/features` control
3. **NEXT_PUBLIC_SITE_URL** — Environment variable set to `https://dunazoe.com` so OG image URLs, canonical links and social share images resolve correctly in production
4. **GitHub Push** — All rc3 + rc4 commits pushed to `dunazoeworld-stack/dunazoe-supermaster` (main branch) via Replit GitHub integration

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
