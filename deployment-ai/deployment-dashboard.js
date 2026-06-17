#!/usr/bin/env node
  // DUNAZOE deployment-ai/deployment-dashboard.js
  // CLI dashboard showing real-time deployment status.
  // Usage: node deployment-dashboard.js [--watch] [--interval 30]
  "use strict";

  const WATCH    = process.argv.includes("--watch");
  const iIdx     = process.argv.indexOf("--interval");
  const INTERVAL = (iIdx >= 0 ? parseInt(process.argv[iIdx + 1]) : 30) * 1000;

  const SERVICES = [
    { name: "Gateway",       url: "http://localhost:3000/health" },
    { name: "Auth",          url: "http://localhost:4001/health" },
    { name: "Payments",      url: "http://localhost:4006/health" },
    { name: "Wallet",        url: "http://localhost:4009/health" },
    { name: "Orders",        url: "http://localhost:4005/health" },
    { name: "Deploy AI",     url: "http://localhost:4027/health" },
    { name: "Reliability",   url: "http://localhost:4025/health" },
    { name: "Feature Flags", url: "http://localhost:4028/health" },
    { name: "Notifications", url: "http://localhost:4010/health" },
    { name: "Realtime",      url: "http://localhost:4020/health" },
  ];

  async function check(svc) {
    try {
      const start = Date.now();
      const r = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
      return { name: svc.name, ok: r.ok, ms: Date.now() - start };
    } catch {
      return { name: svc.name, ok: false, ms: -1 };
    }
  }

  async function render() {
    const results = await Promise.all(SERVICES.map(check));
    const up      = results.filter(r => r.ok).length;
    const ts      = new Date().toISOString().slice(0, 19) + " UTC";

    if (WATCH) process.stdout.write("\x1Bc");

    const border = "+------------------------------------------+";
    console.log(border);
    console.log("| DUNAZOE DEPLOYMENT DASHBOARD             |");
    console.log("| " + ts + "      |");
    console.log("| Services: " + up + "/" + results.length + " UP" + " ".repeat(28) + "|");
    console.log(border);

    results.forEach(r => {
      const icon = r.ok ? "[UP]  " : "[DOWN]";
      const ms   = r.ms > 0 ? r.ms + "ms" : "TIMEOUT";
      const line = "| " + icon + " " + r.name.padEnd(16) + ms.padStart(8) + "          |";
      console.log(line);
    });

    console.log(border);

    let verdict;
    if (up === results.length)           verdict = "ALL SYSTEMS GO";
    else if (up >= results.length * 0.8) verdict = "DEGRADED";
    else                                  verdict = "CRITICAL";
    console.log("| " + verdict.padEnd(40) + " |");
    console.log(border + "\n");
  }

  (async () => {
    await render();
    if (WATCH) {
      console.log("Refreshing every " + (INTERVAL / 1000) + "s (Ctrl+C to stop)...");
      setInterval(render, INTERVAL);
    }
  })();
  