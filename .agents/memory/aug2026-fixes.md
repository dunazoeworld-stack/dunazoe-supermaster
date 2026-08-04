---
name: August 2026 production fixes
description: 10 targeted bug fixes applied in production stabilization session (Aug 2026)
---

## Key fixes and decisions

### Product Edit/Delete — ROOT CAUSE
`api/products/[id]/route.js` only had GET. Vendor dashboard calls PUT for both edit and soft-delete.
Added PUT handler with JWT auth + vendor ownership check + DB update + local store mirror.
Soft delete: `is_active=FALSE, status='deleted'` — preserves order history.

### Theme System
Added `ThemeProvider.jsx` (light/dark/system) + `[data-theme]` CSS selectors in globals.css.
`ThemeToggle compact` button added to Navbar. layout.jsx wraps body with `<ThemeProvider>`.
Theme stored in `localStorage["dunazoe_theme"]`.

### ORD-ORD ID bug
`o.id` can already contain "ORD-" prefix from backend. Strip with `replace(/^ORD-?/i, "")` before padding.

### Cart mobile
Use `.cart-layout` CSS class (single column on ≤640px). `cart-qty-btn` min 38px (44px mobile).

### OG sharing bug
`products/[id]/layout.jsx` had `type: "og:type"` (string literal bug) → fixed to `type: "website"`.
API_BASE was `http://localhost:5000/api` — fixed to derive from env vars.

### Stripe NGN→USD
Payment initialize route: if amount > 500 and currency=USD, treat as NGN, fetch `open.er-api.com/v6/latest/USD`.
Fallback rate: 1 USD = ₦1,600. Saves to `payment_conversions` table (migration in `migrations/payment_conversions.sql`).

### Vision AI in vendor onboard
State vars `aiVision/aiVisionLoading/aiApplied` already existed but were never populated.
Added `runVisionAI(imageUrl)` that calls `/api/ai/product-vision`. Triggered after every image upload.
Auto-fills empty fields only. Heuristic fallback always works (no API key needed).

### Deployment AI centers
Added Operations Centers panel to `deploy/page.jsx`: Fix, Payment, AI, Delivery.
Payment Center calls `/api/payments/health` live.
