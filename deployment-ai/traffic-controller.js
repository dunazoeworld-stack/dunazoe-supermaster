#!/usr/bin/env node
  // DUNAZOE deployment-ai/traffic-controller.js
  // Manages blue/green traffic switching for zero-downtime deploys.
  // Usage: node traffic-controller.js --switch blue|green
  //        node traffic-controller.js --verify
  "use strict";

  const args   = process.argv.slice(2);
  const VERIFY = args.includes("--verify");
  const swIdx  = args.indexOf("--switch");
  const TARGET = swIdx >= 0 ? args[swIdx + 1] : null;

  const SLOTS = {
    blue:  { port: 3000, url: "http://localhost:3000", label: "CURRENT PRODUCTION" },
    green: { port: 3010, url: "http://localhost:3010", label: "STAGING / NEW VERSION" },
  };

  async function healthCheck(url) {
    try {
      const r = await fetch(url + "/health", { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      return { ok: r.ok, status: d.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  const line = "=".repeat(50);

  (async () => {
    console.log("DUNAZOE TRAFFIC CONTROLLER");
    console.log(line);

    if (VERIFY) {
      console.log("Checking both slots:");
      for (const [name, slot] of Object.entries(SLOTS)) {
        const h = await healthCheck(slot.url);
        const status = h.ok ? "[HEALTHY]" : "[DOWN]   ";
        console.log("  " + status + " " + name.toUpperCase() + " — " + slot.label + (h.error ? " — " + h.error : ""));
      }
      return;
    }

    if (!TARGET || !SLOTS[TARGET]) {
      console.log("Usage:");
      console.log("  node traffic-controller.js --verify");
      console.log("  node traffic-controller.js --switch blue   (port 3000, production)");
      console.log("  node traffic-controller.js --switch green  (port 3010, staging)");
      return;
    }

    const slot   = SLOTS[TARGET];
    const health = await healthCheck(slot.url);

    if (!health.ok) {
      console.error(TARGET + " slot is not healthy — switch aborted: " + (health.error || ""));
      process.exit(1);
    }

    console.log(TARGET.toUpperCase() + " is healthy");
    console.log("Update your Replit deployment port to: " + slot.port);
    console.log("Or update reverse proxy upstream to: " + slot.url);
    console.log("READY FOR " + TARGET.toUpperCase() + " TRAFFIC");
  })();
  