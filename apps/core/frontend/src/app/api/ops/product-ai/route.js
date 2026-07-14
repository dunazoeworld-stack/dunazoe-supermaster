/**
 * DUNAZOE — Product Listing AI API (Operator / Superuser)
 * /api/ops/product-ai
 *
 * Exposes all ai-service capabilities directly in the Deployment AI cockpit.
 * Requires JWT with role: super_admin | admin | coordinator
 *
 * GET  /api/ops/product-ai            → status + demand index
 * POST /api/ops/product-ai            → run an AI operation
 *   body: { type, data }
 *   types: demand_forecast | optimize_price | listing_assistant |
 *          marketing_copy | recommend | vendor_insights | site_health
 */
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;

// ─── Nigerian Market Intelligence (mirrors ai-service, no external costs) ───
const DEMAND_INDEX = {
  fashion: 0.85, electronics: 0.70, food_groceries: 0.92,
  beauty_health: 0.78, home_appliances: 0.55, phones_tablets: 0.80,
  thrift_fashion: 0.88, thrift_electronics: 0.72,
  services: 0.60, books_education: 0.50, sports_fitness: 0.45,
  solar_energy: 0.75, furniture: 0.50, baby_kids: 0.80,
  agriculture: 0.65, automotive: 0.55,
};

const LOCATION_POWER = {
  lagos: 1.35, abuja: 1.40, kano: 0.85, ibadan: 0.95,
  "port harcourt": 1.20, enugu: 0.90, abeokuta: 0.88, default: 0.85,
};

const MARKETING_TEMPLATES = {
  thrift_seeker:   { hook: "💰 Pay in easy instalments with DUNAZOE Ajo",          badge: "⬡ Ajo Available",   tone: "savings-focused"  },
  champion:        { hook: "✨ Exclusively curated for our top buyers",              badge: "⭐ Top Pick",        tone: "exclusive"        },
  loyal:           { hook: "💛 A special thank-you for your loyalty",               badge: "🎖️ Member Offer",   tone: "appreciative"     },
  at_risk:         { hook: "👋 We've missed you! Here's something special",          badge: "🎁 Welcome Back",   tone: "re-engagement"    },
  price_sensitive: { hook: "🏷️ Best price guaranteed on DUNAZOE",                  badge: "🔥 Best Deal",      tone: "value"            },
  new_user:        { hook: "🛒 Join thousands of happy DUNAZOE buyers",              badge: "🆕 New to DUNAZOE", tone: "welcoming"        },
};

// Key frontend routes to health-check
const SITE_ROUTES = [
  { path: "/",                  label: "Homepage"          },
  { path: "/products",          label: "Product Listing"   },
  { path: "/login",             label: "Login"             },
  { path: "/register",          label: "Register"          },
  { path: "/orders",            label: "Orders"            },
  { path: "/wallet",            label: "Wallet"            },
  { path: "/track",             label: "Track"             },
  { path: "/vendors",           label: "Vendors"           },
  { path: "/thrift",            label: "Ajo/Thrift"        },
  { path: "/ops",               label: "Ops Panel"         },
  { path: "/api/ops/status",    label: "Ops API"           },
  { path: "/api/stae",          label: "STAE API"          },
  { path: "/manifest.json",     label: "PWA Manifest"      },
];

// ─── Auth ────────────────────────────────────────────────────────────────────
function verifyOperator(req) {
  if (!JWT_SECRET) return null;
  const auth = req.headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!["admin", "super_admin", "coordinator"].includes(decoded.role)) return null;
    return decoded;
  } catch { return null; }
}

// ─── AI helpers ──────────────────────────────────────────────────────────────
function demandForecast(category, city = "lagos") {
  const base = DEMAND_INDEX[category?.toLowerCase()] ?? 0.60;
  const loc  = LOCATION_POWER[city?.toLowerCase()] ?? LOCATION_POWER.default;
  const score = Math.min(1, base * loc);
  const tier  = score >= 0.90 ? "🔥 Hyper-demand" : score >= 0.75 ? "📈 High demand"
              : score >= 0.55 ? "📊 Moderate"    : "📉 Low demand";
  return { category, city, demand_score: +score.toFixed(3), tier, base_index: base, location_multiplier: loc };
}

