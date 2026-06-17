#!/usr/bin/env node
  // DUNAZOE deployment-ai/rollback-engine.js
  // Executes rollback to a previous stable version.
  // Usage: node rollback-engine.js --to <tag|commit> --reason "reason"
  // Stable checkpoint: a20abd7c
  "use strict";
  const { execSync } = require("child_process");

  const args   = process.argv.slice(2);
  const toIdx  = args.indexOf("--to");
  const whyIdx = args.indexOf("--reason");
  const TARGET = toIdx >= 0 ? args[toIdx + 1] : null;
  const REASON = whyIdx >= 0 ? args[whyIdx + 1] : "Manual rollback";

  if (!TARGET) {
    console.error("Usage: node rollback-engine.js --to <tag|commit> [--reason 'reason']");
    console.error("Stable checkpoints:");
    console.error("  a20abd7c — Add live deployment monitoring page");
    console.error("  f5ad07c  — ci: wire CI/CD to live Deployment AI dashboard");
    process.exit(1);
  }

  function run(cmd) {
    try { return { ok: true, out: execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim() }; }
    catch (e) { return { ok: false, out: e.message }; }
  }

  const line = "=".repeat(50);
  console.log("DUNAZOE ROLLBACK ENGINE");
  console.log(line);
  console.log("Target: " + TARGET);
  console.log("Reason: " + REASON);
  console.log("Time:   " + new Date().toISOString());
  console.log("\nWARNING: This will roll back to " + TARGET);
  console.log("Abort with Ctrl+C within 5 seconds...");

  setTimeout(() => {
    const verify = run("git cat-file -e " + TARGET + "^{commit}");
    if (!verify.ok) { console.error("Target " + TARGET + " not found"); process.exit(1); }

    const current = run("git rev-parse --short HEAD").out;
    run("git tag rollback-checkpoint-" + current + "-" + Date.now());
    console.log("\n[1/3] Checkpoint saved from: " + current);

    console.log("[2/3] Switching to: " + TARGET);
    const co = run("git checkout " + TARGET);
    console.log(co.ok ? "      Checkout OK" : "      ERROR: " + co.out);

    console.log("[3/3] Restart required:");
    console.log("      Replit: Restart the gateway workflow");
    console.log("      Manual: kill gateway process, restart node apps/core/gateway/index.js");

    console.log("\nROLLBACK COMPLETE");
    console.log("From: " + current + " -> To: " + TARGET);
    console.log("Reason: " + REASON);
  }, 5000);
  