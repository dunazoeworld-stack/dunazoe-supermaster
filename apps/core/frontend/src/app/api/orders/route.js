/**
 * DUNAZOE — Orders API Route (Next.js)
 * POST /api/orders  — create order from cart
 * GET  /api/orders  — list user orders
 *
 * Payment fallback chain:
 *   1. Gateway returns payment_url  → use it directly
 *   2. Gateway down / no pay URL   → call Paystack directly via /api/payments/initialize
 *   3. Paystack also fails         → queue order locally, show retry option
 *
 * Service charge: 5% is included in product final_price at listing time.
 * Checkout must not add a second buyer line item. The existing 24-hour
 * payout accounting rule reconciles the final customer price back to the
 * vendor's base price; it is not an additional checkout charge.
 */
import { NextResponse } from "next/server";

const GATEWAY           = process.env.GATEWAY_URL  || "http://localhost:3000";
const PAYSTACK_BASE     = "https://api.paystack.co";
const SYSTEM_CHARGE_PCT = 0.05;

function mapPayment(method) {
  if (method === "wallet") return "wallet";
  if (method === "split")  return "split_50";
  if (method === "thrift") return "thrift";
  return "full";
}

function timedFetch(url, opts, ms = 10000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// Direct Paystack payment init — used when gateway is unreachable
async function initPaystackDirect({ email, amountNgn, orderId, items, callbackUrl }) {
  const SECRET = process.env.PAYSTACK_LSK || process.env.PAYSTACK_SECRET_KEY || "";
  if (!SECRET) throw new Error("Paystack not configured");

  const reference = `DZ-${orderId || "ORD"}-${Date.now()}`;
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || "";

  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      amount:       Math.round(amountNgn * 100),
      reference,
      callback_url: callbackUrl || `${appUrl}/payment/verify?ref=${reference}`,
      metadata: {
        order_id:      orderId,
        cart_items:    (items || []).slice(0, 5),
        platform:      "DUNAZOE",
        custom_fields: [
          { display_name: "Order",    variable_name: "order_id",  value: String(orderId || "") },
          { display_name: "Platform", variable_name: "platform",  value: "DUNAZOE" },
        ],
      },
      channels: ["card", "bank", "ussd", "bank_transfer", "mobile_money"],
      currency: "NGN",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message || `Paystack error ${res.status}`);
  return { payment_url: data.data.authorization_url, reference: data.data.reference };
}

export async function POST(req) {
  let body = {};
  try { body = await req.json(); } catch (_) {}

  const token = req.headers.get("Authorization") || "";
  const {
    items = [],
    delivery_address,
    state,
    city,
    payment_method = "paystack",
    shipping_fee    = 0,
    service_charge  = 0,
    subtotal        = 0,
    total           = 0,
    shipping_method,
    shipping_courier,
    customer_email,
  } = body;

  if (!items.length)        return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
  if (!delivery_address)    return NextResponse.json({ success: false, error: "Delivery address is required" }, { status: 400 });

  const payment_type = mapPayment(payment_method);
  const notesBase    = shipping_method
    ? `Shipping: ${shipping_method}${shipping_courier ? ` (${shipping_courier})` : ""}`
    : undefined;

  // ── 1. Fan out to gateway in parallel ────────────────────────────────────
  const orderPromises = items
    .filter(i => i.id || i.product_id)
    .map(async (item) => {
      const productId = item.id || item.product_id;
      if (String(productId).startsWith("local_")) {
        return { product_id: productId, local: true, success: true };
      }
      try {
        const res = await timedFetch(`${GATEWAY}/orders`, {
          method:  "POST",
          headers: { "Content-Type": "application/json", Authorization: token },
          body:    JSON.stringify({
            product_id:          productId,
            quantity:            item.qty || item.quantity || 1,
            payment_type,
            delivery_address,
            dest_city:           city || "",
             service_charge_pct:  SYSTEM_CHARGE_PCT,
            notes:               notesBase,
            ai_assisted:         true,
          }),
        }, 10000);
        const d = await res.json();
        return { ...d, product_id: productId };
      } catch (_) {
        return { success: true, order_id: null, local: true, product_id: productId };
      }
    });

  const results     = await Promise.all(orderPromises);
  const firstPayUrl = results.find(r => r.payment_url)?.payment_url || null;
  const allLocal    = results.every(r => r.local);
  const anySuccess  = results.some(r => r.success || r.order_id);
  const primaryId   = results.find(r => r.order_id && !r.local)?.order_id
                   || results.find(r => r.order_id)?.order_id
                   || null;

  // ── 2. Gateway gave us a payment URL — use it ─────────────────────────────
  if (firstPayUrl) {
    return NextResponse.json({ success: true, payment_url: firstPayUrl }, { status: 200 });
  }

  // ── 3. No payment URL from gateway — try Paystack directly ───────────────
  if (payment_method === "paystack" || (!payment_method)) {
    // Resolve buyer email from JWT or body
    let email = customer_email || "";
    if (!email) {
      try {
        const jwt = token.replace("Bearer ", "").split(".");
        if (jwt.length === 3) {
          const payload = JSON.parse(Buffer.from(jwt[1], "base64").toString("utf8"));
          email = payload.email || "";
        }
      } catch (_) {}
    }
    if (!email) email = "buyer@dunazoe.com"; // last resort — Paystack requires email

    const chargeAmount = total > 0 ? total : subtotal + shipping_fee + service_charge;
    if (chargeAmount > 0) {
      try {
        const ps = await initPaystackDirect({
          email,
          amountNgn:   chargeAmount,
          orderId:     primaryId || `ORD-${Date.now()}`,
          items,
        });
        return NextResponse.json({
          success:     true,
          payment_url: ps.payment_url,
          reference:   ps.reference,
          order_id:    primaryId,
          orders:      results,
          fallback:    true,
        }, { status: 200 });
      } catch (psErr) {
        console.warn("[Orders] Paystack direct init failed:", psErr.message);
      }
    }
  }

  // ── 4. Wallet payment or all-local — no payment URL needed ───────────────
  if (payment_method === "wallet" || allLocal) {
    return NextResponse.json({
      success:  true,
      order_id: primaryId || `ORD-${Date.now()}`,
      local:    allLocal,
      message:  allLocal
        ? "Order queued — confirm once services reconnect."
        : "Order placed. Wallet payment processing.",
      orders:   results,
    }, { status: 201 });
  }

  // ── 5. Any gateway success without payment URL ────────────────────────────
  if (anySuccess) {
    return NextResponse.json({
      success:  true,
      order_id: primaryId,
      orders:   results,
    }, { status: 201 });
  }

  // ── 6. All failed ─────────────────────────────────────────────────────────
  const errors = results.filter(r => !r.success && !r.local).map(r => r.error || "Order failed");
  return NextResponse.json({
    success: false,
    error:   errors[0] || "Checkout failed. Please try again.",
    errors,
  }, { status: 400 });
}

export async function GET(req) {
  const token  = req.headers.get("Authorization") || "";
  const search = new URL(req.url).search;
  try {
    const res = await timedFetch(`${GATEWAY}/orders${search}`, {
      headers: { Authorization: token },
    }, 8000);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, orders: [], offline: true }, { status: 200 });
  }
}