function optimizePrice({ cost_price = 0, category = "fashion", city = "lagos", name = "" }) {
  const demand = DEMAND_INDEX[category?.toLowerCase()] ?? 0.65;
  const loc    = LOCATION_POWER[city?.toLowerCase()]   ?? LOCATION_POWER.default;
  const margin = 0.15 + demand * 0.10;
  const suggested_price   = +(cost_price * (1 + margin) * loc).toFixed(2);
  const ajo_price         = +(suggested_price * 1.05).toFixed(2);
  const ajo_installment_6 = +(ajo_price / 6).toFixed(2);
  const whatsapp_tip = `📦 ${name || category} @ ₦${suggested_price.toLocaleString()} — Ajo from ₦${ajo_installment_6.toLocaleString()}/mo`;
  return { cost_price, suggested_price, ajo_price, ajo_installment_6, margin_pct: +(margin * 100).toFixed(1), demand_index: demand, location_power: loc, whatsapp_tip };
}

function listingAssistant({ name = "", description = "", price = 0, category = "", images = 0, has_cost_price = false }) {
  const checks = [
    { field: "name",         pass: name.length >= 5,          tip: "Product name should be at least 5 characters" },
    { field: "description",  pass: description.length >= 30,  tip: "Add a description of at least 30 characters" },
    { field: "price",        pass: price > 0,                 tip: "Set a selling price" },
    { field: "category",     pass: !!category,                tip: "Assign a category for better discoverability" },
    { field: "images",       pass: images >= 1,               tip: "Add at least 1 product image" },
    { field: "cost_price",   pass: has_cost_price,            tip: "Set cost price for accurate price optimization" },
  ];
  const passed = checks.filter(c => c.pass).length;
  const score  = Math.round((passed / checks.length) * 100);
  const grade  = score === 100 ? "A" : score >= 80 ? "B" : score >= 60 ? "C" : "D";
  const improvements = checks.filter(c => !c.pass).map(c => c.tip);
  return { listing_score: score, grade, passed, total: checks.length, improvements, checks };
}

function marketingCopy({ segment = "new_user", product_name = "", price = 0 }) {
  const t = MARKETING_TEMPLATES[segment] ?? MARKETING_TEMPLATES.new_user;
  const first_payment = Math.ceil(price * 1.05 / 6);
  const sms  = `[DUNAZOE] ${t.hook}. ${product_name ? `Get ${product_name} now.` : ""} ${t.badge}`;
  const wa   = `*${t.badge}* ${t.hook}\n\n${product_name ? `📦 *${product_name}*` : ""}\n💰 ₦${price.toLocaleString()}\n💳 Ajo from ₦${first_payment.toLocaleString()}/mo\n\nShop now 👉 dunazoe-supermaster-1--dunazoeworld.replit.app/products`;
  return { segment, tone: t.tone, hook: t.hook, badge: t.badge, sms_copy: sms, whatsapp_copy: wa };
}

// ─── GET — status & demand index ─────────────────────────────────────────────
export async function GET(req) {
  const user = verifyOperator(req);
  if (!user) return NextResponse.json({ success: false, error: "Superuser access required." }, { status: 401 });

  // Check if ai-service is up on port 4014
  let aiServiceOnline = false;
  try {
    const r = await fetch("http://localhost:4014/health", { signal: AbortSignal.timeout(1000) });
    aiServiceOnline = r.ok;
  } catch { /* offline */ }

  return NextResponse.json({
    success: true,
    product_ai: {
      status: "ACTIVE",
      mode: "rule-based-inline",
      ai_service_port4014: aiServiceOnline ? "online" : "offline (inline fallback active)",
      categories_indexed: Object.keys(DEMAND_INDEX).length,
      operations: ["demand_forecast", "optimize_price", "listing_assistant", "marketing_copy", "recommend", "vendor_insights", "site_health"],
    },
    demand_index: DEMAND_INDEX,
    location_power: LOCATION_POWER,
    operator: user.email || user.id,
    timestamp: new Date().toISOString(),
  });
}

