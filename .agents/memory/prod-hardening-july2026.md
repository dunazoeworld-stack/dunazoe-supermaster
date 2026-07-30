---
name: Production hardening patch July 2026
description: Key decisions and rules from the July 2026 production stabilization patch
---

## What was done (July 30, 2026)

### Delivery Vendor Gate
- `/deliver` page now checks `user.role` from localStorage; non-vendors see a lock screen
- Valid vendor roles: `vendor`, `direct_vendor`, `delivery_vendor`, `admin`, `super_admin`
- Lock message: "Delivery Vendor registration is available only for approved vendors."

**Why:** Delivery agents must already be vendors — their pickup address / logistics setup depends on having a vendor profile.

### Vendor Registration Types (cleaned up)
- Removed `pickup_station` from Store Type dropdown in `/vendor/onboard`
- Now only two options: `direct` (Direct Vendor) and `delivery` (Delivery Vendor)

### Business Logo Upload
- Added logo upload to vendor onboard Step 1 (`/vendor/onboard`)
- State: `vendor.logo_url`, uses same `/api/upload/product-image` endpoint
- Handler: `handleLogoUpload` in `VendorOnboardPage`; uses `compressImage` then upload-with-data-URI fallback

### Superuser Control Center (`/admin`)
- Completely rebuilt from simple stats page to full 7-tab management center
- Tabs: Overview · Users · Vendors · Products · Orders · Payments · Disputes
- RBAC levels: super_admin (4) > admin (3) > coordinator (2) > operator (1)
- All entity IDs shown as ORD/PRD/VND/TXN/DSP-XXXXX short format
- Role level ≥ 2 (coordinator+) required for action buttons

### Raw ID Display Cleanup
- Vendor dashboard product cards: removed `ID: {p.id} · VND: {user?.vendor_id}`
- Vendor dashboard order cards: removed `ID: {o.id}`
- Product detail info panel: removed `ID: {product.id} · VID: {product.vendor_id}` line
- Product detail vendor card: removed `ID: {product.vendor_id}` from vendor badge

### Vendor Dashboard Product Cards
- Now show 140px product image at top (background-image CSS)
- PRD-XXXXX badge overlaid on image, status badge top-right
- Category shown below name

### Disputes Page
- Added expandable cards (click to expand/collapse)
- Visual 3-stage timeline: Created → Under Review → Resolved
- Filter tabs by status (All / Open / Under Review / Escalated / Resolved)
- Escalated state shows red alert banner

### Wallet Security Migration
- File: `migrations/wallet_transactions_schema_fix.sql`
- Adds UNIQUE(reference) to wallet_transactions
- Creates commission_transactions and delivery_vendor_profiles tables
- **Must run on production DB before deploying**

### Documentation
- Created 10 docs files in `docs/` directory
- Key: `docs/PRODUCTION_HANDOVER.md` contains full status + operator actions

## How to apply it right
1. Run `migrations/wallet_transactions_schema_fix.sql` on the prod DB
2. Set `PAYSTACK_LSK` and `STRIPE_SECRET_KEY` in Replit Secrets
3. Grant `super_admin` role to admin user via direct DB UPDATE
4. Set Paystack webhook URL to `https://YOUR_DOMAIN/api/payments/webhook`
