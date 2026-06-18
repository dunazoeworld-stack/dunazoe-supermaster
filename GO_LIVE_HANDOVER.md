# GO_LIVE_HANDOVER.md — Stage 10
## DUNAZOE Final Go-Live Handover | 2026-06-18
## REPLIT5 — All Stages Complete

---

## PRODUCTION DETAILS
```
Platform:      Replit Autoscale
URL:           https://<project>.replit.app (set after deploy click)
Health:        GET /health → 200 OK
Build:         cd apps/core/gateway && npm install --production
Start:         node apps/core/gateway/index.js
Port:          3000
Control Center: http://localhost:5000 (Replit webview)
```

## COMMIT + RELEASE
```
Repository:    dunazoeworld-stack/dunazoe-supermaster
Branch:        main
Phases:        1-30 complete
Files pushed:  30+
Release tag:   v1.0.0-beta (create after first stable deploy)
Tag command:   git tag v1.0.0-beta && git push origin v1.0.0-beta
```

## OPERATOR GUIDE (final ~40 min sequence)

### 1. Set 3 Blocking Secrets (15 min)
```
Replit → 🔒 Secrets:
JWT_SECRET = <generate: openssl rand -hex 32>
PAYSTACK_SECRET_KEY = sk_live_...  (from dashboard.paystack.com)
STRIPE_SECRET_KEY = sk_live_...    (from dashboard.stripe.com)
```

### 2. Run Schema (5 min)
```bash
cd apps/core && npm run schema
```

### 3. Start Services (1 min)
Click "DUNAZOE Gateway" workflow → Start
OR: bash scripts/start-all-services.sh

### 4. Verify Gateway
```bash
curl https://$REPLIT_DEV_DOMAIN/health
# Expected: {"status":"ok"}
```

### 5. Register Webhooks (10 min)
```
Paystack: dashboard.paystack.com → Settings → Webhooks
  URL: https://<replit-url>/api/payments/paystack/webhook
Stripe: dashboard.stripe.com/webhooks
  URL: https://<replit-url>/api/payments/stripe/webhook
```

### 6. Deploy (2 min)
```
Replit → Deploy → Autoscale
Build:  cd apps/core/gateway && npm install --production
Start:  node apps/core/gateway/index.js
Health: /health
→ Click Deploy
```

### 7. Post-Deploy
```bash
node smoke-tests/index.js https://<your-url>.replit.app
```

### 8. Share with Beta Users
Invite first 10 users to https://<your-url>.replit.app

---

## KNOWN ISSUES
| Issue | Severity | Status |
|---|---|---|
| JWT_SECRET fallback active | HIGH | Set JWT_SECRET before sharing URL |
| Thrift/loan service | LOW | Disabled by design — do not activate |
| Payment service warns without secrets | MEDIUM | Set PAYSTACK+STRIPE to resolve |
| CORS allows localhost only | LOW | Set ALLOWED_ORIGINS after deploy |

---

## ROLLBACK PROCEDURE
```bash
# Fastest: Deployment AI
node deployment-ai/rollback-engine.js --to a20abd7c --reason "emergency"

# Alternative: Replit
Replit → History → Restore checkpoint a20abd7c

# Manual: Git
git checkout a20abd7c && git push --force origin main
```

---

## MONITORING (72h post-launch)
```
Health:  https://<url>/health
Deploy:  https://<url>/deploy (Next.js dashboard)
Logs:    Replit → Deployment → Logs
Control: Replit browser (port 5000) → All tabs
```

---

## CREDITS ESTIMATE
```
Beta (10 users, 30 days, optimized):  ~450 credits
Without optimization:                ~1,656 credits
Contabo split saves:                  ~73%
```

---

## NEXT ACTIONS (post-stable beta)
1. Monitor 72h → zero critical errors
2. Expand to 50 beta users
3. Renew Namecheap (see NAMECHEAP_DOMAIN_RECOVERY.md)
4. Connect dunazoe.com domain
5. Generate v1.0.0 production release tag

---

## FINAL STATUS: ✅ LIVE ON REPLIT (pending 3 secret sets + deploy click)
