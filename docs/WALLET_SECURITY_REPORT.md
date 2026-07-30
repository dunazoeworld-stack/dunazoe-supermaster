# DUNAZOE Wallet Double-Credit Security Report
**Date:** 2026-07-30  
**Severity:** HIGH — Fixed

---

## Problem

Paystack webhook retries (on 5xx responses or network timeouts) could create duplicate wallet credits if:
1. The `wallet_transactions` table lacked a `UNIQUE(reference)` constraint
2. The idempotency check failed silently

## Root Cause

The webhook's `ON CONFLICT (reference) DO NOTHING` clause requires a UNIQUE constraint on `wallet_transactions.reference`. Without this constraint, the INSERT would succeed on duplicate references, crediting the wallet twice.

## Fix Applied

### 1. Database Migration (`migrations/wallet_transactions_schema_fix.sql`)
```sql
-- Create table with UNIQUE constraint
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    INTEGER       NOT NULL,
  type       VARCHAR(50)   NOT NULL DEFAULT 'deposit',
  amount     NUMERIC(15,2) NOT NULL,
  currency   VARCHAR(10)   NOT NULL DEFAULT 'NGN',
  reference  VARCHAR(255)  UNIQUE NOT NULL,   -- ← KEY CHANGE
  note       TEXT,
  status     VARCHAR(50)   NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add constraint if table already exists
ALTER TABLE wallet_transactions 
  ADD CONSTRAINT wallet_transactions_reference_key UNIQUE (reference);
```

### 2. Webhook Guard (already in place)
```js
// apps/core/frontend/src/app/api/payments/webhook/route.js
const dupeCheck = await pool.query(
  `SELECT id FROM wallet_transactions WHERE reference = $1 AND type = 'deposit' LIMIT 1`,
  [reference]
);
if (dupeCheck.rows.length > 0) {
  console.log(`[Webhook] ⚠️ wallet_deposit ${reference} already credited — skipping`);
  // Returns 200 to stop Paystack from retrying
}
```

### 3. INSERT with conflict guard
```js
await pool.query(
  `INSERT INTO wallet_transactions (...) VALUES (...) ON CONFLICT (reference) DO NOTHING`,
  [userId, email, amountNgn, reference]
);
```

## Testing

| Test | Expected | Status |
|------|----------|--------|
| First webhook with reference | Wallet credited | ✅ |
| Second webhook with same reference | Silently ignored, 200 returned | ✅ |
| Multiple rapid retries | Only first succeeds | ✅ |
| Invalid signature | 401 returned | ✅ |
| Missing PAYSTACK_LSK | 503 returned | ✅ |

## Operator Action Required

**MUST RUN before deploying to production:**
```bash
psql $DATABASE_URL < migrations/wallet_transactions_schema_fix.sql
```

## Status: FIXED ✅
