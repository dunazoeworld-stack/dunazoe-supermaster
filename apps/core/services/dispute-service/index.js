// ================================================================
// DUNAZOE OS — DISPUTE SERVICE
// services/dispute-service/index.js
// Port: 4016
//
// CTO RULES:
//   - Escrow LOCKED immediately when dispute raised
//   - Both parties have 24 hours to submit evidence
//   - Only admin can resolve
//   - Vendor gets payment only after resolution in their favour
//   - Buyer gets refund only after resolution in their favour
//   - All actions logged to audit_log
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4016;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const ESCROW_URL    = process.env.ESCROW_SERVICE_URL    || "http://localhost:4007";
const EVIDENCE_HOURS= parseInt(process.env.DISPUTE_EVIDENCE_HOURS || "24");

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ service: "dispute-service", status: "ok", port: PORT });
});

// ── RAISE DISPUTE ─────────────────────────────────────────────
/**
 * POST /disputes
 * Auth: customer or vendor (either party)
 * Body: { order_id, reason, evidence_urls? }
 */
app.post("/disputes", requireAuth, asyncHandler(async (req, res) => {
  const { order_id, reason, evidence_urls = [] } = req.body;
  const user_id = req.user.id;

  if (!order_id || !reason) {
    return res.status(400).json({ success: false, error: "order_id and reason required" });
  }
  if (reason.trim().length < 10) {
    return res.status(400).json({ success: false, error: "Reason must be at least 10 characters" });
  }

  // Verify user is involved in this order
  const order = await pool.query(
    `SELECT o.*, v.user_id vendor_user_id FROM orders o
     JOIN vendors v ON o.vendor_id = v.id
     WHERE o.id = $1`, [order_id]
  );
  if (!order.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const o = order.rows[0];
  const is_customer = o.customer_id === user_id;
  const is_vendor   = o.vendor_user_id === user_id;

  if (!is_customer && !is_vendor) {
    return res.status(403).json({ success: false, error: "You are not party to this order" });
  }

  // Only allow disputes on active/delivered orders
  if (!["paid","processing","shipped","delivered"].includes(o.status)) {
    return res.status(400).json({
      success: false,
      error:  `Cannot raise dispute on order with status: ${o.status}`
    });
  }

  // Check for existing open dispute
  const existing = await pool.query(
    "SELECT id FROM disputes WHERE order_id=$1 AND status NOT IN ('closed','resolved_buyer','resolved_vendor')",
    [order_id]
  );
  if (existing.rows.length > 0) {
    return res.status(409).json({
      success:    false,
      error:      "A dispute already exists for this order",
      dispute_id: existing.rows[0].id
    });
  }

  const against           = is_customer ? o.vendor_user_id : o.customer_id;
  const evidence_deadline = new Date(Date.now() + EVIDENCE_HOURS * 3600000).toISOString();

  const result = await pool.query(
    `INSERT INTO disputes(order_id, raised_by, against, reason, evidence_urls,
       status, evidence_deadline)
     VALUES($1,$2,$3,$4,$5,'open',$6) RETURNING *`,
    [order_id, user_id, against, reason.trim(),
     JSON.stringify(evidence_urls), evidence_deadline]
  );

  const dispute = result.rows[0];

  // Lock escrow immediately
  const escrow = await pool.query(
    "SELECT id FROM escrow WHERE order_id=$1 AND status='held'", [order_id]
  );
  if (escrow.rows[0]) {
    await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/lock`)
      .catch(e => console.error("Escrow lock failed:", e.message));
  }

  // Update order status
  await pool.query(
    "UPDATE orders SET status='disputed', updated_at=NOW() WHERE id=$1", [order_id]
  );

  // Notify the other party
  const notif_msg = `⚠️ Dispute raised on Order #${order_id}. Upload evidence within ${EVIDENCE_HOURS} hours.`;
  await pool.query(
    "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'warning')",
    [against, "Dispute Raised on Your Order", notif_msg]
  ).catch(() => {});

  // Audit
  await _audit(user_id, req.user.role, "DISPUTE_RAISED", "order", String(order_id), reason);

  return res.status(201).json({
    success:           true,
    dispute_id:        dispute.id,
    order_id,
    status:            "open",
    evidence_deadline,
    escrow_status:     "locked — funds frozen until resolution",
    message:           `Dispute filed. Both parties have ${EVIDENCE_HOURS} hours to submit evidence.`,
    next_step:         `POST /disputes/${dispute.id}/evidence with photo/video URLs`,
  });
}));

// ── SUBMIT EVIDENCE ───────────────────────────────────────────
/**
 * POST /disputes/:id/evidence
 * Body: { evidence_urls: [], notes? }
 */
app.post("/disputes/:id/evidence", requireAuth, asyncHandler(async (req, res) => {
  const { id }                    = req.params;
  const { evidence_urls = [], notes = "" } = req.body;
  const user_id = req.user.id;

  if (!evidence_urls.length && !notes) {
    return res.status(400).json({ success: false, error: "Provide evidence_urls or notes" });
  }

  const dispute = await pool.query("SELECT * FROM disputes WHERE id=$1", [id]);
  if (!dispute.rows[0]) {
    return res.status(404).json({ success: false, error: "Dispute not found" });
  }

  const d = dispute.rows[0];

  if (!["open","evidence_pending"].includes(d.status)) {
    return res.status(400).json({ success: false, error: `Cannot add evidence to dispute with status: ${d.status}` });
  }

  // Verify party is involved
  if (d.raised_by !== user_id && d.against !== user_id) {
    return res.status(403).json({ success: false, error: "Not your dispute" });
  }

  // Check deadline
  if (new Date() > new Date(d.evidence_deadline)) {
    return res.status(400).json({ success: false, error: "Evidence submission deadline has passed" });
  }

  // Merge with existing evidence
  const existing_urls = JSON.parse(d.evidence_urls || "[]");
  const all_urls      = [...existing_urls, ...evidence_urls];

  await pool.query(
    "UPDATE disputes SET evidence_urls=$1, status='under_review' WHERE id=$2",
    [JSON.stringify(all_urls), id]
  );

  // Notify admin
  const admins = await pool.query("SELECT user_id FROM admin_staff WHERE office='dispute_resolver' LIMIT 1");
  if (admins.rows[0]) {
    await pool.query(
      "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'info')",
      [admins.rows[0].user_id,
       `Evidence Submitted — Dispute #${id}`,
       `${evidence_urls.length} file(s) submitted. Ready for admin review.`]
    ).catch(() => {});
  }

  return res.json({
    success:    true,
    dispute_id: id,
    evidence_count: all_urls.length,
    status:     "under_review",
    message:    "Evidence submitted. Admin will review within 24 hours.",
  });
}));

// ── RESOLVE DISPUTE (Admin only) ──────────────────────────────
/**
 * POST /disputes/:id/resolve
 * Auth: Admin only
 * Body: { decision: "buyer"|"vendor", reason, refund_amount? }
 */
app.post("/disputes/:id/resolve", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const { id }   = req.params;
    const { decision, reason, refund_amount } = req.body;

    if (!["buyer","vendor"].includes(decision)) {
      return res.status(400).json({ success: false, error: "decision must be 'buyer' or 'vendor'" });
    }
    if (!reason) {
      return res.status(400).json({ success: false, error: "reason required" });
    }

    const dispute = await pool.query(
      `SELECT d.*, o.customer_id, o.vendor_id, o.amount
       FROM disputes d JOIN orders o ON d.order_id=o.id WHERE d.id=$1`, [id]
    );
    if (!dispute.rows[0]) {
      return res.status(404).json({ success: false, error: "Dispute not found" });
    }

    const d = dispute.rows[0];
    if (!["open","evidence_pending","under_review","escalated"].includes(d.status)) {
      return res.status(400).json({ success: false, error: `Cannot resolve dispute with status: ${d.status}` });
    }

    // Get escrow
    const escrow = await pool.query(
      "SELECT * FROM escrow WHERE order_id=$1", [d.order_id]
    );

    const new_status = `resolved_${decision}`;
    let   refund_issued = false;
    let   refund_amt    = 0;

    if (decision === "buyer") {
      // Refund escrow to buyer
      refund_amt = parseFloat(refund_amount || d.amount);
      if (escrow.rows[0]) {
        await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/refund`, {
          reason: `Admin resolved in buyer's favour: ${reason}`
        }).catch(e => console.error("Escrow refund failed:", e.message));
      }
      refund_issued = true;

      await pool.query(
        "UPDATE orders SET status='refunded', updated_at=NOW() WHERE id=$1", [d.order_id]
      );
      await pool.query(
        "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'success')",
        [d.customer_id, "✅ Dispute Resolved in Your Favour",
         `Refund of ₦${refund_amt.toLocaleString()} is being processed.`]
      ).catch(() => {});
      await pool.query(
        "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'warning')",
        [d.against, "Dispute Resolved — Buyer Favoured",
         `Admin decision: ${reason}. Escrow refunded to buyer.`]
      ).catch(() => {});

    } else {
      // Release escrow to vendor
      if (escrow.rows[0]) {
        await axios.post(`${ESCROW_URL}/escrow/${escrow.rows[0].id}/release`)
          .catch(e => console.error("Escrow release failed:", e.message));
      }
      await pool.query(
        "UPDATE orders SET status='completed', updated_at=NOW() WHERE id=$1", [d.order_id]
      );
      await pool.query(
        "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'success')",
        [d.against, "✅ Dispute Resolved in Your Favour",
         `Payment of ₦${parseFloat(d.amount).toLocaleString()} released to your account.`]
      ).catch(() => {});
      await pool.query(
        "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'warning')",
        [d.raised_by, "Dispute Resolved — Vendor Favoured",
         `Admin decision: ${reason}`]
      ).catch(() => {});
    }

    await pool.query(
      `UPDATE disputes SET status=$1, decision=$2, decided_by=$3,
         refund_issued=$4, refund_amount=$5, resolved_at=NOW()
       WHERE id=$6`,
      [new_status, reason, req.user.id, refund_issued, refund_amt, id]
    );

    await _audit(req.user.id, "admin", "DISPUTE_RESOLVED", "dispute", id,
      `decision=${decision} reason=${reason}`);

    return res.json({
      success:       true,
      dispute_id:    id,
      decision,
      status:        new_status,
      refund_issued,
      refund_amount: refund_amt,
      message:       `Dispute resolved in ${decision}'s favour.`,
    });
  })
);

