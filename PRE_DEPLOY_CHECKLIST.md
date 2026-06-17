# PRE_DEPLOY_CHECKLIST.md — Phase 21
## DUNAZOE Pre-Deploy Validation | 2026-06-17

### AUDIT RESULT: CONDITIONAL GREEN (4 operator tasks pending)

## CODE AUDIT — ALL GREEN
- [x] 33 microservices — production-ready
- [x] Gateway v4 — JWT, CORS, rate-limits, helmet
- [x] Deployment AI — 8 scripts ready
- [x] Security score: 92/100
- [x] GitHub: SYNCED (Phase 1-20 pushed)
- [x] Thrift/loan services: DISABLED (known bugs, by design)
- [x] Service orchestrator: scripts/start-all-services.sh

## OPERATOR TASKS — BLOCKING DEPLOY
- [ ] Set 17 secrets in Replit Secrets
- [ ] Run: `cd apps/core && npm run schema`
- [ ] Register Paystack webhook in Paystack dashboard
- [ ] Register Stripe webhook in Stripe dashboard

## CREDIT OPTIMIZER RESULT
- Current baseline: ~2.3 credits/hr
- Optimized (Contabo split): ~0.6 credits/hr (73% savings)
- Beta runway (10 users, 30 days): ~50 credits
- All code-level optimizations already active:
  - AI limiter: 30 req/min cap
  - Killswitch cache: 10s TTL
  - Thrift disabled: 0 idle credits
  - Queue-based notifications: async

## LAUNCH GATE
```
BLOCK: Missing 17 secrets
BLOCK: DB schemas not applied
BLOCK: Webhooks not registered
PASS:  Code quality (92/100)
PASS:  Security approval (SECURITY_APPROVAL.md)
PASS:  GitHub fully synced
PASS:  Deployment AI ready (8 scripts)
PASS:  Control center live (port 5000)
PASS:  Service orchestrator ready
```

**VERDICT: DO NOT DEPLOY until 3 blockers are resolved (~40 min)**
