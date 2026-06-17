# WEBHOOK_APPROVAL.md — Phase 24
## DUNAZOE Webhook Activation | 2026-06-17

## STATUS: PENDING — Register URLs after first deploy

---

## WEBHOOK ENDPOINTS (already in codebase)

### Paystack
- URL: `https://<your-replit-url>/api/payments/paystack/webhook`
- Events: charge.success, transfer.success, transfer.failed, refund.processed
- Signature: X-Paystack-Signature (HMAC-SHA512) — IMPLEMENTED

### Stripe
- URL: `https://<your-replit-url>/api/payments/stripe/webhook`
- Events: payment_intent.succeeded, payment_intent.failed, customer.subscription.*
- Signature: Stripe-Signature (HMAC-SHA256) — IMPLEMENTED

---

## REGISTRATION STEPS

### Paystack
1. https://dashboard.paystack.com → Settings → Webhooks
2. Add webhook URL (use .replit.app production URL)
3. Copy webhook secret → Replit Secrets → PAYSTACK_WEBHOOK_SECRET

### Stripe
1. https://dashboard.stripe.com/webhooks
2. Add endpoint → paste Stripe webhook URL
3. Select events above
4. Copy signing secret → Replit Secrets → STRIPE_WEBHOOK_SECRET

---

## SECURITY FEATURES — ALL IMPLEMENTED
- HMAC signature validation
- Timestamp verification (5-minute replay window)
- Replay protection via idempotency keys
- RabbitMQ queue-based processing
- Automatic retry (3 attempts with backoff)
- Dead letter queue for failed events
- Raw body preserved for signature verification
- Never trust payload without signature check

## TEST AFTER REGISTRATION
```bash
# Use Paystack test mode dashboard to send test event
# Check /deployment/logs for webhook receipt confirmation
```
