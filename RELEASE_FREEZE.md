# RELEASE FREEZE
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-beta  
**Date:** 2026-06-15  
**Status:** 🔒 ARCHITECTURE FROZEN  

---

## RELEASE VERSION: v1.0.0-beta

This document declares a full release freeze on DUNAZOE.  
**No new services. No new architecture. No new features. Ship what exists.**

---

## Frozen: Dependencies

All service dependencies are locked at their current versions in each service's `package.json`.

| Layer | Lock Status |
|---|---|
| Node.js | `>=18.0.0` — locked |
| Express | `^4.x` — locked |
| Next.js | `14.x` — locked |
| PostgreSQL client (`pg`) | `^8.x` — locked |
| JWT (`jsonwebtoken`) | current version — locked |
| Redis (`ioredis`) | current version — locked |
| Paystack / Stripe SDKs | current version — locked |

**Action:** Run `npm ci` (not `npm install`) in production to use exact lockfile versions.

---

## Frozen: Environment Schema

The following environment variables constitute the complete production environment.  
No new variables to be added until v1.1.0.

See `ENV_VALIDATION.md` for full list. Core set:

```
DATABASE_URL · JWT_SECRET · INTERNAL_SECRET
PAYSTACK_SECRET_KEY · PAYSTACK_WEBHOOK_SECRET
STRIPE_SECRET_KEY · STRIPE_WEBHOOK_SECRET
REDIS_URL · RABBITMQ_URL · CLOUDINARY_* (3 vars)
TERMII_API_KEY · NODE_ENV · NEXT_PUBLIC_API_URL
```

---

## Frozen: Database Schema

Schemas are locked at phase 10. Files are final:

```
shared/schema.sql              ← phase 1-2
shared/schema-phase3-4.sql     ← phase 3-4
shared/schema-phase5-8.sql     ← phase 5-8
shared/schema-phase9.sql       ← phase 9
shared/schema-phase10.sql      ← phase 10
```

**No new migrations until after beta launch and real user data exists.**

---

## Frozen: API Contracts

The gateway at `apps/core/gateway/index.js` routes 30 services.  
All route prefixes are locked. No new routes in v1.0.0-beta.

---

## Frozen: Frontend Routes

| Route | Status |
|---|---|
| `/` | Frozen |
| `/login` | Frozen |
| `/register` | Frozen |
| `/products` | Frozen |
| `/products/[id]` | Frozen |
| `/checkout` | Frozen |
| `/dashboard` | Frozen |
| `/vendor/dashboard` | Frozen |
| `/admin` | Frozen |

---

## Frozen: Feature Flags

| Flag | State | Locked Until |
|---|---|---|
| `USERS_ENABLED` | ON | Permanent |
| `VENDORS_ENABLED` | ON | Permanent |
| `PRODUCTS_ENABLED` | ON | Permanent |
| `ORDERS_ENABLED` | ON | Permanent |
| `WALLET_ENABLED` | ON | Permanent |
| `NOTIFICATIONS_ENABLED` | ON | Permanent |
| `ADMIN_ENABLED` | ON | Permanent |
| `THRIFT_ENABLED` | OFF | Until loan ledger bug fixed |
| `EXPRESS_ENABLED` | OFF | Until index.js built |
| `AI_BANK_ENABLED` | OFF | Indefinite |
| `SHAREHOLDERS_ENABLED` | OFF | Indefinite |

---

## What This Freeze Means

- ❌ No new microservices
- ❌ No DUNAZOE Express build
- ❌ No Thrift activation
- ❌ No AI Bank Layer
- ❌ No Shareholder system
- ❌ No TypeScript migration
- ❌ No BullMQ migration
- ❌ No Supabase migration
- ✅ Fix bugs only
- ✅ Set secrets
- ✅ Deploy
- ✅ Verify
- ✅ Launch beta

---

*v1.0.0-beta release freeze declared: 2026-06-15*  
*Next version gate: 10 vendors + 100 users reached*
