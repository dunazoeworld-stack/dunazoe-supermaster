// ================================================================
// DUNAZOE OS — LOGISTICS SERVICE
// services/logistics-service/index.js
// Port: 4018
//
// Phase 6: delivery agent assignment + Shipbubble + 4-stage tracking
//
// CTO RULES:
//   - Same-city (small SW towns) → self-pickup from vendor
//   - Inter-location → nearest agent assigned + Shipbubble backup
//   - Delivery photo REQUIRED to mark as delivered
//   - 2% commission only on inter-location completed deliveries
//   - Agent must accept within 30 minutes or auto-reassign
//   - Milestone bonus triggered at every 100 deliveries
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 4018;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const COMMISSION_URL   = process.env.COMMISSION_SERVICE_URL  || "http://localhost:4013";
const NOTIF_URL        = process.env.NOTIFICATION_SERVICE_URL|| "http://localhost:4017";
const SHIPBUBBLE_KEY   = process.env.SHIPBUBBLE_API_KEY      || "";
const SHIPBUBBLE_BASE  = process.env.SHIPBUBBLE_BASE_URL     || "https://api.shipbubble.com/v1";
const ACCEPT_WINDOW    = parseInt(process.env.AGENT_ACCEPT_MINUTES || "30");
const MILESTONE_AT     = parseInt(process.env.MILESTONE_EVERY      || "100");

// SW Nigeria self-pickup cities (same-city = customer collects)
const SELF_PICKUP_CITIES = new Set([
  "ibadan","osogbo","ile-ife","ilesa","ede","iwo","akure","owo","ore",
  "okitipupa","ondo","ikare","abeokuta","ijebu-ode","ado-ekiti",
]);

// Haversine distance (km)
function haversine(lat1, lon1, lat2, lon2) {
  const R  = 6371;
  const dL = Math.PI/180*(lat2-lat1);
  const dN = Math.PI/180*(lon2-lon1);
  const a  = Math.sin(dL/2)**2 +
              Math.cos(Math.PI/180*lat1)*Math.cos(Math.PI/180*lat2)*Math.sin(dN/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── HEALTH ────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    service:    "logistics-service", status: "ok", port: PORT,
    shipbubble: SHIPBUBBLE_KEY ? "configured" : "not configured",
  });
});

