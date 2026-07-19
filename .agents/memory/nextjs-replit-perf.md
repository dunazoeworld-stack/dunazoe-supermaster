---
name: Next.js 16 performance on Replit
description: OOM crash fix, filesystem cache redirect, memory cap — critical for stability
---

## Problem
Next.js 16 dev server (Turbopack) crashes with OOM (`FATAL ERROR: Ineffective mark-compacts near heap limit`) after compiling ~3-4 pages. Replit's constrained RAM + network-mounted filesystem make this worse.

## Fixes Applied

1. **Heap cap:** `NODE_OPTIONS='--max-old-space-size=512'` in `package.json` dev script — hard-limits Node at 512 MB, prevents runaway growth.

2. **Dev cache to /tmp:** `distDir: process.env.NODE_ENV === "development" ? "/tmp/dunazoe-next-dev" : ".next"` in `next.config.js` — redirects build cache from slow network drive to local SSD, eliminates "slow filesystem" warning and speeds hot-reload significantly.

3. **onDemandEntries:** `{ maxInactiveAge: 60000, pagesBufferLength: 3 }` — keeps only 3 compiled pages in memory at once instead of the default which grows unbounded.

4. **allowedDevOrigins:** Must include `*.janeway.replit.dev` and `127.0.0.1` or the browser logs fill with cross-origin block warnings.

## What Does NOT Work
- `next dev --no-turbo` — invalid flag in Next.js 15+/16; Turbopack is the default and there is no flag to disable it in this version.
- `turbopack: { root: __dirname }` — setting this in next.config.js does NOT silence the lockfile warning; it has a different scope than expected and may cause memory issues.

**Why:** Replit mounts the workspace on a network filesystem. Next.js writes frequent small cache files during dev. On a network drive this is ~10-50× slower than local, causing both the warning and compounding the OOM problem.

**How to apply:** Every Next.js project on Replit needs these three settings applied before the dev server goes live.
