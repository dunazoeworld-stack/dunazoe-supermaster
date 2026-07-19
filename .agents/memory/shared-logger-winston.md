---
name: Shared logger winston resolution
description: Why deployment-ai-service cannot find winston via apps/core/shared/logger.js and the fix
---

# Shared Logger Winston Resolution

## Rule
`apps/core/shared/logger.js` requires `winston`. Node's module resolution looks UP from `shared/`, not down into individual service `node_modules/` dirs.

**Why:** When `deployment-ai-service/index.js` calls `require("../../shared/logger")`, Node resolves `winston` starting from `apps/core/shared/`, not from `apps/core/services/deployment-ai-service/`. Each service installs its own `winston` in its own `node_modules/`, but that's on a different path branch — invisible to `shared/logger.js`.

## Fix applied
Run `npm install winston` inside `apps/core/shared/` — this puts winston in `apps/core/shared/node_modules/` where the logger can find it.

## How to apply
If deployment-ai-service (or any service that imports from shared/) reports `MODULE_NOT_FOUND` for a package, install that package in `apps/core/shared/` in addition to (or instead of) the service's own package.json.
