# WORKFLOW_STATUS.md — Phase 25
## DUNAZOE Workflow Activation | 2026-06-17

## STATUS: 2/2 workflows configured

---

## REPLIT WORKFLOWS

### Workflow 1: Deployment AI Control Center — RUNNING
- Type: webview (port 5000)
- Command: node server.js
- Status: LIVE — open Replit browser to see UI
- Tabs: Dashboard, Console, Wizard, Health, Secrets, Credits, GitHub

### Workflow 2: DUNAZOE Gateway — CONFIGURED (start after secrets set)
- Type: console (port 3000)
- Command: bash scripts/start-all-services.sh
- Status: Ready — awaiting secrets before first start
- Starts ALL 10 services (one workflow = maximum credit efficiency)

---

## SERVICES STARTED BY WORKFLOW 2

| # | Service | Port | Path |
|---|---|---|---|
| 1 | API Gateway | 3000 | apps/core/gateway/index.js (foreground) |
| 2 | Auth Service | 4001 | apps/core/services/auth-service/index.js |
| 3 | User Service | 4002 | apps/core/services/user-service/index.js |
| 4 | Payment Service | 4006 | apps/core/services/payment-service/index.js |
| 5 | Order Service | 4005 | apps/core/services/order-service/index.js |
| 6 | Notification Service | 4010 | apps/core/services/notification-service/index.js |
| 7 | Reliability Service | 4025 | apps/core/services/reliability-service/index.js |
| 8 | Deployment AI | 4027 | apps/core/services/deployment-ai-service/index.js |
| 9 | Feature Flags | 4028 | apps/core/services/feature-flag-service/index.js |
| 10 | Frontend (Next.js) | 3001 | apps/core/frontend (npm run dev) |

---

## CREDIT OPTIMIZATION NOTE
Running all services in ONE workflow uses ~70% fewer credits vs 10 separate workflows.
Each Replit workflow has overhead. One orchestrator = one overhead unit.

## START COMMAND (after secrets set)
Click "DUNAZOE Gateway" workflow → Start
OR run: bash scripts/start-all-services.sh

## SERVICE LOGS
After starting: tail -f logs/<service-name>.log