// ── REGISTER DELIVERY AGENT ───────────────────────────────────
app.post("/logistics/agents/register", requireAuth, asyncHandler(async (req, res) => {
  const { vendor_id, state, city, lat = 0, lng = 0 } = req.body;
  const user_id = req.user.id;

  const existing = await pool.query(
    "SELECT id FROM delivery_agents WHERE user_id=$1", [user_id]
  );
  if (existing.rows.length) {
    return res.status(409).json({ success: false, error: "Already registered as agent" });
  }

  const result = await pool.query(
    `INSERT INTO delivery_agents(user_id,vendor_id,state,city,lat,lng)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
    [user_id, vendor_id||null, state, city,
     parseFloat(lat), parseFloat(lng)]
  );

  await _notify(user_id,
    "🛵 Agent Account Active",
    "You're now a DUNAZOE delivery agent. Accept orders within 30 minutes and earn per delivery!"
  );

  return res.status(201).json({ success: true, agent: result.rows[0] });
}));

// ── ASSIGN NEAREST AGENT ──────────────────────────────────────
/**
 * POST /logistics/assign
 * Called by Order Service after order is created
 * Body: { order_id, vendor_lat, vendor_lng, vendor_city, dest_city, state }
 */
app.post("/logistics/assign", asyncHandler(async (req, res) => {
  const { order_id, vendor_lat, vendor_lng, vendor_city, dest_city, state } = req.body;

  if (!order_id) {
    return res.status(400).json({ success: false, error: "order_id required" });
  }

  const src = (vendor_city||"").toLowerCase().trim();
  const dst = (dest_city ||"").toLowerCase().trim();

  // ── SAME CITY + SMALL TOWN → SELF-PICKUP ──────────────────
  if (src === dst && SELF_PICKUP_CITIES.has(src)) {
    await pool.query(
      "UPDATE orders SET is_self_pickup=TRUE, tracking_status='confirmed' WHERE id=$1",
      [order_id]
    );
    const vendor = await pool.query(
      "SELECT v.pickup_address, u.phone FROM orders o JOIN vendors v ON o.vendor_id=v.id JOIN users u ON v.user_id=u.id WHERE o.id=$1",
      [order_id]
    );
    return res.json({
      success:          true,
      method:           "self_pickup",
      vendor_address:   vendor.rows[0]?.pickup_address || "Contact vendor for address",
      message:          "Customer will collect directly from vendor",
      inter_location:   false,
    });
  }

  // ── INTER-LOCATION → FIND NEAREST AGENT ───────────────────
  const is_inter = src !== dst;

  const agents = await pool.query(
    "SELECT * FROM delivery_agents WHERE state=$1 AND is_available=TRUE",
    [state || "lagos"]
  );

  let best = null;
  let best_km = Infinity;

  for (const a of agents.rows) {
    if (a.lat && a.lng) {
      const km = haversine(
        parseFloat(vendor_lat||0), parseFloat(vendor_lng||0),
        parseFloat(a.lat), parseFloat(a.lng)
      );
      if (km < best_km) { best_km = km; best = a; }
    }
  }

  if (!best && agents.rows.length) { best = agents.rows[0]; best_km = 0; }

  let agent_id  = null;
  let assign_id = null;

  if (best) {
    const assign = await pool.query(
      "INSERT INTO delivery_assignments(order_id,agent_id,status) VALUES($1,$2,'assigned') RETURNING id",
      [order_id, best.id]
    );
    assign_id = assign.rows[0].id;
    agent_id  = best.id;

    await pool.query(
      "UPDATE delivery_agents SET is_available=FALSE WHERE id=$1", [best.id]
    );
    await pool.query(
      "UPDATE orders SET delivery_agent_id=$1, tracking_status='confirmed', is_inter_location=$2 WHERE id=$3",
      [best.user_id, is_inter, order_id]
    );

    await _notify(best.user_id,
      "📦 New Delivery Assignment",
      `Order #${order_id} assigned to you. Accept within ${ACCEPT_WINDOW} mins. ` +
      `Vendor is ~${best_km.toFixed(1)}km away.`
    );
  }

  // ── SHIPBUBBLE for inter-location ─────────────────────────
  let shipbubble_ref = null;
  if (is_inter && SHIPBUBBLE_KEY) {
    shipbubble_ref = await _initiate_shipbubble(order_id, src, dst);
  }

  return res.json({
    success:          true,
    method:           best ? "agent_delivery" : "shipbubble_only",
    agent_id:         best?.id || null,
    agent_user_id:    best?.user_id || null,
    distance_km:      best ? Math.round(best_km * 10) / 10 : null,
    assignment_id:    assign_id,
    inter_location:   is_inter,
    shipbubble_ref,
    accept_window_minutes: ACCEPT_WINDOW,
  });
}));

// ── UPDATE TRACKING ───────────────────────────────────────────
/**
 * POST /logistics/track
 * Auth: agent or admin
 * Body: { order_id, agent_id, stage, photo_url?, gps_lat?, gps_lng? }
 *
 * Stages: confirmed → picked_up → in_transit → nearby → delivered
 */
