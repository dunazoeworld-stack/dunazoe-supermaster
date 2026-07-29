---
name: July 2026 major feature batch
description: KYC frontend, delivery vendor ops, wallet deposit verification, image upload fallback, order handling, Stripe feature flag, auto theme
---

## Key decisions & rules

### Wallet deposit Paystack callback
Paystack redirects back with `?deposit_ref=REF` (set as `callback_url` in the deposit API route).
The wallet page (`/wallet`) auto-detects this param in `useSearchParams()` and calls `GET /api/wallet/verify?ref=REF`.
`/api/wallet/verify` verifies with Paystack then POSTs `${GATEWAY}/wallets/deposit` to credit the wallet.
**Why:** wallet-service does NOT initiate Paystack — it only credits; deposit initiation is in the Next.js API route directly. Gateway URL must be `/wallets/*` not `/wallet/*`.

### Image upload local fallback
When `/api/upload/product-image` returns `success:false` (missing CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY), vendor onboard now reads the file as a data URI and stores it locally instead of blocking the listing. The error is silently swallowed unless it is NOT the "not yet configured" message.

### Order not-found graceful handling
Orders created when gateway is offline get a fake string ID (e.g. `ORD-1234567890`). The order detail page now detects non-numeric IDs, checks `dunazoe_pending_orders` in localStorage, and shows a friendly "processing" state instead of "not found". Checkout saves a pending stub to localStorage before Paystack redirect.

### can_deliver field in vendor-service
`PUT /vendors/:id` now accepts `can_deliver` (boolean) and `service_area` (string). The COALESCE is conditional — only updates if the incoming value is not null. Delivery agent registration in `/api/delivery/register` uses this to enable Delivery Vendor First assignment in dunazoe-express.

### Notification triggers in order-service
Status changes (paid, processing, shipped, nearby, delivered, cancelled) now fire `POST {NOTIFICATION_SERVICE_URL}/notifications/send` with `channels:["in_app"]` to both buyer and vendor. Non-blocking (fire-and-forget). Vendor lookup via `SELECT user_id FROM vendors WHERE id=$1`.

### Auto dark/light theme
`globals.css` has `@media (prefers-color-scheme: light)` block with full CSS variable overrides. `layout.jsx` viewport uses `colorScheme: "dark light"` and two `themeColor` entries. Dark remains default.

### Forgot-password notifications
`/api/auth/forgot-password` now fires `POST ${GATEWAY}/notifications/send` with `channels:["in_app","email"]` and a formatted reset link. Non-blocking.

### New pages and routes
- `/kyc` — KYC status, BVN/NIN Level 1, gov ID Level 2, bank account management
- `/deliver` — Delivery agent registration, active assignments, status updates, earnings
- `/api/kyc/[...path]` — catch-all proxy to gateway/kyc/*
- `/api/delivery/[...path]` — delivery proxy; /register maps to vendor PUT with can_deliver=true
- `/api/wallet/verify` — GET; verifies Paystack ref then credits wallet via gateway
