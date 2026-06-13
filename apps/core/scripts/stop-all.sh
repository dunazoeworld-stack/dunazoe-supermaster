#!/bin/bash
# ================================================================
# DUNAZOE OS — STOP ALL SERVICES
# scripts/stop-all.sh
# ================================================================

echo ""
echo "🛑 Stopping DUNAZOE OS services..."

if [ -f "logs/.pids" ]; then
  PIDS=$(cat logs/.pids)
  for pid in $PIDS; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "  ✓ Stopped PID $pid"
    fi
  done
  rm -f logs/.pids
else
  # Fallback: kill by port
  for port in 3000 4001 4002 4003 4004 4005 4006 4007 4008 4009 4010 4011 4012 4013 4014; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null
      echo "  ✓ Stopped port $port (PID $pid)"
    fi
  done
fi

echo ""
echo "✅ All services stopped."
echo ""
