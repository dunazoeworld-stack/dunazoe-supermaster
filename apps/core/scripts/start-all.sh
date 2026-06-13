#!/bin/bash
# DUNAZOE OS v4 — Start all 30 services + gateway
# Updates #93 #94 #95 #96 applied
mkdir -p logs
DB="${DATABASE_URL:-postgresql://localhost:5432/dunazoe_db}"

echo "Running migrations..."
for s in \
  shared/schema.sql \
  shared/schema-phase3-4.sql \
  shared/schema-phase5-8.sql \
  shared/schema-phase9.sql; do
  [ -f "$s" ] && psql "$DB" -f "$s" >/dev/null 2>&1 \
    && echo "  ✓ $s" || echo "  ⚠ $s"
done

# All 30 services: name:port
SVCS="\
auth:4001 user:4002 vendor:4003 product:4004 \
inventory:4005 order:4006 escrow:4007 fraud:4008 \
wallet:4009 thrift:4010 trust:4011 loan:4012 \
commission:4013 ai:4014 payment:4015 dispute:4016 \
notification:4017 logistics:4018 feature-flag:4019 \
upload:4020 realtime:4021 search:4022 \
kyc:4023 reconciliation:4024 reliability:4025 \
security-ai:4026 deployment-ai:4027 self-delivery:4028 \
admin-override:4029 social-media:4030"

echo "Starting 30 services..."
PIDS=""
for e in $SVCS; do
  n=$(echo $e|cut -d: -f1)
  p=$(echo $e|cut -d: -f2)
  dir="services/${n}-service"
  [ -f "$dir/index.js" ] || { echo "  ⚠ $dir/index.js not found"; continue; }
  [ ! -d "$dir/node_modules" ] && (cd "$dir" && npm install --silent 2>/dev/null)
  SERVICE_NAME="dunazoe-$n" PORT=$p node "$dir/index.js" \
    > "logs/${n}.log" 2>&1 &
  PIDS="$PIDS $!"; printf "  ✓ %-24s port %s\n" "$n" "$p"; sleep 0.15
done

# Gateway
[ ! -d "gateway/node_modules" ] && (cd gateway && npm install --silent 2>/dev/null)
PORT=3000 SERVICE_NAME="dunazoe-gateway" node gateway/index.js \
  > logs/gateway.log 2>&1 &
PIDS="$PIDS $!"; echo "  ✓ gateway               port 3000"
echo $PIDS > logs/.pids

echo ""
sleep 8
echo "Health checks:"
for e in $SVCS; do
  n=$(echo $e|cut -d: -f1); p=$(echo $e|cut -d: -f2)
  s=$(curl -s --max-time 2 "http://localhost:${p}/health" 2>/dev/null \
      | python3 -c "import sys,json;d=json.load(sys.stdin);print('ok' if d.get('status')=='ok' else 'err')" 2>/dev/null \
      || echo "down")
  [ "$s" = "ok" ] \
    && printf "  ✅ %-26s(%s)\n" "$n" "$p" \
    || printf "  ❌ %-26s(%s) check logs/%s.log\n" "$n" "$p" "$n"
done

gw=$(curl -s --max-time 2 http://localhost:3000/health 2>/dev/null \
     | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('services','?'))" 2>/dev/null \
     || echo "down")
echo "  ✅ gateway               (3000) — $gw services"

echo ""
echo "DUNAZOE OS v4 running."
echo "Gateway:    http://localhost:3000"
echo "Health:     http://localhost:3000/health"
echo "WS:         ws://localhost:4021"
echo "Security:   http://localhost:4026/security/dashboard"
echo "Deploy AI:  http://localhost:4027/deployment/status"
echo "Reliability:http://localhost:4025/reliability/status-dashboard"
