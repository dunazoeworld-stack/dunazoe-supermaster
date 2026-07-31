# DUNAZOE Payment Security Report
**Date:** 2026-07-31  
**Audit:** Wallet Double-Credit, Webhook Security, Transaction Audit

---

## 1. Wallet Double-Credit Prevention

### Attack Vector
Paystack (and Stripe) retry webhooks on 5xx responses. Without idempotency, each retry would credit the wallet again.

### Mitigations Implemented

| Layer | Mechanism | Status |
|-------|-----------|--------|
| DB constraint | `UNIQUE(reference)` on `wallet_transactions` | ✅ Migration file created |
| Application | `ON CONFLICT (reference) DO NOTHING` on INSERT | ✅ In webhook handler |
| Pre-check | SELECT before INSERT to log duplicate attempt | ✅ In webhook handler |
| Signature | HMAC-SHA512 verification of Paystack signature | ✅ In webhook handler |
| Startup | Logs `WALLET LEDGER SCHEMA INVALID` if constraint missing | ✅ In webhook handler |

### Webhook Handler Security
```
POST /api/payments/webhook
```
- Reads raw body as Buffer for HMAC verification
- Computes `HMAC-SHA512(body, PAYSTACK_LSK)`
- Rejects if `x-paystack-signature` doesn't match → 401
- Returns 200 (not 5xx) on duplicate → stops Paystack retries
- Returns 503 if `PAYSTACK_LSK` is not configured

---

## 2. Webhook Logs

All webhook events log to console:
```
[Webhook] ✅ wallet_deposit {reference} — ₦{amount} credited to user {id}
[Webhook] ⚠️ wallet_deposit {reference} already credited — skipping
[Webhook] ❌ Invalid Paystack signature
[Webhook] ⚠️ WALLET LEDGER SCHEMA INVALID — run migration
```

---

## 3. Failed Webhook Retry Policy

Paystack retries failed webhooks automatically (5xx responses).
DUNAZOE webhook always returns 200 for processed events (including duplicates) to prevent retry floods.
On genuine failures (DB down), returns 500 so Paystack retries after the outage.

---

## 4. Transaction Audit Trail

### `wallet_transactions` table
| Column | Type | Purpose |
|--------|------|---------|
| id | BIGSERIAL | Internal ID |
| user_id | INTEGER | Account owner |
| type | VARCHAR | deposit / withdrawal / commission |
| amount | NUMERIC(15,2) | NGN amount |
| currency | VARCHAR | Always NGN |
| reference | VARCHAR UNIQUE | Paystack/Stripe reference |
| note | TEXT | Human-readable note |
| status | VARCHAR | completed / pending / failed |
| created_at | TIMESTAMPTZ | Timestamp |

### `commission_transactions` table
| Column | Type | Purpose |
|--------|------|---------|
| id | BIGSERIAL | Internal ID |
| order_id | INTEGER | Source order |
| vendor_id | INTEGER | Vendor paid |
| gross_amount | NUMERIC | Pre-commission |
| system_fee | NUMERIC | 5% of gross |
| vendor_amount | NUMERIC | gross - fee |
| status | VARCHAR | pending / released |
| released_at | TIMESTAMPTZ | When payout was sent |

---

## 5. Payment Gateway Health Check

```
GET /api/payments/health
```

Returns:
```json
{
  "paystack":      "configured" | "missing",
  "stripe":        "configured" | "missing",
  "wallet_ledger": "valid" | "missing_unique_constraint" | "db_unreachable",
  "any_gateway":   true | false
}
```
HTTP 200 if healthy, 503 if no gateway configured.

---

## 6. Stripe Webhook (Separate)

Stripe has its own webhook at `/api/payments/webhook` (handles both via `x-paystack-signature` detection).
Stripe uses `stripe.webhooks.constructEvent()` for signature verification.

---

## 7. Operator Actions Required

- [ ] Set `PAYSTACK_LSK` in Replit Secrets
- [ ] Set `STRIPE_SECRET_KEY` in Replit Secrets  
- [ ] Run `migrations/wallet_transactions_schema_fix.sql` on production DB
- [ ] Set Paystack webhook URL to `https://YOUR_DOMAIN/api/payments/webhook`
- [ ] Verify `/api/payments/health` returns `"paystack": "configured"`

---

## Status: IMPLEMENTED ✅ (Pending Operator DB Migration)
