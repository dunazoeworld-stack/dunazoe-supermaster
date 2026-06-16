# ROLLBACK GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-rc1  

---

## ROLLBACK DECISION TREE

```
INCIDENT DETECTED
      ↓
Is it a P0? (payments down / data loss / all services down)
      ↓ YES                        ↓ NO
ROLLBACK IMMEDIATELY        Try restart first (P1/P2)
```

---

## METHOD 1 — REPLIT CHECKPOINT (Fastest — 2 minutes)

Use this for Replit deployments.

1. Replit → **History** (left sidebar)
2. Find the last stable checkpoint:

| Checkpoint | What It Contains |
|---|---|
| `a20abd7c` | Monitor page + 10 reports (current) |
| `4300e500` | Activation Engine + 10 reports |
| `f93122b0` | Deploy dashboard + PWA |
| `a7d16079` | Register page |

3. Click **Restore**
4. Verify: `GET /health` → `{"status":"ok"}`

---

## METHOD 2 — DEPLOYMENT AI (Recommended for Contabo)

```bash
# Find the last successful run_id first
curl https://dunazoe.com/deployment/status \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Then rollback
curl -X POST https://dunazoe.com/deployment/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"run_id": LAST_RUN_ID, "reason": "P0: payments down"}'
```

---

## METHOD 3 — GIT ROLLBACK (Contabo terminal)

```bash
cd /opt/dunazoe/apps/core
docker-compose down

# Option A: previous release tag
git checkout v1.0.0
docker-compose up --build -d

# Option B: specific commit
git stash
git checkout 4300e500
docker-compose up --build -d

# Verify
sleep 60 && curl http://localhost:3000/health
```

---

## METHOD 4 — SINGLE SERVICE RESTART

For P2 (one service down):
```bash
# Restart specific service
docker-compose restart payment

# Or rebuild one service
docker-compose up -d --build payment

# Check logs
docker logs dunazoe-payment --tail 50
```

---

## ROLLBACK VERIFICATION

After any rollback, run these checks:
```bash
# 1. All services up
docker-compose ps | grep -v Up && echo "ALL UP" || echo "SOME DOWN"

# 2. Gateway healthy
curl http://localhost:3000/health

# 3. Auth working
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@dunazoe.com","password":"testpass"}'

# 4. Payment service
curl http://localhost:4015/health

# 5. Monitor page
curl http://localhost:4027/deployment/monitor \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## POST-ROLLBACK STEPS

1. **Log the incident** in `FIX_LOG.md`
2. **Notify** via WhatsApp group
3. **Root cause** analysis before re-deploy
4. **Re-audit** via Deployment AI before going live again
5. **Update** `BETA_HEALTH_REPORT.md` with incident details

---

*Generated: 2026-06-16 — DUNAZOE Chief Reliability Engineer*
