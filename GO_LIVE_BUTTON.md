# GO_LIVE_BUTTON.md — Phase 14: Replit Deployment Readiness
  ## Status: READY FOR HUMAN APPROVAL

  ---

  ## PRE-DEPLOY CHECKLIST

  Before clicking Deploy, complete these 4 operator tasks:

  - [ ] Set 17 secrets in Replit Secrets panel
  - [ ] Run: `cd apps/core && npm run schema`
  - [ ] Create 10 Replit workflows (see below)
  - [ ] Register Paystack + Stripe webhooks

  ---

  ## REPLIT AUTOSCALE CONFIG

  ```
  Build Command:   cd apps/core/gateway && npm install --production
  Start Command:   node apps/core/gateway/index.js
  Health Check:    /health
  Health Method:   GET
  Expected Status: 200
  Wait Port:       3000
  ```

  ---

  ## HOW TO DEPLOY

  1. Open Replit → Click **Deploy** (top right)
  2. Select **Autoscale**
  3. Set Build Command above
  4. Set Start Command above
  5. Set Health Check to /health
  6. Add Custom Domain: dunazoe.com (optional at launch)
  7. Click **Deploy**
  8. Wait for health check to pass (usually 30-60 seconds)
  9. Visit https://app.dunazoe.com

  **DO NOT CLICK DEPLOY until all 4 operator tasks are done.**

  ---

  ## 10 REQUIRED WORKFLOWS

  ```
  1. Gateway:      node apps/core/gateway/index.js           port 3000
  2. Frontend:     cd apps/core/frontend && npm run dev       port 3001
  3. Auth:         node apps/core/services/auth-service/...   port 4001
  4. Payments:     node apps/core/services/payment-service/.. port 4006
  5. Wallet:       node apps/core/services/wallet-service/..  port 4009
  6. Orders:       node apps/core/services/order-service/...  port 4005
  7. Deploy AI:    node apps/core/services/deployment-ai-.../. port 4027
  8. Reliability:  node apps/core/services/reliability-svc/.. port 4025
  9. Notify:       node apps/core/services/notification-svc/. port 4010
  10. Features:    node apps/core/services/feature-flags/...  port 4028
  ```

  ---

  ## ENVIRONMENT VARIABLES

  See SECRETS_CHECKLIST.md for all 17 required secrets.

  ---

  ## POST-DEPLOY VERIFICATION

  ```bash
  # Run smoke tests
  node smoke-tests/index.js https://app.dunazoe.com

  # Check all services
  node deployment-ai/environment-checker.js all

  # Run deployment validator
  node deployment-ai/deployment-validator.js

  # Watch dashboard
  node deployment-ai/deployment-dashboard.js --watch
  ```

  ---

  **FINAL VERDICT: READY — PENDING OPERATOR APPROVAL**
  