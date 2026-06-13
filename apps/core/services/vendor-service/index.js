// ================================================================
// DUNAZOE OS — VENDOR SERVICE
// services/vendor-service/index.js
// Port: 4003
// Handles: Vendor registration, manual verification,
//          pickup station activation, coordinator assignment,
//          SW Nigeria network, shareable links
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// SW Nigeria cities eligible for pickup station network
const SW_NIGERIA_CITIES = [
  "ibadan","osogbo","ile-ife","ilesa","ede","iwo","ogbomoso",
  "akure","owo","ore","okitipupa","ondo","ikare",
  "abeokuta","ijebu-ode","sagamu",
  "ado-ekiti","ikere-ekiti",
  "lagos","ikeja","lekki","surulere","yaba","badagry",
];

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "vendor-service", status: "ok", port: PORT });
});

// ── CREATE VENDOR ─────────────────────────────────────────────
/**
 * POST /vendors
 * Auth: Required
 * Body: { business_name, description?, type?, category?,
 *         state, city, town, lat?, lng?,
 *         pickup_address?, payout_method?,
 *         bank_name?, account_no?, account_name? }
 */
app.post("/vendors", requireAuth, asyncHandler(async (req, res) => {
  const {
    business_name, description, type, category,
    state, city, town, lat, lng,
    pickup_address, payout_method,
    bank_name, account_no, account_name
  } = req.body;

  if (!business_name) {
    return res.status(400).json({ success: false, error: "business_name is required" });
  }

  // Prevent duplicate vendor for same user
  const existing = await pool.query(
    "SELECT id FROM vendors WHERE user_id=$1 AND status != 'rejected'",
    [req.user.id]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({
      success: false,
      error: "You already have a vendor account. Contact support to create another."
    });
  }

  const safe_type  = ["direct","delivery","copytrader","pickup_station"].includes(type)
    ? type : "direct";
  const safe_payout= ["bank","opay","moniepoint"].includes(payout_method)
    ? payout_method : "bank";
  const city_lower = (city || "").toLowerCase().trim();
  const in_network = SW_NIGERIA_CITIES.includes(city_lower);

  // Auto-assign coordinator for this city
  const coord = await pool.query(
    `SELECT id FROM admin_staff WHERE office='vendor_coordinator'
     AND (jurisdiction=$1 OR jurisdiction=$2) LIMIT 1`,
    [state || "", city || ""]
  ).catch(() => ({ rows: [] }));

  // Generate shareable link (will use real domain in production)
  const temp_id    = Date.now();
  const link       = `dunazoe.com/store/${temp_id}`;

  const result = await pool.query(
    `INSERT INTO vendors(
       user_id, business_name, description, type, category,
       state, city, town, lat, lng, pickup_address,
       is_pickup_station, payout_method,
       bank_name, account_no, account_name,
       coordinator_id, shareable_link
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
    [
      req.user.id, business_name, description || null, safe_type,
      category || null, state || null, city || null, town || null,
      parseFloat(lat || 0), parseFloat(lng || 0), pickup_address || null,
      in_network, safe_payout,
      bank_name || null, account_no || null, account_name || null,
      coord.rows[0]?.id || null, link
    ]
  );

  const vendor = result.rows[0];
  // Update shareable link with real vendor ID
  const real_link = `dunazoe.com/store/${vendor.id}`;
  await pool.query("UPDATE vendors SET shareable_link=$1 WHERE id=$2", [real_link, vendor.id]);

  return res.status(201).json({
    success:          true,
    message:          "Vendor application submitted — pending review",
    vendor_id:        vendor.id,
    status:           "pending",
    shareable_link:   real_link,
    in_sw_network:    in_network,
    coordinator:      coord.rows[0]?.id || null,
    note:             in_network
      ? `Your city (${city}) is in DUNAZOE's SW Nigeria pickup network ✓`
      : "Your application is under review.",
  });
}));

// ── GET VENDOR ────────────────────────────────────────────────
/**
 * GET /vendors/:id
 */
