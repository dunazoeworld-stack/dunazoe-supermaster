---
name: DUNAZOE Frontend Bug Fixes & Features (July 2026)
description: Durable fixes and features applied across two sessions — what broke, what was fixed, what was built, and rules to maintain.
---

# DUNAZOE Frontend — Fixed Bugs, Rules & New Features

## Session 1 Critical Fixes

### Dynamic route params — Next.js 14 compat
- `/products/[id]/page.jsx` and `/orders/[id]/page.jsx` used `use(params)` (React 19 / Next.js 15 pattern)
- In Next.js 14, `params` is a plain object — `use(params)` throws "unsupported type" → 500s
- **Fix:** `const { id } = params;` — remove `import { use }` entirely
- **Why:** Repo pins Next.js 14.x; `use(params)` only works in Next 15+

### JWT hardcoded fallback — security
- 3 API routes had `|| "dunazoe_secret_change_in_prod"` fallback (allows token forgery)
- **Fix:** Removed fallback; fail closed — log FATAL and reject all requests if secret missing
- **Rule:** Never add `|| "hardcoded_string"` after JWT_SECRET reads

## Session 1 Minor Fixes
- `layout.jsx`: moved themeColor/colorScheme/viewport to `export const viewport`
- `next.config.js`: deprecated `images.domains` → `images.remotePatterns`
- login/register/deploy: added correct `autoComplete` attributes

## Session 2 Features Built (July 11, 2026)

### Password visibility toggles
- Both `/login` and `/register` now have 👁️ toggle button inside password inputs
- Register has two toggles: one for password, one for confirm password
- Uses `showPwd` / `showConfirm` state + `aria-label` for accessibility
- Toggles switch `input type` between `"password"` and `"text"`

### STAE — Scaling-Triggered Activation Engine
- Built from scratch (was completely missing, referenced but absent)
- `deployment-ai/scaling-triggered-activation-engine/scale-policy.js` — Node.js module with full state management
- `apps/core/frontend/src/app/api/stae/route.js` — Next.js API route (GET state, POST actions), JWT-gated
- **MANAGED SIMULATION MODE** — on Replit single-container, controls internal throttles/flags, not cloud resources; labelled truthfully in every response
- Actions: health_check, activate_surge, deactivate_surge, scale_up (per-service), scale_down, pause_noncritical, resume_all, enable/disable_queue_protection
- Full audit log ring buffer (50 entries), recommendations engine
- **Rule:** STAE state is in-memory on single container; for multi-node, switch to Redis

### STAE tab in Operator Cockpit (/ops)
- New `⚡ STAE` tab added to ops page (now 6 tabs: overview, secrets, webhooks, stae, deploy, distribution)
- Shows platform mode, surge/queue badges, recommendations, primary control buttons, per-service scale up/down, audit log
- Lazy-loaded (only fetches STAE state when tab is first opened)
- All buttons call `/api/stae` with JWT from localStorage

### PWA Icons — Logo as App Icon
- Used ImageMagick to generate proper-sized icons from `dunazoe-logo.jpg`:
  - `public/icon-192.png` → 192×192 (was 1024×1024 mislabelled)
  - `public/icon-512.png` → 512×512 (was 1024×1024 mislabelled)
  - `public/apple-touch-icon.png` → 180×180 (new, for iOS home screen)
- Manifest updated to reference all three correctly
- `layout.jsx` `<head>` updated to use `apple-touch-icon.png` for iOS

### Domain Guide
- `docs/DUNAZOE_DOMAIN_SETUP.md` — simple 12-step operator guide for Namecheap + Replit custom domain

## Replit Redirect Issue — Diagnosis
- **Root cause:** No middleware exists; homepage is fully public; no Replit Auth in code
- **Actual cause:** Replit deployment was set to "Private" visibility in deployment settings
- **Fix:** In Replit deployment settings → set visibility to **Public**
- No code change needed — the app itself never redirects to Replit auth

## Architecture Notes
- STAE API: `/api/stae` GET = state, POST = action (`action` + optional `target` fields)
- Ops cockpit: `/ops` (6 tabs) — operator cockpit with STAE, secrets, webhooks, deploy links
- Deploy engine: `/deploy` and all `/deploy/*` sub-pages — linked from ops
- JWT_SECRET / SESSION_SECRET must be set as Replit Secrets — login/register/ops/stae all fail-closed if missing
