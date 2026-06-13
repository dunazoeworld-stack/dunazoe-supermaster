// ================================================================
// DUNAZOE OS — USER SERVICE
// services/user-service/index.js
// Port: 4002
// Handles: User profile read/update, nearby lookup
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "user-service", status: "ok", port: PORT });
});

// ── GET USER PROFILE ──────────────────────────────────────────
/**
 * GET /users/:id
 * Auth: Required (own profile or admin)
 */
app.get("/users/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Users can only view own profile unless admin
  if (req.user.id !== parseInt(id) && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const result = await pool.query(
    `SELECT id, name, email, phone, whatsapp, role,
            state, city, town, lat, lng,
            is_active, last_seen, created_at
     FROM users WHERE id=$1`,
    [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  return res.json({ success: true, user: result.rows[0] });
}));

// ── UPDATE USER PROFILE ───────────────────────────────────────
/**
 * PUT /users/:id
 * Auth: Required (own profile only)
 * Body: { name?, phone?, whatsapp?, state?, city?, town?, lat?, lng? }
 */
app.put("/users/:id", requireAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user.id !== parseInt(id)) {
    return res.status(403).json({ success: false, error: "Can only update your own profile" });
  }

  const { name, phone, whatsapp, state, city, town, lat, lng } = req.body;

  const result = await pool.query(
    `UPDATE users
     SET name      = COALESCE($1, name),
         phone     = COALESCE($2, phone),
         whatsapp  = COALESCE($3, whatsapp),
         state     = COALESCE($4, state),
         city      = COALESCE($5, city),
         town      = COALESCE($6, town),
         lat       = COALESCE($7, lat),
         lng       = COALESCE($8, lng)
     WHERE id=$9
     RETURNING id, name, email, phone, whatsapp, state, city, town`,
    [name, phone, whatsapp, state, city, town, lat, lng, id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  return res.json({ success: true, message: "Profile updated", user: result.rows[0] });
}));

// ── LIST USERS (admin only) ───────────────────────────────────
/**
 * GET /users?role=customer&city=lagos&page=1
 * Auth: Admin only
 */
app.get("/users", requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }

  const role   = req.query.role   || null;
  const city   = req.query.city   || null;
  const page   = parseInt(req.query.page || "1");
  const limit  = parseInt(req.query.limit || "20");
  const offset = (page - 1) * limit;

  let query  = "SELECT id,name,email,role,city,state,is_active,created_at FROM users WHERE 1=1";
  const vals = [];
  let idx    = 1;

  if (role) { query += ` AND role=$${idx++}`; vals.push(role); }
  if (city) { query += ` AND LOWER(city)=LOWER($${idx++})`; vals.push(city); }

  query += ` ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`;
  vals.push(limit, offset);

  const result = await pool.query(query, vals);
  const count  = await pool.query("SELECT COUNT(*) FROM users WHERE 1=1"
    + (role ? ` AND role='${role}'` : ""), []);

  return res.json({
    success: true,
    users:   result.rows,
    total:   parseInt(count.rows[0].count),
    page, limit,
  });
}));

// ── DELETE USER (admin only, soft delete) ─────────────────────
app.delete("/users/:id", requireAuth, asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Admin access required" });
  }
  await pool.query("UPDATE users SET is_active=FALSE WHERE id=$1", [req.params.id]);
  return res.json({ success: true, message: "User deactivated" });
}));

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use(errorHandler);

app.listen(PORT, () => console.log(`✅ User Service running on port ${PORT}`));
module.exports = app;
