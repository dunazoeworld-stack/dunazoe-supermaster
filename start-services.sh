#!/usr/bin/env bash
# ================================================================
# DUNAZOE — Core Microservices Startup Script
# As CTO: starts only services required for basic ecommerce ops.
# Resource-efficient for Replit free tier.
#
# TIER 1 (Critical — ecommerce cannot function without these):
#   auth-service     4001 — login/signup/JWT
#   user-service     4002 — user profiles
#   vendor-service   4003 — vendor management
#   product-service  4004 — product catalog
#   order-service    4006 — order lifecycle
#   payment-service  4015 — Paystack/Stripe gateway
#   upload-service   4020 — Cloudinary file backend
#
# TIER 2 (Important — enables full platform features):
#   escrow-service       4007 — buyer/seller fund protection
#   wallet-service       4009 — NGN/USD digital wallet
#   notification-service 4017 — WhatsApp/SMS/in-app alerts
#   logistics-service    4018 — delivery agent assignment
#   search-service       4022 — product search
#   dunazoe-express      4032 — AI courier aggregator
#   self-delivery-service 4028 — vendor self-delivery
#
# TIER 3 (Enhanced — start if resources allow):
#   trust-service        4011 — platform trust scoring
#   ai-service           4014 — general AI assistant
#   realtime-service     4021 — WebSocket/Socket.io
#   kyc-service          4023 — identity verification
#   deployment-ai-service 4027 — CI/CD control plane
# ================================================================

set -e

SERVICES_DIR="apps/core/services"
LOG_DIR="logs/services"
mkdir -p "$LOG_DIR"

# ── Helper ────────────────────────────────────────────────────────────────────
start_service() {
  local name="$1"
  local port="$2"
  local tier="$3"
  local dir="$SERVICES_DIR/$name"

  if [ ! -f "$dir/index.js" ]; then
    echo "⚠️  [$name] index.js not found — skipping"
    return
  fi

  # Install deps if node_modules missing
  if [ ! -d "$dir/node_modules" ] && [ -f "$dir/package.json" ]; then
    echo "📦 [$name] Installing dependencies..."
    (cd "$dir" && npm install --prefer-offline --no-fund --no-audit 2>&1 | tail -3) || true
  fi

  # Check if already running
  if lsof -i ":$port" -t >/dev/null 2>&1; then
    echo "✅ [$name] Already running on :$port"
    return
  fi

  echo "🚀 [$name] Starting on :$port (Tier $tier)..."
  PORT=$port \
    DATABASE_URL="${DATABASE_URL:-}" \
    SESSION_SECRET="${SESSION_SECRET:-}" \
    JWT_SECRET="${SESSION_SECRET:-dunazoe_jwt_change_in_prod}" \
    PAYSTACK_LSK="${PAYSTACK_LSK:-}" \
    STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}" \
    CLOUDINARY_CLOUD_NAME="${CLOUDINARY_CLOUD_NAME:-}" \
    CLOUDINARY_API_KEY="${CLOUDINARY_API_KEY:-}" \
    CLOUDINARY_API_SECRET="${CLOUDINARY_API_SECRET:-}" \
    GEMINI_API_KEY="${GEMINI_API_KEY:-}" \
    INTERNAL_SECRET="${INTERNAL_SECRET:-dunazoe_internal_shared}" \
    REALTIME_SERVICE_URL="${REALTIME_SERVICE_URL:-http://localhost:4021}" \
    node "$dir/index.js" \
    >> "$LOG_DIR/$name.log" 2>&1 &

  echo $! > "$LOG_DIR/$name.pid"
  sleep 0.4 # stagger startup to avoid DB connection storms
}

# ── Environment check ─────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   DUNAZOE Microservices — Starting Core Stack    ║"
echo "║   $(date '+%Y-%m-%d %H:%M:%S')                           ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

if [ -z "$DATABASE_URL" ]; then
  echo "⚠️  WARNING: DATABASE_URL not set. Services requiring PostgreSQL will exit."
fi

# ── TIER 1: Critical ecommerce services ──────────────────────────────────────
echo "── TIER 1: Critical Services ────────────────────────"
start_service "auth-service"     4001 1
start_service "user-service"     4002 1
start_service "vendor-service"   4003 1
start_service "product-service"  4004 1
start_service "order-service"    4006 1
start_service "payment-service"  4015 1
start_service "upload-service"   4020 1

sleep 1

# ── TIER 2: Full platform features ───────────────────────────────────────────
echo ""
echo "── TIER 2: Platform Services ───────────────────────"
start_service "escrow-service"        4007 2
start_service "cart-service"          4008 2
start_service "wallet-service"        4009 2
start_service "thrift-service"        4010 2
start_service "notification-service"  4017 2
start_service "logistics-service"     4018 2
start_service "search-service"        4022 2
start_service "self-delivery-service" 4028 2
start_service "dunazoe-express"       4032 2

sleep 1

# ── TIER 3: Enhanced features (conditional on free memory) ───────────────────
FREE_MEM_MB=$(awk '/MemAvailable/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null || echo "0")
if [ "$FREE_MEM_MB" -gt 400 ] 2>/dev/null; then
  echo ""
  echo "── TIER 3: Enhanced Services (${FREE_MEM_MB}MB free) ──────"
  start_service "trust-service"           4011 3
  start_service "review-service"          4012 3
  start_service "loan-service"            4013 3
  start_service "ai-service"              4014 3
  start_service "chat-service"            4016 3
  start_service "realtime-service"        4021 3
  start_service "kyc-service"             4023 3
  start_service "analytics-service"       4024 3
  start_service "marketing-service"       4025 3
  start_service "social-media-service"    4026 3
  start_service "deployment-ai-service"   4027 3
  start_service "inventory-service"       4029 3
  start_service "fraud-service"           4030 3
  start_service "payments-ai-service"     4031 3
  start_service "activation-engine"       4033 3
  start_service "ops-service"             4034 3
  start_service "stae-service"            4035 3
else
  echo ""
  echo "── TIER 3: Skipped (${FREE_MEM_MB}MB free — below 400MB threshold)"
  echo "   To start Tier 3 manually: PORT=4XXX node apps/core/services/<name>/index.js"
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  Services launched. Logs → logs/services/*.log  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

# Keep script alive so workflow doesn't exit
echo "Monitoring services (Ctrl+C to stop all)..."
wait
