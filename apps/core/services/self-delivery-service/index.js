// ================================================================
// DUNAZOE OS — SELF-DELIVERY SERVICE (Update #94)
// services/self-delivery-service/index.js
// Port: 4028
//
// CEO VIEW: Reduce logistics cost. Let vendors and buyers
//   handle local deliveries themselves. Save DUNAZOE Express
//   for when it's actually needed.
//
// CTO RULES:
//   1. BOTH vendor AND user must explicitly consent
//   2. AI monitors every self-delivery for delays/disputes
//   3. DUNAZOE Express auto-activates on failure
//   4. Full chat/notification support via existing services
//   5. All tracking stages still recorded (dispute protection)
//   6. Commission rules still apply to DUNAZOE Express escalation
// ================================================================

require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");
const { queueJob }                   = require("../../shared/fintech/fintechOS");
const svc                            = require("../../shared/serviceClient");

const app  = express();
const PORT = process.env.PORT || 4028;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS self_deliveries (
      id                  SERIAL PRIMARY KEY,
      order_id            INTEGER NOT NULL REFERENCES orders(id),
      vendor_id           INTEGER NOT NULL,
      customer_id         INTEGER NOT NULL,
      vendor_consent      BOOLEAN DEFAULT FALSE,
      customer_consent    BOOLEAN DEFAULT FALSE,
      vendor_consented_at TIMESTAMP,
      customer_consented_at TIMESTAMP,
      status              TEXT DEFAULT 'pending_consent' CHECK (status IN (
        'pending_consent','agreed','scheduled','in_progress',
        'completed','failed','escalated_to_express','disputed'
      )),
      scheduled_pickup    TIMESTAMP,
      agreed_location     TEXT,
      delivery_notes      TEXT,
      completed_at        TIMESTAMP,
      failure_reason      TEXT,
      escalated_at        TIMESTAMP,
      escalation_reason   TEXT,
      ai_monitoring       BOOLEAN DEFAULT TRUE,
      last_ai_check       TIMESTAMP,
      proof_photo_url     TEXT,
      dispute_id          INTEGER,
      created_at          TIMESTAMP DEFAULT NOW(),
      updated_at          TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sd_order  ON self_deliveries(order_id);
    CREATE INDEX IF NOT EXISTS idx_sd_vendor ON self_deliveries(vendor_id);
    CREATE INDEX IF NOT EXISTS idx_sd_status ON self_deliveries(status);

    CREATE TABLE IF NOT EXISTS self_delivery_stages (
      id          SERIAL PRIMARY KEY,
      delivery_id INTEGER NOT NULL REFERENCES self_deliveries(id),
      stage       TEXT NOT NULL CHECK (stage IN (
        'agreed','scheduled','in_progress','completed',
        'failed','escalated'
      )),
      note        TEXT,
      photo_url   TEXT,
      recorded_by INTEGER REFERENCES users(id),
      recorded_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_sds_delivery ON self_delivery_stages(delivery_id);
  `).catch(e => logger.warn("[SelfDelivery] Schema:", e.message));
  logger.info("[SelfDelivery] Schema ready ✓");
}

app.get("/health", (req, res) => res.json({
  service: "self-delivery-service",
  status:  "ok",
  port:    PORT,
  update:  "#94",
}));

// ================================================================
// VENDOR INITIATES SELF-DELIVERY OFFER
// ================================================================
app.post("/self-delivery/offer", requireAuth, asyncHandler(async (req, res) => {
  const { order_id, delivery_notes, suggested_location } = req.body;
  if (!order_id) return res.status(400).json({ success: false, error: "order_id required" });

  // Verify this vendor owns the order
  const order = await pool.query(
    `SELECT o.*, v.user_id vendor_uid FROM orders o
     JOIN vendors v ON o.vendor_id = v.id WHERE o.id=$1`,
    [order_id]
  );
  if (!order.rows[0]) return res.status(404).json({ success: false, error: "Order not found" });
  if (order.rows[0].vendor_uid !== req.user.id) {
    return res.status(403).json({ success: false, error: "Not your order" });
  }
  if (!["pending","reserved"].includes(order.rows[0].status)) {
    return res.status(400).json({ success: false, error: "Order already in progress — cannot switch to self-delivery" });
  }

  // Create self-delivery record
  const delivery = await pool.query(
    `INSERT INTO self_deliveries(order_id,vendor_id,customer_id,vendor_consent,vendor_consented_at,
       delivery_notes,agreed_location,status)
     VALUES($1,$2,$3,TRUE,NOW(),$4,$5,'pending_consent') RETURNING *`,
    [order_id, order.rows[0].vendor_id, order.rows[0].customer_id,
     delivery_notes || null, suggested_location || null]
  );
  const delivery_id = delivery.rows[0].id;

  // Notify customer — they must consent too
  await queueJob("send_push", {
    user_id: order.rows[0].customer_id,
    title:   "📦 Self-Delivery Offer",
    body:    `Your vendor wants to self-deliver Order #${order_id}. Tap to review and accept or decline.`,
    data:    { screen: "self_delivery_consent", delivery_id },
  });
  await svc.notify(order.rows[0].customer_id,
    "Self-Delivery Offer",
    `Vendor wants to personally deliver Order #${order_id}. Open app to respond.`,
    ["in_app","whatsapp"]
  );

  return res.status(201).json({
    success:      true,
    delivery_id,
    status:       "pending_consent",
    message:      "Customer has been notified. Waiting for their consent.",
    next_step:    "Customer must accept at POST /self-delivery/consent",
  });
}));

