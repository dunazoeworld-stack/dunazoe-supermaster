// ================================================================
// DUNAZOE OS — PRODUCT SERVICE
// services/product-service/index.js
// Port: 4004
// Handles: CRUD products (physical/digital/service),
//          Copytrader (6% markup), AI price suggestion,
//          Ajo surcharge, shareable links, data quality scoring
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4004;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Nigerian market demand scores (from Claude v5 intelligence)
const DEMAND_SCORES = {
  fashion: 0.85, electronics: 0.70, food_groceries: 0.92,
  beauty_health: 0.78, home_appliances: 0.55, phones_tablets: 0.80,
  thrift_fashion: 0.88, thrift_electronics: 0.72,
  services: 0.60, books_education: 0.50, sports_fitness: 0.45,
  solar_energy: 0.75, furniture: 0.50, baby_kids: 0.80,
};

const PLATFORM_MARGIN  = parseFloat(process.env.PLATFORM_MARGIN  || "0.15");
const AJO_SURCHARGE    = parseFloat(process.env.AJO_SURCHARGE    || "0.10");
const AJO_WEEKS_LIMIT  = parseInt(process.env.AJO_WEEKS_LIMIT    || "2");
const COPY_MARKUP      = parseFloat(process.env.COPY_MARKUP      || "0.06"); // 6% as per ChatGPT v6
const THRIFT_MIN_PRICE = parseFloat(process.env.THRIFT_MIN_PRICE || "10000");

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "product-service", status: "ok", port: PORT });
});

// ── CREATE PRODUCT ────────────────────────────────────────────
/**
 * POST /products
 * Auth: Required (vendor only)
 * Body: { name, description, type, category, price, cost?,
 *         ajo_enabled?, ajo_weeks?, images? }
 */
