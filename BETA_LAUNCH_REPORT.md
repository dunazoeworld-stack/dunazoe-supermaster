# BETA_LAUNCH_REPORT.md — Phase 26
## DUNAZOE Replit Production Beta | 2026-06-17

## DEPLOY TARGET: REPLIT AUTOSCALE (Replit URL first — NOT Namecheap yet)

---

## REPLIT AUTOSCALE CONFIG
```
Build Command:  cd apps/core/gateway && npm install --production
Start Command:  node apps/core/gateway/index.js
Health Check:   GET /health
Expected:       200 OK
Wait Port:      3000
Scale:          Auto (0→N replicas)
```

## PRE-DEPLOY GATE (all must be GREEN)
- [ ] 17 secrets set in Replit Secrets
- [ ] npm run schema completed successfully
- [ ] Paystack webhook registered
- [ ] Stripe webhook registered
- [ ] Health endpoint returns 200: GET /health

## DEPLOY STEPS
1. Click Deploy in Replit top bar
2. Select Autoscale
3. Confirm build + start commands above
4. Click Deploy
5. Copy the .replit.app URL shown
6. Update ALLOWED_ORIGINS secret to that URL
7. Restart DUNAZOE Gateway workflow
8. Run smoke tests

## EXPECTED BETA URL
`https://<project-name>.replit.app`

## LAUNCH READINESS: 60%
## ETA TO LAUNCH: ~40 min operator work

## POST-LAUNCH (first 72h)
- Monitor: https://<url>/deploy/monitor
- Credits: node deployment-ai/cost-optimizer.js --report
- Health: https://<url>/health
- Logs: Replit → Deployment → Logs tab

## BETA USER PLAN
- Week 1: 10 beta users (invite only)
- Week 2: 50 users (expand if stable)
- Week 3-4: 100 users
- After stable: connect dunazoe.com domain