// ================================================================
// CUSTOMER CONSENTS TO SELF-DELIVERY
// ================================================================
app.post("/self-delivery/consent", requireAuth, asyncHandler(async (req, res) => {
  const { delivery_id, accept, scheduled_pickup, agreed_location } = req.body;

  if (!delivery_id) return res.status(400).json({ success: false, error: "delivery_id required" });
  if (typeof accept !== "boolean") return res.status(400).json({ success: false, error: "accept must be true or false" });

  const delivery = await pool.query(
    "SELECT * FROM self_deliveries WHERE id=$1", [delivery_id]
  );
  if (!delivery.rows[0]) return res.status(404).json({ success: false, error: "Delivery not found" });
  if (delivery.rows[0].customer_id !== req.user.id) {
    return res.status(403).json({ success: false, error: "Not your order" });
  }
  if (delivery.rows[0].status !== "pending_consent") {
    return res.status(400).json({ success: false, error: `Already ${delivery.rows[0].status}` });
  }

  if (!accept) {
    // Customer declined — fall back to DUNAZOE Express automatically
    await pool.query(
      "UPDATE self_deliveries SET status='escalated_to_express',escalated_at=NOW(),escalation_reason='Customer declined self-delivery' WHERE id=$1",
      [delivery_id]
    );
    // Reactivate logistics service
    await svc.post("logistics", "/logistics/assign", { order_id: delivery.rows[0].order_id }).catch(() => {});

    return res.json({
      success:  true,
      status:   "escalated_to_express",
      message:  "DUNAZOE Express will handle this delivery.",
    });
  }

  // Both parties consented — activate self-delivery
  await pool.query(
    `UPDATE self_deliveries SET
       customer_consent=TRUE, customer_consented_at=NOW(),
       status='agreed', scheduled_pickup=$1,
       agreed_location=COALESCE($2, agreed_location), updated_at=NOW()
     WHERE id=$3`,
    [scheduled_pickup || null, agreed_location || null, delivery_id]
  );

  // Record stage
  await pool.query(
    "INSERT INTO self_delivery_stages(delivery_id,stage,note) VALUES($1,'agreed','Both parties consented to self-delivery')",
    [delivery_id]
  );

  // Notify vendor of acceptance
  await svc.notify(delivery.rows[0].vendor_id,
    "Self-Delivery Accepted ✅",
    `Customer accepted self-delivery for Order #${delivery.rows[0].order_id}. Coordinate via chat.`,
    ["in_app","whatsapp"]
  );

  // Open chat channel between vendor and customer
  await svc.emitOrder(delivery.rows[0].order_id, "self_delivery:agreed", {
    delivery_id,
    message:        "Self-delivery agreed! Coordinate pickup via chat.",
    vendor_id:      delivery.rows[0].vendor_id,
    customer_id:    delivery.rows[0].customer_id,
    scheduled_pickup,
  });

  return res.json({
    success:       true,
    delivery_id,
    status:        "agreed",
    message:       "Self-delivery confirmed! Use the DUNAZOE chat to coordinate pickup.",
    scheduled_pickup,
    agreed_location,
    chat_tip:      "Open order chat to arrange exact time and location with vendor.",
  });
}));

// ================================================================
// UPDATE DELIVERY STAGE
// ================================================================
app.post("/self-delivery/:id/stage", requireAuth, asyncHandler(async (req, res) => {
  const { stage, note, photo_url } = req.body;
  const VALID_STAGES = ["scheduled","in_progress","completed","failed"];

  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({ success: false, error: `stage must be: ${VALID_STAGES.join(",")}` });
  }

  const delivery = await pool.query(
    "SELECT * FROM self_deliveries WHERE id=$1", [req.params.id]
  );
  if (!delivery.rows[0]) return res.status(404).json({ success: false, error: "Not found" });

  const d = delivery.rows[0];
  // Only vendor or customer can update stages
  if (d.vendor_id !== req.user.id && d.customer_id !== req.user.id) {
    return res.status(403).json({ success: false, error: "Not authorised" });
  }

  // Require proof photo for completion
  if (stage === "completed" && !photo_url) {
    return res.status(400).json({ success: false, error: "photo_url required to mark self-delivery complete" });
  }

  await pool.query(
    `UPDATE self_deliveries SET status=$1, updated_at=NOW(),
       completed_at=CASE WHEN $1='completed' THEN NOW() ELSE NULL END,
       proof_photo_url=COALESCE($2,proof_photo_url)
     WHERE id=$3`,
    [stage, photo_url || null, req.params.id]
  );

  await pool.query(
    "INSERT INTO self_delivery_stages(delivery_id,stage,note,photo_url,recorded_by) VALUES($1,$2,$3,$4,$5)",
    [req.params.id, stage, note || null, photo_url || null, req.user.id]
  );

  // If completed — trigger escrow release
  if (stage === "completed") {
    await svc.post("escrow", `/escrow/${d.order_id}/release`, {
      reason:    "Self-delivery completed",
      photo_url,
    }).catch(() => {});

    // Update order status
    await pool.query(
      "UPDATE orders SET status='delivered',delivery_photo=$1 WHERE id=$2",
      [photo_url, d.order_id]
    ).catch(() => {});

    await svc.notify(d.customer_id, "Order Delivered ✅",
      `Your Order #${d.order_id} has been marked delivered. Funds released to vendor.`,
      ["in_app","whatsapp","sms"]
    );
  }

  if (stage === "failed") {
    // Auto-escalate to DUNAZOE Express
    await escalateToExpress(d, req.params.id, req.body.reason || "Self-delivery failed");
  }

  // Broadcast real-time update
  await svc.emitOrder(d.order_id, "delivery:stage", { stage, note, delivery_id: req.params.id });

  return res.json({ success: true, delivery_id: req.params.id, status: stage });
}));

