# DUNAZOE Payment Configuration Guide
**Version:** Production Hardening Patch  
**Date:** 2026-07-30

---

## Required Environment Variables

Set these in Replit Secrets (never commit to code):

| Variable | Purpose | Where to get |
|----------|---------|--------------|
| `PAYSTACK_LSK` | Paystack Live Secret Key | dashboard.paystack.com → Settings → API Keys |
| `STRIPE_SECRET_KEY` | Stripe Secret Key | dashboard.stripe.com → Developers → API Keys |

## Paystack Configuration

### 1. Get your keys
1. Log in at https://dashboard.paystack.com
2. Go to **Settings → API Keys & Webhooks**
3. Copy the **Live Secret Key** (starts with `sk_live_...`)

### 2. Set webhook URL
In Paystack dashboard:
- Webhook URL: `https://YOUR_DOMAIN/api/payments/webhook`
- Events to enable: `charge.success`, `transfer.success`, `transfer.failed`, `transfer.reversed`

### 3. Set environment variable
```bash
PAYSTACK_LSK=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Verify health
Visit `/deploy/health` and check **Payment Gateway** status.

---

## Stripe Configuration

### 1. Get your keys
1. Log in at https://dashboard.stripe.com
2. Go to **Developers → API Keys**
3. Copy the **Secret key** (starts with `sk_live_...`)

### 2. Set environment variable
```bash
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Payment Gateway Health Check

The system validates payment configuration on startup. If keys are missing:
- Paystack: Returns 503 from webhook endpoint; wallet deposits will fail
- Stripe: Stripe payments will be disabled; Paystack remains active

### Health check endpoint
```
GET /api/payments/health
```

Expected response when healthy:
```json
{
  "paystack": "configured",
  "stripe": "configured",
  "wallet_ledger": "valid"
}
```

---

## Wallet Idempotency

The webhook at `/api/payments/webhook` uses:
1. **HMAC-SHA512 signature verification** — rejects unsigned requests
2. **Reference uniqueness check** — `wallet_transactions` has `UNIQUE(reference)` constraint
3. **ON CONFLICT DO NOTHING** — duplicate webhook retries are silently ignored
4. **Startup validation** — logs `WALLET LEDGER SCHEMA INVALID` if `wallet_transactions` table or unique constraint is missing

### Run migration before first payment:
```bash
psql $DATABASE_URL < migrations/wallet_transactions_schema_fix.sql
```

---

## Commission Structure

- **5% service charge** deducted from every product order payout
- Vendor receives: `gross_amount × 0.95`
- System fee credited to platform wallet
- Payout released: **24 hours after delivery confirmation**
- All tracked in `commission_transactions` table

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "Payment gateway not configured" | `PAYSTACK_LSK` not set | Add to Replit Secrets |
| Webhook 503 | Missing secret key | Add `PAYSTACK_LSK` |
| Webhook 401 | Wrong signature | Verify key matches Paystack dashboard |
| Duplicate wallet credit | Missing UNIQUE constraint | Run migration SQL |
| "WALLET LEDGER SCHEMA INVALID" | Table missing | Run migration SQL |

## Status: READY FOR CONFIGURATION ✅
