---
name: August 2026 production fixes (rc3–rc6)
description: Key bugs fixed in August 2026 — cart JSX, navbar theme, mobile CSS, OG image, currency service, vendor ID, self-delivery, AI scaling, deploy assistant, canonical webhooks
---

## rc7 (2026-08-06) — CTO Audit: 4 Missing Pages + Turbopack Config

### Missing Pages (mobile menu ghost links fixed)
- `/settings` — Account/Appearance/Notifications/Privacy/Danger Zone tabs; theme toggle persists to localStorage + document
- `/support` — 10-question FAQ accordion + contact form (select + textarea) + 6 quick-action shortcut cards
- `/notifications` — All/Unread filter, mark-one/mark-all-read via `/api/notifications`, graceful offline banner
- `/messages` — Conversation list + full chat UI; DUNAZOE Support bot with auto-reply; send on Enter
- **Why:** All 4 were in the mobile menu but returned 404; 0 broken nav links now

### Turbopack root config
- Added `turbopack: { root: __dirname }` to `next.config.js`
- **Why:** 3 lockfiles at different workspace levels triggered "Found additional lockfiles" warning on every start

## rc8 (2026-08-07) — Build and Preview Stabilization

### Next.js query-string pages
- Next.js 16 production builds require `useSearchParams()` to be below a Suspense boundary in client pages.
- **Why:** Without the boundary, static page generation fails even when the page works in the dev preview.

### Replit preview bundler
- The repository has multiple lockfiles and Next.js Turbopack inferred the workspace root incorrectly, causing recurring React Client Manifest and missing-module errors after restarts.
- **Why:** Webpack dev mode is stable in this workspace; the remaining lockfile root warning is cosmetic.

### Full page audit result
- 25 pages all return 200; `/api/webhooks/paystack` 401 (correct — rejects unsigned); `/api/webhooks/stripe` 503 (correct — Stripe secrets not set)

---

## rc6 (2026-08-06) — Canonical Webhook Routes + Secret Audit

### Canonical Webhook URLs
- Created `/api/webhooks/paystack` (re-exports HMAC-SHA512 handler from payments/webhook)
- Created `/api/webhooks/stripe` (full Stripe-Signature timestamp verification + payment_intent.succeeded + charge.refunded)
- Created `/api/webhooks/notify` (Termii DLR callback, GET ping for URL validation)
- **Why:** ops/status referenced these URLs; without the routes the URLs would 404 when Paystack/Stripe POSTed events

### Empty Secrets Audit (action required by user)
- `PAYSTACK_LSK` — registered as Replit Secret but value is empty string (length 0)
- `PAYSTACK_WEBHOOK_SECRET` — same, empty
- `CLOUDINARY_API_SECRET` — same, empty
- `CLOUDINARY_CLOUD_NAME` ✅ set (length 9), `CLOUDINARY_API_KEY` ✅ set (length 15)
- **Pattern:** Shell `node -e "console.log(process.env.X?.length)"` to audit secret values without revealing them
- **Fix needed:** User must go to Replit Secrets and set actual values — no code changes required, all handlers read at request time

## rc5 (2026-08-06) — Final Production Patch

### Cloudinary Upload JSON Error Fix
- `uploadWithRetry` in vendor/onboard calls `r.json()` — Cloudinary returns HTML on gateway 5xx errors
- **Fix:** In upload route, changed `response.json()` to `response.text()` + `JSON.parse()` with catch block
- Returns 502 with clear message instead of crashing with "Unexpected end of JSON input"
- **Pattern:** Always use `text()` then `JSON.parse()` when calling external APIs that may return non-JSON on error

### Product Page Mobile Responsive
- Grid used `gridTemplateColumns: "clamp(280px,45%,520px) 1fr"` — inline style, no media query → overflows on mobile
- **Fix:** Replaced with `.product-top-grid` and `.product-specs-grid` CSS classes in globals.css
- Added `@media (max-width: 768px)` → both grids collapse to `1fr`
- **Pattern:** Never put two-column grids with `clamp()` as inline styles — they can't have media queries

### Quantity Controller
- Old: `<p>QTY</p> <button>−</button> <span>n</span> <button>+</button>` — misaligned on mobile
- **Fix:** Unified border container with 44px touch targets — `[-] 1 [+]` centered pattern

