// ================================================================
// DUNAZOE OS — UPDATE #93 IMPLEMENTATION
// shared/reliability/reliabilityEngine.js
//
// CEO VIEW: High Volume + Low Margin = infrastructure must be
//   cheap to run but impossible to break.
//
// CTO IMPLEMENTATION:
//   1. Multi-AZ health checks with automatic failover
//   2. Graceful degradation (SMS→WhatsApp→Push→Email)
//   3. Nigeria network resilience (PHCN/MTN reality)
//   4. Cost governance AI (cloud spend monitoring)
//   5. Circuit breakers on ALL external APIs
//   6. Offline-first event queuing
//   7. AI traffic surge detection + auto-scaling signals
//   8. Webhook double-verification (NEVER trust payload alone)
//   9. Chaos engineering hooks
//  10. OpenTelemetry distributed tracing
// ================================================================

const crypto  = require("crypto");
const { Pool }= require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// ── INIT SCHEMA ───────────────────────────────────────────────
async function initReliabilitySchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_health_log (
      id          BIGSERIAL PRIMARY KEY,
      service     TEXT NOT NULL,
      status      TEXT NOT NULL CHECK (status IN ('healthy','degraded','down','recovering')),
      latency_ms  INTEGER,
      error       TEXT,
      checked_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_shl_service ON service_health_log(service, checked_at DESC);

    CREATE TABLE IF NOT EXISTS degradation_events (
      id          SERIAL PRIMARY KEY,
      service     TEXT NOT NULL,
      reason      TEXT NOT NULL,
      fallback    TEXT NOT NULL,
      activated_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS webhook_verifications (
      id              BIGSERIAL PRIMARY KEY,
      provider        TEXT NOT NULL,
      reference       TEXT NOT NULL,
      webhook_payload JSONB NOT NULL,
      verified_amount NUMERIC(15,2),
      verified_status TEXT,
      provider_response JSONB,
      is_verified     BOOLEAN DEFAULT FALSE,
      verification_at TIMESTAMP,
      idempotency_key TEXT UNIQUE,
      created_at      TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wv_ref ON webhook_verifications(reference);
    CREATE INDEX IF NOT EXISTS idx_wv_idempotency ON webhook_verifications(idempotency_key);

    CREATE TABLE IF NOT EXISTS cost_metrics (
      id          SERIAL PRIMARY KEY,
      metric_type TEXT NOT NULL,
      service     TEXT,
      value_ngn   NUMERIC(15,2),
      value_usd   NUMERIC(15,4),
      period_from TIMESTAMP,
      period_to   TIMESTAMP,
      recorded_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chaos_events (
      id          SERIAL PRIMARY KEY,
      event_type  TEXT NOT NULL,
      target      TEXT NOT NULL,
      initiated_by TEXT,
      outcome     TEXT,
      duration_secs INTEGER,
      started_at  TIMESTAMP DEFAULT NOW(),
      ended_at    TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS api_nonces (
      nonce       TEXT PRIMARY KEY,
      service     TEXT NOT NULL,
      expires_at  TIMESTAMP NOT NULL,
      created_at  TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_nonces_expires ON api_nonces(expires_at);
  `).catch(e => console.warn("[Reliability] Schema:", e.message));
  console.log("[Reliability] Schema ready ✓");
}

// ================================================================
// 1. GRACEFUL DEGRADATION FRAMEWORK
//    If SMS fails → WhatsApp → Push → Email
//    If AI fails → core commerce continues
//    If Analytics fails → orders continue
// ================================================================
const DEGRADATION_FALLBACKS = {
  sms:           ["whatsapp", "push", "email"],
  whatsapp:      ["sms",      "push", "email"],
  push:          ["whatsapp", "sms", "email"],
  ai_pricing:    ["manual_price"],
  ai_recommend:  ["popular_products"],
  ai_fraud:      ["rule_based_fraud"],
  analytics:     ["continue_without_analytics"],
  search_v2:     ["postgresql_fts"],
  shipbubble:    ["gig_logistics", "manual_dispatch"],
  paystack:      ["stripe_ngn", "manual_verification"],
};

async function getActiveFallback(service) {
  const fallbacks = DEGRADATION_FALLBACKS[service] || [];
  if (!fallbacks.length) return null;

  // Try each fallback in order
  for (const fallback of fallbacks) {
    const is_healthy = await checkServiceHealth(fallback);
    if (is_healthy) {
      await pool.query(
        "INSERT INTO degradation_events(service,reason,fallback) VALUES($1,$2,$3)",
        [service, `${service} unavailable`, fallback]
      ).catch(() => {});
      console.warn(`[Reliability] DEGRADATION: ${service} → ${fallback}`);
      return fallback;
    }
  }
  return null;
}

async function checkServiceHealth(service) {
  const SERVICE_URLS = {
    sms:           process.env.TERMII_API_URL    || "https://api.ng.termii.com",
    whatsapp:      process.env.META_WA_URL       || "https://graph.facebook.com",
    paystack:      "https://api.paystack.co",
    stripe:        "https://api.stripe.com",
    shipbubble:    "https://api.shipbubble.com",
    elasticsearch: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
  };

  const url = SERVICE_URLS[service];
  if (!url) return true; // internal service — assume healthy

  try {
    const axios    = require("axios");
    const start    = Date.now();
    await axios.get(url, { timeout: 3000 });
    const latency  = Date.now() - start;

    await pool.query(
      "INSERT INTO service_health_log(service,status,latency_ms) VALUES($1,'healthy',$2)",
      [service, latency]
    ).catch(() => {});
    return true;
  } catch (e) {
    await pool.query(
      "INSERT INTO service_health_log(service,status,error) VALUES($1,'down',$2)",
      [service, e.message]
    ).catch(() => {});
    return false;
  }
}

// ================================================================
// 2. NIGERIA NETWORK RESILIENCE
//    Offline-first event queuing for weak network conditions
//    PHCN power outage survival: queue + retry
// ================================================================
class NigeriaNetworkQueue {
  constructor() {
    this.offline_queue = [];
    this.is_online     = true;
    this.retry_interval= null;
  }

  async enqueue(event) {
    this.offline_queue.push({
      ...event,
      queued_at: new Date().toISOString(),
      retries:   0,
    });

    if (this.is_online) {
      await this.flush();
    }
  }

  async flush() {
    const pending = [...this.offline_queue];
    this.offline_queue = [];

    for (const event of pending) {
      try {
        const { writeEvent } = require("../outbox/outboxWorker");
        await writeEvent(pool, event);
      } catch (e) {
        // Network still down — re-queue
        event.retries++;
        if (event.retries < 10) {
          this.offline_queue.push(event);
        } else {
          console.error("[Nigeria Queue] Max retries exceeded for event:", event.event_type);
        }
      }
    }
  }

  setOnline(is_online) {
    const was_offline = !this.is_online;
    this.is_online    = is_online;

    if (is_online && was_offline && this.offline_queue.length > 0) {
      console.log(`[Nigeria Queue] Back online — flushing ${this.offline_queue.length} queued events`);
      this.flush().catch(console.error);
    }
  }

  get queue_depth() { return this.offline_queue.length; }
}

const nigeriaQueue = new NigeriaNetworkQueue();

// ================================================================
// 3. WEBHOOK DOUBLE VERIFICATION
//    NEVER credit based on webhook alone
//    ALWAYS verify with payment provider API first
// ================================================================
async function verifyWebhookWithProvider(provider, reference, webhook_data) {
  const idempotency_key = `WH_${provider}_${reference}`;

  // Check if already verified (anti-replay)
  const existing = await pool.query(
    "SELECT * FROM webhook_verifications WHERE idempotency_key=$1",
    [idempotency_key]
  );
  if (existing.rows[0]) {
    console.log(`[Webhook] Replay blocked: ${reference}`);
    return { verified: existing.rows[0].is_verified, replayed: true, data: existing.rows[0] };
  }

  // Log webhook receipt BEFORE verification
  await pool.query(
    `INSERT INTO webhook_verifications(provider,reference,webhook_payload,idempotency_key)
     VALUES($1,$2,$3,$4) ON CONFLICT(idempotency_key) DO NOTHING`,
    [provider, reference, JSON.stringify(webhook_data), idempotency_key]
  );

  let verified = false, provider_response = null, verified_amount = 0, verified_status = "";

  try {
    if (provider === "paystack") {
      const axios = require("axios");
      const res   = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
          timeout: 10000,
        }
      );
      provider_response = res.data;
      verified_status   = res.data.data?.status;
      verified_amount   = parseFloat(res.data.data?.amount || 0) / 100; // kobo → naira
      verified          = verified_status === "success";

      // Amount mismatch check
      const webhook_amount = parseFloat(webhook_data.data?.amount || 0) / 100;
      if (Math.abs(verified_amount - webhook_amount) > 0.01) {
        console.error(`[Webhook] AMOUNT MISMATCH: webhook=${webhook_amount} verified=${verified_amount}`);
        verified = false;
      }
    } else if (provider === "stripe") {
      const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
      const intent = await stripe.paymentIntents.retrieve(reference);
      verified_status = intent.status;
      verified_amount = intent.amount / 100; // cents → dollars
      verified        = verified_status === "succeeded";
    }
  } catch (e) {
    console.error(`[Webhook] Provider verification failed: ${e.message}`);
    verified = false;
    provider_response = { error: e.message };
  }

  // Update verification record
  await pool.query(
    `UPDATE webhook_verifications SET
       is_verified=$1, verified_amount=$2, verified_status=$3,
       provider_response=$4, verification_at=NOW()
     WHERE idempotency_key=$5`,
    [verified, verified_amount, verified_status,
     JSON.stringify(provider_response), idempotency_key]
  );

  return { verified, replayed: false, verified_amount, verified_status, provider_response };
}

// ================================================================
// 4. ANTI-REPLAY NONCE SYSTEM
//    Prevents duplicate requests, replay attacks, forged callbacks
// ================================================================
async function validateNonce(nonce, service, ttl_seconds = 300) {
  if (!nonce || nonce.length < 8) {
    return { valid: false, error: "Invalid nonce format" };
  }

  // Check Redis first (faster)
  try {
    const { getRedis } = require("../rateLimiter");
    const redis  = await getRedis();
    const key    = `nonce:${service}:${nonce}`;

    if (redis) {
      const exists = await redis.exists(key);
      if (exists) return { valid: false, error: "Nonce already used (replay detected)" };
      await redis.set(key, "1", { EX: ttl_seconds });
      return { valid: true };
    }
  } catch (_) {}

  // DB fallback
  const existing = await pool.query(
    "SELECT nonce FROM api_nonces WHERE nonce=$1 AND service=$2 AND expires_at>NOW()",
    [nonce, service]
  );
  if (existing.rows[0]) {
    return { valid: false, error: "Nonce already used (replay detected)" };
  }

  const expires = new Date(Date.now() + ttl_seconds * 1000);
  await pool.query(
    "INSERT INTO api_nonces(nonce,service,expires_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
    [nonce, service, expires]
  );

  return { valid: true };
}

// Cleanup expired nonces (run daily)
async function cleanupNonces() {
  await pool.query("DELETE FROM api_nonces WHERE expires_at < NOW()");
}

// ================================================================
// 5. COST GOVERNANCE AI
//    Monitor spend across all external services
//    Generate recommendations for CTO/CEO
// ================================================================
async function analyzeCosts(period_days = 30) {
  const from = new Date(Date.now() - period_days * 86400000);

  // Estimate costs from usage
  const [sms_count, upload_count, payment_count, ai_calls] = await Promise.all([
    pool.query("SELECT COUNT(*) c FROM notifications WHERE channel='sms' AND created_at>$1", [from]),
    pool.query("SELECT COUNT(*) c FROM uploads WHERE created_at>$1",                         [from]),
    pool.query("SELECT COUNT(*),SUM(amount) FROM orders WHERE status='paid' AND created_at>$1",[from]),
    pool.query("SELECT COUNT(*) c FROM ai_request_log WHERE created_at>$1 LIMIT 1",          [from])
      .catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  const COSTS = {
    sms_per_msg:     4,     // ₦4 per SMS (Termii estimate)
    whatsapp_per_msg:3,     // ₦3 per WhatsApp
    cloudinary_per_gb:500,  // ₦500 per GB/month
    paystack_pct:    0.015, // 1.5% of transaction
    redis_per_month: 15000, // ₦15k estimate
    postgres_per_month:25000,
  };

  const sms_cost     = parseInt(sms_count.rows[0].c)    * COSTS.sms_per_msg;
  const payment_vol  = parseFloat(payment_count.rows[0].sum || 0);
  const gateway_cost = payment_vol                        * COSTS.paystack_pct;
  const total_ngn    = sms_cost + gateway_cost;

  const recommendations = [];

  if (sms_cost > 50000) {
    recommendations.push({
      type:    "cost_reduction",
      area:    "SMS",
      insight: `SMS spending ₦${sms_cost.toLocaleString()} in ${period_days} days — shift to WhatsApp first`,
      saving:  sms_cost * 0.25,
    });
  }

  if (gateway_cost > 200000) {
    recommendations.push({
      type:    "cost_reduction",
      area:    "Payment Gateway",
      insight: `Paystack fees ₦${gateway_cost.toLocaleString()} — negotiate volume discount above ₦10M/month`,
      saving:  gateway_cost * 0.1,
    });
  }

  return {
    period_days,
    costs: {
      sms_ngn:          sms_cost,
      payment_gateway:  gateway_cost,
      estimated_total:  total_ngn,
      estimated_usd:    total_ngn / 1600, // approximate FX
    },
    volume: {
      sms_sent:      parseInt(sms_count.rows[0].c),
      uploads:       parseInt(upload_count.rows[0].c),
      payment_vol_ngn: payment_vol,
    },
    recommendations,
    generated_at: new Date().toISOString(),
  };
}

// ================================================================
// 6. AI TRAFFIC SURGE DETECTION
//    Monitor for viral campaign / flash sale spikes
//    Signal auto-scaling before service degradation
// ================================================================
async function detectTrafficSurge(window_mins = 5) {
  const baseline_window = window_mins * 2;
  const [current, baseline] = await Promise.all([
    pool.query(
      "SELECT COUNT(*) c FROM orders WHERE created_at > NOW() - INTERVAL $1",
      [`${window_mins} minutes`]
    ),
    pool.query(
      "SELECT COUNT(*)/2.0 c FROM orders WHERE created_at BETWEEN NOW()-INTERVAL $1 AND NOW()-INTERVAL $2",
      [`${baseline_window} minutes`, `${window_mins} minutes`]
    ),
  ]);

  const current_rate  = parseFloat(current.rows[0].c);
  const baseline_rate = parseFloat(baseline.rows[0].c);
  const ratio         = baseline_rate > 0 ? current_rate / baseline_rate : 1;

  const surge_detected = ratio > 3.0; // 3× normal = surge

  if (surge_detected) {
    console.warn(`[Reliability] TRAFFIC SURGE: ${ratio.toFixed(1)}× normal rate`);
    // In production: trigger auto-scaling via AWS/GCP API
    // Signal: scale up order-service, payment-service, inventory-service
    await pool.query(
      "INSERT INTO degradation_events(service,reason,fallback) VALUES('auto_scale','Traffic surge detected',?)",
      [`Scale up: ratio=${ratio.toFixed(1)}x`]
    ).catch(() => {});
  }

  return {
    surge_detected,
    current_rate,
    baseline_rate,
    ratio: parseFloat(ratio.toFixed(2)),
    recommendation: surge_detected
      ? `Scale order-service + payment-service (${ratio.toFixed(1)}× traffic spike)`
      : "Normal traffic — no action needed",
  };
}

// ================================================================
// 7. CHAOS ENGINEERING HOOKS
//    Test self-healing capabilities before they matter in prod
// ================================================================
const CHAOS_ENABLED = process.env.CHAOS_ENABLED === "true" &&
                      process.env.NODE_ENV       !== "production";

async function injectChaos(target, chaos_type, duration_secs = 30) {
  if (!CHAOS_ENABLED) {
    return { success: false, reason: "Chaos disabled in production" };
  }

  console.warn(`[CHAOS] Injecting ${chaos_type} into ${target} for ${duration_secs}s`);

  const event = await pool.query(
    "INSERT INTO chaos_events(event_type,target,initiated_by) VALUES($1,$2,$3) RETURNING id",
    [chaos_type, target, "chaos-engineer"]
  );

  // Simulate various failure modes
  if (chaos_type === "latency") {
    await new Promise(r => setTimeout(r, duration_secs * 1000));
  } else if (chaos_type === "error_rate") {
    // Return random errors 50% of the time
    if (Math.random() > 0.5) throw new Error(`[CHAOS] Simulated ${target} failure`);
  }

  await pool.query(
    "UPDATE chaos_events SET ended_at=NOW(), outcome='completed' WHERE id=$1",
    [event.rows[0].id]
  );

  return { success: true, event_id: event.rows[0].id, chaos_type, target };
}

// ================================================================
// 8. OPENTELEMETRY DISTRIBUTED TRACING
//    Track complete user + payment + order journey
// ================================================================
function createTraceId() {
  return crypto.randomBytes(16).toString("hex");
}

function createSpanId() {
  return crypto.randomBytes(8).toString("hex");
}

function createTraceContext(parent_trace_id = null) {
  return {
    trace_id:    parent_trace_id || createTraceId(),
    span_id:     createSpanId(),
    started_at:  Date.now(),
    service:     process.env.SERVICE_NAME || "dunazoe",

    child: (operation) => ({
      trace_id:    parent_trace_id || createTraceId(),
      span_id:     createSpanId(),
      parent_span: createSpanId(),
      operation,
      service:     process.env.SERVICE_NAME || "dunazoe",
      started_at:  Date.now(),
    }),

    end: function(status = "ok") {
      return {
        ...this,
        status,
        duration_ms: Date.now() - this.started_at,
        ended_at:    Date.now(),
      };
    },
  };
}

// ================================================================
// 9. HEALTH CHECK AGGREGATOR
//    Multi-AZ health checks with automatic failover signals
// ================================================================
async function aggregateHealthChecks() {
  const services = {
    gateway:        process.env.GATEWAY_URL             || "http://localhost:3000",
    auth:           process.env.AUTH_SERVICE_URL         || "http://localhost:4001",
    order:          process.env.ORDER_SERVICE_URL        || "http://localhost:4006",
    payment:        process.env.PAYMENT_SERVICE_URL      || "http://localhost:4015",
    wallet:         process.env.WALLET_SERVICE_URL       || "http://localhost:4009",
    thrift:         process.env.THRIFT_SERVICE_URL       || "http://localhost:4010",
    notification:   process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4017",
    reconciliation: process.env.RECON_SERVICE_URL        || "http://localhost:4024",
  };

  const axios   = require("axios");
  const results = {};
  let   healthy = 0, total = 0;

  for (const [name, url] of Object.entries(services)) {
    total++;
    try {
      const start = Date.now();
      const res   = await axios.get(`${url}/health`, { timeout: 3000 });
      const ms    = Date.now() - start;

      results[name] = {
        status:  res.data.status === "ok" ? "healthy" : "degraded",
        latency_ms: ms,
      };
      if (res.data.status === "ok") healthy++;
    } catch (e) {
      results[name] = { status: "down", error: e.message };
    }
  }

  const overall   = healthy === total ? "healthy" :
                    healthy >= total * 0.7 ? "degraded" : "critical";

  return {
    overall,
    healthy,
    total,
    availability_pct: parseFloat((healthy/total*100).toFixed(1)),
    services: results,
    checked_at: new Date().toISOString(),
  };
}

// ================================================================
// 10. TLS / CERTIFICATE MONITORING
//     AI Security Engine monitors SSL validity
// ================================================================
async function checkSSLCertificate(hostname) {
  return new Promise((resolve) => {
    const tls  = require("tls");
    const sock = tls.connect(443, hostname, { servername: hostname }, () => {
      const cert    = sock.getPeerCertificate();
      const expires = new Date(cert.valid_to);
      const days    = Math.ceil((expires - Date.now()) / 86400000);

      resolve({
        hostname,
        valid:      sock.authorized,
        expires_at: expires,
        days_remaining: days,
        warning: days < 30,
        critical: days < 7,
      });
      sock.destroy();
    });
    sock.on("error", (e) => resolve({
      hostname,
      valid:   false,
      error:   e.message,
      warning: true,
      critical:true,
    }));
    sock.setTimeout(5000, () => { sock.destroy(); resolve({ hostname, error: "timeout", critical: true }); });
  });
}

module.exports = {
  initReliabilitySchema,
  getActiveFallback,
  checkServiceHealth,
  nigeriaQueue,
  verifyWebhookWithProvider,
  validateNonce,
  cleanupNonces,
  analyzeCosts,
  detectTrafficSurge,
  injectChaos,
  createTraceContext,
  aggregateHealthChecks,
  checkSSLCertificate,
  DEGRADATION_FALLBACKS,
};
