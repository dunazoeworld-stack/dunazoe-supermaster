# DUNAZOE Environment Setup

This checklist documents configuration names only. Secret values must be stored in Replit Secrets or the target environment and must never be committed, printed, or placed in browser code.

## Runtime-managed

- `DATABASE_URL` — Replit-managed PostgreSQL connection. Do not manually set or request this key.
- `REPLIT_DOMAINS`, `REPLIT_DEV_DOMAIN` — Replit-managed hostnames.

## Authentication

- `JWT_SECRET` — signing key for access tokens. The current application accepts `SESSION_SECRET` as a compatibility alias.
- `SESSION_SECRET` — existing compatibility secret for Next.js API routes and realtime authentication.
- `REFRESH_SECRET` — optional dedicated refresh-token signing key; otherwise the session secret is used.
- `BCRYPT_ROUNDS` — optional password hashing cost; default is 12.

Production must have a strong, non-placeholder JWT/session secret. No service should fall back to a hardcoded secret.

## Payments

- `PAYSTACK_LSK` or `PAYSTACK_SECRET_KEY` — Paystack server secret for initialization, verification, and webhook HMAC checks.
- `PAYSTACK_WEBHOOK_SECRET` — retain for provider configuration/audit if used by the deployment.
- `STRIPE_SECRET_KEY` — Stripe server secret for USD checkout.
- `STRIPE_WEBHOOK_SECRET` — Stripe signature verification secret.

Payment routes support Paystack NGN and Stripe USD, provider signature verification, webhook logging, duplicate-event protection, and status checks. Live payment success still requires provider test-mode credentials and webhook delivery.

## Notifications

- `TERMII_API_KEY` — Termii SMS/WhatsApp delivery.
- `TERMII_SENDER_ID` — optional sender identity; defaults to `DUNAZOE`.
- `INTERNAL_SECRET` — service-to-service protection for notification queue flushing.

Without `TERMII_API_KEY`, in-app notifications remain available and outbound SMS/WhatsApp messages remain queued rather than being falsely reported as delivered. Email and push providers require a separate adapter/configuration before enabling them.

## Media and AI

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — signed product/chat media uploads.
- `GEMINI_API_KEY` — AI product/deployment features.

## Logistics

- `DUNAZOE_EXPRESS_URL` — optional internal Express service URL; local fallback quoting works without it.
- Provider credentials for Shipbubble, GIG, DHL, FedEx, or UPS must be added only when the corresponding live adapter is enabled. The quote fallback does not claim a live booking.

## WebRTC calls

- `TURN_PROVIDER` — `coturn` by default; use `cloud`/`cloudflare` only when the corresponding cloud TURN URLs and credentials are configured.
- `TURN_SERVER_URL` or comma-separated `TURN_SERVER_URLS` — TURN endpoint(s), returned only to authenticated call clients.
- `TURN_USERNAME`, `TURN_PASSWORD` — TURN credentials. Prefer short-lived credentials from a TURN provider in production.
- `TURN_SECRET` — optional Coturn REST/API shared secret. When set with `TURN_USERNAME`, the server generates one-hour HMAC credentials and does not return the shared secret.
- `CLOUD_TURN_SERVER_URL` or comma-separated `CLOUD_TURN_SERVER_URLS` — cloud TURN endpoint(s) for the provider abstraction.
- `CLOUD_TURN_USERNAME`, `CLOUD_TURN_CREDENTIAL` — cloud TURN credential pair.
- `NEXT_PUBLIC_REALTIME_URL` — browser URL for the authenticated realtime service.

STUN remains available without TURN, but restrictive NATs require a configured TURN service. The application logic is provider-neutral; Coturn is the launch provider and cloud TURN is a configuration-level migration path.

## Chat storage and behavior

Cloudinary is used for configured chat media uploads. Without Cloudinary credentials, development fallback supports data-URI files up to 2 MB and deliberately returns a service-unavailable response for larger files rather than pretending local storage is durable. Chat messages support authenticated search, reactions, 15-minute sender-only edits, soft deletion, typing state, read state, voice notes, and call-history events.

## Development test accounts

The seed command intentionally does not contain passwords:

```bash
npm run seed:test-users
```

Before running it, provide these through secure development environment values:

- `TEST_SUPER_ADMIN_EMAIL`, `TEST_SUPER_ADMIN_PASSWORD`
- `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`
- `TEST_VENDOR_EMAIL`, `TEST_VENDOR_PASSWORD`
- `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_PASSWORD`
- `TEST_DELIVERY_AGENT_EMAIL`, `TEST_DELIVERY_AGENT_PASSWORD`

The script hashes passwords with bcrypt and prints emails/roles only. It never prints passwords.

## Verification commands

```bash
npm test
npm run build
npm run production-check
```

`production-check` targets the local preview by default. Set `PRODUCTION_CHECK_URL` for another authorized environment.