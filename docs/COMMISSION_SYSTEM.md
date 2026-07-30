# DUNAZOE Commission System
**Version:** Production Hardening Patch  
**Date:** 2026-07-30

---

## Commission Rules

### Product Service Charge (5%)

Every product order includes a 5% DUNAZOE service charge:

| | Amount |
|--|--|
| Vendor lists at | ₦10,000 |
| DUNAZOE adds (5%) | ₦500 |
| Customer pays | ₦10,500 |
| Vendor receives | ₦10,000 (gross - 5%) |
| DUNAZOE earns | ₦500 |

The 5% is calculated on the **product subtotal only** (not delivery fee).

### Payout Timeline
1. Customer pays → order marked `paid`
2. Delivery confirmed → timer starts
3. After **24 hours** (no dispute) → vendor payout released
4. Payout tracked in `vendor_payouts` table
5. Commission tracked in `commission_transactions` table

### Delivery Commission (2%)

Delivery vendors earn:
- 2% of delivery fee per completed delivery
- ₦5,000 milestone bonus every 100 completed deliveries
- Payouts within 24h of delivery confirmation

---

## Database Schema

### `commission_transactions`
```sql
CREATE TABLE commission_transactions (
  id             BIGSERIAL PRIMARY KEY,
  product_id     INTEGER       NOT NULL,
  order_id       INTEGER       NOT NULL,
  vendor_id      INTEGER       NOT NULL,
  gross_amount   NUMERIC(15,2) NOT NULL,
  system_fee     NUMERIC(15,2) NOT NULL,   -- 5% of gross
  vendor_amount  NUMERIC(15,2) NOT NULL,   -- gross - system_fee
  status         VARCHAR(50)   NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  released_at    TIMESTAMPTZ,
  UNIQUE(order_id, product_id)
);
```

### `vendor_payouts`
```sql
-- Already exists; commission scheduled 24h after delivery
INSERT INTO vendor_payouts (vendor_id, order_id, gross_ngn, service_charge_ngn, net_ngn, status, scheduled_at)
VALUES ($1, $2, $3, $4, $5, 'pending', NOW() + INTERVAL '24 hours')
ON CONFLICT DO NOTHING;
```

---

## Service Charge Display

Product listings show prices with a note on checkout:
> "Includes DUNAZOE service charge (5%)"

This is transparent to buyers. Vendors see their net payout clearly:
- In their payout notification
- In their wallet transaction history
- During onboarding: "5% service charge is deducted from your payout per successful delivery"

---

## Configuration

```bash
SERVICE_CHARGE_PCT=0.05    # 5% — set in .env or environment
DELIVERY_COMMISSION=0.02   # 2% — set in dunazoe-express service
```

## Status: IMPLEMENTED ✅