app.get("/vendors/:id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT v.*, u.name owner_name, u.phone owner_phone
     FROM vendors v JOIN users u ON v.user_id=u.id
     WHERE v.id=$1`,
    [req.params.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Vendor not found" });
  }
  return res.json({ success: true, vendor: result.rows[0] });
}));

// ── LIST VENDORS ──────────────────────────────────────────────
/**
 * GET /vendors?state=oyo&city=ibadan&status=active&page=1
 */
app.get("/vendors", asyncHandler(async (req, res) => {
  const { state, city, status, type, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = "SELECT v.*, u.name owner_name FROM vendors v JOIN users u ON v.user_id=u.id WHERE 1=1";
  const vals = [];
  let idx = 1;

  if (state)  { query += ` AND LOWER(v.state)=LOWER($${idx++})`;  vals.push(state); }
  if (city)   { query += ` AND LOWER(v.city)=LOWER($${idx++})`;   vals.push(city); }
  if (status) { query += ` AND v.status=$${idx++}`;               vals.push(status); }
  if (type)   { query += ` AND v.type=$${idx++}`;                 vals.push(type); }

  query += ` ORDER BY v.created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  vals.push(parseInt(limit), offset);

  const result = await pool.query(query, vals);
  return res.json({ success: true, vendors: result.rows, count: result.rows.length });
}));

// ── MANUAL VERIFICATION (Admin) ───────────────────────────────
/**
 * POST /vendors/:id/verify
 * Auth: Admin only
 */
app.post("/vendors/:id/verify", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE vendors
       SET verified_manual=TRUE, status='active', is_pickup_station=TRUE
       WHERE id=$1
       RETURNING id, business_name, status, is_pickup_station, shareable_link`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }
    const v = result.rows[0];
    return res.json({
      success:           true,
      message:           `${v.business_name} verified and now LIVE as vendor + pickup station`,
      vendor_id:         v.id,
      status:            v.status,
      is_pickup_station: v.is_pickup_station,
      shareable_link:    v.shareable_link,
    });
  })
);

// ── REJECT VENDOR (Admin) ─────────────────────────────────────
app.post("/vendors/:id/reject", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    await pool.query(
      "UPDATE vendors SET status='rejected' WHERE id=$1", [req.params.id]
    );
    return res.json({
      success: true,
      message: "Vendor application rejected",
      reason:  reason || "Did not meet requirements"
    });
  })
);

// ── UPDATE VENDOR ─────────────────────────────────────────────
app.put("/vendors/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Check ownership or admin
  const vendor = await pool.query("SELECT user_id FROM vendors WHERE id=$1", [id]);
  if (!vendor.rows[0]) {
    return res.status(404).json({ success: false, error: "Vendor not found" });
  }
  if (vendor.rows[0].user_id !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Not your vendor account" });
  }

  const {
    business_name, description, category, pickup_address,
    bank_name, account_no, account_name, payout_method,
    lat, lng, town
  } = req.body;

  const result = await pool.query(
    `UPDATE vendors SET
       business_name  = COALESCE($1,  business_name),
       description    = COALESCE($2,  description),
       category       = COALESCE($3,  category),
       pickup_address = COALESCE($4,  pickup_address),
       bank_name      = COALESCE($5,  bank_name),
       account_no     = COALESCE($6,  account_no),
       account_name   = COALESCE($7,  account_name),
       payout_method  = COALESCE($8,  payout_method),
       lat            = COALESCE($9,  lat),
       lng            = COALESCE($10, lng),
       town           = COALESCE($11, town)
     WHERE id=$12 RETURNING id, business_name, status`,
    [business_name, description, category, pickup_address,
     bank_name, account_no, account_name, payout_method,
     lat, lng, town, id]
  );

  return res.json({ success: true, vendor: result.rows[0] });
}));

// ── GET MY VENDOR ─────────────────────────────────────────────
app.get("/vendors/me/profile", requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM vendors WHERE user_id=$1", [req.user.id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "No vendor account found" });
  }
  return res.json({ success: true, vendor: result.rows[0] });
}));

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => console.log(`✅ Vendor Service running on port ${PORT}`));
module.exports = app;
