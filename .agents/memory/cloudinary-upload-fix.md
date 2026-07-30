---
name: Cloudinary upload fix
description: How the product image upload route is configured and what credential issues to watch for
---

## Setup
Upload route: `apps/core/frontend/src/app/api/upload/product-image/route.js`
Reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` inside the handler at request time (not at module load) — required for Next.js App Router.
Uses native `crypto` + `fetch` REST API to Cloudinary's upload endpoint. SDK imports fail because the Cloudinary SDK is not in the frontend package.json.

## Silent fallback
If any credential is missing/blank the route returns `{ success: false, reason: "missing_credentials" }`.
The vendor onboard page catches this and falls back to a local data-URI (stored in localStorage/local_data/products.json).
This fallback can mask broken cloud credentials — always verify the returned URL starts with `res.cloudinary.com`.

## Blank secret trap
Replit Secrets can be saved with an empty string value — the key appears in `process.env` but `.trim()` returns `""`.
This happened with `CLOUDINARY_API_SECRET` in July 2026. Re-entering the secret via `requestSecrets` fixed it.
All three creds must be non-empty for cloud upload to work.

**Why:** Next.js App Router caches module-level imports; reading creds inside the handler ensures they pick up the latest Replit Secret values after a restart.

**How to apply:** Any time Cloudinary upload fails silently, check all three creds are non-empty strings, not just that the keys exist in env.
