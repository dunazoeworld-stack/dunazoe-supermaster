// ================================================================
// DUNAZOE OS — COMMISSION + INCENTIVE SERVICE
// services/commission-service/index.js
// Port: 4013
//
// Manages:
//   - 2% delivery commission (inter-location orders)
//   - ₦5,000 milestone bonus at every 100 deliveries
//   - 6% copytrader referral commission
//   - Biweekly payout cycle (every 14 days)
//   - Payout via bank/OPay/Moniepoint
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4013;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const DELIVERY_COMMISSION_PCT = parseFloat(process.env.DELIVERY_COMMISSION_PCT || "0.02");
const COPYTRADER_COMMISSION   = parseFloat(process.env.COPYTRADER_COMMISSION   || "0.06");
const MILESTONE_EVERY         = parseInt(process.env.MILESTONE_EVERY           || "100");
const MILESTONE_BONUS_NGN     = parseFloat(process.env.MILESTONE_BONUS_NGN    || "5000");
const PAYOUT_CYCLE_DAYS       = parseInt(process.env.PAYOUT_CYCLE_DAYS        || "14");

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    service: "commission-service", status: "ok", port: PORT,
    rules: {
      delivery_commission: `${DELIVERY_COMMISSION_PCT*100}%`,
      copytrader_commission: `${COPYTRADER_COMMISSION*100}%`,
      milestone_bonus: `₦${MILESTONE_BONUS_NGN.toLocaleString()} every ${MILESTONE_EVERY} deliveries`,
      payout_cycle: `Every ${PAYOUT_CYCLE_DAYS} days`,
    },
  });
}));

// ── RECORD DELIVERY COMMISSION ────────────────────────────────
/**
 * POST /commissions/delivery
 * Called by Logistics Service after inter-location delivery confirmed
 * Body: { agent_user_id, order_id, order_amount, vendor_id? }
 */
app.post("/commissions/delivery", asyncHandler(async (req, res) => {
  const { agent_user_id, order_id, order_amount, vendor_id } = req.body;

  if (!agent_user_id || !order_id || !order_amount) {
    return res.status(400).json({ success: false, error: "agent_user_id, order_id, order_amount required" });
  }

  const commission = parseFloat((parseFloat(order_amount) * DELIVERY_COMMISSION_PCT).toFixed(2));

  // Add to payout ledger
  const result = await pool.query(
    `INSERT INTO payout_ledger(user_id, type, amount, source, order_id)
     VALUES($1,'delivery_commission',$2,$3,$4) RETURNING id`,
    [agent_user_id, commission, `Delivery commission — Order ${order_id}`, order_id]
  );

  // Update agent total deliveries and check milestone
  const agent_row = await pool.query(
    `SELECT total_deliveries FROM delivery_agents WHERE user_id=$1`, [agent_user_id]
  );

  if (agent_row.rows[0]) {
    const new_total = parseInt(agent_row.rows[0].total_deliveries) + 1;
    await pool.query(
      "UPDATE delivery_agents SET total_deliveries=$1, total_earned=total_earned+$2 WHERE user_id=$3",
      [new_total, commission, agent_user_id]
    );

    // Check milestone bonus
    if (new_total % MILESTONE_EVERY === 0) {
      await _award_milestone_bonus(agent_user_id, new_total);
    }
  }

  return res.json({
    success:       true,
    commission_id: result.rows[0].id,
    agent_user_id,
    commission_ngn: commission,
    order_id,
    message:       `₦${commission.toLocaleString()} commission queued for next payout`,
  });
}));

// ── RECORD COPYTRADER COMMISSION ──────────────────────────────
/**
 * POST /commissions/copytrader
 * Called by Order Service when a referred order is completed
 * Body: { referrer_vendor_id, buyer_id, order_id, order_amount }
 */
app.post("/commissions/copytrader", asyncHandler(async (req, res) => {
  const { referrer_vendor_id, buyer_id, order_id, order_amount } = req.body;

  // Anti-abuse: buyer cannot be the same person as referrer
  const vendor = await pool.query(
    "SELECT user_id FROM vendors WHERE id=$1", [referrer_vendor_id]
  );
  if (vendor.rows[0] && vendor.rows[0].user_id === parseInt(buyer_id)) {
    return res.status(400).json({
      success: false,
      error:   "Self-referral detected. Commission not recorded."
    });
  }

  const commission = parseFloat((parseFloat(order_amount) * COPYTRADER_COMMISSION).toFixed(2));
  const ref_user_id = vendor.rows[0]?.user_id;

  if (!ref_user_id) {
    return res.status(404).json({ success: false, error: "Referrer vendor not found" });
  }

  const result = await pool.query(
    `INSERT INTO payout_ledger(user_id, type, amount, source, order_id)
     VALUES($1,'copytrader_commission',$2,$3,$4) RETURNING id`,
    [ref_user_id, commission, `Copytrader commission — Order ${order_id}`, order_id]
  );

  // Update referral record
  await pool.query(
    "UPDATE referrals SET commission=$1, status='pending' WHERE order_id=$2",
    [commission, order_id]
  ).catch(() => {});

  // Update vendor copy trader stats
  await pool.query(
    "UPDATE copy_traders SET total_sales=total_sales+1, total_earned=total_earned+$1 WHERE user_id=$2",
    [commission, ref_user_id]
  ).catch(() => {});

  return res.json({
    success:        true,
    commission_id:  result.rows[0].id,
    referrer_user:  ref_user_id,
    commission_ngn: commission,
    rate:           `${COPYTRADER_COMMISSION*100}%`,
    message:        `₦${commission.toLocaleString()} copytrader commission queued`,
  });
}));