// ================================================================
// AI MONITORING — Detect delays and auto-escalate
// ================================================================
async function monitorSelfDeliveries() {
  try {
    // Find deliveries overdue by more than 2 hours
    const overdue = await pool.query(
      `SELECT * FROM self_deliveries
       WHERE status IN ('agreed','scheduled','in_progress')
         AND scheduled_pickup < NOW() - INTERVAL '2 hours'
         AND escalated_at IS NULL`
    );

    for (const d of overdue.rows) {
      logger.warn("[SelfDelivery AI] Overdue delivery detected", { delivery_id: d.id, order_id: d.order_id });

      // Notify both parties first
      await svc.notify(d.customer_id, "⚠️ Delivery Delay",
        `Your self-delivery for Order #${d.order_id} appears delayed. Respond to avoid DUNAZOE Express escalation.`,
        ["in_app","whatsapp"]
      );
      await svc.notify(d.vendor_id, "⚠️ Delivery Delay Alert",
        `Self-delivery for Order #${d.order_id} is overdue. Update status or DUNAZOE Express will take over.`,
        ["in_app","whatsapp"]
      );

      await pool.query(
        "UPDATE self_deliveries SET last_ai_check=NOW() WHERE id=$1", [d.id]
      );
    }

    // Find deliveries overdue by more than 6 hours — auto-escalate
    const critical = await pool.query(
      `SELECT * FROM self_deliveries
       WHERE status IN ('agreed','scheduled','in_progress')
         AND scheduled_pickup < NOW() - INTERVAL '6 hours'
         AND escalated_at IS NULL`
    );

    for (const d of critical.rows) {
      await escalateToExpress(d, d.id, "AI auto-escalation: 6-hour delivery overdue");
    }
  } catch (e) {
    logger.error("[SelfDelivery Monitor] Error:", e.message);
  }
}

async function escalateToExpress(d, delivery_id, reason) {
  await pool.query(
    `UPDATE self_deliveries SET
       status='escalated_to_express',
       escalated_at=NOW(),
       escalation_reason=$1
     WHERE id=$2`,
    [reason, delivery_id]
  );

  await pool.query(
    "INSERT INTO self_delivery_stages(delivery_id,stage,note) VALUES($1,'escalated',$2)",
    [delivery_id, reason]
  );

  // Reassign to DUNAZOE Express
  await svc.post("logistics", "/logistics/assign", { order_id: d.order_id }).catch(() => {});

  await svc.notify(d.customer_id, "🚚 DUNAZOE Express Taking Over",
    `Self-delivery failed for Order #${d.order_id}. DUNAZOE Express is now handling your delivery.`,
    ["in_app","whatsapp","sms"]
  );
  await svc.notify(d.vendor_id, "DUNAZOE Express Escalation",
    `Self-delivery for Order #${d.order_id} escalated to DUNAZOE Express. Reason: ${reason}`,
    ["in_app","whatsapp"]
  );

  logger.warn("[SelfDelivery] Escalated to DUNAZOE Express", { delivery_id, order_id: d.order_id, reason });
}

// GET self-delivery status
app.get("/self-delivery/:id", requireAuth, asyncHandler(async (req, res) => {
  const d = await pool.query(
    `SELECT sd.*, array_agg(row_to_json(sds.*) ORDER BY sds.recorded_at) stages
     FROM self_deliveries sd
     LEFT JOIN self_delivery_stages sds ON sds.delivery_id=sd.id
     WHERE sd.id=$1 GROUP BY sd.id`,
    [req.params.id]
  );
  if (!d.rows[0]) return res.status(404).json({ success: false, error: "Not found" });

  return res.json({ success: true, delivery: d.rows[0] });
}));

// Run AI monitor every 30 minutes
setInterval(monitorSelfDeliveries, 30 * 60 * 1000);

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ Self-Delivery Service (Update #94) running on port ${PORT}`));
module.exports = app;
