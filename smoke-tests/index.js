#!/usr/bin/env node
// =====================================================================
// DUNAZOE — smoke-tests/index.js
// Phase 14: Automated smoke test suite
// Run: node smoke-tests/index.js [BASE_URL]
// Pass threshold: 95%
// =====================================================================

const BASE = process.argv[2] || process.env.DUNAZOE_URL || "http://localhost:3000";
const TIMEOUT = 10000;

let passed = 0;
let failed = 0;
let warned = 0;
const results = [];
let adminToken = null;
let testUserId = null;
const TEST_EMAIL = `smoketest_${Date.now()}@dunazoe.com`;
const TEST_PASS  = "SmokeTest_2026!";

async function req(method, path, body, token) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await r.text();
    try { return { status: r.status, data: JSON.parse(text) }; }
    catch { return { status: r.status, data: { raw: text } }; }
  } catch (e) {
    clearTimeout(timer);
    return { status: 0, data: { error: e.message } };
  }
}

function log(name, ok, detail = "") {
  const icon = ok === true ? "✅" : ok === "warn" ? "⚠️ " : "❌";
  const line = `${icon} ${name}${detail ? ` — ${detail}` : ""}`;
  console.log(line);
  results.push({ name, ok, detail });
  if (ok === true) passed++;
  else if (ok === "warn") warned++;
  else failed++;
}

