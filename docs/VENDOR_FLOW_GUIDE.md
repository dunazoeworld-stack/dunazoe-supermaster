# DUNAZOE Vendor Flow Guide
**Date:** 2026-07-30

---

## Vendor Registration Flow

### Step 1: User Registration
1. Visit homepage → click **"Become a Vendor"**
2. Register a normal user account at `/register`
3. Verify email (if enabled)

### Step 2: Vendor Onboarding (`/vendor/onboard`)
Fill in:
- **Business Name** (required)
- **Business Description**
- **Business Logo** (optional — upload PNG/JPG/WebP)
- **State** and **City** (required)
- **Store Type** — choose one:
  - **Direct Vendor**: Sells products directly to customers
  - **Delivery Vendor**: Provides delivery services for DUNAZOE orders
- **Phone Number** (required)
- **Bank Account Details** (required — for payouts)

### Step 3: Add First Product
- After completing vendor setup, the onboard page advances to product listing
- Add product name, description, category, price, images, type-specific details
- Publish the listing

---

## Vendor Dashboard (`/vendor/dashboard`)

### Quick Links
- ➕ Add Product
- 💳 Payout / Wallet
- 📦 Orders
- 📍 Track
- ⚖️ Disputes
- 📣 Marketing AI

### Product Cards
Each product card shows:
- Product image (140px)
- `PRD-XXXXX` short ID
- Status badge (published/draft/hidden)
- Product name and category
- Price (gradient text)
- Share, Copy Link, View Listing buttons

---

## Becoming a Delivery Vendor

Only available to already-approved vendor accounts.

1. From Vendor Dashboard → click **"Register as Agent →"** card
2. Or navigate directly to `/deliver`
3. Non-vendors see a lock screen with instructions to become a vendor first

### Delivery Vendor Registration
- GPS auto-detected
- Pickup address required
- Phone number required
- Select service area: Local / Regional / South-West / Nationwide

---

## Vendor Visibility Rules

| Feature | Visible to Normal User | Visible to Vendor |
|---------|----------------------|-------------------|
| Vendor Dashboard | ❌ No | ✅ Yes |
| Vendor Icons (quick links) | ❌ No | ✅ Yes |
| "Become a Vendor" (homepage) | ✅ Yes | ✅ Yes |
| Delivery Vendor Registration | ❌ No | ✅ Yes (vendor role required) |
| Product listing | ✅ Yes | ✅ Yes |

---

## Payout Rules

- **5% service charge** deducted from each order payout
- Vendor receives: `order_total × 0.95` (product subtotal only, not delivery fee)
- Payout released: 24 hours after delivery confirmation (if no dispute)
- Payout method: Bank Transfer, OPay, Moniepoint, or PalmPay

---

## Vendor KYC

From Vendor Dashboard → KYC Verification card:
- Complete identity verification at `/kyc`
- Until verified: `⏳ Store verification pending` banner shown
- After verification: `✓ Verified` badge

---

## Share Products

From vendor dashboard or product detail page:
- 📤 **Share** — uses Web Share API (or clipboard fallback)
- 📱 **WhatsApp** — pre-fills share message with product link
- 🔗 **Copy Link** — copies shareable URL to clipboard

Every product has a unique shareable link that works on WhatsApp, Facebook, and Twitter/X.