// ─── POST — run an AI operation ───────────────────────────────────────────────
export async function POST(req) {
  const user = verifyOperator(req);
  if (!user) return NextResponse.json({ success: false, error: "Superuser access required." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, data = {} } = body;

  const VALID = ["demand_forecast", "optimize_price", "listing_assistant", "marketing_copy",
                 "recommend", "vendor_insights", "site_health"];

  if (!type || !VALID.includes(type)) {
    return NextResponse.json({ success: false, error: `type required. Valid: ${VALID.join(", ")}` }, { status: 400 });
  }

  const ts = new Date().toISOString();

  // ── demand_forecast ────────────────────────────────────────────────────────
  if (type === "demand_forecast") {
    const category = data.category || null;
    if (category) {
      return NextResponse.json({ success: true, type, result: demandForecast(category, data.city), ts });
    }
    // Return full matrix
    const matrix = Object.keys(DEMAND_INDEX).map(cat =>
      demandForecast(cat, data.city || "lagos")
    ).sort((a, b) => b.demand_score - a.demand_score);
    return NextResponse.json({ success: true, type, result: { matrix, city: data.city || "lagos" }, ts });
  }

  // ── optimize_price ─────────────────────────────────────────────────────────
  if (type === "optimize_price") {
    return NextResponse.json({ success: true, type, result: optimizePrice(data), ts });
  }

  // ── listing_assistant ──────────────────────────────────────────────────────
  if (type === "listing_assistant") {
    return NextResponse.json({ success: true, type, result: listingAssistant(data), ts });
  }

  // ── marketing_copy ─────────────────────────────────────────────────────────
  if (type === "marketing_copy") {
    return NextResponse.json({ success: true, type, result: marketingCopy(data), ts });
  }

  // ── recommend / vendor_insights — try ai-service, fallback inline ──────────
  if (type === "recommend" || type === "vendor_insights") {
    try {
      const r = await fetch(`http://localhost:4014/ai/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: req.headers.get("authorization") || "" },
        body: JSON.stringify({ type, data }),
        signal: AbortSignal.timeout(3000),
      });
      if (r.ok) {
        const d = await r.json();
        return NextResponse.json({ success: true, type, result: d, source: "ai-service:4014", ts });
      }
    } catch { /* ai-service offline */ }
    // Inline fallback
    const fallback = type === "recommend"
      ? { note: "AI recommendations require a running database with product data.", top_categories: Object.entries(DEMAND_INDEX).sort(([,a],[,b])=>b-a).slice(0,5).map(([cat,score])=>({category:cat,demand_score:score})) }
      : { note: "Vendor insights require a running database.", demand_leaders: Object.entries(DEMAND_INDEX).filter(([,s])=>s>0.75).map(([cat,score])=>({category:cat,demand_score:score,action:"stock up"})) };
    return NextResponse.json({ success: true, type, result: fallback, source: "inline-fallback", ts });
  }

  // ── site_health — test all frontend routes ─────────────────────────────────
  if (type === "site_health") {
    const baseUrl = data.base_url || "http://localhost:5000";
    const results = await Promise.all(
      SITE_ROUTES.map(async ({ path, label }) => {
        const start = Date.now();
        try {
          const r = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(4000), redirect: "follow" });
          return { path, label, status: r.status, ok: r.status < 400, latency_ms: Date.now() - start };
        } catch (e) {
          return { path, label, status: 0, ok: false, latency_ms: Date.now() - start, error: e.message };
        }
      })
    );
    const passed  = results.filter(r => r.ok).length;
    const failed  = results.filter(r => !r.ok).length;
    const avg_ms  = Math.round(results.reduce((a, r) => a + r.latency_ms, 0) / results.length);
    return NextResponse.json({ success: true, type, result: { passed, failed, total: results.length, avg_latency_ms: avg_ms, routes: results }, ts });
  }

  return NextResponse.json({ success: false, error: "Unhandled operation." }, { status: 500 });
}
