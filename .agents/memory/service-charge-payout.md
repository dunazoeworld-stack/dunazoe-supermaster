---
name: Service charge & vendor payout rule
description: DUNAZOE 5% service charge logic — how it applies to buyers and vendors
---

## Rule (confirmed by owner, 2026-07-19)

**5% service charge is on the product price (subtotal), NOT the delivery fee.**

- **Buyers pay:** `subtotal × 1.05` at checkout — shown as a separate "Service charge (5% of items)" line
- **Vendors receive:** `order.amount × 0.95` — net payout credited to wallet 24 hours after delivery confirmation

## Implementation locations

- `apps/core/frontend/src/app/checkout/page.jsx`
  - `serviceCharge = subtotal * 0.05` (was wrongly `shippingFee * 0.05` before this fix)
- `apps/core/frontend/src/app/api/orders/route.js`
  - passes `service_charge_pct: 0.05` to gateway per item
- `apps/core/services/order-service/index.js`
  - on `status = "delivered"`: inserts row into `vendor_payouts` with `net_amount = gross - 5%`, `scheduled_at = NOW() + 24h`
- Migration: `apps/core/services/order-service/migrations/vendor_payouts.sql`

**Why:** Owner specified "5% of the product bought or sold" — NOT shipping. Deducted before crediting vendor wallet, 24h delay after delivery.

**How to apply:** Any future pricing, payout, or escrow logic must use `SERVICE_CHARGE_PCT=0.05` env var (defaulting to 0.05) applied to `order.amount`, not delivery fee.