app.post("/logistics/track", requireAuth, asyncHandler(async (req, res) => {
  const { order_id, agent_id, stage, photo_url, gps_lat, gps_lng } = req.body;

  const VALID_STAGES = ["confirmed","picked_up","in_transit","nearby","delivered"];
  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({
      success: false,
      error:  `Invalid stage. Must be one of: ${VALID_STAGES.join(" → ")}`,
    });
  }

  if (stage === "delivered" && !photo_url) {
    return res.status(400).json({
      success: false,
      error:   "Delivery photo proof required to mark as delivered. Upload photo first.",
    });
  }

  // Update assignment
  const update_fields = { status: stage };
  if (stage === "picked_up")  update_fields.picked_up_at   = "NOW()";
  if (stage === "delivered")  update_fields.delivered_at   = "NOW()";
  if (photo_url)              update_fields.photo_proof     = photo_url;
  if (gps_lat && gps_lng) {
    update_fields.gps_lat = parseFloat(gps_lat);
    update_fields.gps_lng = parseFloat(gps_lng);
  }

  await pool.query(
    `UPDATE delivery_assignments SET
       status=$1,
       picked_up_at  = CASE WHEN $2='picked_up'  THEN NOW() ELSE picked_up_at  END,
       delivered_at  = CASE WHEN $2='delivered'   THEN NOW() ELSE delivered_at  END,
       photo_proof   = COALESCE($3, photo_proof),
       gps_lat       = COALESCE($4, gps_lat),
       gps_lng       = COALESCE($5, gps_lng)
     WHERE order_id=$6`,
    [stage, stage, photo_url||null,
     gps_lat ? parseFloat(gps_lat) : null,
     gps_lng ? parseFloat(gps_lng) : null,
     order_id]
  );

  // Update order tracking_status
  await pool.query(
    "UPDATE orders SET tracking_status=$1, delivery_photo=COALESCE($2,delivery_photo), updated_at=NOW() WHERE id=$3",
    [stage, photo_url||null, order_id]
  );

  // ── ON DELIVERY CONFIRMED ──────────────────────────────────
  if (stage === "delivered") {
    const order = await pool.query("SELECT * FROM orders WHERE id=$1", [order_id]);
    const o     = order.rows[0];

    // Mark order delivered
    await pool.query(
      "UPDATE orders SET status='delivered', updated_at=NOW() WHERE id=$1", [order_id]
    );

    // Free agent
    if (agent_id) {
      const agent = await pool.query("SELECT * FROM delivery_agents WHERE id=$1", [agent_id]);
      if (agent.rows[0]) {
        const new_total = parseInt(agent.rows[0].total_deliveries) + 1;
        await pool.query(
          "UPDATE delivery_agents SET is_available=TRUE, total_deliveries=$1 WHERE id=$2",
          [new_total, agent_id]
        );

        // 2% commission on inter-location deliveries
        if (o?.is_inter_location) {
          await axios.post(`${COMMISSION_URL}/commissions/delivery`, {
            agent_user_id: agent.rows[0].user_id,
            order_id,
            order_amount:  o.amount,
            vendor_id:     o.vendor_id,
          }).catch(e => console.error("Commission call failed:", e.message));
        }

        // Milestone bonus check (every 100)
        if (new_total % MILESTONE_AT === 0) {
          await axios.post(`${COMMISSION_URL}/commissions/delivery`, {
            agent_user_id: agent.rows[0].user_id,
            order_id:      `MILESTONE-${new_total}`,
            order_amount:  0,
            milestone_trigger: true,
          }).catch(() => {});
        }
      }
    }

    // Notify customer
    if (o) {
      await _notify(o.customer_id,
        "📦 Order Delivered!",
        `Your order #${order_id} has been delivered. Please rate your experience!`
      );
      // Notify vendor
      await _notify(o.vendor_id,
        "✅ Delivery Confirmed",
        `Order #${order_id} delivered. Payment will be released to your account.`
      );
    }
  }

  return res.json({
    success:         true,
    order_id,
    tracking_status: stage,
    timestamp:       new Date().toISOString(),
    message:
      stage === "delivered"
        ? "Delivery confirmed. Escrow release initiated."
        : `Tracking updated: ${stage}`,
  });
}));

// ── GET TRACKING STATUS ───────────────────────────────────────
app.get("/logistics/track/:order_id", requireAuth, asyncHandler(async (req, res) => {
  const order = await pool.query(
    "SELECT o.tracking_status, o.is_inter_location, o.is_self_pickup, o.delivery_photo, o.source_city, o.dest_city FROM orders o WHERE o.id=$1",
    [req.params.order_id]
  );
  if (!order.rows[0]) {
    return res.status(404).json({ success: false, error: "Order not found" });
  }

  const assignment = await pool.query(
    `SELECT da.*, u.name agent_name, u.phone agent_phone
     FROM delivery_assignments da
     JOIN delivery_agents ag ON da.agent_id=ag.id
     JOIN users u ON ag.user_id=u.id
     WHERE da.order_id=$1 ORDER BY da.created_at DESC LIMIT 1`,
    [req.params.order_id]
  );

  const shipbubble = await pool.query(
    "SELECT * FROM shipbubble_shipments WHERE order_id=$1", [req.params.order_id]
  );

  const o = order.rows[0];
  return res.json({
    success:          true,
    order_id:         parseInt(req.params.order_id),
    tracking_status:  o.tracking_status,
    is_inter_location:o.is_inter_location,
    is_self_pickup:   o.is_self_pickup,
    route:            o.source_city && o.dest_city ? `${o.source_city} → ${o.dest_city}` : null,
    delivery_photo:   o.delivery_photo,
    agent:            assignment.rows[0] || null,
    shipbubble:       shipbubble.rows[0] || null,
    stages:           ["confirmed","picked_up","in_transit","nearby","delivered"],
  });
}));

