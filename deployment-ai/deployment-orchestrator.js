#!/usr/bin/env node
  // DUNAZOE deployment-ai/deployment-orchestrator.js
  // Orchestrates the full deployment pipeline with approval gates.
  // Usage: node deployment-orchestrator.js --env staging|production
  "use strict";
  const { execSync } = require("child_process");
  const ENV = process.argv[2] === "--env" ? process.argv[3] : "staging";

  function run(cmd) {
    try { return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim() }; }
    catch (e) { return { ok: false, out: e.message }; }
  }

  async function healthCheck(url) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return r.ok;
    } catch { return false; }
  }

  const REQUIRED_SECRETS = [
    "DATABASE_URL","JWT_SECRET","PAYSTACK_SECRET_KEY",
    "STRIPE_SECRET_KEY","ALLOWED_ORIGINS","NODE_ENV"
  ];

  async function main() {
    const line = "=".repeat(60);
    console.log(line);
    console.log("DUNAZOE DEPLOYMENT ORCHESTRATOR — " + ENV.toUpperCase());
    console.log(new Date().toISOString());
    console.log(line);

    let gates = 0, passed = 0;

    // Gate 1: Secrets
    gates++;
    const missing = REQUIRED_SECRETS.filter(k => !process.env[k]);
    if (missing.length === 0) { console.log("[GATE 1] Secrets: PASS"); passed++; }
    else { console.log("[GATE 1] Secrets: FAIL — missing: " + missing.join(", ")); }

    // Gate 2: Gateway health
    gates++;
    const gw = await healthCheck("http://localhost:3000/health");
    if (gw) { console.log("[GATE 2] Gateway: PASS"); passed++; }
    else { console.log("[GATE 2] Gateway: FAIL — not responding"); }

    // Gate 3: Database connection
    gates++;
    if (process.env.DATABASE_URL) { console.log("[GATE 3] Database URL: PASS"); passed++; }
    else { console.log("[GATE 3] Database URL: FAIL"); }

    // Gate 4: NODE_ENV
    gates++;
    if (process.env.NODE_ENV === "production") { console.log("[GATE 4] NODE_ENV=production: PASS"); passed++; }
    else { console.log("[GATE 4] NODE_ENV=production: FAIL — currently: " + (process.env.NODE_ENV || "unset")); }

    console.log(line);
    console.log("Result: " + passed + "/" + gates + " gates passed");

    if (passed === gates) {
      console.log("APPROVED FOR DEPLOYMENT TO " + ENV.toUpperCase());
      console.log("Run: node deployment-ai/release-manager.js --env " + ENV);
    } else {
      console.log("DEPLOYMENT BLOCKED — Fix failing gates before proceeding");
      process.exit(1);
    }
  }

  main().catch(console.error);
  