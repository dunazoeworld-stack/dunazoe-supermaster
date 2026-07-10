---
name: DUNAZOE Frontend Bug Fixes (July 2026)
description: Durable fixes applied in the July 2026 audit/bug-fix session — what broke, what was fixed, and rules to maintain going forward.
---

# DUNAZOE Frontend — Fixed Bugs & Rules

## Critical Fixes

### Dynamic route params — Next.js 14 compat
- `/products/[id]/page.jsx` and `/orders/[id]/page.jsx` were using `use(params)` (React 19 / Next.js 15 pattern)
- In Next.js 14, `params` is a plain object — `use(params)` throws "unsupported type", causing 500s
- **Fix:** `const { id } = params;` — remove `import { use }` entirely
- **Why:** This repo pins Next.js 14.x; `use(params)` only works in Next 15+

### JWT hardcoded fallback — security
- `api/ops/status/route.js`, `api/auth/login/route.js`, `api/auth/register/route.js` all had `|| "dunazoe_secret_change_in_prod"` fallback
- Allows token forgery if `JWT_SECRET`/`SESSION_SECRET` are unset
- **Fix:** Remove fallback; fail closed — log FATAL and reject all requests if secret missing
- **Rule:** Never add `|| "hardcoded_string"` after JWT_SECRET reads in this codebase

## Minor Fixes

### Viewport metadata — Next.js 14
- `layout.jsx` had `themeColor`, `colorScheme`, `viewport` inside `metadata` export — deprecated
- **Fix:** Move to named `export const viewport = { ... }` in same file
- `images.domains` in `next.config.js` deprecated → use `images.remotePatterns`

### Autocomplete attributes
- Password/email inputs in `login`, `register`, `deploy` pages missing `autocomplete`
- Added: `autoComplete="current-password"`, `autoComplete="email"`, `autoComplete="new-password"`, etc.

### Operator cockpit cross-link
- `/deploy` footer had no link back to `/ops` (Operator Cockpit)
- Added: `← Back to DUNAZOE` + `🛸 Operator Cockpit →` side by side

## Architecture Notes
- `/ops` = Operator Cockpit (secure, JWT-gated, loads secrets/webhooks/pwa status from `/api/ops/status`)
- `/deploy` = Deployment AI UI (connects to deployment-ai microservice at port 4027 via gateway at 3000)
- Both pages cross-link each other; `/admin` page links to both
- `jsonwebtoken` is in **root** `node_modules` (not frontend's), accessed via monorepo resolution — do not add it to `apps/core/frontend/package.json`

## Route Health (all return 200 after fixes)
All 22+ routes tested and confirmed 200. Previously broken: `/products/[id]` and `/orders/[id]` (500 → 200).
