---
name: July 2026 Feature Activation
description: Chat widget, notification bell, full product listing form, marketing AI, logistics zones, share button, deployment AI download — all added July 2026
---

# July 2026 Feature Push

## ChatWidget (no socket.io-client dependency)
- `src/components/ChatWidget.jsx` — REST polling only (5s for messages, 20s for convos)
- Floating 💬 button, fixed bottom-right, global in layout.jsx
- `dz:open-chat` DOM event lets product pages pre-fill receiver_id + name
- socket.io-client is NOT installed in frontend/package.json — do not use dynamic import for it; pure REST polling is the pattern

**Why:** socket.io-client causes Next.js module-not-found at build time even with dynamic import. REST polling is sufficient until the package is installed.

## NotificationBell
- `src/components/NotificationBell.jsx` — polls `/api/notifications?limit=15` every 20s
- Badge shows unread count, dropdown with mark-read / mark-all-read
- Rendered inside Navbar.jsx (right of cart icon)

## Vendor Product Listing (`/vendor/onboard`)
Full rewrite. New fields:
- Multi-image upload (up to 5, via `/api/upload/product-image` proxy → upload-service:4020)
- Colors (tag input — hex or name)
- Sizes (tag input — clothing or numeric)
- Weight, stock_quantity, brand, material, dimensions, country_of_origin, dispatch_time, return_policy
- Digital: file_format, file_size, license_type, language, compatibility, updates_included, drm_protected
- Service: service_duration, service_area, service_includes, service_excludes, booking_note
- Logistics provider picker: Shipbubble, GIGM, Jumia Express, Self Delivery
- Self-delivery zone tag input (towns/cities for coverage)
- AI assistant button → calls `/products/ai/assist` → shows suggested price, badge, tips

## Upload Proxy API Route
`src/app/api/upload/product-image/route.js` — proxies POST to UPLOAD_SERVICE_URL (default localhost:4020)

## Marketing AI (`/vendor/marketing`)
`src/app/vendor/marketing/page.jsx`
- 6 formats: WhatsApp, Instagram, Facebook, Twitter, product_desc, email
- 6 tones: Friendly, Professional, Urgent, Luxury, Playful, Bold
- Promo text field
- Copy + social share buttons
- Inline fallback generator (no external API cost)
- Calls `/api/ops/product-ai` with operation=marketing_copy

## Product Share Button (`/products/[id]`)
Added below CTA: 📤 Share (native share API + clipboard fallback), 📱 WhatsApp, 💬 Chat Vendor (dispatches dz:open-chat event to ChatWidget)

## Deployment AI Download (`/deploy/download`)
`src/app/deploy/download/page.jsx` + `src/app/api/deploy/download/route.js`
- Lists v2.0.0 (STABLE) and v1.5.0 (LEGACY)
- Download button → tries real API, falls back to GitHub releases
- GitHub releases URL: https://github.com/dunazoe/dunazoe-os/releases

## GitHub
Pushed to: https://github.com/dunazoeworld-stack/dunazoe-supermaster (main branch)
All 10 files committed and pushed successfully.

**How to apply:** ChatWidget always uses REST polling. Never dynamic-import socket.io-client in frontend until it's added to frontend/package.json. Notification polling hits /api/notifications (gateway proxies to notification-service:4017).
