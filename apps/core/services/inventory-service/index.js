// ================================================================
// DUNAZOE OS — INVENTORY SERVICE
// services/inventory-service/index.js
// Port: 4005
// CTO RULE: NEVER reduce stock before payment confirmation.
//   Flow: reserve → payment confirmed → confirm sale
//         OR reserve → payment failed → release
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4005;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "inventory-service", status: "ok", port: PORT });
});

// ── ADD / SET INVENTORY ───────────────────────────────────────
/**
 * POST /inventory
 * Body: { product_id, vendor_id, quantity, reorder_level? }
 */
app.post("/inventory", requireAuth, asyncHandler(async (req, res) => {
  const { product_id, vendor_id, quantity, reorder_level = 5 } = req.body;

  if (!product_id || !vendor_id || quantity === undefined) {
    return res.status(400).json({ success: false, error: "product_id, vendor_id, quantity required" });
  }
  if (parseInt(quantity) < 0) {
    return res.status(400).json({ success: false, error: "Quantity cannot be negative" });
  }

  // Upsert inventory
  const result = await pool.query(
    `INSERT INTO inventory(product_id, vendor_id, quantity, reorder_level)
     VALUES($1,$2,$3,$4)
     ON CONFLICT(product_id, vendor_id)
     DO UPDATE SET quantity = inventory.quantity + $3, updated_at = NOW()
     RETURNING *`,
    [product_id, vendor_id, parseInt(quantity), parseInt(reorder_level)]
  );

  // Log movement
  await _logMovement(pool, product_id, vendor_id, "restock", parseInt(quantity),
    null, `Stock added by vendor ${vendor_id}`);

  const inv = result.rows[0];
  const low_stock = inv.quantity - inv.reserved <= inv.reorder_level;

  return res.status(201).json({
    success:    true,
    inventory:  inv,
    available:  inv.quantity - inv.reserved,
    low_stock_alert: low_stock ? `⚠️ Stock below reorder level (${inv.reorder_level})` : null,
  });
}));

// ── GET INVENTORY ─────────────────────────────────────────────
app.get("/inventory/:product_id", asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT *, (quantity - reserved) AS available FROM inventory WHERE product_id=$1",
    [req.params.product_id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ success: false, error: "Inventory not found" });
  }
  return res.json({ success: true, inventory: result.rows[0] });
}));

// ── RESERVE STOCK (called by Order Service before creating order) ─
/**
 * POST /inventory/reserve
 * Body: { product_id, quantity, order_ref }
 * CTO RULE: This is the ONLY way stock moves before payment.
 *           Never call /confirm directly.
 */
