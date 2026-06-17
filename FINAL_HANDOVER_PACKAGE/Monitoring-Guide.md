# MONITORING GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1

---

## DASHBOARD URLS

| Dashboard | URL | Refresh |
|---|---|---|
| Production Monitor | `/deploy/monitor` | Auto 30s |
| System Status | `/deploy/status` | Manual |
| Deep Health | `/deploy/health` | Auto 30s |
| Deploy Logs | `/deploy/logs` | Manual |
| Deployment AI | `/deploy` | On demand |

All require admin login.

---

## WHAT TO WATCH (Daily)

### Morning Check (5 min)
1. Open `/deploy/monitor`
2. Should show: 🟢 HEALTHY
3. Check `service_errors = 0`
4. Check `new_orders > 0` (if business hours)

### Evening Review (5 min)
```sql
-- Orders today
SELECT COUNT(*), SUM(total_amount) 
FROM orders WHERE status='paid' AND created_at > CURRENT_DATE;

-- Users registered today
SELECT COUNT(*) FROM users WHERE created_at > CURRENT_DATE;

-- Failed payments
SELECT COUNT(*) FROM transactions 
WHERE status='failed' AND created_at > NOW() - INTERVAL '24 hours';
```

---

## ALERT THRESHOLDS

| Metric | 🟢 HEALTHY | 🟡 WATCH | 🔴 ALERT |
|---|---|---|---|
| Errors/hr | 0 | 1–5 | >5 |
| Payment fail rate | <2% | 2–5% | >5% |
| DB connections | <70% pool | 70–90% | >90% |
| Redis memory | <200MB | 200–240MB | >250MB |
| Response P95 | <500ms | 500ms–1s | >1s |
| Stale async jobs | <50 | 50–100 | >100 |

---

## INTERPRETING `/deployment/monitor` RESPONSE

```json
{
  "monitor_status": "🟢 HEALTHY",
  "last_hour": {
    "service_errors": 0,
    "new_orders": 3,
    "successful_payments": 2
  },
  "ceo_view": {
    "status": "🟢 HEALTHY",
    "message": "Platform is running smoothly after deployment."
  }
}
```

**🟢 HEALTHY** = errors=0, all good  
**🟡 MONITORING** = 1–5 errors/hr, watch closely  
**🔴 ISSUES DETECTED** = >5 errors/hr, investigate immediately  

---

## GRAFANA (Contabo only)

Access: `http://[contabo-ip]:3100`  
Username: admin  
Password: set via `GF_SECURITY_ADMIN_PASSWORD`

Dashboards:
- Node.js service metrics (CPU, memory, latency)
- PostgreSQL connection pool usage
- Redis memory
- RabbitMQ queue depth
- Order + payment rates

---

## LOG ACCESS

```bash
# Gateway logs
docker logs dunazoe-gateway --tail 100 -f

# Payment service logs
docker logs dunazoe-payment --tail 100 -f

# All services at once
docker compose logs --tail 50 -f

# Filter errors
docker compose logs | grep "ERROR\|WARN" | tail -50
```

---

## 72-HOUR BETA LOG TEMPLATE

| Hour | 🟢/🟡/🔴 | Errors | Orders | Payments | Notes |
|---|---|---|---|---|---|
| 0 | | | | | Deploy moment |
| 6 | | | | | |
| 12 | | | | | |
| 24 | | | | | Day 1 |
| 48 | | | | | Day 2 |
| 72 | | | | | Beta complete |

Fill from `/deploy/monitor` every 6 hours.

---

*DUNAZOE Monitoring Guide v1.0.0-RC1 — 2026-06-16*
