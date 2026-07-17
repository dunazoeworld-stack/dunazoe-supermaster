---
name: July 2026 Feature Activation
description: All features activated/fixed in the July 2026 session — upload, resilience, activation tab, deploy PWA icon, API proxy defaults
---

## Activated / Fixed — July 16-17 2026

### Upload Engine (FIXED — July 17)
- `/api/upload/product-image/route.js` — rewrote to upload **directly to Cloudinary** with signed request
  - SHA-1 signature: `sha1("folder=dunazoe_products&timestamp=<ts>" + CLOUDINARY_API_SECRET)`
  - Requires: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (all now set in Replit secrets)
  - 3x retry with exponential backoff, 35s timeout per attempt
  - MIME validation + magic-byte check (JPEG/PNG/WebP)
  - Returns: `{ success, url, public_id, format, bytes, width, height }`
- Client-side in `/vendor/onboard/page.jsx`:
  - `compressImage()` — Canvas API → WebP 0.92 quality, max 1400px, falls back to JPEG
  - `uploadWithRetry()` — 3 attempts, 1.2s/2.4s/4.8s backoff, `navigator.onLine` guard
  - `uploadProgress` state — shows "Compressing image 1 of 2…" / "Uploading…" spinner
  - Upload button disabled + spinner while `uploading` state is true

### Network Resilience (FIXED — July 17)
- Upload: offline guard, retry, progress display
- All API proxy routes: AbortController with timeout, graceful fallback responses
- No offline-queue localStorage yet (BETA tracking only via activation engine)

### Activation Engine Tab (NEW — July 17)
- New tab `activation` (🎛️) added to `/ops` Operator Cockpit
- State: `actFeatures`, `actLoading`, `actMsg`, `actToggles`
- Functions: `loadActivation()`, `activateFeature(name, currentState)`
- Optimistic state update on toggle (instant UI feedback)
- `/api/activation/features/route.js` — GET all 14 features; returns mock data when service offline
- `/api/activation/features/[name]/activate/route.js` — POST toggle; acknowledges optimistically when offline
- 14 mock features defined inline in the route for graceful offline rendering

### Deployment AI Superuser PWA — Distinct Icon (NEW — July 17)
- `public/icon-deploy-192.png` + `public/icon-deploy-512.png` — AI-generated rocket/circuit orange icon
- `public/manifest-deploy.json` — separate PWA manifest: name="DUNAZOE Superuser", short_name="DZ Control", theme=#FF6B00, scope=/deploy/
- `src/app/deploy/layout.jsx` — uses `metadata.manifest` + `viewport.themeColor` exports (NO inline `<head>`)
  - **Key rule**: never render `<head>` in a Next.js App Router layout — causes hydration mismatch
  - Use `metadata.manifest` and `viewport` exports to inject `<link>` and theme-color

### API Default Fix (FIXED — July 17)
- 19 pages had `process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"` 
- Fixed to `process.env.NEXT_PUBLIC_API_URL || "/api"` across all pages
- `localhost:3000` is unreachable from Replit preview browser; `/api` routes through Next.js proxy
- Bulk-fixed using Node.js string replacement script

### New API Proxy Routes (NEW — July 17)
- `/api/products/route.js` — GET+POST proxy to gateway:3000; returns `{products:[],total:0,offline:true}` on failure
- `/api/notifications/route.js` — GET+POST proxy to notification-service:4017; returns `{notifications:[],unread:0,offline:true}` on failure

### Previously Activated (July 16)
- Chat widget (REST polling, no socket.io-client)
- Notification bell (polling /api/notifications every 20s)
- Marketing AI page (/vendor/marketing)
- Product listing overhaul (types, colors, sizes, weight, digital, service)
- Logistics self-delivery zones
- Share button on product pages
- Deployment AI download page (PWA install + remote control)
- Update notifier (SW update detection + /api/version polling)

## Environment Variables Required
- `CLOUDINARY_CLOUD_NAME` — set ✓
- `CLOUDINARY_API_KEY` — set ✓
- `CLOUDINARY_API_SECRET` — set ✓ (added July 17)
- `GATEWAY_URL` — not set (defaults to localhost:3000, offline fallback active)
- `NOTIFICATION_SERVICE_URL` — not set (defaults to localhost:4017, offline fallback active)
- `ACTIVATION_ENGINE_URL` — not set (defaults to localhost:4033, mock data served)
- `UPLOAD_SERVICE_URL` — obsolete (no longer used; upload goes direct to Cloudinary)

## Build Verified
- 60/60 pages compiled clean (July 17)
- All pages render without hydration errors
- No browser console errors (WebSocket HMR error is Replit dev-proxy cosmetic only)
- GitHub pushed: commit 3cfb49a on main
