# REPLIT DEPLOYMENT REPORT
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  
**Target:** Replit Autoscale (Level 1 — Beta only)  

---

## DEPLOYMENT STRATEGY: REPLIT FIRST

**Why Replit first, not Contabo:**
- Instant SSL (no Certbot needed)
- Auto-scales to handle traffic spikes
- Zero server management
- Fastest path to real users
- Easy rollback via Replit checkpoint

**Move to Contabo ONLY after:** 50 orders + 20 payouts + 72h stable

---

## REPLIT DEPLOYMENT STEPS

### 1. Set Secrets in Replit
Replit → 🔐 Secrets → add all 17 variables from `FINAL_ENV_REPORT.md`

### 2. Configure Workflow (Frontend)
Create workflow:
```
Name: DUNAZOE Frontend
Command: cd apps/core/frontend && npm install && npm run build && npm start
Port: 5000
Auto-restart: ON
```

### 3. Configure Workflow (Gateway)
```
Name: DUNAZOE Gateway
Command: cd apps/core/gateway && npm install && node index.js
Port: 3000
Auto-restart: ON
```

### 4. Configure Workflow (Each Service)
For each of the 33 services, create a workflow:
```
Command: cd apps/core/services/[service-name] && npm install && node index.js
Port: [see port map]
```

> 💡 Replit Autoscale handles port assignment. Use `process.env.PORT`.

### 5. Deploy via Replit
- Click **Deploy** → **Autoscale**
- Or: **Deploy** → **Reserved VM** (for always-on)
- Wait for health check: `https://[your-repl].replit.app/health`

---

## SMOKE TEST SEQUENCE

After deploy, test in this exact order:

| # | Test | URL | Expected |
|---|---|---|---|
| 1 | Health | `/health` | `{"status":"ok"}` |
| 2 | Products | `/products?limit=5` | JSON array |
| 3 | Register | `/register` | Form renders |
| 4 | Create user | POST `/auth/register` | JWT returned |
| 5 | Login | POST `/auth/login` | JWT + role |
| 6 | Wallet | GET `/wallets/balance` | Balance (0) |
| 7 | Deploy dashboard | `/deploy` | Admin login → scores |
| 8 | Monitor | `/deploy/monitor` | Live vitals |
| 9 | Activation | GET `/activation/features` | 15 features listed |
| 10 | PWA | Chrome → Add to Home Screen | DUNAZOE icon appears |

---

## BETA CONFIGURATION

| Setting | Value |
|---|---|
| Max vendors (beta) | 10 |
| Max users (beta) | 100 |
| Max products (beta) | 500 |
| Features ON at launch | payments, kyc, cybersecurity_ai, notification_ai |
| Features OFF (auto-activate) | wallet (100 users), express (1 intercity order) |
| Features OFF (manual gate) | thrift, loans, shareholder |
| Public URL | `https://[repl-name].replit.app` |
| Admin panel | `/deploy` |
| Monitor | `/deploy/monitor` |

---

## REPLIT AUTOSCALE LIMITS (Free/Hacker Tier)

| Resource | Limit | DUNAZOE Need |
|---|---|---|
| RAM | 2GB | ~2.5GB (33 services) |
| vCPU | Shared | OK for beta |
| Storage | 1GB code | OK |
| Bandwidth | 100GB/mo | OK for 100 users |

> ⚠️ RAM constraint: For full 33-service stack, use Replit Pro or Reserved VM (2GB+). For beta with core services only, standard tier works.

**Recommended beta config on Replit:** Run only core services (gateway + auth + payment + product + order + escrow + notification). Use activation engine to keep other services OFF.

---

## ROLLBACK ON REPLIT

If anything breaks:
1. Replit → History → find last checkpoint
2. Click Restore
3. Verify: `GET /health`

Last stable checkpoints:
- `4300e500` — Activation engine added (current)
- `f93122b0` — PWA icons + deploy dashboard
- `a7d16079` — Register page + SW registration

---

*Generated: 2026-06-15 — DUNAZOE Chief DevOps Lead*
