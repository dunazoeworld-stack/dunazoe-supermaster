# FINAL RISK MATRIX
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-15  

---

## Risk Matrix

| ID | Risk | Likelihood | Impact | Score | Mitigation |
|---|---|---|---|---|---|
| R-01 | Secrets not set before deploy — gateway throws | HIGH (if rushed) | CRITICAL | 🔴 HIGH | Follow `FINAL_DEPLOYMENT_CHECKLIST.md` in order |
| R-02 | Database migrations not run — services crash on first query | MEDIUM | CRITICAL | 🔴 HIGH | Run all 5 schema files before starting services |
| R-03 | JWT in localStorage — XSS token theft | LOW (no XSS vectors currently) | HIGH | 🟡 MEDIUM | Deferred to Sprint 2 — HttpOnly cookie migration |
| R-04 | Loan ledger double-entry bug — same account | LOW (loan OFF at launch) | CRITICAL | 🟡 MEDIUM | Loan/thrift features held until fixed |
| R-05 | dunazoe-express `idGenerator` path wrong at runtime | LOW | MEDIUM | 🟡 MEDIUM | Verify `shared/identity/idGenerator.js` exists at first run |
| R-06 | Paystack/Stripe webhook secret not set — payments process unverified | MEDIUM | CRITICAL | 🔴 HIGH | Both secrets required before enabling payments |
| R-07 | Redis unavailable — feature flags fail open (all flags ON) | MEDIUM | MEDIUM | 🟡 MEDIUM | Redis required — provision before deploy |
| R-08 | RabbitMQ unavailable — notification queue drops silently | MEDIUM | MEDIUM | 🟡 MEDIUM | RabbitMQ required — provision before deploy |
| R-09 | DNS propagation delay — site unreachable for up to 48h | CERTAIN (on DNS change) | LOW | 🟢 LOW | Expected — inform beta users of window |
| R-10 | Cloudinary not configured — product images broken | MEDIUM | MEDIUM | 🟡 MEDIUM | 3 Cloudinary secrets required |
| R-11 | VPS under-resourced (<4GB RAM) — OOM kills services | MEDIUM | HIGH | 🟡 MEDIUM | Use min 4GB RAM VPS for full stack |
| R-12 | Docker containers don't restart after VPS reboot | MEDIUM | MEDIUM | 🟡 MEDIUM | `restart: unless-stopped` in docker-compose — already set |
| R-13 | Mobile users can't install PWA — icon files missing | HIGH (icons not created yet) | MEDIUM | 🟡 MEDIUM | Add `icon-192.png` + `icon-512.png` to `public/` |

---

## Risk Actions

### Must Resolve Before Go-Live (🔴 HIGH)

| Risk | Action |
|---|---|
| R-01 | Set all 17 secrets before starting services |
| R-02 | Run 5 schema files against production database |
| R-06 | Set PAYSTACK_WEBHOOK_SECRET + STRIPE_WEBHOOK_SECRET |

### Resolve Within 48h of Launch (🟡 MEDIUM)

| Risk | Action |
|---|---|
| R-03 | Sprint 2: Migrate login/register to HttpOnly cookie |
| R-04 | Fix loan ledger before activating thrift |
| R-05 | Confirm `shared/identity/idGenerator.js` path at first start |
| R-07 | Provision Redis before deploy |
| R-08 | Provision RabbitMQ before deploy |
| R-10 | Set 3 Cloudinary environment variables |
| R-11 | Confirm VPS has ≥4GB RAM |
| R-13 | Create and place `icon-192.png` + `icon-512.png` in `public/` |

### Accept (🟢 LOW)

| Risk | Accepted Because |
|---|---|
| R-09 | Normal DNS propagation — not a system failure |

---

## Overall Risk Rating: MEDIUM → LOW after pre-deploy checklist complete

---

*Generated: 2026-06-15 — DUNAZOE CTO / SRE Lead*
