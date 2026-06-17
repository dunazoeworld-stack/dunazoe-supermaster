#!/usr/bin/env node
  // DUNAZOE deployment-ai/deployment-validator.js
  // Validates all pre-deployment conditions.
  // Usage: node deployment-validator.js
  "use strict";

  const checks = [
    { name: "NODE_ENV = production",    fn: () => process.env.NODE_ENV === "production" },
    { name: "JWT_SECRET set (32+ chars)", fn: () => !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32 },
    { name: "DATABASE_URL set",         fn: () => !!process.env.DATABASE_URL },
    { name: "PAYSTACK_SECRET_KEY set",  fn: () => !!process.env.PAYSTACK_SECRET_KEY },
    { name: "STRIPE_SECRET_KEY set",    fn: () => !!process.env.STRIPE_SECRET_KEY },
    { name: "ALLOWED_ORIGINS set",      fn: () => !!process.env.ALLOWED_ORIGINS },
    { name: "REDIS_URL set",            fn: () => !!process.env.REDIS_URL },
    { name: "INTERNAL_SECRET set",      fn: () => !!process.env.INTERNAL_SECRET },
    { name: "CLOUDINARY_CLOUD_NAME set",fn: () => !!process.env.CLOUDINARY_CLOUD_NAME },
    { name: "TERMII_API_KEY set",       fn: () => !!process.env.TERMII_API_KEY },
  ];

  let pass = 0, fail = 0;
  console.log("DUNAZOE DEPLOYMENT VALIDATOR");
  console.log("=".repeat(40));

  checks.forEach(({ name, fn }) => {
    try {
      const ok = fn();
      console.log((ok ? "[PASS]" : "[FAIL]") + " " + name);
      ok ? pass++ : fail++;
    } catch (e) {
      console.log("[FAIL] " + name + " — " + e.message);
      fail++;
    }
  });

  console.log("=".repeat(40));
  console.log("Result: " + pass + "/" + checks.length + " passed");
  if (fail > 0) {
    console.log("VALIDATION FAILED — set missing secrets before deploying");
    process.exit(1);
  } else {
    console.log("ALL CHECKS PASSED — ready to deploy");
  }
  