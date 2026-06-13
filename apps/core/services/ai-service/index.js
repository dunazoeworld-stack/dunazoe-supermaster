// ================================================================
// DUNAZOE OS — AI SERVICE
// services/ai-service/index.js
// Port: 4014
//
// Phase 10: Rule-based → ML upgrade path
// CTO NOTE: No external AI API costs. Everything runs locally.
//   - Product recommendations: demand score + category affinity
//   - Price optimisation: cost + margin + Nigerian demand index
//   - Fraud signals: rule engine (upgradeable to IsolationForest)
//   - AI Marketing copy: template engine with segment variables
//   - Vendor insights: sales velocity, restock alerts
//   - Trust signals: contribution pattern analysis
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4014;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Nigerian market demand intelligence (no external API needed)
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
  akure: 0.80, osogbo: 0.78, "port harcourt": 1.20,
  enugu: 0.90, "ado-ekiti": 0.78, abeokuta: 0.88, default: 0.85,
};

const PLATFORM_MARGIN = parseFloat(process.env.PLATFORM_MARGIN || "0.15");

// Marketing copy templates
const MARKETING_TEMPLATES = {
  thrift_seeker: {
    hook:   "💰 Pay in easy instalments with DUNAZOE Ajo",
    cta:    "Start with just ₦{first_payment}",
    badge:  "⬡ Ajo Available",
    tone:   "savings-focused",
  },
  champion: {
    hook:   "✨ Exclusively curated for our top buyers",
    cta:    "Claim your priority offer",
    badge:  "⭐ Top Pick",
    tone:   "exclusive",
  },
  loyal: {
    hook:   "💛 A special thank-you for your loyalty",
    cta:    "Your member deal awaits",
    badge:  "🎖️ Member Offer",
    tone:   "appreciative",
  },
  at_risk: {
    hook:   "👋 We've missed you! Here's something special",
    cta:    "Come back — exclusive deal inside",
    badge:  "🎁 Welcome Back",
    tone:   "re-engagement",
  },
  price_sensitive: {
    hook:   "🏷️ Best price guaranteed on DUNAZOE",
    cta:    "Get the lowest price today",
    badge:  "🔥 Best Deal",
    tone:   "value",
  },
  new_user: {
    hook:   "🛒 Join thousands of happy DUNAZOE buyers",
    cta:    "Start shopping now",
    badge:  "🆕 New to DUNAZOE",
    tone:   "welcoming",
  },
};

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    service: "ai-service", status: "ok", port: PORT,
    mode: "rule-based (ML upgrade path ready)",
    categories_indexed: Object.keys(DEMAND_INDEX).length,
  });
});

// ── UNIFIED DISPATCHER (matches ChatGPT AI.run pattern) ───────
/**
 * POST /ai/run
 * Body: { type, data }
 * Types: recommend, optimize_price, marketing_copy, vendor_insights,
 *        segment_user, demand_forecast, listing_assistant
 */
app.post("/ai/run", requireAuth, asyncHandler(async (req, res) => {
  const { type, data = {} } = req.body;

  const VALID = [
    "recommend", "optimize_price", "marketing_copy", "vendor_insights",
    "segment_user", "demand_forecast", "listing_assistant", "fraud_signals",
  ];

  if (!type || !VALID.includes(type)) {
    return res.status(400).json({
      success: false,
      error:   `type required. Valid: ${VALID.join(", ")}`,
    });
  }

  switch (type) {
    case "recommend":         return res.json(await _recommend(data));
    case "optimize_price":    return res.json(await _optimize_price(data));
    case "marketing_copy":    return res.json(_marketing_copy(data));
    case "vendor_insights":   return res.json(await _vendor_insights(data));
    case "segment_user":      return res.json(await _segment_user(data));
    case "demand_forecast":   return res.json(_demand_forecast(data));
    case "listing_assistant": return res.json(_listing_assistant(data));
    case "fraud_signals":     return res.json(await _fraud_signals(data));
    default:                  return res.json({ success: false, error: "Unknown type" });
  }
}));

