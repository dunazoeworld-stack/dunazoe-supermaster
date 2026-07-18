---
name: Cloudinary REST signing rule
description: How to correctly sign Cloudinary REST API uploads (no SDK) — required params, exclusions, sort order
---

## Rule
All form parameters sent to Cloudinary MUST be included in the SHA-1 signature string **except**: `api_key`, `file`, `resource_type` (when it's already baked into the URL path like `/raw/upload`).

Sort all included param keys alphabetically, join as `key=value&key=value`, then append the API secret and SHA-1 hash.

```js
const signParams = { eager, folder, timestamp }; // all params you're POST-ing
const paramsToSign = Object.keys(signParams).sort().map(k => `${k}=${signParams[k]}`).join("&");
const signature = crypto.createHash("sha1").update(paramsToSign + API_SECRET).digest("hex");
```

**Why:** Cloudinary's signature validation covers every body param you send. If you send `eager` but don't sign it, Cloudinary computes a different string-to-sign and rejects the upload with "Invalid Signature." The error message helpfully includes the string it expected — use that to debug.

**How to apply:** Whenever adding a new Cloudinary upload param (e.g. `tags`, `transformation`, `public_id`), add it to `signParams` too. Never hardcode the params-to-sign string — build it dynamically from the object being posted.

## Cloudinary secret in Replit
`CLOUDINARY_API_SECRET` must be a **Replit Secret** (not a shared env var). If the key appears in `Object.keys(process.env)` but the value is falsy (`""`), the secret was saved blank — user must re-enter it in Replit Secrets panel. The other two Cloudinary vars (`CLOUD_NAME`, `API_KEY`) can be shared env vars since they're not sensitive.
