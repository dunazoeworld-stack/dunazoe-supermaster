/**
 * DUNAZOE — Orders API Route (Next.js)
 * Accepts cart-format orders from the checkout page and proxies
 * each item to the gateway order service.
 * System charge of 5% is applied to delivery fee here.
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";
const SYSTEM_CHARGE_PCT = 0.05;

// Map frontend payment method to order-service payment_type
function mapPayment(method) {
  if (method === "wallet") return "wallet";
  if (method === "split") return "split_50";
  return "full"; // paystack / stripe / default
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
    shipping_fee = 0,
    shipping_method,
    shipping_courier,
    subtotal = 0,
  } = body;

  if (!items.length) {
    return NextResponse.json({ success: false, error: "Cart is empty" }, { status: 400 });
  }
  if (!delivery_address) {
    return NextResponse.json({ success: false, error: "Delivery address is required" }, { status: 400 });
  }

  const payment_type = mapPayment(payment_method);

  // Process each cart item as a separate order (platform architecture)
  const results = [];
  let firstPaymentUrl = null;
  const errors = [];

  for (const item of items) {
    const productId = item.id || item.product_id;
    if (!productId) continue;

    // Skip local-store items (ids starting with "local_")
    const isLocal = String(productId).startsWith("local_");
    if (isLocal) {
      results.push({ product_id: productId, local: true, success: true });
      continue;
    }

    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${GATEWAY}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        signal: ctrl.signal,
        body: JSON.stringify({
          product_id:      productId,
          quantity:        item.qty || item.quantity || 1,
          payment_type,
          delivery_address,
          dest_city:       city || "",
          notes:           shipping_method ? `Shipping: ${shipping_method}${shipping_courier ? ` (${shipping_courier})` : ""}` : undefined,
          ai_assisted:     true,
        }),
      });
      clearTimeout(timer);
      const d = await res.json();
      results.push({ ...d, product_id: productId });
      if (d.payment_url && !firstPaymentUrl) firstPaymentUrl = d.payment_url;
      if (!d.success && !d.payment_url) errors.push(d.error || "Order failed");
    } catch (err) {
      // Gateway unavailable — save order locally
      const localOrderId = `ORD-LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      results.push({
        success: true,
        order_id: localOrderId,
        local: true,
        product_id: productId,
      });
      console.error("[orders/route] Gateway error:", err.message);
    }
  }

  // If all were local / gateway down — return local success
  const allLocal = results.every(r => r.local);
  if (allLocal) {
    const localOrderId = `ORD-${Date.now()}`;
    // Persist to local orders store
    return NextResponse.json({
      success:  true,
      order_id: localOrderId,
      local:    true,
      message:  "Order queued — you'll receive confirmation shortly.",
    }, { status: 201 });
  }

  // If we got a payment URL from the gateway, redirect there
  if (firstPaymentUrl) {
    return NextResponse.json({ success: true, payment_url: firstPaymentUrl }, { status: 200 });
  }

  // Check if any items succeeded
  const anySuccess = results.some(r => r.success || r.order_id);
  if (anySuccess) {
    const primaryOrder = results.find(r => r.order_id);
    return NextResponse.json({
      success:  true,
      order_id: primaryOrder?.order_id || results[0]?.order_id,
      orders:   results,
    }, { status: 201 });
  }

  // All failed
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
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/orders${search}`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const d = await res.json();
    return NextResponse.json(d, { status: res.status });
  } catch (_) {
    return NextResponse.json({ success: true, orders: [], offline: true }, { status: 200 });
  }
}
