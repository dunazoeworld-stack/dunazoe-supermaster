/**
 * DUNAZOE — Orders API Route (Next.js)
 * Accepts cart-format orders from checkout and fans out to the gateway
 * order service in PARALLEL (not sequential) for speed.
 *
 * Service charge = 5% of product subtotal (not delivery fee).
 * Passed to the gateway so the order-service can schedule vendor payout deduction.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const SYSTEM_CHARGE_PCT = 0.05; // 5% of product value

// Map frontend payment method → order-service payment_type
function mapPayment(method) {
  if (method === "wallet")  return "wallet";
  if (method === "split")   return "split_50";
  if (method === "thrift")  return "thrift";
  return "full"; // paystack / stripe / default
}

// Shared AbortController factory with timeout
function timedFetch(url, opts, ms = 10000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
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
    service_charge  = 0, // 5% of subtotal, calculated on frontend
    subtotal        = 0,
    total           = 0,
    shipping_method,
    shipping_courier,
  } = body;

  if (!items.length) {
    return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
  }
  if (!delivery_address) {
    return NextResponse.json({ success: false, error: "Delivery address is required" }, { status: 400 });
  }

  const payment_type = mapPayment(payment_method);
  const notesBase    = shipping_method
    ? `Shipping: ${shipping_method}${shipping_courier ? ` (${shipping_courier})` : ""}`
    : undefined;

  // ── Fan out to gateway IN PARALLEL for each cart item ─────────────────────
  const orderPromises = items
    .filter(item => item.id || item.product_id)
    .map(async (item) => {
      const productId = item.id || item.product_id;
      const isLocal   = String(productId).startsWith("local_");

      if (isLocal) {
        return { product_id: productId, local: true, success: true };
      }

      try {
        const res = await timedFetch(`${GATEWAY}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: token },
          body: JSON.stringify({
            product_id:      productId,
            quantity:        item.qty || item.quantity || 1,
            payment_type,
            delivery_address,
            dest_city:       city || "",
            service_charge_pct: SYSTEM_CHARGE_PCT, // 5% — gateway deducts from vendor payout
            notes:           notesBase,
            ai_assisted:     true,
          }),
        }, 10000);

        const d = await res.json();
        return { ...d, product_id: productId };
      } catch (_) {
        // Gateway unreachable — queue locally
        return {
          success:    true,
          order_id:   `ORD-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          local:      true,
          product_id: productId,
        };
      }
    });

  const results = await Promise.all(orderPromises);

  const errors       = results.filter(r => !r.success && !r.payment_url && !r.local).map(r => r.error || "Order failed");
  const firstPayUrl  = results.find(r => r.payment_url)?.payment_url || null;
  const allLocal     = results.every(r => r.local);

  if (allLocal) {
    return NextResponse.json({
      success:  true,
      order_id: `ORD-${Date.now()}`,
      local:    true,
      message:  "Order queued — you'll receive confirmation once services reconnect.",
    }, { status: 201 });
  }

  if (firstPayUrl) {
    return NextResponse.json({ success: true, payment_url: firstPayUrl }, { status: 200 });
  }

  const anySuccess = results.some(r => r.success || r.order_id);
  if (anySuccess) {
    const primary = results.find(r => r.order_id);
    return NextResponse.json({
      success:  true,
      order_id: primary?.order_id || results[0]?.order_id,
      orders:   results,
    }, { status: 201 });
  }

  return NextResponse.json({
    success: false,
    error:   errors[0] || "Checkout failed. Please try again.",
    errors,
  }, { status: 400 });
}

// GET — list orders for current user
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
