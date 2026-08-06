---
name: August 2026 production fixes (rc3–rc5)
description: Key bugs fixed in August 2026 — cart JSX, navbar theme, mobile CSS, OG image, currency service, vendor ID, self-delivery, AI scaling, deploy assistant
---

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