app.post("/inventory/reserve", asyncHandler(async (req, res) => {
  const { product_id, quantity, order_ref } = req.body;

  if (!product_id || !quantity) {
    return res.status(400).json({ success: false, error: "product_id and quantity required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock row for update to prevent race conditions
    const inv = await client.query(
      "SELECT * FROM inventory WHERE product_id=$1 FOR UPDATE",
      [product_id]
    );

    if (inv.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Product not in inventory" });
    }

    const row       = inv.rows[0];
    const available = row.quantity - row.reserved;

    if (available < parseInt(quantity)) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success:   false,
        error:     `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
        available,
      });
    }

    // Reserve
    await client.query(
      "UPDATE inventory SET reserved = reserved + $1, updated_at = NOW() WHERE product_id=$2",
      [parseInt(quantity), product_id]
    );

    await _logMovement(client, product_id, row.vendor_id, "reserve", parseInt(quantity),
      order_ref, "Stock reserved for order");

    await client.query("COMMIT");

    return res.json({
      success:   true,
      message:   "Stock reserved",
      reserved:  parseInt(quantity),
      available: available - parseInt(quantity),
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── CONFIRM SALE (called after payment confirmed) ─────────────
/**
 * POST /inventory/confirm
 * Body: { product_id, quantity, order_ref }
 * Effect: Moves reserved → actual reduction (stock -= qty, reserved -= qty)
 */
app.post("/inventory/confirm", asyncHandler(async (req, res) => {
  const { product_id, quantity, order_ref } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inv = await client.query(
      "SELECT * FROM inventory WHERE product_id=$1 FOR UPDATE", [product_id]
    );
    if (!inv.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Inventory not found" });
    }

    const row = inv.rows[0];
    if (row.reserved < parseInt(quantity)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `Cannot confirm more than reserved. Reserved: ${row.reserved}`,
      });
    }

    await client.query(
      `UPDATE inventory SET
         quantity = quantity - $1,
         reserved = reserved - $1,
         updated_at = NOW()
       WHERE product_id=$2`,
      [parseInt(quantity), product_id]
    );

    await _logMovement(client, product_id, row.vendor_id, "sale", parseInt(quantity),
      order_ref, "Sale confirmed");

    await client.query("COMMIT");

    // Get updated inventory
    const updated = await pool.query(
      "SELECT *, (quantity-reserved) available FROM inventory WHERE product_id=$1", [product_id]
    );
    const low_stock = updated.rows[0]?.available <= updated.rows[0]?.reorder_level;

    return res.json({
      success:         true,
      message:         "Sale confirmed — stock reduced",
      remaining_stock: updated.rows[0]?.quantity,
      available:       updated.rows[0]?.available,
      low_stock_alert: low_stock ? `⚠️ Low stock: ${updated.rows[0]?.quantity} units remain` : null,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── RELEASE RESERVED (called if payment fails or order cancelled) ─
/**
 * POST /inventory/release
 * Body: { product_id, quantity, order_ref }
 */
app.post("/inventory/release", asyncHandler(async (req, res) => {
  const { product_id, quantity, order_ref } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const inv = await client.query(
      "SELECT * FROM inventory WHERE product_id=$1 FOR UPDATE", [product_id]
    );
    if (!inv.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "Inventory not found" });
    }

    const to_release = Math.min(parseInt(quantity), inv.rows[0].reserved);
    await client.query(
      "UPDATE inventory SET reserved = reserved - $1, updated_at=NOW() WHERE product_id=$2",
      [to_release, product_id]
    );

    await _logMovement(client, product_id, inv.rows[0].vendor_id, "release", to_release,
      order_ref, "Stock released — order cancelled or payment failed");

    await client.query("COMMIT");

    return res.json({
      success:  true,
      message:  "Stock reservation released",
      released: to_release,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}));

// ── INVENTORY MOVEMENTS LOG ───────────────────────────────────
app.get("/inventory/:product_id/movements", asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);

  const result = await pool.query(
    `SELECT * FROM inventory_movements
     WHERE product_id=$1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [req.params.product_id, parseInt(limit), offset]
  );
  return res.json({ success: true, movements: result.rows });
}));

// ── LOW STOCK ALERTS (admin/vendor poll) ─────────────────────
app.get("/inventory/alerts/low-stock", requireAuth, asyncHandler(async (req, res) => {
  const { vendor_id } = req.query;
  let q = `SELECT i.*, p.name product_name, v.business_name
           FROM inventory i
           JOIN products p ON i.product_id=p.id
           JOIN vendors v ON i.vendor_id=v.id
           WHERE (i.quantity - i.reserved) <= i.reorder_level AND i.status='active'`;
  const vals = [];
  if (vendor_id) { q += " AND i.vendor_id=$1"; vals.push(parseInt(vendor_id)); }
  q += " ORDER BY (i.quantity-i.reserved) ASC";
  const result = await pool.query(q, vals);
  return res.json({ success: true, alerts: result.rows, count: result.rows.length });
}));

// ── HELPER ────────────────────────────────────────────────────
async function _logMovement(db, product_id, vendor_id, type, qty, ref, note) {
  await db.query(
    `INSERT INTO inventory_movements(product_id, vendor_id, type, quantity, reference, note)
     VALUES($1,$2,$3,$4,$5,$6)`,
    [product_id, vendor_id || null, type, qty, ref || null, note || null]
  );
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Inventory Service running on port ${PORT}`));
module.exports = app;
