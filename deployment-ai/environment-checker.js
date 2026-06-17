#!/usr/bin/env node
  // DUNAZOE deployment-ai/environment-checker.js
  // Checks all required environment variables by group.
  // Usage: node environment-checker.js [db|security|payments|all]
  "use strict";

  const GROUP = process.argv[2] || "all";

  const ENV_GROUPS = {
    db:        ["DATABASE_URL", "REDIS_URL"],
    security:  ["JWT_SECRET", "INTERNAL_SECRET", "BCRYPT_ROUNDS", "SESSION_DAYS"],
    payments:  ["PAYSTACK_SECRET_KEY", "PAYSTACK_PUBLIC_KEY", "PAYSTACK_WEBHOOK_SECRET",
                 "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    media:     ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    sms:       ["TERMII_API_KEY", "WHATSAPP_BUSINESS_TOKEN"],
    logistics: ["SHIPBUBBLE_API_KEY"],
    ai:        ["OPENAI_API_KEY"],
    gateway:   ["ALLOWED_ORIGINS", "NODE_ENV", "PORT"],
  };

  const groups = GROUP === "all" ? Object.keys(ENV_GROUPS) : [GROUP];
  let total = 0, missing = 0;

  console.log("DUNAZOE ENVIRONMENT CHECKER");
  console.log("=".repeat(50));

  groups.forEach(g => {
    const vars = ENV_GROUPS[g] || [];
    console.log("\n[" + g.toUpperCase() + "]");
    vars.forEach(v => {
      total++;
      const val = process.env[v];
      if (!val) { console.log("  [MISSING] " + v); missing++; }
      else { console.log("  [SET]     " + v + " = " + val.slice(0, 4) + "****"); }
    });
  });

  console.log("\nSummary: " + (total - missing) + "/" + total + " set, " + missing + " missing");
  if (missing > 0) {
    console.log("See SECRETS_CHECKLIST.md for all required secrets");
    process.exit(1);
  }
  