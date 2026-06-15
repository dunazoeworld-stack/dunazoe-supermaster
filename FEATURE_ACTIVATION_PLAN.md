# FEATURE ACTIVATION PLAN
**Project:** DUNAZOE Supermaster  
**Date:** 2026-06-15  
**Phase:** 10 — Post Launch  

---

## Features ACTIVE at Go-Live

These are ON from day one. No further action needed.

| Feature | Service(s) | Flag |
|---|---|---|
| Users (register/login/profile) | `auth-service`, `user-service` | Always ON |
| Vendors (registration/dashboard) | `vendor-service` | Always ON |
| Products (listing/search/detail) | `product-service`, `search-service`, `inventory-service` | Always ON |
| Orders + Escrow | `order-service`, `escrow-service` | Always ON |
| Wallet + Ledger | `wallet-service`, `commission-service`, `reconciliation-service` | Always ON |
| Notifications (email/SMS/WhatsApp) | `notification-service` | Always ON |
| Admin system | `admin-override-service` | Always ON |
| KYC | `kyc-service` | Always ON |
| Fraud detection | `fraud-service` | Always ON |
| Payments (Paystack + Stripe) | `payment-service` | Always ON |
| Disputes | `dispute-service` | Always ON |
| Logistics (Shipbubble + GIG) | `logistics-service` | Always ON |
| Trust scoring | `trust-service` | Always ON |

---

## Features HELD — Activation Schedule

### Thrift Savings ← Activate: Week 2–3 post launch

**Prerequisite checklist before activating:**
- [ ] Fix loan disbursement ledger double-entry bug (same account 1001) — see `docs/audit/HANDOFF.md` Task I
- [ ] Load test thrift contribution flow under realistic NGN volume
- [ ] Confirm `AJO_SURCHARGE_PCT` and `THRIFT_MIN` values with Finance
- [ ] Enable feature flag: `THRIFT_ENABLED=true` in `feature-flag-service`

**Activation command:**
```bash
curl -X POST http://localhost:4022/flags/activate \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"flag": "THRIFT_ENABLED", "value": true}'
```

---

### DUNAZOE Express Delivery ← Activate: After index.js is written

**Prerequisite checklist:**
- [ ] Write `apps/core/services/dunazoe-express/index.js` (service logic)
- [ ] Test pickup/delivery flow end-to-end
- [ ] Integrate with logistics-service routing
- [ ] Enable feature flag: `EXPRESS_ENABLED=true`

---

## Features KEPT OFF — Do Not Activate

| Feature | Reason |
|---|---|
| Thrift loans (loan-service activation) | Ledger double-entry bug not yet fixed |
| AI Bank Layer | Excluded from scope — regulatory risk |
| Shareholder System | Not built — no spec implemented |

---

## Feature Flag Service

All feature flags are managed via `feature-flag-service` (`:4022`).

Check current flags:
```bash
curl http://localhost:4022/flags \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

*Generated: 2026-06-15 — DUNAZOE Release Manager (Replit 4)*
