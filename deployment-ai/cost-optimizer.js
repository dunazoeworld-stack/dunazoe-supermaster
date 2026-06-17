#!/usr/bin/env node
  // DUNAZOE deployment-ai/cost-optimizer.js
  // Analyzes and optimizes Replit credit usage.
  // Usage: node cost-optimizer.js [--report|--optimize]
  "use strict";

  const MODE = process.argv[2] || "--report";

  const SERVICES = [
    { name: "gateway",           port: 3000, critical: true,  cph: 0.5,  disabled: false },
    { name: "auth-service",      port: 4001, critical: true,  cph: 0.3,  disabled: false },
    { name: "user-service",      port: 4002, critical: true,  cph: 0.2,  disabled: false },
    { name: "product-service",   port: 4003, critical: true,  cph: 0.2,  disabled: false },
    { name: "order-service",     port: 4005, critical: true,  cph: 0.3,  disabled: false },
    { name: "payment-service",   port: 4006, critical: true,  cph: 0.4,  disabled: false },
    { name: "wallet-service",    port: 4009, critical: true,  cph: 0.3,  disabled: false },
    { name: "notification-svc",  port: 4010, critical: false, cph: 0.2,  disabled: false },
    { name: "feature-flags",     port: 4028, critical: true,  cph: 0.1,  disabled: false },
    { name: "deployment-ai",     port: 4027, critical: false, cph: 0.3,  disabled: false },
    { name: "reliability-svc",   port: 4025, critical: false, cph: 0.2,  disabled: false },
    { name: "thrift-service",    port: 4035, critical: false, cph: 0.0,  disabled: true  },
    { name: "loan-service",      port: 4036, critical: false, cph: 0.0,  disabled: true  },
  ];

  const line = "=".repeat(60);
  console.log("DUNAZOE CREDIT OPTIMIZER");
  console.log(line);

  const active   = SERVICES.filter(s => !s.disabled);
  const disabled = SERVICES.filter(s => s.disabled);
  const totalCph = active.reduce((a, s) => a + s.cph, 0);

  console.log("Active services:       " + active.length);
  console.log("Disabled (saving):     " + disabled.length + " (" + disabled.map(s => s.name).join(", ") + ")");
  console.log("Credits/hour (est):    " + totalCph.toFixed(2));
  console.log("Credits/day (est):     " + (totalCph * 24).toFixed(2));
  console.log("Credits/30 days (est): " + (totalCph * 24 * 30).toFixed(0));

  if (MODE === "--optimize") {
    console.log("\n" + line);
    console.log("OPTIMIZATION ACTIONS:");
    console.log("  1. Move non-critical services to Contabo (~60% savings)");
    console.log("  2. Enable Redis caching for product/user reads (~20% DB savings)");
    console.log("  3. Use RabbitMQ queues for notifications (async, not inline)");
    console.log("  4. Thrift/loan services: ALREADY DISABLED (saving 0.3 cph)");
    console.log("  5. AI limiter: 30 req/min cap already active");
    console.log("  6. Killswitch cache: 10s TTL reduces feature-flag calls");
    console.log("\nWith all optimizations: ~65% credit reduction estimated");
    console.log("Recommended: Gateway-only on Replit, all services on Contabo");
  }
  