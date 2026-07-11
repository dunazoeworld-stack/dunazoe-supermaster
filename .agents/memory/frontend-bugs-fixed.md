---
name: DUNAZOE Frontend Bug Fixes & Features (July 2026)
description: Durable fixes and features applied across sessions — what broke, what was fixed, what was built, and rules to maintain.
---

# DUNAZOE Frontend — Fixed Bugs, Rules & New Features

## Session 1 Critical Fixes

### Dynamic route params — Next.js 14 compat
- `/products/[id]/page.jsx` and `/orders/[id]/page.jsx` used `use(params)` (React 19 / Next.js 15 pattern)
- In Next.js 14, `params` is a plain object — `use(params)` throws → 500s
- **Fix:** `const { id } = params;` — remove `import { use }` entirely
- **Rule:** Repo pins Next.js 14.x; `use(params)` only works in Next 15+

### JWT hardcoded fallback — security
- 3 API routes had `|| "dunazoe_secret_change_in_prod"` fallback (allows token forgery)
- **Fix:** Removed hardcoded string; now uses `process.env.JWT_SECRET || process.env.SESSION_SECRET`
- `SESSION_SECRET` IS set as a Replit Secret — auth works via this fallback
- **Rule:** Never add `|| "hardcoded_string"` after JWT_SECRET reads

## Session 1 Minor Fixes
- `layout.jsx`: moved themeColor/colorScheme/viewport to `export const viewport`
- `next.config.js`: deprecated `images.domains` → `images.remotePatterns`
- login/register/deploy: added correct `autoComplete` attributes

## Session 2 Features Built (July 11, 2026)

### Password visibility toggles
- Both `/login` and `/register` now have 👁️ toggle button inside password inputs
- Register has two toggles: password + confirm password
- Uses `showPwd` / `showConfirm` state + `aria-label` for accessibility

### STAE — Scaling-Triggered Activation Engine
- Built from scratch (was completely missing)
- `deployment-ai/scaling-triggered-activation-engine/scale-policy.js` — Node.js module
- `apps/core/frontend/src/app/api/stae/route.js` — JWT-gated Next.js API route
- **MANAGED SIMULATION MODE** — controls internal throttles on Replit single-container
- Actions: health_check, activate/deactivate_surge, scale_up/down, pause_noncritical, resume_all, enable/disable_queue_protection
- Audit log ring buffer (50 entries), recommendations engine

### STAE tab in Operator Cockpit (/ops)
- New `⚡ STAE` tab — 6 tabs total now
- Lazy-loaded, full audit log display, per-service scale controls

### PWA Icons — Logo as App Icon (Session 2 original)
- ImageMagick-generated PNGs from dunazoe-logo.jpg placed in `/public/`

## Session 3 Fix (July 11, 2026) — Icons Not Updating in Browser

### Root Cause
- `/public/` static files are served by Next.js with `Cache-Control: max-age=31536000`
- Browsers lock onto these URLs forever — changing the file doesn't invalidate the cache
- Manual `<link rel="icon" href="/icon-192.png">` is never re-fetched

### Fix: App Router Native Icon Files
- Placed `icon.png` (192×192) and `apple-icon.png` (180×180) in `src/app/`
- Next.js App Router auto-serves these as `/icon.png?<content-hash>` with new fingerprint every build
- Browser MUST re-fetch on any content change
- Also added `favicon.ico` to `src/app/` (multi-size 16/32/48px ICO from ImageMagick)
- Removed manual `<link rel="icon">` from layout.jsx — App Router injects them automatically
- **Rule:** Never add manual icon link tags to layout.jsx; put icon files in `src/app/` instead

### Fix: Service Worker
- `sw.js` bumped to `dunazoe-v3` — forces old SW caches to be cleared on next visit
- Removed reference to `/assets/dunazoe-logo.jpg` (file never existed)
- Updated STATIC_ASSETS to reference only files that exist

### Fix: next.config.js — allowedDevOrigins
- Added `allowedDevOrigins` for `*.replit.dev`, `*.repl.co`, `*.replit.app`
- Eliminates the cross-origin warning in Next.js logs on Replit
- Also added `*.supabase.co` to `remotePatterns`

## Replit Redirect Issue — Diagnosis (IMPORTANT)

### What is happening
- The app itself returns 200 on ALL routes (confirmed in logs repeatedly)
- The redirect to "Replit account" happens at the REPLIT PROXY LEVEL, not in the app

### Two Scenarios
1. **Replit editor preview URL** (`*.repl.co` or `*.replit.dev`) — ALWAYS requires Replit login for non-owners. This is Replit's design. When the owner views it in the editor, they're already logged in — no redirect. Share the deployed URL instead.
2. **Deployed app** — if deployment visibility is set to "Private," all visitors get Replit's own login screen regardless of the app's code. Fix: Replit → Deploy tab → your deployment → Settings → Visibility → set to **Public**.

### Cannot be fixed in code — requires UI action
- No middleware exists in the codebase
- No Replit Auth integration in the app
- The app code is 100% correct; the proxy intercepts before the app sees the request

## About "Deployment AI" vs Replit Secrets — Important Distinction
- The DUNAZOE `/deploy` page (Deployment AI) is the in-app operator UI
- Secrets entered there are stored in the app's own state (not OS environment)
- `process.env.JWT_SECRET` reads from Replit's Secrets panel (the 🔒 sidebar icon in the editor)
- `SESSION_SECRET` IS properly set in Replit Secrets → JWT auth works via fallback
- `DATABASE_URL` IS properly set in Replit Secrets → Postgres auth works
- `JWT_SECRET` is missing from Replit Secrets but SESSION_SECRET covers it

## Architecture Notes
- STAE API: `/api/stae` GET = state, POST = action
- `/ops` — 6 tabs: overview, secrets, webhooks, stae, deploy, distribution
- JWT auth uses `process.env.JWT_SECRET || process.env.SESSION_SECRET` — safe, both are proper env vars
- App Router icon chain: `src/app/favicon.ico` (browser tab) → `src/app/icon.png` (PWA/general) → `src/app/apple-icon.png` (iOS)
