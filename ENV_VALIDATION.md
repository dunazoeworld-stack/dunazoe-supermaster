# ENV VALIDATION REPORT
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 2 — Environment Validation  

> Verification only. No secrets replaced or modified.

---

## Validation Results

| Variable | Template Present | Required | Status |
|---|---|---|---|
| `DATABASE_URL` | ✅ `.env.example` | All 31 services | ⚠️ WARNING — set in Replit Secrets |
| `JWT_SECRET` | ✅ `.env.example` | Gateway + auth-service | ⚠️ WARNING — set in Replit Secrets; hardcoded fallback removed |
| `SUPABASE_URL` | ❌ Not in template | Optional (plain Postgres used) | ℹ️ INFO — not blocking |
| `SUPABASE_KEY` | ❌ Not in template | Optional (plain Postgres used) | ℹ️ INFO — not blocking |
| `PAYSTACK_SECRET_KEY` | ✅ `.env.example` | payment-service | ⚠️ WARNING — set in Replit Secrets |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ `.env.example` | payment-service | ⚠️ WARNING — set in Replit Secrets |
| `STRIPE_SECRET_KEY` | ✅ `.env.example` | payment-service (USD) | ⚠️ WARNING — set in Replit Secrets |
| `STRIPE_WEBHOOK_SECRET` | ✅ `.env.example` | payment-service (USD) | ⚠️ WARNING — set in Replit Secrets |
| `REDIS_URL` | ✅ `.env.example` (added) | feature-flag, realtime | ⚠️ WARNING — set in Replit Secrets |
| `CLOUDINARY_CLOUD_NAME` | ✅ `.env.example` (added) | upload-service | ⚠️ WARNING — set in Replit Secrets |
| `CLOUDINARY_API_KEY` | ✅ `.env.example` (added) | upload-service | ⚠️ WARNING — set in Replit Secrets |
| `CLOUDINARY_API_SECRET` | ✅ `.env.example` (added) | upload-service | ⚠️ WARNING — set in Replit Secrets |
| `CLOUDINARY_URL` | ❌ Not used directly | Covered by 3 separate vars above | ✅ PASS |
| `SMTP_CONFIG` / `TERMII_API_KEY` | ✅ `.env.example` | notification-service | ⚠️ WARNING — set in Replit Secrets |
| `INTERNAL_SECRET` | ✅ `.env.example` | All inter-service HMAC auth | ⚠️ WARNING — set in Replit Secrets |
| `NODE_ENV` | ✅ `.env.example` | All services | ⚠️ WARNING — must be `production` |
| `ALLOWED_ORIGINS` | ✅ `.env.example` | Gateway CORS | ✅ PASS — includes dunazoe.com |
| `RABBITMQ_URL` | ✅ `.env.example` (added) | eventBus, outbox | ⚠️ WARNING — set in Replit Secrets |

---

## Summary

| Status | Count |
|---|---|
| ✅ PASS | 3 |
| ⚠️ WARNING — requires operator action | 14 |
| ❌ FAIL | 0 |
| ℹ️ INFO (optional) | 2 |

**No hard failures. All warnings are operational (operator must set real values).**

---

## Action Required

Set the following in **Replit Secrets** (Tools → Secrets):

```
DATABASE_URL          postgresql://user:pass@host:5432/dunazoe_db
JWT_SECRET            <random 64-char hex: openssl rand -hex 32>
INTERNAL_SECRET       <random 64-char hex: openssl rand -hex 32>
PAYSTACK_SECRET_KEY   sk_live_...
PAYSTACK_WEBHOOK_SECRET  <from Paystack dashboard>
STRIPE_SECRET_KEY     sk_live_...
STRIPE_WEBHOOK_SECRET whsec_...
REDIS_URL             redis://<host>:6379
CLOUDINARY_CLOUD_NAME <your cloud name>
CLOUDINARY_API_KEY    <your api key>
CLOUDINARY_API_SECRET <your api secret>
TERMII_API_KEY        <your termii key>
RABBITMQ_URL          amqp://<host>:5672
NODE_ENV              production
NEXT_PUBLIC_API_URL   https://dunazoe.com
```

---

*Generated: 2026-06-15 — DUNAZOE CTO / Production Engineer*
