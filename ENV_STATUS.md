# ENV STATUS REPORT
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 2 — Environment Verification  

> **Note:** This report audits the `.env.example` template and known secret requirements.
> Actual secret values are set by the operator in Replit Secrets and GitHub Actions Secrets — 
> they are never stored in the codebase. All values below are TEMPLATE STATUS only.

---

## Environment Variables Audit

| Variable | Template Present | Required For | Status |
|---|---|---|---|
| `DATABASE_URL` | ✅ Yes | All 31 services | ⚠️ WARNING — must be set in Replit Secrets before deploy |
| `JWT_SECRET` | ✅ Yes | Gateway, auth-service | ⚠️ WARNING — must be set; hardcoded fallback removed (fix B-01) |
| `INTERNAL_SECRET` | ✅ Yes | All inter-service HMAC | ⚠️ WARNING — must be set in Replit Secrets |
| `SUPABASE_URL` | ❌ Not in template | Optional (Supabase migration) | ℹ️ INFO — not required if using plain Postgres |
| `SUPABASE_KEY` | ❌ Not in template | Optional (Supabase migration) | ℹ️ INFO — not required if using plain Postgres |
| `PAYSTACK_SECRET_KEY` | ✅ Yes | payment-service | ⚠️ WARNING — must be set |
| `PAYSTACK_PUBLIC_KEY` | ✅ Yes | payment-service | ⚠️ WARNING — must be set |
| `PAYSTACK_WEBHOOK_SECRET` | ✅ Yes | payment-service | ⚠️ WARNING — must be set |
| `STRIPE_SECRET_KEY` | ✅ Yes | payment-service (USD) | ⚠️ WARNING — must be set |
| `STRIPE_WEBHOOK_SECRET` | ✅ Yes | payment-service (USD) | ⚠️ WARNING — must be set |
| `CLOUDINARY_CLOUD_NAME` | ✅ Yes (added this session) | upload-service | ⚠️ WARNING — must be set |
| `CLOUDINARY_API_KEY` | ✅ Yes (added this session) | upload-service | ⚠️ WARNING — must be set |
| `CLOUDINARY_API_SECRET` | ✅ Yes (added this session) | upload-service | ⚠️ WARNING — must be set |
| `CLOUDINARY_URL` | ❌ Not in template (uses 3 separate vars) | upload-service | ✅ PASS — covered by the 3 vars above |
| `REDIS_URL` | ✅ Yes (added this session) | feature-flag, realtime | ⚠️ WARNING — must be set |
| `RABBITMQ_URL` | ✅ Yes (added this session) | eventBus, outbox worker | ⚠️ WARNING — must be set |
| `NEXT_PUBLIC_API_URL` | ✅ Yes (as NEXT_PUBLIC_URL equivalent) | Frontend | ⚠️ WARNING — must be set to production gateway URL |
| `SMTP_CONFIG` / `TERMII_API_KEY` | ✅ Yes | notification-service | ⚠️ WARNING — must be set |
| `NODE_ENV` | ✅ Yes | All services | ⚠️ WARNING — must be `production` |
| `ALLOWED_ORIGINS` | ✅ Yes | Gateway CORS | ✅ PASS — template has dunazoe.com |
| `PORT` | ✅ Yes | Gateway | ✅ PASS |
| `BCRYPT_ROUNDS` | ✅ Yes | auth-service | ✅ PASS (12) |
| `SHIPBUBBLE_API_KEY` | ✅ Yes | logistics-service | ⚠️ WARNING — must be set |

---

## Summary

| Status | Count | Meaning |
|---|---|---|
| ✅ PASS | 5 | Template correct, no secrets needed or defaults are safe |
| ⚠️ WARNING | 17 | Template present — operator must set real values in Replit Secrets |
| ❌ FAIL | 0 | None — no hard failures |
| ℹ️ INFO | 2 | Supabase — optional, not blocking |

---

## Action Required (Operator)

Set the following in **Replit Secrets** before deployment:

```
DATABASE_URL
JWT_SECRET
INTERNAL_SECRET
PAYSTACK_SECRET_KEY
PAYSTACK_PUBLIC_KEY
PAYSTACK_WEBHOOK_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
REDIS_URL
RABBITMQ_URL
TERMII_API_KEY
SHIPBUBBLE_API_KEY
NEXT_PUBLIC_API_URL
NODE_ENV=production
```

**Template file updated:** `apps/core/.env.example` — now includes Cloudinary, Redis, RabbitMQ, and all remaining service URLs.

---

*Generated: 2026-06-15 — DUNAZOE Release Manager (Replit 4)*
