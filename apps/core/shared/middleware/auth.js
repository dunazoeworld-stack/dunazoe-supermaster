// ================================================================
// DUNAZOE OS — SHARED AUTH MIDDLEWARE
// shared/middleware/auth.js
// Used by: user-service, vendor-service, product-service, etc.
// ================================================================

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dunazoe_secret_change_in_production";

/**
 * Verify JWT token on protected routes.
 * Attaches req.user = { id, role } if valid.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers["authorization"] || "";
  const token      = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return res.status(401).json({ success: false, error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user      = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

/**
 * Restrict route to specific roles.
 * Usage: requireRole("admin") or requireRole(["admin","coordinator"])
 */
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: "Unauthorised" });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error:   `Access denied. Required role: ${allowed.join(" or ")}`
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, JWT_SECRET };
