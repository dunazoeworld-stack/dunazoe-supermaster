---
name: DUNAZOE Supermaster Architecture
description: Key decisions, port map, and durable constraints for the DUNAZOE platform — frozen at v1.0.0-rc1
---

# DUNAZOE Architecture — Durable Facts

**Why:** Architecture is frozen at v1.0.0-rc1 by CTO order. All future work is DevOps/deployment/activation — no new business features.

## Port Map
- gateway: 3000
- frontend: 3001/5000
- auth: 4001, user: 4002, vendor: 4003, product: 4004, inventory: 4005
- order: 4006, escrow: 4007, fraud: 4008, wallet: 4009, thrift: 4010
- trust: 4011, loan: 4012, commission: 4013, ai: 4014, payment: 4015
- dispute: 4016, notification: 4017, logistics: 4018
- flags: 4019, upload: 4020, realtime: 4021, search: 4022, kyc: 4023
- reconciliation: 4024, reliability: 4025, security-ai: 4026, deployment-ai: 4027
- self-delivery: 4028, admin-override: 4029, social-media: 4030, payments-ai: 4031
- dunazoe-express: 4032 (NOT 4027 — that's deployment-ai), activation-engine: 4033

## Critical Fixes Applied (all sessions)
- JWT_SECRET: throws on missing — no fallback
- dunazoe-express: port was 4027 (collision with deployment-ai) → fixed to 4032
- shared/identity/idGenerator.js: was MISSING — created (dunazoe-express requires it)
- axios was missing from dunazoe-express/package.json — added
- register/page.jsx was missing — created
- Service worker not registered — added to homepage

## Features OFF at launch
- thrift: loan ledger double-entry bug (DEBIT+CREDIT to same account 1001)
- loans: CBN compliance review needed
- shareholder_system: no spec

**How to apply:** Before any code change, check this port map. Before adding a feature, check if architecture-is-frozen rule applies.

## Key Files
- Gateway: `apps/core/gateway/index.js` (33 services in SVC map)
- Activation Engine: `apps/core/services/activation-engine/index.js` (port 4033, 15 features tracked)
- Deploy Dashboard: `apps/core/frontend/src/app/deploy/page.jsx`
- Phone guide: `PHONE_LAUNCH_GUIDE.md`, `DEPLOY_FROM_PHONE.md`
- Gate report: `DEPLOYMENT_FINAL_GATE.md`

## Deployment AI is Master Control
- ALL deploys must go through `POST /deployment/audit` → `POST /deployment/deploy`
- Thresholds: security≥95, reliability≥95, performance≥90, scalability≥85, readiness≥90
- 72-hour post-deploy monitoring auto-starts after deploy