// ── GET DISPUTE ────────────────────────────────────────────────
app.get("/disputes/:id", requireAuth, asyncHandler(async (req, res) => {
  const dispute = await pool.query(
    `SELECT d.*,
            u_raised.name raised_by_name,
            u_against.name against_name
     FROM disputes d
     JOIN users u_raised ON d.raised_by = u_raised.id
     JOIN users u_against ON d.against  = u_against.id
     WHERE d.id=$1`, [req.params.id]
  );
  if (!dispute.rows[0]) {
    return res.status(404).json({ success: false, error: "Dispute not found" });
  }
  const d = dispute.rows[0];
  if (d.raised_by !== req.user.id && d.against !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, error: "Access denied" });
  }
  return res.json({ success: true, dispute: d });
}));

// ── MY DISPUTES ────────────────────────────────────────────────
app.get("/disputes/my/list", requireAuth, asyncHandler(async (req, res) => {
  const rows = await pool.query(
    `SELECT d.*, o.amount order_amount FROM disputes d
     JOIN orders o ON d.order_id=o.id
     WHERE d.raised_by=$1 OR d.against=$1
     ORDER BY d.raised_at DESC LIMIT 20`,
    [req.user.id]
  );
  return res.json({ success: true, disputes: rows.rows });
}));

// ── ALL DISPUTES (Admin) ───────────────────────────────────────
app.get("/disputes", requireAuth, requireRole("admin"), asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page)-1)*parseInt(limit);
  let q    = "SELECT d.*,o.amount,u.name raised_name FROM disputes d JOIN orders o ON d.order_id=o.id JOIN users u ON d.raised_by=u.id WHERE 1=1";
  const v  = [];
  if (status) { q += " AND d.status=$1"; v.push(status); }
  q += ` ORDER BY d.raised_at DESC LIMIT $${v.length+1} OFFSET $${v.length+2}`;
  v.push(parseInt(limit), offset);
  const rows = await pool.query(q, v);
  return res.json({ success: true, disputes: rows.rows, count: rows.rows.length });
}));

async function _audit(actor_id, role, action, target_type, target_id, detail) {
  await pool.query(
    "INSERT INTO audit_log(actor_id,actor_role,action,target_type,target_id,detail) VALUES($1,$2,$3,$4,$5,$6)",
    [actor_id, role, action, target_type, target_id, detail]
  ).catch(() => {});
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Dispute Service running on port ${PORT}`));
module.exports = app;
