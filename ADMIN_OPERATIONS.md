# ADMIN OPERATIONS GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Date:** 2026-06-16  

---

## ADMIN DASHBOARD URLS

| Page | URL | Access |
|---|---|---|
| Deployment AI | `[url]/deploy` | Admin only |
| Monitor | `[url]/deploy/monitor` | Admin only |
| System Status | `[url]/deploy/status` | Admin only |
| Deep Health | `[url]/deploy/health` | Admin only |
| Audit | `[url]/deploy/audit` | Admin only |
| Deploy Logs | `[url]/deploy/logs` | Admin only |
| Releases | `[url]/deploy/releases` | Admin only |
| GitHub Sync | `[url]/deploy/github` | Admin only |
| Credit Usage | `[url]/deploy/credits` | Admin only |
| Go-Live Checklist | `[url]/deploy/checklist` | Admin only |

**Login:** use your admin@dunazoe.com credentials  
**Role required:** `admin`, `super_admin`, or `cto`

---

## DAILY OPERATIONS

### Morning Check (5 minutes)
1. Open `/deploy/monitor` on phone
2. Verify: 🟢 HEALTHY
3. Check last hour: errors=0, orders>0
4. If any errors: check `/deploy/status` for which service

### Before Any Deploy
1. `/deploy/checklist` → must show **GO**
2. `/deploy/audit` → all scores ≥85
3. Press Deploy on `/deploy`

### After Any Deploy
1. Watch `/deploy/monitor` for 30 minutes
2. Run `./smoke-tests/run.sh [url]`
3. Check payment logs in Paystack dashboard
4. Fill `72h-beta-report.md`

---

## ACTIVATION ENGINE COMMANDS

```bash
# Check all 15 feature states (no auth)
curl [url]/activation/features

# Check specific feature
curl [url]/activation/features/wallet

# Force-evaluate all triggers
curl -X POST [url]/activation/evaluate \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Manually activate a feature
curl -X POST [url]/activation/features/wallet/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state":"ON","notes":"Manual — 100 users reached"}'

# Emergency deactivate
curl -X POST [url]/activation/features/thrift/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"state":"OFF","notes":"Emergency stop"}'
```

---

## DATABASE QUERIES (run via psql or DB admin tool)

```sql
-- User count (toward wallet auto-activation at 100)
SELECT COUNT(*) FROM users;

-- Orders today
SELECT COUNT(*), SUM(total_amount) FROM orders 
WHERE status='paid' AND created_at > CURRENT_DATE;

-- Failed payments
SELECT COUNT(*) FROM transactions 
WHERE status='failed' AND created_at > NOW() - INTERVAL '24 hours';

-- Active vendors
SELECT COUNT(*) FROM users WHERE role='vendor' AND status='active';

-- Activation history
SELECT feature_name, old_state, new_state, triggered_at 
FROM activation_events ORDER BY triggered_at DESC LIMIT 10;

-- Deployment history
SELECT version, environment, approved, readiness_score, started_at 
FROM deployment_runs ORDER BY started_at DESC LIMIT 5;
```

---

## EMERGENCY PROCEDURES

### Service Down
```bash
# Check which container is down
docker-compose ps | grep -v Up

# Restart specific service
docker-compose restart payment

# View logs
docker logs dunazoe-payment --tail 100
```

### Payment Issue
1. Check Paystack webhook log: `SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 20`
2. Verify webhook URL in Paystack dashboard
3. Check payment service logs: `docker logs dunazoe-payment --tail 100`

### Rollback
See `HANDOVER_PACKAGE/ROLLBACK_GUIDE.md` — 4 methods available

---

## REPLIT PHONE DEPLOY (One-Tap)

1. Open Replit app on Android
2. Navigate to `/deploy`
3. Login with admin credentials
4. Tap **🔍 Run Deployment Audit**
5. Wait for all scores ≥85
6. Tap **🚀 DEPLOY TO PRODUCTION**
7. Follow the generated steps

*No terminal required. Works fully from Android.*

---

*Generated: 2026-06-16 — DUNAZOE Chief Operations Officer*