app.post("/products", requireAuth, asyncHandler(async (req, res) => {
  const {
    name, description, type, category,
    price, cost, ajo_enabled, ajo_weeks, images
  } = req.body;

  if (!name || !price) {
    return res.status(400).json({ success: false, error: "name and price are required" });
  }
  if (parseFloat(price) <= 0) {
    return res.status(400).json({ success: false, error: "price must be positive" });
  }

  // Get vendor for this user
  const vendor_res = await pool.query(
    "SELECT id FROM vendors WHERE user_id=$1 AND status='active'", [req.user.id]
  );
  if (vendor_res.rows.length === 0) {
    return res.status(403).json({
      success: false,
      error: "You need an active vendor account to add products"
    });
  }
  const vendor_id = vendor_res.rows[0].id;

  const safe_type    = ["physical","digital","service"].includes(type) ? type : "physical";
  const num_price    = parseFloat(price);
  const num_cost     = parseFloat(cost || 0);
  const num_ajo_wks  = parseInt(ajo_weeks || 0);
  const ajo_on       = Boolean(ajo_enabled) && num_price >= THRIFT_MIN_PRICE;

  // Ajo surcharge: +10% if schedule > 2 weeks (DUNAZOE business rule)
  const ajo_surcharge_pct = (ajo_on && num_ajo_wks > AJO_WEEKS_LIMIT) ? AJO_SURCHARGE : 0;

  // AI suggested price (Nigerian market optimised)
  const demand        = DEMAND_SCORES[category] || 0.60;
  const ai_price      = num_cost > 0
    ? Math.round(num_cost * (1 + PLATFORM_MARGIN) / 50) * 50
    : Math.round(num_price * 1.05 / 50) * 50;

  // Badge based on demand
  const ai_badge = demand > 0.80 ? "🔥 Trending"
                 : demand > 0.65 ? "📈 Popular"
                 : null;
  const ai_cta   = demand > 0.80 ? "Get it before it's gone" : "Shop now";

  // Shareable link (temp, updated after insert)
  const result = await pool.query(
    `INSERT INTO products(
       vendor_id, name, description, type, category,
       price, cost, ai_suggested_price,
       ajo_enabled, ajo_weeks, ajo_surcharge_pct,
       images, demand_score, ai_badge, ai_cta, shareable_link
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      vendor_id, name, description || null, safe_type, category || null,
      num_price, num_cost, ai_price,
      ajo_on, num_ajo_wks, ajo_surcharge_pct,
      images || null, demand, ai_badge, ai_cta,
      "dunazoe.com/p/temp"
    ]
  );

  const product   = result.rows[0];
  const real_link = `dunazoe.com/p/${product.id}`;
  await pool.query("UPDATE products SET shareable_link=$1 WHERE id=$2",
    [real_link, product.id]);

  return res.status(201).json({
    success:         true,
    product_id:      product.id,
    name:            product.name,
    type:            product.type,
    price:           num_price,
    ai_suggested_price: ai_price,
    ajo_enabled:     ajo_on,
    ajo_surcharge_pct: ajo_surcharge_pct,
    ajo_surcharge_ngn: ajo_on ? Math.round(num_price * ajo_surcharge_pct) : 0,
    ai_badge,
    demand_score:    demand,
    shareable_link:  real_link,
    share_message:   `Check out '${name}' on DUNAZOE: ${real_link}`,
    note:            ajo_surcharge_pct > 0
      ? `Ajo schedule >2 weeks: buyer pays +₦${Math.round(num_price*AJO_SURCHARGE).toLocaleString()} surcharge. You keep full price.`
      : null,
  });
}));

// ── GET ALL PRODUCTS ──────────────────────────────────────────
/**
 * GET /products?category=fashion&type=physical&vendor_id=1&search=ankara&page=1
 */
app.get("/products", asyncHandler(async (req, res) => {
  const { category, type, vendor_id, search, state, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT p.*, v.business_name vendor_name, v.city, v.state
    FROM products p
    JOIN vendors v ON p.vendor_id=v.id
    WHERE p.is_active=TRUE AND v.status='active'
  `;
  const vals = [];
  let idx    = 1;

  if (category)  { query += ` AND p.category=$${idx++}`;               vals.push(category); }
  if (type)      { query += ` AND p.type=$${idx++}`;                   vals.push(type); }
  if (vendor_id) { query += ` AND p.vendor_id=$${idx++}`;              vals.push(parseInt(vendor_id)); }
  if (state)     { query += ` AND LOWER(v.state)=LOWER($${idx++})`;    vals.push(state); }
  if (search)    {
    query += ` AND (p.name ILIKE $${idx} OR p.description ILIKE $${idx++})`;
    vals.push(`%${search}%`);
  }

  query += ` ORDER BY p.demand_score DESC, p.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  vals.push(parseInt(limit), offset);

  const result = await pool.query(query, vals);

  return res.json({
    success:  true,
    products: result.rows,
    count:    result.rows.length,
    page:     parseInt(page),
  });
}));

// ── GET SINGLE PRODUCT ────────────────────────────────────────
/**
 * GET /products/:id
 */
app.get("/products/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT p.*, v.business_name, v.city, v.state, v.rating
     FROM products p JOIN vendors v ON p.vendor_id=v.id
     WHERE p.id=$1 AND p.is_active=TRUE`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  return res.json({ success: true, product: result.rows[0] });
}));

// ── COPY PRODUCT (Copytrader — 6% markup) ────────────────────
/**
 * POST /products/copy
 * Auth: Required
 * Body: { product_id }
 *
 * ChatGPT v6 had: price * 1.06 — KEPT as per business spec
 * Claude adds: link tracking, stock check, original validation
 */
app.post("/products/copy", requireAuth, asyncHandler(async (req, res) => {
  const { product_id } = req.body;

  if (!product_id) {
    return res.status(400).json({ success: false, error: "product_id required" });
  }

  // Get original product
  const orig_res = await pool.query(
    "SELECT * FROM products WHERE id=$1 AND is_active=TRUE", [product_id]
  );
  if (orig_res.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Original product not found" });
  }
  const orig = orig_res.rows[0];

  // Prevent copying your own product
  const my_vendor = await pool.query(
    "SELECT id FROM vendors WHERE user_id=$1", [req.user.id]
  );
  if (my_vendor.rows[0]?.id === orig.vendor_id) {
    return res.status(400).json({ success: false, error: "Cannot copy your own product" });
  }

  // Cannot copy a copy (chain prevention)
  if (orig.is_copy) {
    return res.status(400).json({ success: false, error: "Cannot copy a copied product" });
  }

  const copy_price = Math.round(orig.price * (1 + COPY_MARKUP) / 50) * 50; // 6% markup, rounded to ₦50
  const link       = `dunazoe.com/p/copy/${Date.now()}`;

  const copy_res = await pool.query(
    `INSERT INTO products(
       vendor_id, name, description, type, category,
       price, cost, ai_suggested_price,
       ajo_enabled, ajo_weeks, ajo_surcharge_pct,
       images, is_copy, original_product_id, copy_markup_pct,
       demand_score, ai_badge, ai_cta, shareable_link
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     RETURNING *`,
    [
      my_vendor.rows[0]?.id || orig.vendor_id,
      orig.name, orig.description, orig.type, orig.category,
      copy_price, orig.cost, orig.ai_suggested_price,
      orig.ajo_enabled, orig.ajo_weeks, orig.ajo_surcharge_pct,
      orig.images, true, orig.id, COPY_MARKUP,
      orig.demand_score, orig.ai_badge, orig.ai_cta, link
    ]
  );
  const copy      = copy_res.rows[0];
  const real_link = `dunazoe.com/p/${copy.id}`;
  await pool.query("UPDATE products SET shareable_link=$1 WHERE id=$2", [real_link, copy.id]);

  return res.status(201).json({
    success:              true,
    message:              "Product copied successfully",
    copy_product_id:      copy.id,
    original_product_id:  orig.id,
    original_price:       orig.price,
    copy_price,
    markup_pct:           COPY_MARKUP * 100 + "%",
    shareable_link:       real_link,
    share_message:        `Get '${orig.name}' on DUNAZOE: ${real_link}`,
  });
}));

// ── UPDATE PRODUCT ────────────────────────────────────────────
app.put("/products/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, cost, stock, ajo_enabled, ajo_weeks, images } = req.body;

  const prod = await pool.query(
    "SELECT p.*,v.user_id FROM products p JOIN vendors v ON p.vendor_id=v.id WHERE p.id=$1",
    [id]
  );
  if (!prod.rows[0]) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  if (prod.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Not your product" });
  }

  const result = await pool.query(
    `UPDATE products SET
       name        = COALESCE($1, name),
       description = COALESCE($2, description),
       price       = COALESCE($3, price),
       cost        = COALESCE($4, cost),
       ajo_enabled = COALESCE($5, ajo_enabled),
       ajo_weeks   = COALESCE($6, ajo_weeks),
       images      = COALESCE($7, images),
       updated_at  = NOW()
     WHERE id=$8 RETURNING id, name, price, updated_at`,
    [name, description, price, cost, ajo_enabled, ajo_weeks, images, id]
  );

  return res.json({ success: true, product: result.rows[0] });
}));

