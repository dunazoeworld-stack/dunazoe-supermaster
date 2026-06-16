# ACTIVATION STATUS
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  
**Service:** Activation Engine (port 4033)  

---

## CURRENT FEATURE STATES AT LAUNCH

| Feature | State | Trigger to Promote | Block Reason |
|---|---|---|---|
| `payments` | 🟢 **ON** | Always | — |
| `kyc` | 🟢 **ON** | Always | — |
| `cybersecurity_ai` | 🟢 **ON** | Always | — |
| `notification_ai` | 🟢 **ON** | Always | — |
| `admin_impersonation` | 🔵 **ADMIN_ONLY** | Always | — |
| `wallet` | ⚫ OFF | 100 users → **ON** (auto) | Awaiting users |
| `express_delivery` | ⚫ OFF | 1 intercity order → **ON** (auto) | Awaiting first delivery |
| `vendor_analytics` | ⚫ OFF | 10 vendors → **BETA** (auto) | Awaiting vendors |
| `chat` | ⚫ OFF | 50 vendors → **BETA** (auto) | Awaiting vendors |
| `social_media_ai` | ⚫ OFF | 500 users → **LIMITED** (auto) | Awaiting users |
| `marketing_ai` | ⚫ OFF | 1,000 users → **ON** (auto) | Awaiting scale |
| `thrift` | ⚫ OFF | Manual approval required | Loan ledger bug |
| `loans` | ⚫ OFF | Manual approval required | CBN compliance |
| `shareholder_system` | ⚫ OFF | Manual approval required | No spec yet |

---

## HOW ACTIVATION WORKS

### Automatic (no human needed)
Activation Engine cron runs every 15 minutes:
1. Queries `users`, `vendors`, `orders` tables for real counts
2. Compares against each feature's trigger threshold
3. If threshold met → promotes feature state
4. Logs to `activation_events` table
5. Available immediately at `GET /activation/features`

### Manual (admin action required)
```bash
# Promote a feature (admin token required)
curl -X POST https://dunazoe.com/activation/features/thrift/activate \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "BETA", "notes": "Loan ledger bug fixed in v1.1.0"}'
```

### Check Current State (public)
```bash
curl https://dunazoe.com/activation/features
```

---

## ACTIVATION ROADMAP

### Week 1 (Beta — 10 vendors, 100 users)
- payments ✅ ON
- kyc ✅ ON
- cybersecurity_ai ✅ ON
- notification_ai ✅ ON

### Week 2 (Growth — wallet auto-activates at user 100)
- wallet → auto-ON at 100 users
- express_delivery → auto-ON after first intercity order
- vendor_analytics → auto-BETA at 10 vendors

### Month 1 (Scale — chat, social, marketing auto-activate)
- chat → BETA at 50 vendors
- social_media_ai → LIMITED at 500 users
- marketing_ai → ON at 1,000 users

### Month 2+ (Manual gates — after compliance/bug fixes)
- thrift → BETA (after loan ledger fix)
- loans → OFF → Legal review needed
- shareholder_system → OFF → Spec needed

---

## ACTIVATION API ENDPOINTS

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/activation/features` | GET | None | List all features + states |
| `/activation/features/:name` | GET | None | Single feature detail + history |
| `/activation/metrics` | GET | JWT | Metric snapshot + pending activations |
| `/activation/evaluate` | POST | admin | Manually trigger evaluation |
| `/activation/features/:name/activate` | POST | admin | Manually set feature state |
| `/activation/history` | GET | JWT | Last 50 activation events |

---

## FEATURE STATE TRANSITIONS (Valid)

```
OFF → BETA → LIMITED → ON
OFF → ON (manual admin override)
ON → OFF (emergency killswitch)
ANY → ADMIN_ONLY (restrict to admin)
ANY → SCALE_ONLY (large traffic only)
```

---

*Generated: 2026-06-15 — DUNAZOE Chief Platform Architect*
