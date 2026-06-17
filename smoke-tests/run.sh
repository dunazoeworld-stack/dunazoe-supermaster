#!/bin/bash
# =====================================================================
# DUNAZOE — smoke-tests/run.sh
# Runs full smoke test suite against a target URL
# Usage: ./smoke-tests/run.sh [URL]
# Default URL: http://localhost:3000
# =====================================================================

set -e

TARGET="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "======================================================"
echo " DUNAZOE SMOKE TEST RUNNER"
echo " Target: $TARGET"
echo " Date:   $(date)"
echo "======================================================"

# Check Node.js available
if ! command -v node &>/dev/null; then
  echo "❌ Node.js not found. Install Node.js 20+ to run smoke tests."
  exit 1
fi

# Wait for gateway to be ready
echo "⏳ Waiting for gateway at $TARGET/health..."
RETRIES=30
until curl -sf "$TARGET/health" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -eq 0 ]; then
    echo "❌ Gateway not responding after 30 attempts. Is it running?"
    exit 1
  fi
  sleep 2
done
echo "✅ Gateway is up"

# Run the smoke tests
node "$SCRIPT_DIR/index.js" "$TARGET"
EXIT_CODE=$?

echo ""
if [ "$EXIT_CODE" -eq 0 ]; then
  echo "🟢 ALL SMOKE TESTS PASSED — Safe to proceed with beta."
else
  echo "🔴 SMOKE TESTS FAILED — Fix failures before beta launch."
fi

exit $EXIT_CODE
