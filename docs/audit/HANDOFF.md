# HANDOFF.md
## Cross-Account Handoff Document

**From:** Replit Account #1 (dunazoe-supermaster)
**To:** Replit Account #2 (continuation)
**Date:** 2026-06-13
**Commit:** latest on branch `main`

---

## 🆕 Deployment AI Integration (New — Read This First)

The CI/CD pipeline is now connected to your live Deployment AI dashboard.

**Your Dashboard:** https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev

### Current Status
The pipeline runs in **CI-only mode** — inline security audits work, but the dashboard needs a backend API to receive live events. This is a 30-minute fix described below.

### 3 Things You Need to Do for Full Connection

**1. Set GitHub Actions Variables** (5 minutes)
Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/variables/actions
```
DEPLOYMENT_AI_URL = https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev
STAGING_URL       = https://9e5b4e75-943a-4219-8c78-a1cf48cb7753-00-1sfx72v0oq3y9.kirk.replit.dev
```
Go to: https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/secrets/actions
```
DEPLOYMENT_AI_TOKEN = <generate with: openssl rand -hex 32>
```

**2. Add Backend API to Your Deployment AI** (20 minutes)
Your dashboard is frontend-only. Copy the `server/index.js` code from:
`docs/audit/DEPLOYMENT_AI_INTEGRATION.md` → Step 3
Add it to your Replit project (Account 2) to receive GitHub webhooks + pipeline events.

**3. Set Up GitHub Webhook** (5 minutes)
Full guide: `scripts/github-webhook-setup.md`
Short version: Go to https://github.com/dunazoeworld-stack/dunazoe-supermaster/settings/hooks
Add webhook pointing to `<your-dashboard-url>/github-webhook`

**Full integration guide:** `docs/audit/DEPLOYMENT_AI_INTEGRATION.md`

---

## What Was Done in This Session

### 1. Repository Setup
- Extracted `dunazoe-supermaster.tar.gz` archive into workspace
- Pushed all 222 files to: `https://github.com/dunazoeworld-stack/dunazoe-supermaster`
- Branch: `main` — commit `7420f5b`
- Authentication used: Classic PAT via `GITHUB_PERSONAL_ACCESS_TOKEN` secret (set in Replit Secrets)

### 2. Full Audit Completed
Executed DUNAZOE OS Unified Review prompt (POST_PUSH_MODE) — all 20 reports generated and committed to `docs/audit/`.

### 3. What Was NOT Done (Your Job)
The following items were identified as required but NOT yet implemented — they are your starting point:

---

## Your Tasks (Prioritized)

### 🔴 CRITICAL — Do These First

#### Task A: Fix JWT Secret Fallback
**File:** `apps/core/gateway/index.js` line 12
```js
// CHANGE THIS:
const JWT_SECRET = process.env.JWT_SECRET || "dunazoe_secret_change_in_prod";
// TO THIS:
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('[Gateway] JWT_SECRET env var is required');
```

#### Task B: Add dunazoe-express package.json
**File:** Create `apps/core/services/dunazoe-express/package.json`
```json
{
  "name": "dunazoe-express",
  "version": "1.0.0",
  "description": "DUNAZOE Express delivery module",
  "main": "index.js",
  "scripts": { "start": "node index.js", "dev": "nodemon index.js" },
  "dependencies": {
    "express": "^4.19.2",
    "dotenv": "^16.4.5",
    "cors": "^2.8.5",
    "pg": "^8.12.0"
  },
  "devDependencies": { "nodemon": "^3.1.0" }
}
```

#### Task C: Update .env.example with Missing Vars
**File:** `apps/core/.env.example`
Add to the bottom:
```
# ── CLOUDINARY ─────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
CLOUDINARY_UPLOAD_FOLDER=dunazoe/products
MAX_FILE_SIZE_MB=5

# ── REDIS ──────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── RABBITMQ ───────────────────────────────────────────────────
RABBITMQ_URL=amqp://localhost:5672

# ── REMAINING SERVICE URLS ─────────────────────────────────────
REALTIME_SERVICE_URL=http://localhost:4019
UPLOAD_SERVICE_URL=http://localhost:4020
SEARCH_SERVICE_URL=http://localhost:4021
FEATURE_FLAG_SERVICE_URL=http://localhost:4022
PAYMENTS_AI_SERVICE_URL=http://localhost:4031
```

#### Task D: Configure Replit Workflow
- Set up a workflow named "Start Frontend"
- Command: `cd apps/core/frontend && npm install && npm run dev`
- Port: **5000**
- Host: **0.0.0.0** (required for Replit proxy)
- Also confirm/create `apps/core/frontend/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['res.cloudinary.com'],
  },
};
module.exports = nextConfig;
```

---

