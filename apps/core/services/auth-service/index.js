// ================================================================
// DUNAZOE OS — AUTH SERVICE
// services/auth-service/index.js
// Port: 4001
// Handles: Register, Login, Token verification
// ================================================================

require("dotenv").config();

const express    = require("express");
const bcrypt     = require("bcrypt");
const jwt        = require("jsonwebtoken");
const cors       = require("cors");
const { Pool }   = require("pg");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

// ── DATABASE ──────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

const JWT_SECRET      = process.env.JWT_SECRET      || "dunazoe_secret_change_in_prod";
const SALT_ROUNDS     = parseInt(process.env.BCRYPT_ROUNDS || "12");
const SESSION_DAYS    = parseInt(process.env.SESSION_DAYS  || "7");

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "auth-service", status: "ok", port: PORT });
});

// ── REGISTER ─────────────────────────────────────────────────
/**
 * POST /register
 * Body: { name, email, password, phone?, role?, state?, city?, town? }
 */
app.post("/register", asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, state, city, town, whatsapp } = req.body;

  // Validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: "name, email, and password are required"
    });
  }
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: "Password must be at least 6 characters"
    });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, error: "Invalid email format" });
  }

  // Check duplicate
  const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ success: false, error: "Email already registered" });
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const safe_role     = ["customer","vendor","agent","admin","coordinator"].includes(role)
    ? role : "customer";

  // Insert user
  const result = await pool.query(
    `INSERT INTO users(name,email,phone,whatsapp,password_hash,role,state,city,town)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,email,role,created_at`,
    [name, email, phone || null, whatsapp || phone || null,
     password_hash, safe_role, state || null, city || null, town || null]
  );
  const user = result.rows[0];

  // Issue token
  const token = _issueToken(user.id, user.role);
  await _saveSession(user.id, user.role, token);

  return res.status(201).json({
    success:  true,
    message:  "Registration successful",
    user_id:  user.id,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    token,
  });
}));

// ── LOGIN ─────────────────────────────────────────────────────
/**
 * POST /login
 * Body: { email, password }
 */
app.post("/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: "email and password required" });
  }

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1 AND is_active=TRUE", [email]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  }

  // Update last_seen
  await pool.query("UPDATE users SET last_seen=NOW() WHERE id=$1", [user.id]);

  const token = _issueToken(user.id, user.role);
  await _saveSession(user.id, user.role, token);

  return res.json({
    success:  true,
    message:  "Login successful",
    user_id:  user.id,
    name:     user.name,
    email:    user.email,
    role:     user.role,
    token,
  });
}));

// ── VERIFY TOKEN (used by API gateway / other services) ───────
/**
 * POST /verify
 * Body: { token }
 * Returns: decoded user if valid
 */
app.post("/verify", asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ success: false, error: "Token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check session DB (allows server-side logout)
    const session = await pool.query(
      "SELECT * FROM sessions WHERE token=$1 AND expires_at > NOW()", [token]
    );
    if (session.rows.length === 0) {
      return res.status(401).json({ success: false, error: "Session expired or revoked" });
    }

    return res.json({ success: true, user: decoded });
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
}));

// ── LOGOUT ────────────────────────────────────────────────────
/**
 * POST /logout
 * Body: { token }
 */
app.post("/logout", asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (token) {
    await pool.query("DELETE FROM sessions WHERE token=$1", [token]);
  }
  return res.json({ success: true, message: "Logged out" });
}));

// ── HELPERS ───────────────────────────────────────────────────
function _issueToken(user_id, role) {
  return jwt.sign(
    { id: user_id, role },
    JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

async function _saveSession(user_id, role, token) {
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_DAYS);
  await pool.query(
    "INSERT INTO sessions(token,user_id,role,expires_at) VALUES($1,$2,$3,$4) ON CONFLICT(token) DO NOTHING",
    [token, user_id, role, expires]
  );
}

// ── ERROR HANDLER ─────────────────────────────────────────────
app.use(errorHandler);

// ── START ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Auth Service running on port ${PORT}`);
});

module.exports = app;
