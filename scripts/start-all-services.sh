#!/usr/bin/env bash
# DUNAZOE — Service Orchestrator
# Starts all 10 critical microservices + Gateway
# Usage: bash scripts/start-all-services.sh
# Credit-efficient: single workflow hosts all services

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVC="$ROOT/apps/core/services"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log()       { echo "[$(timestamp)] $1"; }
start_svc() {
  local name="$1" port="$2" path="$3"
  log "Starting $name on port $port..."
  node "$path/index.js" > "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$LOG_DIR/$name.pid"
  log "  PID $! — tail: logs/$name.log"
}

log "========================================"
log "  DUNAZOE Service Orchestrator"
log "  Starting 10 services"
log "========================================"
echo ""

# ── CRITICAL MICROSERVICES (background) ───────────────────────────
start_svc "auth-service"         4001 "$SVC/auth-service"
start_svc "user-service"         4002 "$SVC/user-service"
start_svc "payment-service"      4006 "$SVC/payment-service"
start_svc "order-service"        4005 "$SVC/order-service"
start_svc "notification-service" 4010 "$SVC/notification-service"
start_svc "reliability-service"  4025 "$SVC/reliability-service"
start_svc "deployment-ai-service" 4027 "$SVC/deployment-ai-service"
start_svc "feature-flag-service" 4028 "$SVC/feature-flag-service"

# ── WARM-UP WAIT ───────────────────────────────────────────────────
log "Waiting 3s for services to warm up..."
sleep 3

# ── STATUS REPORT ─────────────────────────────────────────────────
log "Service status:"
for svc in auth-service user-service payment-service order-service \
           notification-service reliability-service deployment-ai-service feature-flag-service; do
  PID_FILE="$LOG_DIR/$svc.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      log "  ✅ $svc (PID $PID)"
    else
      log "  ❌ $svc FAILED — check logs/$svc.log"
    fi
  fi
done

# ── GATEWAY (foreground — keeps workflow alive) ────────────────────
log ""
log "Starting Gateway on port 3000..."
log "========================================"
exec node "$ROOT/apps/core/gateway/index.js"
