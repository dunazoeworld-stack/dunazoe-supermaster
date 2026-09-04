# DUNAZOE Product System Update

**Updated:** 2026-09-04
**Scope:** production-safe listing and marketplace display patch

## Pricing contract

At listing time, the vendor enters the product's base price. The system calculates:

```text
system_charge = round(base_price × 0.05, 2)
final_price   = round(base_price + system_charge)
```

The stored fields are:

- `base_price` — vendor-entered amount
- `system_charge` — DUNAZOE's 5% listing charge, adjusted to keep the rounded final price additive
- `final_price` — customer-facing selling price
- `price` — compatibility alias containing `final_price`

The calculation is applied in the vendor UI, the Next.js API fallback, and the product microservice. Existing records remain readable because all customer views fall back to `price` when the new fields are absent.

## Files changed

- `apps/core/shared/schema.sql` — pricing columns.
- `apps/core/services/product-service/index.js` — insert/update calculation and additive startup migration for existing databases.
- `apps/core/frontend/src/app/api/products/route.js` — gateway payload and local-store fallback.
- `apps/core/frontend/src/app/vendor/onboard/page.jsx` — vendor pricing breakdown and local mirror.
- `apps/core/frontend/src/app/products/page.jsx` and `products/[id]/page.jsx` — final price display and responsive actions.
- `apps/core/frontend/src/app/products/[id]/layout.jsx` — HTTPS-safe social image and canonical metadata.

## Compatibility and verification

- Gateway-first behavior and the existing local product store are preserved.
- Checkout now treats each cart item's `price` as the listing-time `final_price`; it does not add a second 5% buyer charge. The existing 24-hour payout accounting entry reconciles the final customer price back to the vendor's stored base price; it is not a second buyer charge.
- A product image that is a data URL is not advertised as a social preview; the public fallback is used instead.
- New products receive collision-safe indexed short slugs such as `/p/product-name-abc-123`; legacy `/products/:id` URLs remain valid.
- Production listing rejects data-URI images so browser-only image bytes are not persisted.
- Before publishing, inspect the rendered `<meta property="og:image">` and response headers from the actual public product URL using a crawler-style request.