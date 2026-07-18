---
name: Cloudinary Upload Fix
description: Why Cloudinary upload kept failing and the definitive fix using native crypto+fetch
---

## Rule
Never use the Cloudinary Node.js SDK in Next.js App Router API routes.
Use Node.js built-in `crypto` + native `fetch` to call the Cloudinary REST API directly.

## Why
Two compounding problems:
1. The `cloudinary` package was not in `apps/core/frontend/package.json` — only in the root — and the SDK import silently failed in certain Next.js compilation paths.
2. Top-level `const` reads of `process.env` in Next.js App Router modules execute at module eval time (before runtime env injection), so credentials always appeared empty.

Moving `process.env` reads inside the handler body fixes problem 2, but problem 1 (missing SDK) must also be addressed. Using native `crypto` + `fetch` eliminates the package dependency entirely.

## How to apply
In any Next.js App Router route that needs Cloudinary:
```js
import crypto from "crypto";
// Inside the POST handler:
const timestamp = Math.round(Date.now() / 1000).toString();
const paramsToSign = `folder=${folder}&timestamp=${timestamp}`;
const signature = crypto.createHash("sha1").update(paramsToSign + API_SECRET).digest("hex");
// Then POST multipart form to: https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload
```
- Params to sign must be sorted alphabetically, excluding api_key/file/resource_type.
- For raw files: POST to `/raw/upload`, set `resource_type=raw` in form AND include in sign params.

## Env vars (confirmed present as of July 2026)
- `CLOUDINARY_CLOUD_NAME` = `dtx17sg1m` — shared env var
- `CLOUDINARY_API_KEY` = `634966339231127` — shared env var
- `CLOUDINARY_API_SECRET` — Replit Secret (not a shared env var)
