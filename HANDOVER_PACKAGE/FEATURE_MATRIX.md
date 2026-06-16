# FEATURE MATRIX
**Project:** DUNAZOE Supermaster v1.0.0-rc1  
**Date:** 2026-06-16  

---

## FEATURE STATES AT LAUNCH

| Feature | State | Port | Auto-Trigger | Manual Gate | Block Reason |
|---|---|---|---|---|---|
| **payments** | 🟢 ON | 4015 | Always | — | — |
| **kyc** | 🟢 ON | 4023 | Always | — | — |
| **cybersecurity_ai** | 🟢 ON | 4026 | Always | — | — |
| **notification_ai** | 🟢 ON | 4017 | Always | — | — |
| **admin_impersonation** | 🔵 ADMIN_ONLY | 4029 | Always | — | — |
| **wallet** | ⚫ OFF → ON | 4009 | 100 users | No | Awaiting users |
| **express_delivery** | ⚫ OFF → ON | 4032 | 1 intercity order | No | Awaiting first order |
| **vendor_analytics** | ⚫ OFF → BETA | 4026/4014 | 10 vendors | No | Awaiting vendors |
| **chat** | ⚫ OFF → BETA | 4021 | 50 vendors | No | Awaiting vendors |
| **social_media_ai** | ⚫ OFF → LIMITED | 4030 | 500 users | No | Awaiting scale |
| **marketing_ai** | ⚫ OFF → ON | 4014 | 1,000 users | No | Awaiting scale |
| **thrift** | ⚫ OFF | 4010 | Manual only | YES | Loan ledger bug |
| **loans** | ⚫ OFF | 4012 | Manual only | YES | CBN compliance |
| **shareholder_system** | ⚫ OFF | — | Manual only | YES | No spec yet |

---

## MODULE CATEGORIES

### Always ON at Launch (Core)
- User registration + login
- Vendor registration + KYB
- Product catalogue + inventory
- Order management + cart
- Escrow (payment hold/release)
- Fraud detection
- KYC verification
- Payment (Paystack NGN + Stripe USD)
- Dispute resolution
- Notifications (SMS + email)
- Logistics (Shipbubble + DHL)
- Upload (Cloudinary)
- Search
- Real-time (WebSocket)
- Deployment AI control panel
- Activation Engine

### Keep OFF (Don't Activate Until Conditions Met)
- **Thrift / Ajo:** Loan ledger records DEBIT+CREDIT to same account (account 1001). Fix before enabling.
- **Loans:** Requires CBN (Central Bank of Nigeria) licence review.
- **Shareholder system:** No product specification written yet.
- **DUNAZOE Express express mode:** Activates automatically after first intercity delivery.

### Activates Automatically (No Human Action Needed)
```
Users → 100  → wallet goes ON
Orders → 1   → express_delivery goes ON
Vendors → 10 → vendor_analytics goes BETA
Vendors → 50 → chat goes BETA
Users → 500  → social_media_ai goes LIMITED
Users → 1000 → marketing_ai goes ON
```

---

## ACTIVATION API QUICK REFERENCE

```bash
# Check all feature states
curl https://dunazoe.com/activation/features

# Check single feature
curl https://dunazoe.com/activation/features/wallet

# Manually activate (admin only)
curl -X POST https://dunazoe.com/activation/features/thrift/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"state": "BETA", "notes": "Loan ledger fixed in v1.1.0"}'

# Trigger evaluation manually (check if auto-conditions met)
curl -X POST https://dunazoe.com/activation/evaluate \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## LAUNCH vs SPRINT 2 FEATURES

| Sprint 1 (NOW) | Sprint 2 (After 72h beta) |
|---|---|
| Auth + registration | JWT HttpOnly cookie |
| Products + orders | Refresh token rotation |
| Payments (NGN + USD) | Thrift loan ledger fix |
| Escrow + fraud | Mobile APK (Expo) |
| KYC + notifications | Shareholder system spec |
| Wallet (auto-ON at 100 users) | Loan CBN review |
| Deployment AI | Admin bulk actions |
| Activation Engine | Full Grafana dashboards |

---

*Generated: 2026-06-16 — DUNAZOE Chief Platform Architect*
