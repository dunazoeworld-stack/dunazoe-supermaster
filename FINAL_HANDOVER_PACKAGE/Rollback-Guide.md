# ROLLBACK GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1

---

## WHEN TO ROLLBACK

| Symptom | Action |
|---|---|
| All services down >5 minutes | ROLLBACK (P0) |
| Payment failures >5% | ROLLBACK (P0) |
| Data corruption detected | ROLLBACK + restore DB |
| One service down | RESTART (not rollback) |
| Slow response times | Investigate, monitor |

---

## METHOD 1: REPLIT CHECKPOINT (Fastest — 2 min)

1. Replit app → History (left sidebar clock icon)
2. Find latest stable checkpoint:

| Checkpoint | Content | When |
|---|---|---|
| `a20abd7c` | Monitor page + all reports | Most recent |
| `915780de` | docker-compose rebuild | Previous |
| `4300e500` | Activation Engine | Earlier |

3. Tap **Restore** → confirm
4. Wait ~2 minutes
5. Verify: open your Replit URL → `/health`

---

## METHOD 2: DEPLOYMENT AI API

```bash
curl -X POST [url]/deployment/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "P0: payments down"}'
```

Returns step-by-step rollback guide.

---

## METHOD 3: GIT (Contabo Terminal)

```bash
cd /opt/dunazoe/apps/core

# Stop everything
docker compose down

# Option A: Go back to stable tag
git checkout v1.0.0

# Option B: Go back to specific commit
git checkout a20abd7c

# Restart
docker compose up -d

# Wait 60 seconds then verify
sleep 60 && curl http://localhost:3000/health
```

---

## METHOD 4: SINGLE SERVICE ROLLBACK

When only one service is broken:

```bash
# Restart the service
docker compose restart payment

# Wait 20 seconds
sleep 20

# Check logs
docker logs dunazoe-payment --tail 50

# Check health
curl http://localhost:4015/health

# If still broken — rebuild just that service
docker compose up -d --build payment
```

---

## POST-ROLLBACK VERIFICATION

Run these after any rollback:

```bash
# 1. Gateway health
curl [url]/health

# 2. Auth working
curl -X POST [url]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dunazoe.com","password":"testpass"}'

# 3. Payment service
curl [url]/payments/health

# 4. Smoke tests
./smoke-tests/run.sh [url]
# Expected: ≥95% pass
```

---

## POST-ROLLBACK PROCESS

1. ✅ Confirm service is back up
2. ✅ Post in WhatsApp group with time + version restored
3. ✅ Update `72h-beta-report.md` with the incident
4. ✅ Find root cause (check logs, check recent code changes)
5. ✅ Fix the root cause
6. ✅ Run full audit (`/deploy/audit`) → all ≥85
7. ✅ Re-deploy only after audit passes

---

*DUNAZOE Rollback Guide v1.0.0-RC1 — 2026-06-16*