// ── DEDICATED ENDPOINTS ───────────────────────────────────────
app.post("/ai/recommend",       requireAuth, asyncHandler(async (req, res) => res.json(await _recommend(req.body))));
app.post("/ai/optimize-price",  requireAuth, asyncHandler(async (req, res) => res.json(await _optimize_price(req.body))));
app.post("/ai/marketing-copy",  requireAuth, asyncHandler(async (req, res) => res.json(_marketing_copy(req.body))));
app.post("/ai/vendor-insights", requireAuth, asyncHandler(async (req, res) => res.json(await _vendor_insights(req.body))));
app.post("/ai/segment",         requireAuth, asyncHandler(async (req, res) => res.json(await _segment_user(req.body))));
app.post("/ai/listing-assist",  requireAuth, asyncHandler(async (req, res) => res.json(_listing_assistant(req.body))));

// ── AI FUNCTIONS ──────────────────────────────────────────────

async function _recommend({ user_id, category, city, limit = 5 }) {
  try {
    let q = `SELECT p.*, v.business_name, v.city,
                    p.demand_score * COALESCE($1,0.85) AS relevance_score
             FROM products p
             JOIN vendors v ON p.vendor_id=v.id
             WHERE p.is_active=TRUE AND v.status='active'`;
    const loc_power = LOCATION_POWER[(city||"").toLowerCase()] || 0.85;
    const vals      = [loc_power];
    let idx         = 2;

    if (category) { q += ` AND p.category=$${idx++}`; vals.push(category); }

    q += ` ORDER BY relevance_score DESC, p.created_at DESC LIMIT $${idx}`;
    vals.push(parseInt(limit));

    const result = await pool.query(q, vals);
    return {
      success:      true,
      user_id,
      recommendations: result.rows,
      count:        result.rows.length,
      powered_by:   "DUNAZOE Demand Intelligence (Nigerian Market Index)",
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function _optimize_price({ product_name, cost, category, city, ajo_weeks = 0 }) {
  const num_cost   = parseFloat(cost || 0);
  const demand     = DEMAND_INDEX[category] || 0.60;
  const loc_power  = LOCATION_POWER[(city||"").toLowerCase()] || 0.85;
  const AJO_SUR    = parseInt(ajo_weeks) > 2 ? 0.10 : 0;

  // scipy-style optimisation (rule-based equivalent)
  // Maximise (margin × demand × location_power)
  let optimal = num_cost * (1 + PLATFORM_MARGIN);
  optimal    *= (1 + demand * 0.1 * loc_power);
  optimal     = Math.round(optimal / 50) * 50; // round to ₦50

  const ajo_total = optimal + (optimal * AJO_SUR);

  return {
    success:           true,
    product_name,
    cost:              num_cost,
    suggested_price:   optimal,
    ajo_price:         ajo_weeks > 2 ? ajo_total : optimal,
    ajo_surcharge_pct: AJO_SUR * 100,
    demand_score:      demand,
    location_power:    loc_power,
    margin_pct:        parseFloat(((optimal - num_cost) / optimal * 100).toFixed(1)),
    ai_badge:          demand > 0.80 ? "🔥 Trending" : demand > 0.65 ? "📈 Popular" : null,
    shareable_tip:     "Share product link on WhatsApp to drive direct sales",
    reasoning:         `Price optimised for ${category} in ${city||"SW Nigeria"}. Demand: ${(demand*100).toFixed(0)}%.`,
  };
}

function _marketing_copy({ segment = "new_user", product_name, price, vendor_city }) {
  const tmpl       = MARKETING_TEMPLATES[segment] || MARKETING_TEMPLATES.new_user;
  const first_pay  = Math.round(parseFloat(price || 0) * 0.40 / 50) * 50;
  const hook       = tmpl.hook.replace("{first_payment}", `₦${first_pay.toLocaleString()}`);
  const cta        = tmpl.cta.replace("{first_payment}", `₦${first_pay.toLocaleString()}`);

  const whatsapp_msg =
    `🛒 ${hook}\n` +
    `📦 ${product_name || "Check out this product"} — ₦${parseFloat(price||0).toLocaleString()}\n` +
    `📍 Available from ${vendor_city || "your area"}\n` +
    `${cta} → dunazoe.com`;

  const sms_msg =
    `DUNAZOE: ${product_name} ₦${parseFloat(price||0).toLocaleString()}. ` +
    `${cta} dunazoe.com`.substring(0, 160);

  return {
    success:      true,
    segment,
    tone:         tmpl.tone,
    badge:        tmpl.badge,
    hook,
    cta,
    whatsapp_message: whatsapp_msg,
    sms_message:      sms_msg,
    score:        _score_campaign_msg(whatsapp_msg, segment),
  };
}

async function _vendor_insights({ vendor_id }) {
  try {
    const sales = await pool.query(
      `SELECT COUNT(*) total_orders,
              COALESCE(SUM(amount),0) total_revenue,
              COALESCE(AVG(amount),0) avg_order_value,
              COUNT(*) FILTER (WHERE status='delivered') delivered,
              COUNT(*) FILTER (WHERE status='cancelled') cancelled
       FROM orders WHERE vendor_id=$1 AND created_at > NOW() - INTERVAL '30 days'`,
      [vendor_id]
    );

    const low_stock = await pool.query(
      `SELECT p.name, i.quantity, i.reserved, i.reorder_level
       FROM inventory i JOIN products p ON i.product_id=p.id
       WHERE i.vendor_id=$1 AND (i.quantity-i.reserved) <= i.reorder_level`,
      [vendor_id]
    );

    const top_products = await pool.query(
      `SELECT p.name, COUNT(*) order_count, SUM(o.amount) revenue
       FROM orders o JOIN products p ON o.product_id=p.id
       WHERE o.vendor_id=$1 AND o.created_at > NOW() - INTERVAL '30 days'
       GROUP BY p.id, p.name ORDER BY order_count DESC LIMIT 5`,
      [vendor_id]
    );

    const s = sales.rows[0];
    return {
      success:           true,
      vendor_id,
      period:            "Last 30 days",
      total_orders:      parseInt(s.total_orders),
      total_revenue:     parseFloat(s.total_revenue),
      avg_order_value:   parseFloat(s.avg_order_value),
      delivery_rate:     s.total_orders > 0
        ? `${(parseInt(s.delivered)/parseInt(s.total_orders)*100).toFixed(1)}%` : "0%",
      low_stock_alerts:  low_stock.rows,
      top_products:      top_products.rows,
      recommendations: [
        ...(low_stock.rows.length > 0
          ? [`⚠️ Restock ${low_stock.rows.length} product(s) below reorder level`] : []),
        ...(parseFloat(s.avg_order_value) < 5000
          ? ["💡 Consider bundling products to increase average order value"] : []),
        "📱 Share product links on WhatsApp to increase visibility",
        "⬡ Enable Ajo payment on high-value items to attract more buyers",
      ],
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function _segment_user({ user_id }) {
  try {
    const orders = await pool.query(
      `SELECT COUNT(*) total,
              COALESCE(SUM(amount),0) total_spent,
              COUNT(*) FILTER (WHERE payment_type IN ('thrift','post_thrift')) thrift_orders
       FROM orders WHERE customer_id=$1`,
      [user_id]
    );
    const o          = orders.rows[0];
    const total      = parseInt(o.total);
    const spent      = parseFloat(o.total_spent);
    const thrift_pct = total > 0 ? parseInt(o.thrift_orders) / total : 0;

    let segment = "new_user";
    if (total > 8 && spent > 50000)           segment = "champion";
    else if (total > 4)                        segment = "loyal";
    else if (thrift_pct > 0.50)                segment = "thrift_seeker";
    else if (spent / Math.max(total,1) < 3000) segment = "price_sensitive";
    else if (total === 0)                      segment = "new_user";
    else                                       segment = "at_risk";

    const tmpl = MARKETING_TEMPLATES[segment];
    return {
      success:  true,
      user_id,
      segment,
      total_orders:  total,
      total_spent:   spent,
      thrift_pct:    Math.round(thrift_pct * 100),
      tone:          tmpl?.tone,
      marketing_tip: tmpl?.hook,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function _demand_forecast({ category, city }) {
  const demand    = DEMAND_INDEX[category] || 0.60;
  const loc_power = LOCATION_POWER[(city||"").toLowerCase()] || 0.85;
  const forecast  = Math.min(1, demand * loc_power);
  const month     = new Date().getMonth() + 1;

  // Nigerian seasonal peaks
  const seasonal_peaks = {
    fashion:       [4, 11, 12],
    electronics:   [1, 11, 12],
    food_groceries:[1, 4, 12],
    beauty_health: [2, 3, 12],
    baby_kids:     [1, 8, 12],
  };
  const in_peak = (seasonal_peaks[category] || []).includes(month);
  const adj_forecast = in_peak ? Math.min(1, forecast * 1.25) : forecast;

  return {
    success:         true,
    category,
    city:            city || "SW Nigeria",
    demand_score:    parseFloat(forecast.toFixed(3)),
    adjusted_score:  parseFloat(adj_forecast.toFixed(3)),
    in_seasonal_peak: in_peak,
    label:           adj_forecast > 0.80 ? "🔥 High Demand"
                   : adj_forecast > 0.60 ? "📈 Rising"
                   : "📊 Moderate",
    recommendation:  in_peak
      ? `Peak season for ${category}. Increase stock and run promotions now.`
      : `Steady demand. Focus on pricing and Ajo payment options.`,
  };
}

function _listing_assistant({ name, cost, category, city, ajo_weeks = 0, description = "" }) {
  const num_cost  = parseFloat(cost || 0);
  const demand    = DEMAND_INDEX[category] || 0.60;
  const opt       = _optimize_price({ product_name: name, cost: num_cost, category, city, ajo_weeks });

  const tips = [];
  if ((name||"").length < 10)   tips.push("❌ Title too short — add brand, size, or colour");
  if ((name||"").length > 80)   tips.push("⚠️ Shorten title to under 80 characters");
  if (!description)             tips.push("❌ Add a description to improve search ranking");
  if (!category)                tips.push("❌ Set a product category for better visibility");
  if (num_cost <= 0)            tips.push("⚠️ Set cost price for accurate AI pricing");

  const listing_score = Math.round(
    (tips.length === 0 ? 10 : Math.max(4, 10 - tips.length * 1.5)) * 10
  ) / 10;

  return {
    success:         true,
    suggested_price: typeof opt === "object" ? opt.suggested_price : Math.round(num_cost * 1.15 / 50) * 50,
    demand_score:    demand,
    ai_badge:        demand > 0.80 ? "🔥 Trending" : demand > 0.65 ? "📈 Popular" : null,
    ajo_eligible:    num_cost >= 10000,
    listing_score,
    title_tips:      tips,
    share_tip:       "Share your product link on WhatsApp, Instagram, and Facebook for direct sales",
  };
}

async function _fraud_signals({ user_id, amount, quantity, ip }) {
  const signals = [];
  let risk      = "safe";

  if (parseFloat(amount) > 500000) {
    signals.push("HIGH_AMOUNT"); risk = "high_risk";
  }
  if (parseInt(quantity) > 50) {
    signals.push("HIGH_QUANTITY"); risk = risk === "high_risk" ? "high_risk" : "suspicious";
  }
  try {
    const recent = await pool.query(
      "SELECT COUNT(*) c FROM orders WHERE customer_id=$1 AND created_at > NOW()-INTERVAL '1 hour'",
      [user_id]
    );
    if (parseInt(recent.rows[0].c) >= 5) {
      signals.push("VELOCITY_HIGH"); risk = "high_risk";
    }
  } catch (_) {}

  return { success: true, risk_level: risk, signals, allowed: risk !== "high_risk" };
}

function _score_campaign_msg(msg, segment) {
  let score = 5.0;
  if (msg.length > 20)  score += 0.5;
  if (msg.includes("₦")) score += 0.5;
  if (msg.includes("Ajo") && segment === "thrift_seeker") score += 1.0;
  if (msg.includes("dunazoe.com")) score += 0.5;
  if (msg.length > 160) score -= 0.5;
  return Math.min(10, Math.round(score * 10) / 10);
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ AI Service running on port ${PORT}`));
module.exports = app;