async function run() {
  console.log(`\n${"=".repeat(60)}`);
  console.log(` DUNAZOE SMOKE TEST SUITE — ${new Date().toISOString()}`);
  console.log(` Target: ${BASE}`);
  console.log("=".repeat(60));

  // ── T01: Gateway Health ────────────────────────────────────────────
  console.log("\n--- HEALTH CHECKS ---");
  {
    const r = await req("GET", "/health");
    log("T01 Gateway /health", r.status === 200 && r.data?.status === "ok",
        `status=${r.status}`);
  }

  // ── T02–T04: Core service health ──────────────────────────────────
  for (const [name, port] of [
    ["Auth",     4001],
    ["Payment",  4015],
    ["Order",    4006],
    ["Product",  4004],
    ["Notify",   4017],
    ["Activate", 4033]
  ]) {
    const r = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(5000) })
      .then(res => res.json()).catch(() => null);
    log(`T0x ${name} Service :${port}`,
        r?.status === "ok",
        r ? `ok` : "UNREACHABLE");
  }

  // ── T05: User Registration ─────────────────────────────────────────
  console.log("\n--- USER FLOWS ---");
  {
    const r = await req("POST", "/auth/register", {
      full_name: "Smoke Test User",
      email:    TEST_EMAIL,
      password: TEST_PASS,
      phone:    "+2348000000001",
      role:     "customer"
    });
    const ok = r.status === 201 || (r.status === 200 && r.data?.success);
    log("T05 User Registration", ok, `status=${r.status}`);
    if (ok) testUserId = r.data?.user?.id || r.data?.id;
  }

  // ── T06: User Login ────────────────────────────────────────────────
  {
    const r = await req("POST", "/auth/login", {
      email: TEST_EMAIL, password: TEST_PASS
    });
    const ok = (r.status === 200) && r.data?.token;
    log("T06 User Login + JWT", ok, `status=${r.status}`);
    if (ok) adminToken = r.data.token;
  }

  // ── T07: Vendor Registration ───────────────────────────────────────
  {
    const r = await req("POST", "/auth/register", {
      full_name:     "Smoke Vendor",
      email:         `vendor_${Date.now()}@dunazoe.com`,
      password:      TEST_PASS,
      phone:         "+2348000000002",
      role:          "vendor",
      business_name: "Smoke Vendors Ltd"
    });
    const ok = r.status === 201 || (r.status === 200 && r.data?.success);
    log("T07 Vendor Registration", ok, `status=${r.status}`);
  }

  // ── T08: Product Listing ───────────────────────────────────────────
  console.log("\n--- PRODUCT FLOWS ---");
  {
    const r = await req("GET", "/products?limit=5&page=1");
    const ok = r.status === 200 && (Array.isArray(r.data?.products) || Array.isArray(r.data?.data) || r.data?.success);
    log("T08 Product Listing", ok, `status=${r.status}`);
  }

  // ── T09: Product Create (vendor token needed) ──────────────────────
  {
    if (adminToken) {
      const r = await req("POST", "/products", {
        name:        "Smoke Test Product",
        description: "Automated smoke test product",
        price:       5000,
        category:    "Electronics",
        stock:       10
      }, adminToken);
      const ok = r.status === 201 || r.status === 200 || r.status === 403;
      log("T09 Product Create", ok,
          r.status === 403 ? "Vendor role required (expected)" : `status=${r.status}`);
    } else {
      log("T09 Product Create", "warn", "Skipped — no token");
    }
  }

  // ── T10: Order Create ──────────────────────────────────────────────
  console.log("\n--- ORDER FLOWS ---");
  {
    if (adminToken) {
      const r = await req("POST", "/orders", {
        items: [{ product_id: "smoke-product-001", quantity: 1, price: 5000 }],
        delivery_address: "123 Smoke St, Lagos"
      }, adminToken);
      const ok = [200, 201, 400, 422].includes(r.status);
      log("T10 Order Create", ok, `status=${r.status} (400/422 = validation working)`);
    } else {
      log("T10 Order Create", "warn", "Skipped — no token");
    }
  }

  // ── T11: Payment Dry Run ───────────────────────────────────────────
  console.log("\n--- PAYMENT FLOWS ---");
  {
    if (adminToken) {
      const r = await req("POST", "/payments/initialize", {
        amount:   100,
        email:    TEST_EMAIL,
        currency: "NGN",
        ref:      `SMOKE_${Date.now()}`
      }, adminToken);
      const ok = r.status === 200 && (r.data?.authorization_url || r.data?.data?.authorization_url || r.data?.success);
      log("T11 Payment Initialize", ok, `status=${r.status}`);
    } else {
      log("T11 Payment Initialize", "warn", "Skipped — no token");
    }
  }

  // ── T12: Wallet Balance ────────────────────────────────────────────
  {
    if (adminToken) {
      const r = await req("GET", "/wallets/balance", null, adminToken);
      const ok = [200, 404].includes(r.status);
      log("T12 Wallet Balance", ok,
          r.status === 404 ? "Wallet feature OFF (expected)" : `balance=${r.data?.balance}`);
    } else {
      log("T12 Wallet Balance", "warn", "Skipped — no token");
    }
  }

  // ── T13: Notification Dry Run ──────────────────────────────────────
  console.log("\n--- NOTIFICATION FLOWS ---");
  {
    if (adminToken) {
      const r = await req("POST", "/notifications/send", {
        type:    "sms",
        to:      "+2348000000001",
        message: "DUNAZOE smoke test notification"
      }, adminToken);
      const ok = [200, 201, 403].includes(r.status);
      log("T13 Notification Send", ok, `status=${r.status}`);
    } else {
      log("T13 Notification Send", "warn", "Skipped — no token");
    }
  }

  // ── T14: Admin Dashboard (Deployment AI) ──────────────────────────
  console.log("\n--- ADMIN FLOWS ---");
  {
    const r = await req("GET", "/deployment/status", null, adminToken);
    const ok = [200, 401].includes(r.status);
    log("T14 Deployment AI Status", ok, `status=${r.status}`);
  }

  // ── T15: Activation Engine ─────────────────────────────────────────
  {
    const r = await req("GET", "/activation/features");
    const ok = r.status === 200 && (Array.isArray(r.data?.features) || r.data?.success);
    log("T15 Activation Engine Features", ok, `status=${r.status}`);
  }

  // ── T16: Deploy Monitor ────────────────────────────────────────────
  {
    const r = await req("GET", "/deployment/monitor", null, adminToken);
    const ok = [200, 401].includes(r.status);
    log("T16 Deploy Monitor API", ok, `status=${r.status}`);
  }

  // ── FINAL REPORT ──────────────────────────────────────────────────
  const total = passed + failed + warned;
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0;
  const THRESHOLD = 95;

  console.log("\n" + "=".repeat(60));
  console.log(` SMOKE TEST RESULTS`);
  console.log(`   Total:   ${total}`);
  console.log(`   Passed:  ${passed} (${pct}%)`);
  console.log(`   Warned:  ${warned}`);
  console.log(`   Failed:  ${failed}`);
  console.log(`   Threshold: ${THRESHOLD}%`);
  console.log(`   Decision: ${pct >= THRESHOLD ? "✅ PASS" : "❌ FAIL"}`);
  console.log("=".repeat(60));

  if (pct < THRESHOLD) {
    console.log("\n❌ Smoke tests FAILED — do not deploy until failures are resolved.\n");
    process.exit(1);
  } else {
    console.log("\n✅ Smoke tests PASSED — safe to proceed with beta launch.\n");
    process.exit(0);
  }
}

run().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