### 🟡 MEDIUM PRIORITY — Do After Critical Fixes

#### Task E: Implement Cloudinary Image Enhancement
See full spec: `docs/audit/PRODUCT_IMAGE_AI_REPORT.md`
- Add transform pipeline to `apps/core/services/upload-service/index.js`
- Add schema columns to products table in a new `shared/schema-phase11.sql`
- Add feature flag: `FEATURE_AI_IMAGE_ENHANCEMENT=false`

#### Task F: Add Product Weight Estimation
See full spec: `docs/audit/WEIGHT_ESTIMATION_REPORT.md`
- Add 2 routes to `apps/core/services/ai-service/index.js`
- Add schema columns to products table

#### Task G: Add Product SEO Content Generation
See full spec: `docs/audit/PRODUCT_CONTENT_REPORT.md`
- Add 3 routes to `apps/core/services/ai-service/index.js`
- Create `product_seo_history` table

#### Task H: Image Quality Scoring
See full spec: `docs/audit/IMAGE_QUALITY_REPORT.md`
- Add `analyzeImageQuality()` function to upload-service
- Add 1 new route: `POST /upload/product-image/quality-check`

#### Task I: Review Loan Disbursement Ledger
See: `docs/audit/LEDGER_REPORT.md` Section 3 (Loan Disbursement)
- The current entry has DEBIT and CREDIT to the same account (1001) — net zero
- Requires fintech architect review + fix before loan feature goes live

---

### 🟢 LOW PRIORITY — When Time Allows

#### Task J: Increase Test Coverage to 80%+
See: `docs/audit/TEST_REPORT.md` Section 5 (Missing Tests)
Priority tests:
1. Ledger double-entry balance validation
2. Loan hard cap enforcement
3. Paystack webhook signature
4. Fraud score gating
5. Kill switch route blocking

#### Task K: Move JWT from localStorage to HttpOnly Cookie
See: `docs/audit/UI_REVIEW.md` — Section 6
- `apps/core/frontend/src/app/login/page.jsx`
- Change `localStorage.setItem("dunazoe_token", ...)` to send token via cookie

#### Task L: Add Orphan Cloudinary Cleanup
See: `docs/audit/MEDIA_REPORT.md` — Section 6
- Add Cloudinary delete call in product-service DELETE route
- Add monthly orphan audit cron

---

## Repository State

```
Branch:  main
Commit:  7420f5b
Remote:  https://github.com/dunazoeworld-stack/dunazoe-supermaster
Status:  All 222 files pushed, audit reports added
```

## Key File Locations

| Purpose | Path |
|---------|------|
| API Gateway | `apps/core/gateway/index.js` |
| All microservices | `apps/core/services/*/index.js` |
| Shared middleware | `apps/core/shared/middleware/` |
| Ledger engine | `apps/core/shared/ledger/ledgerEngine.js` |
| DB schemas | `apps/core/shared/schema*.sql` |
| Frontend app | `apps/core/frontend/src/app/` |
| Env template | `apps/core/.env.example` |
| All audit reports | `docs/audit/` |
| CI/CD workflows | `.github/workflows/` |
| Docker setup | `apps/core/docker-compose.yml` |

## Tech Stack Quick Reference

| Layer | Tech |
|-------|------|
| Backend services | Node.js + Express |
| API Gateway | Express + http-proxy-middleware |
| Frontend | Next.js 14 (App Router) |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Message queue | RabbitMQ |
| File storage | Cloudinary |
| Payments (NGN) | Paystack |
| Payments (USD) | Stripe |
| SMS/WhatsApp | Termii |
| Logistics | Shipbubble + GIG |
| Deployment | Docker Compose + Contabo VPS |

## Environment Secrets Needed in New Account

Set these in Replit Secrets (not in code):

| Secret Name | Where Used |
|-------------|-----------|
| `DATABASE_URL` | All services |
| `JWT_SECRET` | Gateway, auth-service |
| `INTERNAL_SECRET` | All inter-service HMAC |
| `REDIS_URL` | feature-flag, realtime |
| `CLOUDINARY_CLOUD_NAME` | upload-service |
| `CLOUDINARY_API_KEY` | upload-service |
| `CLOUDINARY_API_SECRET` | upload-service |
| `PAYSTACK_SECRET_KEY` | payment-service |
| `PAYSTACK_WEBHOOK_SECRET` | payment-service |
| `STRIPE_SECRET_KEY` | payment-service |
| `STRIPE_WEBHOOK_SECRET` | payment-service |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | For git push |

---

## Audit Reports Index

All 20 reports are in `docs/audit/`. Start with:
1. `FINAL_SUMMARY.md` — full picture
2. `BLOCKERS.md` — what to fix first
3. `FIX_LOG.md` — exact fix instructions

**Good luck. Ship it.**
