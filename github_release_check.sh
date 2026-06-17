#!/bin/bash
# =====================================================================
# DUNAZOE — github_release_check.sh
# Phase 12: GitHub release verification
# Run: chmod +x github_release_check.sh && ./github_release_check.sh
# Output: PASS or FAIL with details
# =====================================================================

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVICES_DIR="$ROOT/apps/core/services"
SHARED_DIR="$ROOT/apps/core/shared"
FAIL=0

red()   { echo -e "\033[31m❌ $*\033[0m"; }
green() { echo -e "\033[32m✅ $*\033[0m"; }
warn()  { echo -e "\033[33m⚠️  $*\033[0m"; }
head_()  { echo -e "\033[1;34m\n=== $* ===\033[0m"; }

echo "======================================================"
echo " DUNAZOE GITHUB RELEASE CHECK — v1.0.0-rc1"
echo " $(date)"
echo "======================================================"

# ── CHECK 1: Critical files exist ─────────────────────────────────────
head_ "CRITICAL FILES"

check_file() {
  if [ -f "$1" ]; then
    green "EXISTS: $1"
  else
    red "MISSING: $1"
    FAIL=$((FAIL+1))
  fi
}

check_file "$ROOT/apps/core/docker-compose.yml"
check_file "$ROOT/apps/core/docker-compose.override.yml"
check_file "$ROOT/apps/core/docker-compose.beta.yml"
check_file "$ROOT/apps/core/gateway/index.js"
check_file "$ROOT/apps/core/gateway/Dockerfile"
check_file "$ROOT/apps/core/frontend/src/app/page.jsx"
check_file "$ROOT/apps/core/frontend/src/app/deploy/page.jsx"
check_file "$ROOT/apps/core/frontend/src/app/deploy/monitor/page.jsx"
check_file "$ROOT/apps/core/shared/middleware/auth.js"
check_file "$ROOT/apps/core/shared/middleware/errorHandler.js"
check_file "$ROOT/apps/core/shared/identity/idGenerator.js"
check_file "$ROOT/apps/core/shared/logger.js"
check_file "$ROOT/apps/core/shared/schema.sql"
check_file "$ROOT/GO_NO_GO.md"
check_file "$ROOT/FINAL_LAUNCH_CHECKLIST.md"
check_file "$ROOT/GO_LIVE_RUNBOOK.md"
check_file "$ROOT/HANDOVER_PACKAGE/SYSTEM_MAP.md"
check_file "$ROOT/HANDOVER_PACKAGE/SECRETS_TEMPLATE.md"

# ── CHECK 2: All 33 services have Dockerfile + index.js ───────────────
head_ "SERVICE COMPLETENESS (33 services)"

EXPECTED_SERVICES=(
  activation-engine admin-override-service ai-service auth-service
  commission-service deployment-ai-service dispute-service dunazoe-express
  escrow-service feature-flag-service fraud-service inventory-service
  kyc-service loan-service logistics-service notification-service
  order-service payments-ai-service payment-service product-service
  realtime-service reconciliation-service reliability-service
  search-service security-ai-service self-delivery-service
  social-media-service thrift-service trust-service upload-service
  user-service vendor-service wallet-service
)

for svc in "${EXPECTED_SERVICES[@]}"; do
  dir="$SERVICES_DIR/$svc"
  if [ ! -d "$dir" ]; then
    red "MISSING SERVICE DIR: $svc"
    FAIL=$((FAIL+1))
  elif [ ! -f "$dir/index.js" ]; then
    red "MISSING index.js: $svc"
    FAIL=$((FAIL+1))
  elif [ ! -f "$dir/Dockerfile" ]; then
    red "MISSING Dockerfile: $svc"
    FAIL=$((FAIL+1))
  else
    green "OK: $svc"
  fi
done

# ── CHECK 3: Hardcoded credentials scan ───────────────────────────────
head_ "CREDENTIAL SCAN"

CRED_PATTERNS=(
  "sk_live_"
  "pk_live_"
  "whsec_"
  "AAAA[A-Za-z0-9_-]{60}"
  "password.*=.*['\"][^$][^{]"
)

CRED_FOUND=0
for pattern in "${CRED_PATTERNS[@]}"; do
  matches=$(grep -rn "$pattern" "$ROOT/apps/core" \
    --include="*.js" --include="*.json" \
    --exclude-dir=node_modules \
    --exclude-dir=".git" 2>/dev/null \
    | grep -v "process\.env\|example\|template\|test\|mock\|\.example" || true)
  if [ -n "$matches" ]; then
    red "POTENTIAL CREDENTIAL: pattern=$pattern"
    echo "$matches" | head -3
    CRED_FOUND=$((CRED_FOUND+1))
  fi
done
if [ "$CRED_FOUND" -eq 0 ]; then
  green "No hardcoded credentials found"
fi

# ── CHECK 4: No .env files committed ──────────────────────────────────
head_ ".ENV FILES CHECK"

ENV_FILES=$(find "$ROOT" -name ".env" -o -name ".env.docker" \
  ! -path "*/node_modules/*" ! -path "*/.git/*" 2>/dev/null || true)
if [ -n "$ENV_FILES" ]; then
  warn "Found .env files — ensure these are in .gitignore:"
  echo "$ENV_FILES"
else
  green "No .env files found in repo (correct)"
fi

# ── CHECK 5: docker-compose has version header ────────────────────────
head_ "DOCKER COMPOSE STRUCTURE"

if grep -q "^version:" "$ROOT/apps/core/docker-compose.yml"; then
  green "docker-compose.yml has version: header"
else
  red "docker-compose.yml missing version: header"
  FAIL=$((FAIL+1))
fi

DUP_SERVICES=$(grep "^  [a-z][a-z-]*:$" "$ROOT/apps/core/docker-compose.yml" \
  | sort | uniq -d || true)
if [ -z "$DUP_SERVICES" ]; then
  green "No duplicate service definitions"
else
  red "DUPLICATE SERVICES: $DUP_SERVICES"
  FAIL=$((FAIL+1))
fi

# ── CHECK 6: Gateway routes count ─────────────────────────────────────
head_ "GATEWAY ROUTES"

ROUTE_COUNT=$(grep -c '"http://localhost:4' \
  "$ROOT/apps/core/gateway/index.js" 2>/dev/null || echo "0")
if [ "$ROUTE_COUNT" -ge 33 ]; then
  green "Gateway has $ROUTE_COUNT service routes (≥33 required)"
else
  red "Gateway only has $ROUTE_COUNT routes — expected ≥33"
  FAIL=$((FAIL+1))
fi

# ── FINAL RESULT ──────────────────────────────────────────────────────
echo ""
echo "======================================================"
if [ "$FAIL" -eq 0 ]; then
  echo -e "\033[32m  RESULT: PASS — Ready for GitHub release\033[0m"
  echo "  Branch: release/v1-go-live"
  echo "  Tag:    v1.0.0"
  echo ""
  echo "  Next: git push origin release/v1-go-live && git push origin v1.0.0"
else
  echo -e "\033[31m  RESULT: FAIL — $FAIL issue(s) found\033[0m"
  echo "  Fix issues above before pushing to GitHub."
fi
echo "======================================================"

exit $FAIL
