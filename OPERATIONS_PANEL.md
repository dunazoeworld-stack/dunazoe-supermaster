# OPERATIONS_PANEL.md — Phase 28
## DUNAZOE Observability + Operations | 2026-06-17

---

## MONITORING ENDPOINTS

| Endpoint | Port | Description |
|---|---|---|
| GET /health | 3000 | All-services health summary |
| GET /deploy | frontend | Deploy dashboard UI |
| GET /deploy/monitor | frontend | Real-time service monitor |
| GET /deployment/status | 4027 | Deployment AI state |
| GET /deployment/logs | 4027 | Recent log entries |
| GET /deployment/credits | 4027 | Credit usage estimate |
| GET /deployment/health/detailed | 4027 | Detailed health per service |

## CONTROL CENTER (Replit browser — port 5000)
- Tab: Health → shows all 9 service dots
- Tab: Credits → live cost estimate
- Tab: Console → run any action one-click

## OPERATIONAL SCRIPTS
```bash
# Full system health
node deployment-ai/environment-checker.js all

# Cost report
node deployment-ai/cost-optimizer.js --report

# Live dashboard
node deployment-ai/deployment-dashboard.js --watch

# Emergency rollback
node deployment-ai/rollback-engine.js --to a20abd7c --reason "emergency"

# Traffic check
node deployment-ai/traffic-controller.js --verify
```

## SERVICE LOGS
```bash
# After starting services:
tail -f logs/gateway.log
tail -f logs/auth-service.log
tail -f logs/payment-service.log
# etc. — all logs in logs/ directory
```

## ALERT SIGNALS
- DeadLetterQueue messages → check logs/notification-service.log
- Reliability score drop < 80 → check reliability-service logs
- Feature flag killswitch trip → check feature-flag-service logs

## 72-HOUR MONITORING SCHEDULE
- Hours 0-24: Check every 30 min
- Hours 24-48: Check every 2 hours
- Hours 48-72: Check every 6 hours
- If stable at hour 72 → expand to 50 beta users
- If unstable → rollback, debug, redeploy
