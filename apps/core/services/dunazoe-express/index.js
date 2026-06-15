// ================================================================
// DUNAZOE DRFCOS — DUNAZOE EXPRESS LOGISTICS ORCHESTRATOR
// services/dunazoe-express/index.js
// Port: 4032
//
// CEO VISION: DUNAZOE Express is not just shipping.
//   It is a hybrid delivery network + courier aggregation platform
//   that makes DUNAZOE the logistics backbone of SW Nigeria.
//
// DELIVERY VENDOR FIRST POLICY (NON-NEGOTIABLE):
//   1. Check nearby DUNAZOE delivery vendors (radius: 50km)
//   2. If no vendor available → check pickup stations
//   3. If neither → route to courier aggregator
//   4. Courier priority: Shipbubble > GIG > Jumia Express > DHL > FedEx > UPS
//
// AI CALCULATES:
//   - Cheapest route (haversine distance + courier rates)
//   - Fastest route (ETA prediction from courier APIs)
//   - Most reliable route (historical success rate per corridor)
//   - Bundle opportunities (same-vendor / same-location orders)
//
// COMMISSION MODEL:
//   2% delivery commission (from customer-side charge)
//   2% pickup coordination commission
//   ₦5,000 milestone bonus every 100 completed deliveries
// ================================================================

require("dotenv").config();

const express  = require("express");
const cors     = require("cors");
const axios    = require("axios");
const { Pool } = require("pg");
const { requireAuth, requireRole } = require("../../shared/middleware/auth");
const { errorHandler, asyncHandler } = require("../../shared/middleware/errorHandler");
const { logger, requestLogger }      = require("../../shared/logger");
const { generate }                   = require("../../shared/identity/idGenerator");

const app  = express();
const PORT = process.env.PORT || 4032;
app.use(cors()); app.use(express.json()); app.use(requestLogger);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const DELIVERY_RADIUS_KM  = parseFloat(process.env.DUNAZOE_EXPRESS_RADIUS_KM  || "50");
const MILESTONE_EVERY     = parseInt(process.env.MILESTONE_EVERY               || "100");
const MILESTONE_BONUS_NGN = parseFloat(process.env.MILESTONE_BONUS_NGN         || "5000");
const DELIVERY_COMM_PCT   = parseFloat(process.env.DELIVERY_COMMISSION_PCT     || "0.02");
const PICKUP_COMM_PCT     = parseFloat(process.env.PICKUP_COMMISSION_PCT        || "0.02");

// ── COURIER REGISTRY ──────────────────────────────────────────
const COURIERS = [
  { name:"shipbubble",    priority:1, api_key: process.env.SHIPBUBBLE_API_KEY, base:"https://api.shipbubble.com/v1" },
  { name:"gig",           priority:2, api_key: process.env.GIG_API_KEY,        base:"https://api.giglogistics.com/v1" },
  { name:"jumia_express", priority:3, api_key: process.env.JUMIA_EXPRESS_KEY,  base:"https://api.jumia.com/shipping" },
  { name:"dhl",           priority:4, api_key: process.env.DHL_API_KEY,        base:"https://api.dhl.com/shipments" },
  { name:"fedex",         priority:5, api_key: process.env.FEDEX_API_KEY,      base:"https://apis.fedex.com" },
  { name:"ups",           priority:6, api_key: process.env.UPS_API_KEY,        base:"https://onlinetools.ups.com" },
].filter(c => c.api_key);