// ── GET PENDING PAYOUTS (Admin) ───────────────────────────────
app.get("/commissions/pending", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const pending = await pool.query(
      `SELECT pl.*, u.name, u.email,
              v.bank_name, v.account_no, v.account_name, v.payout_method
       FROM payout_ledger pl
       JOIN users u ON pl.user_id=u.id
       LEFT JOIN vendors v ON v.user_id=pl.user_id
       WHERE pl.status='pending'
       ORDER BY pl.created_at ASC`
    );

    const total = pending.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    return res.json({
      success:      true,
      pending_payouts: pending.rows,
      count:        pending.rows.length,
      total_ngn:    Math.round(total * 100) / 100,
      payout_cycle: `Every ${PAYOUT_CYCLE_DAYS} days`,
    });
  })
);

// ── RUN PAYOUT (Admin — biweekly) ────────────────────────────
/**
 * POST /commissions/payout/run
 * Auth: Admin only
 * Processes all pending payouts via bank/OPay/Moniepoint
 * CTO: In production, this calls Paystack Bulk Transfer API
 */
app.post("/commissions/payout/run", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const pending = await pool.query(
      `SELECT pl.*, u.name user_name,
              COALESCE(v.bank_name,'') bank,
              COALESCE(v.account_no,'') acct,
              COALESCE(v.account_name,'') acct_name,
              COALESCE(v.payout_method,'bank') method
       FROM payout_ledger pl
       JOIN users u ON pl.user_id=u.id
       LEFT JOIN vendors v ON v.user_id=pl.user_id
       WHERE pl.status='pending'`
    );

    if (pending.rows.length === 0) {
      return res.json({ success: true, message: "No pending payouts", count: 0 });
    }

    let paid_count = 0;
    let paid_total = 0;
    let failed     = 0;

    for (const p of pending.rows) {
      try {
        // Production: call Paystack Transfer API here
        // const transfer = await paystack.transfer({ amount: p.amount * 100, recipient: ... })

        await pool.query(
          "UPDATE payout_ledger SET status='paid', processed_at=NOW() WHERE id=$1", [p.id]
        );

        // Mark referral as paid
        if (p.type === "copytrader_commission" && p.order_id) {
          await pool.query(
            "UPDATE referrals SET status='paid', paid_at=NOW() WHERE order_id=$1", [p.order_id]
          ).catch(() => {});
        }

        paid_count++;
        paid_total += parseFloat(p.amount);
      } catch (_) {
        failed++;
        await pool.query(
          "UPDATE payout_ledger SET status='failed' WHERE id=$1", [p.id]
        );
      }
    }

    return res.json({
      success:     true,
      paid_count,
      failed_count: failed,
      total_paid:  Math.round(paid_total * 100) / 100,
      next_payout: `${PAYOUT_CYCLE_DAYS} days from now`,
      note:        "Production: integrate Paystack Bulk Transfer API for real disbursement",
    });
  })
);

// ── MY EARNINGS ───────────────────────────────────────────────
app.get("/commissions/my/earnings", requireAuth, asyncHandler(async (req, res) => {
  const pending = await pool.query(
    "SELECT SUM(amount) total FROM payout_ledger WHERE user_id=$1 AND status='pending'",
    [req.user.id]
  );
  const paid = await pool.query(
    "SELECT SUM(amount) total FROM payout_ledger WHERE user_id=$1 AND status='paid'",
    [req.user.id]
  );
  const history = await pool.query(
    "SELECT * FROM payout_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20",
    [req.user.id]
  );

  // Delivery milestone progress
  const agent = await pool.query(
    "SELECT total_deliveries FROM delivery_agents WHERE user_id=$1", [req.user.id]
  );
  const deliveries   = parseInt(agent.rows[0]?.total_deliveries || 0);
  const next_ms      = Math.ceil((deliveries + 1) / MILESTONE_EVERY) * MILESTONE_EVERY;
  const to_next_ms   = next_ms - deliveries;

  return res.json({
    success:          true,
    pending_payout:   parseFloat(pending.rows[0].total || 0),
    total_earned:     parseFloat(paid.rows[0].total || 0),
    history:          history.rows,
    delivery_milestone: {
      total_deliveries: deliveries,
      next_bonus_at:    next_ms,
      deliveries_left:  to_next_ms,
      bonus_amount:     `₦${MILESTONE_BONUS_NGN.toLocaleString()}`,
    },
  });
}));

// ── HELPER: Award milestone bonus ─────────────────────────────
async function _award_milestone_bonus(user_id, delivery_count) {
  await pool.query(
    `INSERT INTO payout_ledger(user_id, type, amount, source)
     VALUES($1,'milestone_bonus',$2,$3)`,
    [user_id, MILESTONE_BONUS_NGN, `Milestone: ${delivery_count} deliveries completed`]
  );
  // Notify user
  await pool.query(
    `INSERT INTO notifications(user_id, title, body, type)
     VALUES($1,$2,$3,'success')`,
    [user_id,
     `🏆 Milestone Bonus Unlocked!`,
     `You've completed ${delivery_count} deliveries! ₦${MILESTONE_BONUS_NGN.toLocaleString()} bonus queued for your next payout.`]
  ).catch(() => {});
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Commission Service running on port ${PORT}`));
module.exports = app;