// ── AGENT DASHBOARD ───────────────────────────────────────────
app.get("/logistics/agents/dashboard", requireAuth, asyncHandler(async (req, res) => {
  const agent = await pool.query(
    "SELECT * FROM delivery_agents WHERE user_id=$1", [req.user.id]
  );
  if (!agent.rows[0]) {
    return res.status(404).json({ success: false, error: "Not registered as agent" });
  }
  const a        = agent.rows[0];
  const pending  = await pool.query(
    "SELECT da.*,o.amount,o.source_city,o.dest_city FROM delivery_assignments da JOIN orders o ON da.order_id=o.id WHERE da.agent_id=$1 AND da.status IN ('assigned','picked_up','in_transit','nearby')",
    [a.id]
  );
  const next_ms  = Math.ceil((a.total_deliveries + 1) / MILESTONE_AT) * MILESTONE_AT;
  return res.json({
    success:  true,
    agent:    a,
    stats: {
      total_deliveries:  a.total_deliveries,
      total_earned:      a.total_earned,
      pending_bonus:     a.pending_bonus,
      milestone_count:   a.milestone_count,
      next_milestone_at: next_ms,
      deliveries_to_go:  next_ms - a.total_deliveries,
      rating:            a.rating,
      is_available:      a.is_available,
    },
    active_deliveries: pending.rows,
  });
}));

// ── LOGISTICS ADMIN DASHBOARD ─────────────────────────────────
app.get("/logistics/dashboard", requireAuth, requireRole("admin"),
  asyncHandler(async (req, res) => {
    const total  = await pool.query("SELECT COUNT(*) c FROM delivery_agents");
    const avail  = await pool.query("SELECT COUNT(*) c FROM delivery_agents WHERE is_available=TRUE");
    const pend   = await pool.query("SELECT COUNT(*) c FROM delivery_assignments WHERE status='assigned'");
    const disps  = await pool.query("SELECT COUNT(*) c FROM disputes WHERE status='open'");
    const sb     = await pool.query("SELECT COUNT(*) c FROM shipbubble_shipments WHERE status='initiated'");

    return res.json({
      success:            true,
      total_agents:       parseInt(total.rows[0].c),
      available_agents:   parseInt(avail.rows[0].c),
      pending_deliveries: parseInt(pend.rows[0].c),
      open_disputes:      parseInt(disps.rows[0].c),
      shipbubble_active:  parseInt(sb.rows[0].c),
      utilisation_pct:    total.rows[0].c > 0
        ? Math.round((1 - avail.rows[0].c / total.rows[0].c) * 1000) / 10 : 0,
    });
  })
);

// ── SHIPBUBBLE HELPER ─────────────────────────────────────────
async function _initiate_shipbubble(order_id, origin, destination) {
  try {
    const ref = `SB-DZ-${order_id}-${Date.now()}`;
    await pool.query(
      `INSERT INTO shipbubble_shipments(order_id,shipbubble_ref,origin_city,dest_city,status)
       VALUES($1,$2,$3,$4,'initiated')`,
      [order_id, ref, origin, destination]
    );
    await pool.query(
      "UPDATE orders SET shipbubble_ref=$1 WHERE id=$2",
      [ref, order_id]
    );
    // In production: await axios.post(`${SHIPBUBBLE_BASE}/shipments`, { ... })
    return ref;
  } catch (e) {
    console.error("Shipbubble initiation failed:", e.message);
    return null;
  }
}

async function _notify(user_id, title, body) {
  try {
    await axios.post(`${NOTIF_URL}/notifications/send`, {
      user_id, title, body, type: "info", channels: ["in_app","whatsapp"]
    }, { headers: { "x-internal-key": process.env.INTERNAL_SECRET || "" } });
  } catch (_) {
    // Fallback: write directly to DB
    await pool.query(
      "INSERT INTO notifications(user_id,title,body,type) VALUES($1,$2,$3,'info')",
      [user_id, title, body]
    ).catch(() => {});
  }
}

app.use(errorHandler);
app.listen(PORT, () => console.log(`✅ Logistics Service running on port ${PORT}`));
module.exports = app;
