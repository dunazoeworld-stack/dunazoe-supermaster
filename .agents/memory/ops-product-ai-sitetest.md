---
name: Ops Cockpit extensions — Product AI + Site Tests
description: What was added to /ops and /api/ops/product-ai and how the product pages were upgraded
---

# Ops Cockpit — Product AI & Site Tests Extension

**Why:** Superuser needs Product Listing AI controls and live site-testing inside the Deployment AI cockpit, not in a separate tool.

## New API route
`src/app/api/ops/product-ai/route.js`
- JWT-gated (same roles as STAE: admin | super_admin | coordinator)
- GET → status, demand index matrix, ai-service:4014 liveness check
- POST → runs any of: demand_forecast, optimize_price, listing_assistant, marketing_copy, recommend, vendor_insights, site_health
- All ops run inline (no external API cost). recommend/vendor_insights try ai-service:4014 first, fall back inline.
- site_health tests all 13 key frontend routes, returns pass/fail + latency per route

## Ops page new tabs (ops/page.jsx)
TABS order: overview → secrets → webhooks → stae → **productai** → **sitetest** → deploy → distribution
- productai tab: status banner, operation runner form (dynamic fields per op type), live JSON result panel, demand index matrix
- sitetest tab: target selector (Deployed vs Dev), runs site_health via /api/ops/product-ai, shows per-route pass/fail table

**How to apply:** All further website fixes/testing should be done from /ops → Site Tests tab against the Deployed target.

## Product pages upgraded

### /products/[id]/page.jsx (full rewrite)
- Multi-image gallery with thumbnail strip (imgIdx state)
- Type inference: physical / digital / service
- Size selector (button pills, pre-selects first)
- Color selector (hex → colored dots, label → pills)
- Qty selector (hidden for service type)
- CTA label adapts: "Add to Cart" / "Buy & Download" / "Book Service"
- SpecRow component renders only non-null fields
- Physical specs: weight, dimensions, brand, material, country, stock, dispatch, returns
- Digital specs: format, file size, license, updates, language, compatibility, DRM badge + "Instant delivery" notice
- Service specs: duration, turnaround, area, includes/excludes, availability, booking note
- Ajo monthly installment shown inline (price × 1.05 / 6)
- Vendor card at bottom
- Removed broken /assets/dunazoe-logo.jpg reference

### /products/page.jsx (card upgrade)
- Type badge top-left (📦 Physical / 💾 Digital / 🛠️ Service)
- Weight shown bottom-left for physical
- Size pills (up to 4)
- Color dots/pills (up to 4, hex renders as dot)
- Digital: file_format + file_size
- Service: service_duration + service_area
- Ajo monthly teaser beside price
- CTA button label adapts per type

**Why:** parseMeta() handles string, JSON string, or array; peekArr() limits to 4 items for card density.