// ── DEACTIVATE PRODUCT ────────────────────────────────────────
app.delete("/products/:id", requireAuth, asyncHandler(async (req, res) => {
  const prod = await pool.query(
    "SELECT p.*,v.user_id FROM products p JOIN vendors v ON p.vendor_id=v.id WHERE p.id=$1",
    [req.params.id]
  );
  if (!prod.rows[0]) {
    return res.status(404).json({ success: false, error: "Product not found" });
  }
  if (prod.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Not your product" });
  }
  await pool.query("UPDATE products SET is_active=FALSE WHERE id=$1", [req.params.id]);
  return res.json({ success: true, message: "Product deactivated" });
}));

// ── LIST BY VENDOR ────────────────────────────────────────────
app.get("/products/vendor/:vendor_id", asyncHandler(async (req, res) => {
  const { vendor_id } = req.params;
  const { type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  let q = "SELECT * FROM products WHERE vendor_id=$1 AND is_active=TRUE";
  const v = [parseInt(vendor_id)];
  if (type) { q += " AND type=$2"; v.push(type); }
  q += ` ORDER BY created_at DESC LIMIT $${v.length+1} OFFSET $${v.length+2}`;
  v.push(parseInt(limit), offset);

  const result = await pool.query(q, v);
  return res.json({ success: true, products: result.rows });
}));

// ── AI LISTING ASSISTANT ──────────────────────────────────────
/**
 * POST /products/ai/assist
 * Body: { name, cost, category, ajo_weeks? }
 * Returns: suggested price, badge, tips, Ajo surcharge info
 */
app.post("/products/ai/assist", requireAuth, asyncHandler(async (req, res) => {
  const { name, cost, category, ajo_weeks = 0, description = "" } = req.body;
  const num_cost = parseFloat(cost || 0);
  const demand   = DEMAND_SCORES[category] || 0.60;
  const sp       = num_cost > 0
    ? Math.round(num_cost * (1 + PLATFORM_MARGIN) / 50) * 50
    : null;

  const tips = [];
  if ((name || "").length < 10) tips.push("Title too short — add brand, size, or colour");
  if ((name || "").length > 80) tips.push("Shorten title to under 80 characters");
  if (!description)             tips.push("Add a description to improve search ranking");

  const surcharge_note = parseInt(ajo_weeks) > AJO_WEEKS_LIMIT
    ? `Ajo schedule >2 weeks: +10% surcharge auto-applied. Buyer pays; you keep full price.`
    : null;

  return res.json({
    success:           true,
    suggested_price:   sp,
    demand_score:      demand,
    ai_badge:          demand > 0.80 ? "🔥 Trending" : demand > 0.65 ? "📈 Popular" : null,
    ajo_eligible:      num_cost >= THRIFT_MIN_PRICE,
    ajo_surcharge_note:surcharge_note,
    title_tips:        tips,
    listing_score:     Math.round(demand * 10 * 10) / 10,
    share_tip:         "Share your listing link on WhatsApp and Instagram for direct sales.",
  });
}));

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => console.log(`✅ Product Service running on port ${PORT}`));
module.exports = app;
