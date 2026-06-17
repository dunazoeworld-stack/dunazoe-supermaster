#!/usr/bin/env node
  // DUNAZOE deployment-ai/release-manager.js
  // Manages release tagging and changelog generation.
  // Usage: node release-manager.js --env staging|production
  "use strict";
  const { execSync } = require("child_process");
  const fs = require("fs");

  const ENV = (process.argv[2] === "--env" ? process.argv[3] : null) || "staging";
  const VERSION = (() => {
    try { return require("../apps/core/package.json").version; }
    catch { return "1.0.0"; }
  })();
  const TAG = "v" + VERSION + "-" + ENV + "-" + Date.now();

  function run(cmd) {
    try { return execSync(cmd, { encoding: "utf8", stdio: "pipe" }).trim(); }
    catch (e) { return "ERROR: " + e.message; }
  }

  const head    = run("git rev-parse --short HEAD");
  const branch  = run("git rev-parse --abbrev-ref HEAD");
  const lastTag = run("git describe --tags --abbrev=0 2>/dev/null") || "none";
  const logCmd  = lastTag === "none" ? "git log --oneline -15" : ("git log " + lastTag + "..HEAD --oneline");
  const changelog = run(logCmd);

  const notes = [
    "# Release " + TAG,
    "Date: " + new Date().toISOString(),
    "Environment: " + ENV,
    "Commit: " + head,
    "Branch: " + branch,
    "",
    "## Changes Since " + lastTag,
    changelog || "No changes since last tag",
    "",
    "## Deploy Checklist",
    "- [ ] Secrets verified (node deployment-ai/deployment-validator.js)",
    "- [ ] Smoke tests pass (node smoke-tests/index.js)",
    "- [ ] Health check green (GET /health)",
    "- [ ] Staging verified before production",
  ].join("\n");

  const outFile = "RELEASE_" + TAG.replace(/[^a-zA-Z0-9._-]/g, "_") + ".md";
  fs.writeFileSync(outFile, notes);

  console.log("DUNAZOE RELEASE MANAGER");
  console.log("=".repeat(50));
  console.log("ENV:     " + ENV);
  console.log("TAG:     " + TAG);
  console.log("HEAD:    " + head);
  console.log("Branch:  " + branch);
  console.log("Written: " + outFile);
  console.log("\nTo tag and push: git tag " + TAG + " && git push origin " + TAG);
  