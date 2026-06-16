# GO-LIVE RUNBOOK
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  

This runbook covers every operational procedure for running DUNAZOE in production.

---

## 1. DEPLOY PROCEDURE

### Pre-Deploy Checklist
1. All 17 secrets set in Replit Secrets / `.env.docker`
2. Database migrations run (5 schema files in order)
3. `release/v1-go-live` branch pushed to GitHub
4. Deployment AI audit score ≥90 across all gates

### Deploy Command (via Deployment AI)
```
1. Open dunazoe.com/deploy
2. Login with admin credentials
3. Select: Environment = production, Provider = replit (or contabo)
4. Tap "Run Deployment Audit" → wait for all GREEN scores
5. Tap "🚀 DEPLOY TO PRODUCTION"
6. Follow the generated step checklist
```

### Deploy Command (Contabo terminal)
```bash
cd /opt/dunazoe/apps/core
git pull origin release/v1-go-live
docker-compose up --build -d
sleep 60
curl http://localhost:3000/health
```

---

## 2. ROLLBACK PROCEDURE

### Replit Rollback (Fastest — 2 min)
```
Replit → History → Select checkpoint → Restore
Checkpoints: 4300e500 (current), f93122b0, a7d16079, 82e538a
```

### Contabo Rollback (Git — 5 min)
```bash
cd /opt/dunazoe
docker-compose down
git stash
git checkout [previous-tag]
cd apps/core
docker-compose up --build -d
curl http://localhost:3000/health
```

### Via Deployment AI (Recommended)
```bash
curl -X POST https://dunazoe.com/deployment/rollback \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d '{"run_id": LAST_RUN_ID, "reason": "P0 incident — payment failure"}'
```

---

## 3. MONITOR PROCEDURE

### Real-time Dashboard
`dunazoe.com/deploy/monitor` — auto-polls every 30s

### Terminal Monitor
```bash
# All service health
docker-compose ps

# Gateway errors (last 100 lines, live)
docker logs dunazoe-gateway --tail 100 --follow

# Payment service
docker logs dunazoe-payment --tail 50

# Check specific error
docker logs dunazoe-gateway 2>&1 | grep "ERROR"

# Activation engine
curl https://dunazoe.com/activation/features | python3 -m json.tool
```

### Deployment AI Monitor
```bash
curl https://dunazoe.com/deployment/monitor \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

---

## 4. RESTORE PROCEDURE (Data)

### Restore from PostgreSQL Backup
```bash
# Create backup first
pg_dump $DATABASE_URL > dunazoe_backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < dunazoe_backup_20260615.sql
```

### Schema-Only Restore (After rollback)
```bash
psql $DATABASE_URL -f apps/core/shared/schema.sql
psql $DATABASE_URL -f apps/core/shared/schema-phase3-4.sql
psql $DATABASE_URL -f apps/core/shared/schema-phase5-8.sql
psql $DATABASE_URL -f apps/core/shared/schema-phase9.sql
psql $DATABASE_URL -f apps/core/shared/schema-phase10.sql
```

---

## 5. INCIDENT RESPONSE

### P0 — Payments Down
```
1. Check: docker logs dunazoe-payment --tail 50
2. Verify: PAYSTACK_SECRET_KEY and PAYSTACK_WEBHOOK_SECRET set correctly
3. Test: curl -X POST /payments/webhook (check signature)
4. If unfixable in 15 min: rollback immediately
5. Notify users: use notification service
```

### P0 — All Services Down (OOM)
```
1. SSH to VPS (Termius)
2. Check RAM: free -m
3. If OOM: docker-compose down && docker-compose up -d [core services only]
4. Core services: gateway, auth, product, payment, order, escrow
5. Reopen monitor after restart
```

### P1 — Auth Broken
```
1. Check: JWT_SECRET is set and matches across all services
2. Restart: docker-compose restart gateway auth-service
3. Test: POST /auth/login with known credentials
```

### P1 — Database Connection Refused
```
1. Verify DATABASE_URL format
2. Check PostgreSQL running: docker ps | grep postgres
3. Restart: docker-compose restart postgres && sleep 15 && docker-compose restart
```

---

## 6. DNS PROCEDURE (Namecheap → dunazoe.com)

```
Namecheap → Domain List → dunazoe.com → Manage → Advanced DNS

ADD/EDIT:
A Record  |  @    | YOUR_CONTABO_IP  | Auto TTL
A Record  |  www  | YOUR_CONTABO_IP  | Auto TTL
CNAME     |  api  | dunazoe.com      | Auto TTL

Wait 1–48h for propagation.
Test: nslookup dunazoe.com → should return Contabo IP
```

---

## 7. PAYMENT PROCEDURES

### Paystack Webhook URL (register in Paystack dashboard)
```
https://dunazoe.com/payments/webhook/paystack
```

### Stripe Webhook URL (register in Stripe dashboard)
```
https://dunazoe.com/payments/webhook/stripe
Event types: payment_intent.succeeded, payment_intent.payment_failed
```

### Verify Webhook Working
```bash
# Check webhook log
psql $DATABASE_URL -c "SELECT * FROM webhook_log ORDER BY created_at DESC LIMIT 5;"
```

---

## 8. PHONE DEPLOYMENT

See `PHONE_LAUNCH_GUIDE.md` for Samsung A10 / Infinix specific guide.

Quick summary:
1. Termius → SSH Contabo
2. `cd /opt/dunazoe/apps/core && docker-compose up -d`
3. Browser → `dunazoe.com/deploy` → Audit → Deploy
4. Namecheap → DNS → A records
5. `certbot --nginx -d dunazoe.com -d www.dunazoe.com`

---

## 9. SCALING PROCEDURE

### Scale Up (Contabo → better VPS)
```
1. POST /deployment/deploy { "hosting_provider": "contabo", "environment": "production" }
2. Follow generated steps
3. Verify: docker-compose ps (all Up)
4. Update DNS if IP changes
```

### Activate Features as Traffic Grows
```
Wallet:   auto at 100 users (Activation Engine)
Chat:     auto at 50 vendors
Marketing: auto at 1,000 users
Thrift:   manual (fix loan ledger first)
```

---

*Generated: 2026-06-15 — DUNAZOE Chief Production Auditor*
