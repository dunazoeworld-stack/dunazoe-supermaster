---
name: CTO final patch July 2026
description: What was changed in the CTO production stabilization brief (July 31 2026) and the GitHub push blocker
---

## Changes Made (July 31 2026)

### Vendor Dashboard
- Edit Product modal added (name, price, stock, category, weight, description)
- Soft-delete with confirmation dialog
- Removed raw vendor ID leak from VND badge

### Delivery Vendor Registration (/deliver)
- Form expanded: WhatsApp, email, home address, business address, GPS, vehicle type/plate, years experience, CAC name, profile photo URL, gov ID URL, agreement checkbox
- Agreement checkbox required before submit

### Checkout
- Added `.checkout-grid` class → stacks sidebar under form on ≤768px
- Fetches /api/payments/health on mount; shows banner if gateway missing

### CSS (globals.css)
- 480px rules: font-size 16px on .form-input (prevents iOS zoom), flex-wrap on tab bars, 2-col stats-grid, smaller btn-lg
- checkout-grid stacks at 768px; admin-table-wrap gets overflow-x: auto

### API
- /api/payments/health — checks PAYSTACK_LSK, STRIPE_SECRET_KEY, wallet_transactions UNIQUE constraint

### OG Tags
- products/[id]/layout.jsx — server-side generateMetadata with og:image, og:price, twitter:card

## GitHub Push Blocker
- `gitPush({})` returns `NO_CREDENTIALS` — user must connect GitHub in Replit Git pane
- 2 commits unpushed at this point:
  1. `aa53534` — OG tags, KYC resilience, checkout gateway health check
  2. `6566352` — CTO final patch (vendor controls, delivery form, mobile fix)
- Manual push: `git push origin main`

## How to Apply
All changes are committed locally. User must:
1. Connect GitHub account in Replit Git pane
2. Run `git push origin main`
