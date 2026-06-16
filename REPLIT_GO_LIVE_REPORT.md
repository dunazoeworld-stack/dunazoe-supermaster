# REPLIT GO-LIVE REPORT
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-16  
**Target:** Replit Autoscale — Beta only  

---

## GO-LIVE STATUS: ⏸ READY TO EXECUTE

All code is complete. Operator must execute the steps below.

---

## WHY REPLIT FIRST (NOT NAMECHEAP)

| Reason | Detail |
|---|---|
| Namecheap domain expired | Cannot point to Contabo yet |
| Replit = instant HTTPS | No Certbot setup needed |
| Replit = zero server management | No SSH for beta |
| Replit = instant rollback | One-click checkpoint restore |
| Fastest path to real users | Deploy in minutes, not hours |

**Replit URL format:** `https://[repl-name].replit.app`  
**After 50 orders + 72h stable:** Move to Contabo → then renew Namecheap → point DNS.

---

## REPLIT GO-LIVE STEPS

### 1. Set Secrets (5 minutes)
Replit → 🔐 Secrets → add all 17 from `HANDOVER_PACKAGE/SECRETS_TEMPLATE.md`

### 2. Create Core Workflows (10 minutes)
Start these 4 first (priority order):

```
Workflow 1 — Gateway
cd apps/core/gateway && npm install && node index.js
Port: 3000

Workflow 2 — Auth Service  
cd apps/core/services/auth-service && npm install && node index.js
Port: 4001

Workflow 3 — Payment Service
cd apps/core/services/payment-service && npm install && node index.js
Port: 4015

Workflow 4 — Frontend
cd apps/core/frontend && npm install && npm run build && npm start
Port: 5000
```

Then create remaining 29 service workflows.

### 3. Click Deploy → Autoscale
Replit toolbar → Deploy → Autoscale → Configure → Deploy

### 4. Run Smoke Tests

| Test | URL | Expected |
|---|---|---|
| Health | `/health` | `{"status":"ok"}` |
| Homepage | `/` | Products visible |
| Register | `/register` | Form renders |
| Login | `/login` | Works |
| Deploy dashboard | `/deploy` | Admin scores visible |
| Monitor | `/deploy/monitor` | 🟢 HEALTHY + 30s countdown |
| PWA | Chrome install | DUNAZOE icon |

### 5. Payment Dry Run
```bash
curl -X POST https://[repl].replit.app/payments/initialize \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "email": "test@dunazoe.com", "currency": "NGN"}'
```
Expected: `{"success": true, "authorization_url": "https://..."}`

### 6. Notification Dry Run
```bash
curl -X POST https://[repl].replit.app/notifications/send \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "sms", "to": "+2348000000000", "message": "DUNAZOE beta is live!"}'
```

---

## SUCCESS DEFINITION FOR REPLIT BETA

| Metric | Target |
|---|---|
| All health checks pass | 100% |
| Register + login works | 100% |
| First order placed | ≥1 |
| First payment processed | ≥1 |
| 0 critical errors in first 2 hours | 100% |
| `/deploy/monitor` shows 🟢 | 100% |

---

## POST GO-LIVE MONITORING

- Open `/deploy/monitor` on phone — leave tab open
- Polls every 30 seconds automatically
- Green = safe. Yellow = watch closely. Red = investigate or rollback.
- Target: 72 consecutive hours of 🟢

---

*Generated: 2026-06-16 — DUNAZOE Chief DevOps Lead*
