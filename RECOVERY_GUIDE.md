# RECOVERY GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1  
**Phase:** 33 — Emergency Recovery  

---

## INCIDENT SEVERITY LEVELS

| Level | Description | Action | Response Time |
|---|---|---|---|
| P0 | Payments down / data loss / all services down | ROLLBACK IMMEDIATELY | < 5 minutes |
| P1 | One core service down (auth, payment, order) | Restart → rollback if fails | < 15 minutes |
| P2 | Non-critical service down | Restart | < 1 hour |
| P3 | Degraded performance | Monitor | Next business day |

---

## P0 RECOVERY STEPS (ALL SYSTEMS DOWN)

```
1. Open Replit → History → Restore checkpoint a20abd7c
   OR
1. SSH to Contabo → docker compose down && git checkout v1.0.0 && docker compose up -d

2. Wait 60 seconds

3. Verify: curl [url]/health → {"status":"ok"}

4. Post in WhatsApp group: "ROLLBACK COMPLETE — v1.0.0 restored"

5. Do NOT re-deploy until root cause found
```

---

## P1 RECOVERY — AUTH SERVICE DOWN

Symptom: All users getting 401 / cannot login

```bash
# Check container
docker logs dunazoe-auth --tail 50

# Restart
docker compose restart auth

# Verify after 30 seconds
curl http://localhost:4001/health

# If still down — rollback auth service
docker compose up -d --build auth
```

---

## P1 RECOVERY — PAYMENT SERVICE DOWN

Symptom: Orders created but payments failing

```bash
# Emergency action: check webhook is still receiving
curl -X POST https://paystack.com/api/webhooks/test  # Send test from Paystack dashboard

# Check service
docker logs dunazoe-payment --tail 100

# Restart
docker compose restart payment

# If Paystack webhooks still failing:
# 1. Go to Paystack Dashboard → Webhooks → re-register URL
# 2. Verify PAYSTACK_WEBHOOK_SECRET matches
```

---

## P1 RECOVERY — DATABASE CONNECTION LOST

Symptom: All services showing DB errors

```bash
# Check PostgreSQL
docker logs dunazoe-postgres --tail 50
docker compose restart postgres

# Wait 30 seconds
docker compose ps | grep postgres

# Test
psql $DATABASE_URL -c "SELECT 1"

# If still fails — check DATABASE_URL secret is correct
echo $DATABASE_URL
```

---

## P1 RECOVERY — REDIS DOWN

Symptom: Auth sessions invalid / search broken

```bash
docker compose restart redis
sleep 10
redis-cli -u $REDIS_URL ping    # should return PONG
```

---

## FULL DATA RECOVERY (Last Resort)

```bash
# Restore from pre-launch backup
psql $DATABASE_URL < pre_launch.sql

# OR restore from automated backup (if configured)
pg_restore -d dunazoe_db backup_$(date +%Y%m%d).dump
```

---

## COMMON ERRORS + FIXES

| Error | Cause | Fix |
|---|---|---|
| `JWT_SECRET too short` | Secret not set | Set `JWT_SECRET` in Replit Secrets |
| `ECONNREFUSED 5432` | DB not reachable | Check `DATABASE_URL` and DB status |
| `Can't reach localhost:4001` | Auth service not running | Start auth workflow |
| `Invalid signature` on webhook | Wrong webhook secret | Re-copy from Paystack/Stripe dashboard |
| `No space left on device` | Disk full | `docker system prune -f` |
| `Port already in use` | Duplicate service | `docker compose down && docker compose up -d` |
| `OOMKilled` | Out of memory | Switch to `docker compose up` (beta mode, not --profile full) |

---

## POST-INCIDENT CHECKLIST

After resolving any P0/P1:
- [ ] Root cause identified
- [ ] Timeline documented
- [ ] `FIX_LOG.md` updated
- [ ] `72h-beta-report.md` updated (mark the incident hour)
- [ ] Team notified via WhatsApp
- [ ] Re-deploy only after audit passes (`/deploy/checklist` → GO)
- [ ] Monitor for 2 hours after recovery

---

*Generated: 2026-06-16 — DUNAZOE Chief Reliability Engineer*