// ── HAVERSINE DISTANCE ────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R   = 6371;
  const dL  = Math.PI / 180 * (lat2 - lat1);
  const dN  = Math.PI / 180 * (lon2 - lon1);
  const a   = Math.sin(dL/2)**2 +
    Math.cos(Math.PI/180*lat1) * Math.cos(Math.PI/180*lat2) * Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── INIT SCHEMA ───────────────────────────────────────────────
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_assignments (
      assignment_id   TEXT PRIMARY KEY,
      order_id        INTEGER REFERENCES orders(id),
      vendor_id       INTEGER REFERENCES vendors(id),
      agent_user_id   INTEGER REFERENCES users(id),
      assignment_type TEXT DEFAULT 'delivery_vendor'
                      CHECK (assignment_type IN ('delivery_vendor','pickup_station','courier')),
      courier_name    TEXT,
      courier_ref     TEXT,
      status          TEXT DEFAULT 'pending'
                      CHECK (status IN ('pending','assigned','accepted','picked_up','in_transit','nearby','delivered','failed','cancelled')),
      pickup_address  TEXT,
      delivery_address TEXT,
      vendor_lat      NUMERIC(10,6),
      vendor_lng      NUMERIC(10,6),
      dest_lat        NUMERIC(10,6),
      dest_lng        NUMERIC(10,6),
      distance_km     NUMERIC(8,2),
      estimated_cost  NUMERIC(10,2),
      actual_cost     NUMERIC(10,2),
      eta_minutes     INTEGER,
      gps_lat         NUMERIC(10,6),
      gps_lng         NUMERIC(10,6),
      delivery_photo  TEXT,
      proof_timestamp TIMESTAMP,
      tracking_code   TEXT,
      courier_tracking_url TEXT,
      ai_selection_reason TEXT,
      accept_deadline TIMESTAMP,
      picked_up_at    TIMESTAMP,
      delivered_at    TIMESTAMP,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_da_order  ON delivery_assignments(order_id);
    CREATE INDEX IF NOT EXISTS idx_da_agent  ON delivery_assignments(agent_user_id);
    CREATE INDEX IF NOT EXISTS idx_da_status ON delivery_assignments(status);

    CREATE TABLE IF NOT EXISTS delivery_bundlings (
      bundle_id       TEXT PRIMARY KEY,
      assignment_ids  TEXT[],
      vendor_id       INTEGER,
      pickup_zone     TEXT,
      delivery_zone   TEXT,
      savings_ngn     NUMERIC(10,2),
      status          TEXT DEFAULT 'active',
      created_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS courier_performance (
      courier_name    TEXT PRIMARY KEY,
      total_shipments INTEGER DEFAULT 0,
      success_count   INTEGER DEFAULT 0,
      avg_days        NUMERIC(4,1) DEFAULT 0,
      avg_cost_ngn    NUMERIC(10,2) DEFAULT 0,
      last_updated    TIMESTAMP DEFAULT NOW()
    );

    -- Seed known couriers
    INSERT INTO courier_performance(courier_name) VALUES
      ('shipbubble'),('gig'),('jumia_express'),('dhl'),('fedex'),('ups')
    ON CONFLICT DO NOTHING;
  `).catch(e => logger.warn("Express schema:", e.message));
  logger.info("DUNAZOE Express schema ready ✓");
}

app.get("/health", (req,res) => res.json({
  service:  "dunazoe-express",
  status:   "ok",
  port:     PORT,
  policy:   "Delivery Vendor First",
  couriers: COURIERS.map(c=>c.name),
}));

// ── CORE: ASSIGN DELIVERY ─────────────────────────────────────
/**
 * POST /express/assign
 * The AI logistics decision engine.
 * Follows strict Delivery Vendor First policy.
 */
app.post("/express/assign", asyncHandler(async (req, res) => {
  const {
    order_id, vendor_lat, vendor_lng, vendor_city,
    dest_lat, dest_lng, dest_city, state,
    order_amount, delivery_address, vendor_id,
  } = req.body;

  if (!order_id || !vendor_city || !dest_city) {
    return res.status(400).json({ success:false, error:"order_id, vendor_city, dest_city required" });
  }

  const assignment_id = generate("LOGISTICS_OP");
  const distance_km   = (vendor_lat && dest_lat)
    ? haversineKm(vendor_lat, vendor_lng, dest_lat, dest_lng)
    : null;

  // ── STEP 1: DELIVERY VENDOR FIRST ────────────────────────
  let assigned    = false;
  let result_data = null;

  // Find nearest DUNAZOE delivery vendor within radius
  if (vendor_lat && vendor_lng) {
    const nearby_vendors = await pool.query(
      `SELECT v.id, v.user_id, u.name, v.lat, v.lng, v.city, v.pickup_address,
              v.total_sales,
              (SELECT COUNT(*) FROM delivery_assignments da
               WHERE da.agent_user_id=v.user_id AND da.status='assigned'
                 AND da.created_at > NOW()-INTERVAL '2 hours') active_jobs
       FROM vendors v JOIN users u ON v.user_id=u.id
       WHERE v.can_deliver=TRUE AND v.status='active'
         AND (v.state=LOWER($1) OR v.city=LOWER($2))
         AND v.lat IS NOT NULL
       ORDER BY POWER(v.lat-$3,2)+POWER(v.lng-$4,2) ASC
       LIMIT 10`,
      [state||"", vendor_city.toLowerCase(), vendor_lat, vendor_lng]
    );

    for (const agent of nearby_vendors.rows) {
      const dist = haversineKm(vendor_lat, vendor_lng, agent.lat, agent.lng);
      if (dist > DELIVERY_RADIUS_KM) continue;
      if (parseInt(agent.active_jobs) >= 5) continue; // skip overloaded agents

      const est_cost = _estimateLocalDeliveryCost(distance_km || dist);
      const eta_mins = Math.round((dist / 30) * 60); // ~30km/h average

      await pool.query(
        `INSERT INTO delivery_assignments(
           assignment_id,order_id,vendor_id,agent_user_id,assignment_type,
           status,pickup_address,delivery_address,vendor_lat,vendor_lng,
           dest_lat,dest_lng,distance_km,estimated_cost,eta_minutes,
           accept_deadline,ai_selection_reason)
         VALUES($1,$2,$3,$4,'delivery_vendor','assigned',$5,$6,$7,$8,$9,$10,$11,$12,$13,
           NOW()+INTERVAL '30 minutes',$14)`,
        [assignment_id, order_id, vendor_id||null, agent.user_id,
         agent.pickup_address, delivery_address,
         vendor_lat, vendor_lng, dest_lat||null, dest_lng||null,
         distance_km||dist, est_cost, eta_mins,
         `Nearest DUNAZOE agent (${dist.toFixed(1)}km, ${agent.active_jobs} active jobs)`]
      );

      result_data = {
        assignment_id,
        type:          "delivery_vendor",
        agent_user_id: agent.user_id,
        agent_name:    agent.name,
        distance_km:   (distance_km || dist).toFixed(1),
        estimated_cost:est_cost,
        eta_minutes:   eta_mins,
        ai_reason:     `DUNAZOE delivery vendor selected (${dist.toFixed(1)}km away)`,
      };
      assigned = true;
      break;
    }
  }

  // ── STEP 2: PICKUP STATION FALLBACK ──────────────────────
  if (!assigned) {
    const pickup = await pool.query(
      `SELECT v.id, v.user_id, u.name, v.pickup_address, v.lat, v.lng
       FROM vendors v JOIN users u ON v.user_id=u.id
       WHERE v.is_pickup_station=TRUE AND v.status='active'
         AND LOWER(v.city)=LOWER($1)
       ORDER BY v.rating DESC LIMIT 1`,
      [dest_city]
    );

    if (pickup.rows[0]) {
      const p = pickup.rows[0];
      await pool.query(
        `INSERT INTO delivery_assignments(
           assignment_id,order_id,vendor_id,agent_user_id,assignment_type,
           status,pickup_address,delivery_address,distance_km,estimated_cost,
           eta_minutes,ai_selection_reason)
         VALUES($1,$2,$3,$4,'pickup_station','assigned',$5,$6,$7,$8,$9,$10)`,
        [assignment_id, order_id, p.id, p.user_id,
         p.pickup_address, delivery_address,
         distance_km || 0, 500, 1440, // ₦500, next day
         "Pickup station selected — no nearby delivery vendor"]
      );

      result_data = {
        assignment_id,
        type:          "pickup_station",
        station_id:    p.id,
        station_name:  p.name,
        pickup_address:p.pickup_address,
        estimated_cost:500,
        eta_minutes:   1440,
        ai_reason:     "Pickup station fallback (no delivery vendor in range)",
      };
      assigned = true;
    }
  }

  // ── STEP 3: COURIER AGGREGATOR ────────────────────────────
  if (!assigned) {
    const courier_result = await _selectCourier({
      vendor_city, dest_city, distance_km, order_amount,
    });

    if (courier_result) {
      await pool.query(
        `INSERT INTO delivery_assignments(
           assignment_id,order_id,vendor_id,assignment_type,courier_name,
           status,pickup_address,delivery_address,distance_km,estimated_cost,
           eta_minutes,ai_selection_reason)
         VALUES($1,$2,$3,'courier',$4,'assigned',$5,$6,$7,$8,$9,$10)`,
        [assignment_id, order_id, vendor_id||null,
         courier_result.courier, null, delivery_address,
         distance_km||0, courier_result.cost, courier_result.eta_days*1440,
         `AI-selected courier: ${courier_result.reason}`]
      );

      result_data = {
        assignment_id,
        type:          "courier",
        courier:       courier_result.courier,
        estimated_cost:courier_result.cost,
        eta_days:      courier_result.eta_days,
        ai_reason:     courier_result.reason,
      };
      assigned = true;
    }
  }

  if (!assigned) {
    return res.status(422).json({
      success: false,
      error:   "No delivery option available for this route. Contact support.",
      vendor_city, dest_city,
    });
  }

  // Update order with assignment
  await pool.query(
    "UPDATE orders SET delivery_agent_id=$1, logistics_status='assigned' WHERE id=$2",
    [result_data.agent_user_id || null, order_id]
  ).catch(()=>{});

  logger.info("Delivery assigned", {
    order_id, assignment_id, type: result_data.type,
    ai_reason: result_data.ai_reason,
  });

  return res.status(201).json({ success:true, ...result_data });
}));

// ── AI COURIER SELECTION ──────────────────────────────────────
async function _selectCourier({ vendor_city, dest_city, distance_km, order_amount }) {
  const same_zone  = _isSameZone(vendor_city, dest_city);
  const is_internat= false; // future

  // Get historical performance
  const perf = await pool.query(
    "SELECT courier_name, success_count, total_shipments, avg_days, avg_cost_ngn FROM courier_performance"
  );
  const perf_map = Object.fromEntries(perf.rows.map(r => [r.courier_name, r]));

  // Score each available courier
  const scored = COURIERS.map(c => {
    const p           = perf_map[c.name] || { success_count:0, total_shipments:1, avg_days:3, avg_cost_ngn:2000 };
    const success_rate= p.total_shipments > 0 ? p.success_count / p.total_shipments : 0.8;
    const est_cost    = _estimateCourierCost(c.name, distance_km || 200, same_zone);
    const eta_days    = c.name === "shipbubble" || c.name === "gig" ? (same_zone?1:2) : (same_zone?2:4);

    // AI scoring: weight cost (40%) + reliability (35%) + speed (25%)
    const cost_score   = 1 - Math.min(est_cost / 10000, 1);
    const speed_score  = 1 - Math.min(eta_days / 7, 1);
    const score        = (cost_score * 0.4) + (success_rate * 0.35) + (speed_score * 0.25);

    return { courier: c.name, cost: est_cost, eta_days, score, success_rate,
             reason: `Score:${score.toFixed(2)} (cost:₦${est_cost}, ETA:${eta_days}d, reliability:${(success_rate*100).toFixed(0)}%)` };
  });

  const best = scored.sort((a,b) => b.score - a.score)[0];
  return best || null;
}

function _isSameZone(city1, city2) {
  const SW_ZONES = {
    oyo:   ["ibadan","ogbomoso","oyo"],
    osun:  ["osogbo","ile-ife","ilesa","ede","iwo"],
    ondo:  ["akure","owo","ore","okitipupa","ondo"],
    ekiti: ["ado-ekiti","ikere-ekiti"],
    ogun:  ["abeokuta","sagamu","ijebu-ode"],
    lagos: ["lagos","ikeja","lekki","surulere","yaba"],
  };
  for (const zone of Object.values(SW_ZONES)) {
    if (zone.includes(city1?.toLowerCase()) && zone.includes(city2?.toLowerCase())) return true;
  }
  return false;
}

function _estimateLocalDeliveryCost(distance_km) {
  const base = 500;
  return Math.round(base + (distance_km || 10) * 50);
}

function _estimateCourierCost(courier_name, distance_km, same_zone) {
  const base_rates = {
    shipbubble: 1200, gig: 1500, jumia_express: 1800,
    dhl: 3500, fedex: 4000, ups: 4200,
  };
  const base     = base_rates[courier_name] || 2000;
  const zone_mul = same_zone ? 1 : 1.8;
  const dist_add = Math.max(0, (distance_km - 100) * 5);
  return Math.round((base + dist_add) * zone_mul);
}

// ── UPDATE TRACKING STATUS ────────────────────────────────────
app.post("/express/track", requireAuth, asyncHandler(async (req, res) => {
  const { assignment_id, stage, gps_lat, gps_lng, photo_url, notes } = req.body;

  const VALID_STAGES = ["confirmed","picked_up","in_transit","nearby","delivered"];
  if (!VALID_STAGES.includes(stage)) {
    return res.status(400).json({ success:false, error:`stage must be: ${VALID_STAGES.join(",")}` });
  }

  // Delivery photo required for 'delivered'
  if (stage === "delivered" && !photo_url) {
    return res.status(400).json({ success:false, error:"photo_url required to mark delivered" });
  }

  const updates = {
    status:    stage === "delivered" ? "delivered" : "in_transit",
    gps_lat:   gps_lat || null,
    gps_lng:   gps_lng || null,
    updated_at:"NOW()",
  };
  if (stage === "delivered") {
    updates.delivered_at   = "NOW()";
    updates.delivery_photo = photo_url;
    updates.proof_timestamp= "NOW()";
  }
  if (stage === "picked_up") updates.picked_up_at = "NOW()";

  await pool.query(
    `UPDATE delivery_assignments SET
       status=$1, gps_lat=$2, gps_lng=$3, updated_at=NOW()
       ${stage==="delivered"?",delivered_at=NOW(),delivery_photo=$4,proof_timestamp=NOW()"
                            : stage==="picked_up"?",picked_up_at=NOW()":""}
     WHERE assignment_id=$${stage==="delivered"?5:4}`,
    stage === "delivered"
      ? [updates.status, gps_lat||null, gps_lng||null, photo_url, assignment_id]
      : [updates.status, gps_lat||null, gps_lng||null, assignment_id]
  );

  // Update order status
  await pool.query(
    "UPDATE orders SET tracking_status=$1 WHERE id=(SELECT order_id FROM delivery_assignments WHERE assignment_id=$2)",
    [stage, assignment_id]
  ).catch(()=>{});

  // Check milestone if delivered
  if (stage === "delivered") {
    await _checkMilestone(req.user.id);
  }

  return res.json({ success:true, stage, assignment_id, timestamp:new Date().toISOString() });
}));

// ── MILESTONE BONUS ───────────────────────────────────────────
async function _checkMilestone(agent_user_id) {
  try {
    const count = await pool.query(
      "SELECT COUNT(*) c FROM delivery_assignments WHERE agent_user_id=$1 AND status='delivered'",
      [agent_user_id]
    );
    const total = parseInt(count.rows[0].c);
    if (total > 0 && total % MILESTONE_EVERY === 0) {
      // Credit milestone bonus to agent wallet
      await pool.query(
        `UPDATE wallets SET balance_ngn=balance_ngn+$1 WHERE user_id=$2`,
        [MILESTONE_BONUS_NGN, agent_user_id]
      );

      // Ledger entry
      const { transactions } = require("../../shared/ledger/ledgerEngine");
      await transactions.deliveryCommission({
        order_id:      `MILESTONE_${total}`,
        agent_user_id,
        order_amount:  MILESTONE_BONUS_NGN / DELIVERY_COMM_PCT,
        correlation_id:`MILESTONE_${agent_user_id}_${total}`,
      }).catch(()=>{});

      logger.info("Milestone bonus paid", {
        agent_user_id, deliveries: total, bonus: MILESTONE_BONUS_NGN,
      });
    }
  } catch(e) {
    logger.error("Milestone check failed:", e.message);
  }
}

// ── AI BUNDLE DETECTION ───────────────────────────────────────
app.post("/express/bundle", requireAuth, requireRole("admin","head_of_logistics"),
  asyncHandler(async (req, res) => {
    const { vendor_city, dest_city, limit=20 } = req.query;

    // Find same-vendor pending assignments
    const bundles = await pool.query(
      `SELECT da.vendor_id, v.city vendor_city, o.dest_city,
              array_agg(da.assignment_id) ids,
              COUNT(*) count,
              SUM(da.estimated_cost) total_cost,
              MIN(da.estimated_cost)*COUNT(*)*0.8 bundled_cost
       FROM delivery_assignments da
       JOIN orders o ON da.order_id=o.id
       JOIN vendors v ON da.vendor_id=v.id
       WHERE da.status='pending'
         ${vendor_city?`AND LOWER(v.city)=LOWER('${vendor_city}')`:""}
         ${dest_city?`AND LOWER(o.dest_city)=LOWER('${dest_city}')`:""}
         AND da.created_at > NOW()-INTERVAL '2 hours'
       GROUP BY da.vendor_id, v.city, o.dest_city
       HAVING COUNT(*) >= 2
       LIMIT $1`,
      [parseInt(limit)]
    );

    const opportunities = bundles.rows.map(b => ({
      vendor_id:    b.vendor_id,
      vendor_city:  b.vendor_city,
      dest_city:    b.dest_city,
      orders:       b.count,
      individual_cost: parseFloat(b.total_cost),
      bundled_cost:    parseFloat(b.bundled_cost),
      savings_ngn:     parseFloat(b.total_cost) - parseFloat(b.bundled_cost),
      assignment_ids:  b.ids,
    }));

    return res.json({ success:true, opportunities, total: opportunities.length });
  })
);

// ── GET ACTIVE ASSIGNMENTS ────────────────────────────────────
app.get("/express/assignments", requireAuth, asyncHandler(async (req, res) => {
  const { status, order_id } = req.query;

  let q      = "SELECT da.*,u.name agent_name FROM delivery_assignments da LEFT JOIN users u ON da.agent_user_id=u.id WHERE 1=1";
  const p    = [];

  if (status)   { q+=` AND da.status=$${p.length+1}`;   p.push(status);          }
  if (order_id) { q+=` AND da.order_id=$${p.length+1}`; p.push(parseInt(order_id));}

  // Agents see only their own
  if (req.user.role === "agent") {
    q += ` AND da.agent_user_id=$${p.length+1}`;
    p.push(req.user.id);
  }

  q += " ORDER BY da.created_at DESC LIMIT 50";
  const result = await pool.query(q, p);
  return res.json({ success:true, assignments:result.rows });
}));

// ── COURIER PERFORMANCE UPDATE (webhook from couriers) ────────
app.post("/express/courier/performance", asyncHandler(async (req, res) => {
  const { courier_name, success, days_taken, cost_ngn } = req.body;

  await pool.query(
    `UPDATE courier_performance SET
       total_shipments = total_shipments + 1,
       success_count   = success_count + $1,
       avg_days        = (avg_days * total_shipments + $2) / (total_shipments + 1),
       avg_cost_ngn    = (avg_cost_ngn * total_shipments + $3) / (total_shipments + 1),
       last_updated    = NOW()
     WHERE courier_name = $4`,
    [success?1:0, parseFloat(days_taken||0), parseFloat(cost_ngn||0), courier_name]
  );

  return res.json({ success:true });
}));

initSchema().catch(console.error);
app.use(errorHandler);
app.listen(PORT, () => logger.info(`✅ DUNAZOE Express running on port ${PORT}`));
module.exports = app;
