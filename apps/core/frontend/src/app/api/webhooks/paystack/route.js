/**
 * POST /api/webhooks/paystack
 * Canonical Paystack webhook URL — register this in the Paystack dashboard.
 * Delegates to the shared payments/webhook handler (HMAC-SHA512 verification).
 */
export { POST } from "../../payments/webhook/route.js";