### Checkout Grid
- Inline `gridTemplateColumns: "1fr 320px"` had no media query
- **Fix:** `.checkout-grid` class in globals.css; stacks to `1fr` at 768px

### Payment Health Upgrade
- Added live Paystack API ping (4s timeout) to confirm connectivity beyond key format check
- Added `PAYSTACK_WEBHOOK_SECRET` existence check
- Returns `summary: { PAYSTACK, STRIPE, WEBHOOK }` with emoji labels for Deployment AI display

### Light Theme Full Coverage
- Dark theme vars were `:root` defaults; light theme was incomplete (nav only)
- **Fix:** Full `[data-theme="light"]` ruleset in globals.css covering all CSS vars + card/form/button overrides
- `@media (prefers-color-scheme: light)` fallback for `body:not([data-theme="dark"])`

### Deploy Assistant Upgrade
- Added `AppPreviewPanel`: iframe, URL input, mobile/desktop toggle, refresh button
- Added `OperationsPanel`: 7 operations (Build/Test/Fix/Run/Deploy/Publish/Rollback)
  - Manual/Assisted/Auto modes filter which operations are shown
  - HIGH risk operations always require confirmation regardless of mode
  - Each operation shows: risk level, what it does, recovery option, result with timestamp

## Cart Build Error Fix
- Original cart had `<style>{...}</style>` as JSX sibling of `<div className="cart-layout">` inside ternary — valid only with Fragment wrapper
- Turbopack (Next.js 16) rejects template literals after IIFE pattern `{(() => {...})()}` inside `.map()` — broke parse
- **Fix:** Rewrote cart page with `resolveImage()` helper function (outside JSX) and split empty/populated states into separate `return` statements. No IIFE, no fragment needed.
- **Why:** Turbopack JSX parser is stricter than Babel about template literals following complex expressions inside ternary branches.

## Navbar Theme Fix
- Navbar hardcoded `rgba(4,9,28,0.97)` — dark regardless of theme
- **Fix:** CSS variables `--nav-bg` / `--nav-bg-scrolled` injected via scoped `<style>` tag in Navbar.jsx; `[data-theme="light"]` and `@media (prefers-color-scheme: light)` overrides applied

## Vendor Dashboard Product ID
- Product ID badge was `position: absolute; top: 8px; left: 8px` inside image container — covering the image
- **Fix:** Removed from image overlay; added as `<p>` in card-body below product name with monospace muted styling

## OG Metadata Image Fix
- `product.images` stored as JSON string in DB — OG layout only checked `Array.isArray()`
- **Fix:** Added JSON.parse attempt before `Array.isArray()` check in `[id]/layout.jsx`
- Also fixed `_origin` precedence bug — now uses explicit ternary chain

## Currency Service
- New file: `apps/core/frontend/src/lib/currency.js`
- Exports: `getExchangeRate()`, `convertNGNtoUSD()`, `ngnToStripeCents()`
- Uses ExchangeRate-API (primary) + Frankfurter (secondary) + ₦1600/USD static fallback
- 1-hour in-memory cache

## Cart Image Resolver
- `images` field can be: array, JSON string of array, or plain URL string
- Helper `resolveImage(item)` handles all three cases; rejects data URIs for CSS backgrounds
- Checks `item.images || item.image_url || item.image`

## Mobile CSS
- Added `overflow-x: hidden` to `html` and `body` in globals.css
- Added `@media (max-width: 360px)` breakpoint for Samsung A10 / Galaxy A01
- Enhanced 480px and 768px breakpoints with touch-friendly sizing, padding, font sizes

## Delivery Registration Error
- When gateway unreachable: now saves registration data to `localStorage.dunazoe_pending_delivery_reg`
- Shows descriptive message instead of generic "Connection error. Please try again."

## GitHub push authorization
- A GitHub PAT saved as a Replit Secret does not satisfy Replit's managed `gitPush` source-control credential check.
- **Why:** Managed pushes require the Replit GitHub source-control OAuth connection; repeatedly retrying with a shell PAT is unsafe and does not resolve `NO_CREDENTIALS`.
