---
name: Products local store
description: How published products are persisted and shown in the marketplace when the gateway (port 3000) is offline
---

# Products Local Store Pattern

## Rule
`apps/core/frontend/local_data/products.json` is a file-based fallback store for products when the gateway (port 3000) is offline.

**Why:** The gateway microservice doesn't run in this Replit env, so `fetch("http://localhost:3000/products")` always fails. Without a fallback, the products page is always empty.

## How to apply
- `POST /api/products` → writes to the JSON file store (returns `source: "local_store"`)
- `GET /api/products` → tries gateway first; on failure merges local JSON store + localStorage client-side
- Vendor `onboard/page.jsx` saves each published product to `localStorage.getItem("dunazoe_products_store")` so `/products` page can merge it immediately (even before API poll resolves)
- `products/page.jsx` merges API results with `localStorage.getItem("dunazoe_products_store")` on the client, de-duping by `id`

## File path
`apps/core/frontend/local_data/products.json` — must exist (even as `[]`) for the API route to work; the directory is gitignored for some setups so verify it's tracked.
