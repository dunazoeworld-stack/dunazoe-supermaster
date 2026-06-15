# FIX LOG
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 4 — Fix Only Failures  

---

## Fixes Applied This Session

### FIX-01 — JWT_SECRET Hardcoded Fallback (CRITICAL)
**File:** `apps/core/gateway/index.js` line 12  
**Problem:** `JWT_SECRET` had a hardcoded insecure fallback string that would silently serve as the signing key if the environment variable was not set.  
**Fix:** Removed fallback. Now throws a hard error on startup if `JWT_SECRET` is not set.  
**Before:**
```js
const JWT_SECRET = process.env.JWT_SECRET || "dunazoe_secret_change_in_prod";
```
**After:**
```js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("[Gateway] JWT_SECRET env var is required — set it in Replit Secrets");
```
**Status:** ✅ APPLIED

---

### FIX-02 — dunazoe-express Missing package.json (HIGH)
**File:** `apps/core/services/dunazoe-express/package.json` (created)  
**Problem:** The `dunazoe-express` service directory existed with only `index.js` — no `package.json`. Docker build and `npm install:all` would fail for this service.  
**Fix:** Created `package.json` with correct dependencies (express, dotenv, cors, pg).  
**Status:** ✅ APPLIED

---

### FIX-03 — .env.example Missing Variables (HIGH)
**File:** `apps/core/.env.example` (appended)  
**Problem:** Template was missing Cloudinary (3 vars), Redis, RabbitMQ, and 5 service URLs that are required by running services.  
**Fix:** Appended all missing variables to the bottom of `.env.example`.  
**Added:**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_FOLDER`, `MAX_FILE_SIZE_MB`
- `REDIS_URL`
- `RABBITMQ_URL`
- `REALTIME_SERVICE_URL`, `UPLOAD_SERVICE_URL`, `SEARCH_SERVICE_URL`, `FEATURE_FLAG_SERVICE_URL`, `PAYMENTS_AI_SERVICE_URL`
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_URL`  
**Status:** ✅ APPLIED

---

### FIX-04 — next.config.js Missing (HIGH)
**File:** `apps/core/frontend/next.config.js` (created)  
**Problem:** Frontend Next.js app had no `next.config.js`. Next.js would warn on build, and Cloudinary image domains would be blocked, causing all product images to fail to load.  
**Fix:** Created `next.config.js` with `images.domains` set to `res.cloudinary.com`.  
**Status:** ✅ APPLIED

---

## Fixes NOT Applied (Deferred)

| ID | Issue | Reason |
|---|---|---|
| D-01 | Loan ledger double-entry (same account 1001) | Requires fintech architect review — loan feature not in initial go-live scope |
| D-02 | JWT in localStorage → HttpOnly cookie | Medium risk, refactor required — deferred post-launch |
| D-03 | Cloudinary orphan cleanup on product delete | Low priority — no data loss risk at launch |
| D-04 | Test coverage < 80% | Does not block deployment — tracked for sprint 2 |

---

## No Redesign. No Refactor. No Migrations Applied.

All fixes above are targeted, minimal changes only to broken/missing files.  
No service logic was rewritten. No architecture was changed.

---

*Generated: 2026-06-15 — DUNAZOE Release Manager (Replit 4)*
