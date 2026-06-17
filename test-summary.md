# TEST SUMMARY
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-16  
**Phase:** 14 — Automated Testing  

---

## TEST SUITE: smoke-tests/index.js

### Run Command
```bash
chmod +x smoke-tests/run.sh
./smoke-tests/run.sh https://[your-repl].replit.app
```

### Pass Threshold: 95%

---

## TEST CASES

| ID | Test | Expected | Status |
|---|---|---|---|
| T01 | Gateway `/health` | `{"status":"ok"}` | ⬜ |
| T02 | Auth service `:4001` | `{"status":"ok"}` | ⬜ |
| T03 | Payment service `:4015` | `{"status":"ok"}` | ⬜ |
| T04 | Order service `:4006` | `{"status":"ok"}` | ⬜ |
| T05 | User registration | 201 + JWT | ⬜ |
| T06 | User login + JWT | 200 + token | ⬜ |
| T07 | Vendor registration | 201 + business_name | ⬜ |
| T08 | Product listing | 200 + array | ⬜ |
| T09 | Product create | 201 or 403 (role) | ⬜ |
| T10 | Order create | 201 or 422 (validation) | ⬜ |
| T11 | Payment initialize | 200 + authorization_url | ⬜ |
| T12 | Wallet balance | 200 or 404 (feature OFF) | ⬜ |
| T13 | Notification send | 200 or 403 | ⬜ |
| T14 | Deployment AI status | 200 or 401 | ⬜ |
| T15 | Activation features | 200 + array | ⬜ |
| T16 | Deploy monitor API | 200 or 401 | ⬜ |

**Fill in status after running:** ✅ PASS / ⚠️ WARN / ❌ FAIL

---

## LOAD TEST SIMULATION

For 100 / 500 / 1,000 concurrent users, use:

```bash
# Install artillery (lightweight load tester)
npx artillery quick --count 100 --num 10 https://[repl].replit.app/health

# 100 users
npx artillery quick --count 100 --num 5 https://[repl].replit.app/products

# 500 users (beta threshold — monitor RAM closely)
npx artillery quick --count 500 --num 10 https://[repl].replit.app/health

# 1000 users — run only on Contabo, not Replit
```

**Replit RAM limit:** Do not exceed 500 concurrent requests on free tier.

---

## RESULTS TEMPLATE

| Metric | Target | Actual | Status |
|---|---|---|---|
| Smoke tests passed | ≥95% | —% | ⬜ |
| 100-user load p95 | <500ms | —ms | ⬜ |
| 500-user load p95 | <1s | —ms | ⬜ |
| Error rate (load) | <1% | —% | ⬜ |
| Gateway uptime | 100% | —% | ⬜ |
| Payment success rate | ≥98% | —% | ⬜ |

---

## WHAT TO DO IF TESTS FAIL

| Failure | Likely Cause | Fix |
|---|---|---|
| T01 Gateway 502 | Service not started | Check workflow is running |
| T05 Register 500 | Missing JWT_SECRET | Set in Replit Secrets |
| T05 Register 400 | DB schema not migrated | Run schema files |
| T11 Payment 401 | PAYSTACK_SECRET_KEY missing | Set in Replit Secrets |
| T15 Activation 404 | activation-engine not started | Start workflow |
| Load test OOM | Too many services running | Use docker-compose.beta.yml or override |

---

*Generated: 2026-06-16 — DUNAZOE QA Lead*
