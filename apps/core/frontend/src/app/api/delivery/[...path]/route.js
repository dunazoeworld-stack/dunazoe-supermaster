/**
 * DUNAZOE — Delivery Vendor API proxy
 * Routes: /api/delivery/*
 *
 *   GET  /api/delivery/profile                — agent profile
 *   POST /api/delivery/register               — register as delivery vendor
 *   GET  /api/delivery/assignments            — active assignments
 *   POST /api/delivery/track                  — update tracking stage
 *   GET  /api/delivery/earnings               — earnings summary
 *   POST /api/express/assign                  — (admin) assign delivery
 *   POST /api/express/quote                   — get shipping quotes
 */
import { NextResponse } from "next/server";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:3000";

async function deliveryProxy(req, { params }) {
  const path    = (await params).path || [];
  const subPath = path.join("/");
  const token   = req.headers.get("Authorization") || "";

  // Map frontend-friendly paths to gateway paths
  const pathMap = {
    "profile":     "vendors/me/profile",
    "register":    "delivery/register",
    "assignments": "dunazoe-express/assignments",
    "track":       "dunazoe-express/track",
    "earnings":    "delivery/earnings",
  };

  const gatewayPath = pathMap[subPath] || `dunazoe-express/${subPath}`;
  const url = `${GATEWAY}/${gatewayPath}`;

  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  const finalUrl = queryString ? `${url}?${queryString}` : url;

  const opts = {
    method:  req.method,
    headers: { Authorization: token },
  };

  if (["POST","PUT","PATCH"].includes(req.method)) {
    let body = {};
    try { body = await req.json(); } catch (_) {}

    // For /register, convert to vendor update with can_deliver=true
    if (subPath === "register") {
      opts.headers["Content-Type"] = "application/json";

      // First check if vendor exists, then update with can_deliver flag
      // Try to update existing vendor profile with delivery capabilities
      try {
        const vendorRes = await fetch(`${GATEWAY}/vendors/me/profile`, {
          headers: { Authorization: token },
        });
        const vendorData = await vendorRes.json();

        if (vendorData.success && vendorData.vendor?.id) {
          // Update existing vendor
          const updateRes = await fetch(`${GATEWAY}/vendors/${vendorData.vendor.id}`, {
            method:  "PUT",
            headers: { "Content-Type": "application/json", Authorization: token },
            body:    JSON.stringify({
              pickup_address: body.pickup_address,
              lat:            body.lat,
              lng:            body.lng,
              can_deliver:    true,
              service_area:   body.service_area || "local",
            }),
          });
          const updateData = await updateRes.json().catch(() => ({}));
          if (updateData.success) {
            // Also update user phone if provided
            if (body.phone) {
              await fetch(`${GATEWAY}/users/me`, {
                method:  "PUT",
                headers: { "Content-Type": "application/json", Authorization: token },
                body:    JSON.stringify({ phone: body.phone }),
              }).catch(() => {});
            }
            return NextResponse.json({
              success: true,
              message: "Registered as DUNAZOE Express delivery agent! You will now receive delivery assignments in your area.",
              agent: updateData.vendor || vendorData.vendor,
            });
          }
        }
      } catch (_) {}

      // No vendor — create one as a delivery vendor
      const res = await fetch(`${GATEWAY}/vendors`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: token },
        body:    JSON.stringify({
          business_name:  "DUNAZOE Express Agent",
          type:           "delivery",
          lat:            body.lat,
          lng:            body.lng,
          pickup_address: body.pickup_address,
          can_deliver:    true,
          service_area:   body.service_area || "local",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success || data.vendor_id) {
        return NextResponse.json({
          success: true,
          message: "Registered as DUNAZOE Express delivery agent!",
          agent:   data,
        });
      }
      return NextResponse.json(data, { status: res.status });
    }

    // For earnings — computed from assignments
    if (subPath === "earnings") {
      return computeEarnings(token);
    }

    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  // Handle earnings GET
  if (req.method === "GET" && subPath === "earnings") {
    return computeEarnings(token);
  }

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    const res   = await fetch(finalUrl, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    const data  = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Delivery proxy] Error:", err.message);
    return NextResponse.json(
      { success: false, error: "Delivery service temporarily unavailable." },
      { status: 503 }
    );
  }
}

async function computeEarnings(token) {
  try {
    const ctrl  = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(`${GATEWAY}/dunazoe-express/assignments?status=delivered`, {
      headers: { Authorization: token },
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({ assignments: [] }));
    const assignments  = data.assignments || [];
    const total        = assignments.length;
    const total_earned = assignments.reduce((s, a) => s + parseFloat(a.estimated_cost || 0) * 0.02, 0);
    const MILESTONE_BONUS = Math.floor(total / 100) * 5000;

    return NextResponse.json({
      success:          true,
      total_deliveries: total,
      total_earned:     parseFloat((total_earned + MILESTONE_BONUS).toFixed(2)),
      pending_payout:   parseFloat((total_earned * 0.4).toFixed(2)), // estimate
      milestone_bonuses: MILESTONE_BONUS,
    });
  } catch (_) {
    return NextResponse.json({
      success: true,
      total_deliveries: 0,
      total_earned: 0,
      pending_payout: 0,
    });
  }
}

export const GET    = deliveryProxy;
export const POST   = deliveryProxy;
export const PUT    = deliveryProxy;
export const DELETE = deliveryProxy;
