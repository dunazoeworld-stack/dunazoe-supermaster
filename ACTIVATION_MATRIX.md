# ACTIVATION MATRIX
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-16  
**Service:** Activation Engine (port 4033)  

---

## PHASE 8 — SAFE FEATURE ACTIVATION

Per CTO order, activate ONLY these at launch:

### ✅ ACTIVATE AT LAUNCH (Always ON)
| Module | Service | Port | State |
|---|---|---|---|
| Users | auth-service | 4001 | 🟢 ON |
| Vendors | vendor-service | 4003 | 🟢 ON |
| Products | product-service | 4004 | 🟢 ON |
| Orders | order-service | 4006 | 🟢 ON |
| Payments | payment-service | 4015 | 🟢 ON |
| Wallet (auto) | wallet-service | 4009 | ⚫ OFF → 🟢 ON at 100 users |
| Ledger / Escrow | escrow-service | 4007 | 🟢 ON |
| Admin | admin-override-service | 4029 | 🔵 ADMIN_ONLY |

### ⚫ KEEP OFF — Do Not Activate

| Module | Service | Port | Reason |
|---|---|---|---|
| Thrift / Ajo | thrift-service | 4010 | Loan ledger DEBIT+CREDIT bug |
| DUNAZOE Express | dunazoe-express | 4032 | Auto-ON after 1st intercity order |
| Shareholder | — | — | No spec exists |
| Marketing AI | ai-service | 4014 | Auto-ON at 1,000 users |
| Banking Layer | loan-service | 4012 | CBN compliance needed |
| Advanced Chat | realtime-service | 4021 | Auto-BETA at 50 vendors |
| Autonomous AI | ai-service | 4014 | Gated — human approval needed |

---

## ACTIVATION TRANSITION MAP

```
Users Registered
    100  → wallet:          OFF → ON    (auto)
    500  → social_media_ai: OFF → LIMITED (auto)
   1000  → marketing_ai:    OFF → ON    (auto)

Vendors Approved
     10  → vendor_analytics: OFF → BETA  (auto)
     50  → chat:             OFF → BETA  (auto)

Orders Placed
      1  → express_delivery: OFF → ON    (auto, intercity orders)

Manual Approval Required
    thrift       → after v1.1.0 loan ledger fix
    loans        → after CBN compliance review
    shareholder  → after product spec
```

---

## HOW TO ACTIVATE (When Conditions Are Met)

```bash
# Check current states (no auth needed)
curl https://dunazoe.com/activation/features

# See what's pending activation
curl https://dunazoe.com/activation/metrics \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Manually trigger condition evaluation
curl -X POST https://dunazoe.com/activation/evaluate \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Force-activate a feature (admin override)
curl -X POST https://dunazoe.com/activation/features/wallet/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "ON", "notes": "Manual override — 100 users reached"}'

# Emergency deactivate
curl -X POST https://dunazoe.com/activation/features/wallet/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "OFF", "notes": "Emergency deactivation"}'
```

---

## ACTIVATION HISTORY

Check what activated when:
```bash
curl https://dunazoe.com/activation/history \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Or check DB:
```sql
SELECT feature_name, old_state, new_state, trigger_metric, 
       triggered_at, notes
FROM activation_events
ORDER BY triggered_at DESC
LIMIT 20;
```

---

## CRON EVALUATION SCHEDULE

The Activation Engine evaluates all triggers every 15 minutes automatically:
- Checks user count against wallet trigger (100)
- Checks order count against express_delivery trigger (1)
- Checks vendor count against chat/analytics triggers
- Logs result to `activation_events` table
- Next evaluation: visible in `GET /activation/metrics`

---

*Generated: 2026-06-16 — DUNAZOE Chief Platform Architect*  
*Do not manually activate thrift, loans, or shareholder without CTO approval.*
