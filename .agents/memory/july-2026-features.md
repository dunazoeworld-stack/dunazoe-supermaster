---
name: July 2026 Feature Activation
description: Chat widget, notification bell, full product listing form, marketing AI, logistics zones, share button, deployment AI standalone panel — all added July 2026
---

# July 2026 Feature Push

## Self-Update Notification System
- `src/components/UpdateNotifier.jsx` — renders banner "🚀 Update ready — tap to refresh" when new SW is found
- `src/app/api/version/route.js` — returns `{ version, build, features }` (bump BUILD_VERSION env to trigger client banner)
- `public/sw.js` bumped to `dunazoe-v4`; removed `skipWaiting()` from install so new SW waits and notifies client
- SW activates on `SKIP_WAITING` message from UpdateNotifier; broadcasts `SW_ACTIVATED` to all open tabs on activate
- UpdateNotifier also polls `/api/version` every 5 min to catch server-side deploys
- Both UpdateNotifier and ChatWidget imported in `src/app/layout.jsx`

**Why:** Old sw.js called skipWaiting() immediately, so users never saw an update banner. New flow: install → wait → notify → user taps → skipWaiting → reload.

## ChatWidget (no socket.io-client dependency)
- `src/components/ChatWidget.jsx` — REST polling only (5s for messages, 20s for convos)
- Floating 💬 button, fixed bottom-right, global in layout.jsx
- `dz:open-chat` DOM event lets product pages pre-fill receiver_id + name
- socket.io-client is NOT installed in frontend/package.json — do not use dynamic import for it; pure REST polling is the pattern

**Why:** socket.io-client causes Next.js module-not-found at build time even with dynamic import.

## Deployment AI Standalone Superuser Panel (`/deploy/download`)
- Full rewrite — this IS the PWA superuser app (not a ZIP download)
- Shows step-by-step PWA install guide (Android Chrome / iOS Safari "Add to Home Screen")
- Shows live platform status via `/api/deploy/proxy?path=/deployment/status` (polls every 30s)
- Remote control buttons: Run Audit, Status, Monitor, GitHub, Backup, Rollback
- Results shown inline; graceful offline mode when deployment-ai-service (port 4027) is down
- Nav grid to all /deploy/* and /ops/* control pages

## Deploy Proxy API (`/api/deploy/proxy`)
- Generic reverse-proxy to deployment-ai-service at port 4027 (or DEPLOY_SERVICE_URL env)
- Whitelisted paths: /deployment/status, /deployment/audit, /deployment/monitor, /deployment/rollback, /deployment/github, /deployment/self/backup, /health
- Returns graceful offline mock if service is down so phone app doesn't crash

## Vendor Dashboard Quick Actions
- Added Marketing AI tile (→ /vendor/marketing) and Deploy Panel tile (→ /deploy/download)
- Grid changed from `repeat(4,1fr)` to `repeat(auto-fit,minmax(90px,1fr))` for responsive 6-tile layout

## NotificationBell
- `src/components/NotificationBell.jsx` — polls `/api/notifications?limit=15` every 20s
- Rendered inside Navbar.jsx (right of cart icon)

## Vendor Product Listing (`/vendor/onboard`)
Full rewrite. New fields:
- Multi-image upload (up to 5, via `/api/upload/product-image` proxy → upload-service:4020)
- Colors, Sizes (tag inputs), Weight, stock, brand, material, dimensions, dispatch, return policy
- Digital: file_format, file_size, license_type, language, compatibility, DRM, updates
- Service: duration, area, includes, excludes, booking_note
- Logistics provider: Shipbubble, GIGM, Jumia Express, Self Delivery with zone tag input
- AI assistant button → calls `/products/ai/assist`

## Product Share Button (`/products/[id]`)
Added below CTA: 📤 Share (native API + clipboard), 📱 WhatsApp, 💬 Chat Vendor (dispatches dz:open-chat)

## Marketing AI (`/vendor/marketing`)
6 formats × 6 tones, inline fallback generator, copy + social share

## GitHub
Pushed to: https://github.com/dunazoeworld-stack/dunazoe-supermaster (main branch) — all changes committed.

## Hydration Rule
Any value derived from window (location.href, matchMedia, navigator.standalone) MUST be read in useEffect and stored in state with a safe SSR default. Never access window directly in JSX.

**How to apply:** Whenever adding browser-only values to JSX, use `const [val, setVal] = useState(safeDefault)` + `useEffect(() => setVal(window.X), [])`.
