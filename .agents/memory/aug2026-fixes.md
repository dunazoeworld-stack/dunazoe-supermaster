---
name: August 2026 production fixes (rc3)
description: Key bugs fixed in August 2026 batch 2 — cart JSX, navbar theme, mobile CSS, OG image, currency service, vendor ID off image
---

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
