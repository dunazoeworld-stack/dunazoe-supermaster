# DUNAZOE Production QA Matrix

Assessment date: 2026-09-17
Environment: Replit preview and local microservice workflows
Deployment: not performed

## Readiness score

**64 / 100 — code recovery is substantially complete, but staging is not production-ready until workflow secrets, database access, and provider callbacks are verified.**

This is a release gate score, not a product-quality score. The deductions are for unavailable runtime infrastructure and unexecuted live-provider tests, not for silently skipped checks.

## Product and sharing

| Check | Status | Evidence or gate |
|---|---|---|
| Share product link | Pass | Product-sharing regression resolves the current catalog slug. |
| Public product page | Pass | `/p/:slug` and legacy product routes build and return successfully. |
| OpenGraph title/description/image/url/type | Pass | Server-rendered metadata uses `og:type=website` and public HTTPS URLs. |
| WhatsApp/Facebook/Telegram image | Code-ready | Public 1200×630 JPEG endpoint and cache headers are verified; external debuggers require public deployment. |
| Cart image | Code-ready | Image mapping accepts the actual product image fields, remote URLs, arrays, and data URIs. |
| Admin share tester | Pass | `/admin/share-tester` validates page status, canonical URL, metadata, and image preview for admin roles. |

## Communication

| Check | Status | Evidence or gate |
|---|---|---|
| Authenticated Socket.IO signaling | Pass | Two-client invite/answer/end-call smoke test passed previously. |
| STUN + TURN provider abstraction | Code-ready | Authenticated ICE route supports Coturn HMAC credentials and cloud URL configuration. |
| Text, attachments, video, voice notes | Code-ready | Existing client/API paths are present; Cloudinary/live storage needs credentials. |
| Message search | Code-ready | Authenticated conversation search is implemented with bounded query length. |
| Reactions | Code-ready | Participant-only reaction toggle with JSONB storage is implemented. |
| Message editing | Code-ready | Sender-only, 15-minute edit window is implemented. |
| Call history and missed/declined state | Code-ready | Authenticated call-history schema and event route are implemented. |
| Mute/camera/switch-camera/quality state | Code-ready | Client call controls and connection-state indicator are implemented. |
| Cross-NAT voice/video call | Blocked | Requires a reachable Coturn deployment and secure TURN credentials. |

## Payments and wallet

| Check | Status | Evidence or gate |
|---|---|---|
| Paystack/Stripe initialization | Code audit complete | Existing adapters and health routes are present. |
| Webhook signature verification | Code audit complete | Paystack and Stripe signature checks are present. |
| Transaction confirmation/wallet update/escrow | Not runtime-verified | Workflow did not expose database/provider credentials. |
| Refunds/disputes | Not runtime-verified | Requires database-backed staging records and provider test mode. |

## Logistics and notifications

| Check | Status | Evidence or gate |
|---|---|---|
| Delivery assignment/status/tracking/proof | Code audit complete | Logistics service routes and order tracking fields are present. |
| Vendor self-delivery | Code audit complete | Self-delivery quote and assignment paths are present. |
| In-app notifications | Pass at health level | Notification service reports in-app active. |
| Termii/Twilio/WhatsApp/SMS | Blocked | Provider credentials were not available. |
| Firebase push/email | Not enabled | No configured adapter/provider credentials were available. |

## Security and operations

| Check | Status | Evidence or gate |
|---|---|---|
| Secret values protected | Pass | No credentials were printed or committed; secure request was declined. |
| Authentication | Pass | Protected ICE route returns HTTP 401 without a valid token. |
| Hardcoded JWT fallback removal | Pass | Shared auth, auth service, realtime service, and token helpers require configured secrets. |
| Test-account seeding | Ready but not run | Requires secure `TEST_*` values; no plaintext credentials belong in documentation. |
| Database access | Blocked | Core workflow reports `DATABASE_URL` unavailable. |
| Deployment | Not performed | User explicitly required no automatic deployment. |

## Release gates

1. Inject the existing managed database and payment aliases into the microservice workflow without logging values.
2. Configure Coturn on the approved infrastructure, including UDP/TCP/TLS, rate limits, monitoring, and short-lived credentials.
3. Add the missing media/notification/turn values through secure secrets.
4. Run the secure test-account seed command in staging.
5. Run database-backed payment, wallet, escrow, logistics, notification, and full communication tests.
6. Validate deployed share images with WhatsApp, Facebook, and Telegram crawlers.
7. Only then run the controlled deployment flow.