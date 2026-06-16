# RELEASE LOCK — DUNAZOE v1.0.0-rc1
**Status:** 🔒 LOCKED  
**Date:** 2026-06-15  
**Authority:** CTO + Chief Release Manager  

---

## ARCHITECTURE IS FROZEN

Effective immediately, the following are **permanently locked** until v1.1.0 planning:

### LOCKED — No Changes Permitted

| Item | Status |
|---|---|
| API Routes | 🔒 LOCKED — 34 routes in gateway |
| DB Schemas | 🔒 LOCKED — schema.sql + phases 3–10 |
| Service Ports | 🔒 LOCKED — 4001–4033 assigned |
| Microservices | 🔒 LOCKED — 33 services + gateway |
| API Contracts | 🔒 LOCKED — all request/response shapes |
| DB Migrations | 🔒 LOCKED — no new columns/tables until v1.1 |
| Dependencies | 🔒 LOCKED — no new npm packages |
| Gateway SVC Map | 🔒 LOCKED — 33 entries |

### ALLOWED — Only These Changes

| Type | Allowed |
|---|---|
| Bug fixes | ✅ Yes — with PR + deployment-ai audit |
| Security patches | ✅ Yes — immediate, no gate bypass |
| Deployment config | ✅ Yes — .env, docker-compose tweaks |
| Performance fixes | ✅ Yes — caching, query optimization |
| Documentation | ✅ Yes — any .md file |
| Activation Engine state | ✅ Yes — feature ON/OFF via API only |

### BLOCKED — These Will Be Rejected

| Type | Status |
|---|---|
| New microservices | ❌ REJECTED |
| New DB tables | ❌ REJECTED |
| New business features | ❌ REJECTED |
| Schema changes | ❌ REJECTED |
| New API routes | ❌ REJECTED |
| Architecture refactors | ❌ REJECTED |

---

## DEPLOYMENT GATE — ONLY PATH TO PRODUCTION

```
ALL DEPLOYS MUST PASS:
POST /deployment/audit → score ≥95 → POST /deployment/deploy
```

**No direct deployment.** No SSH bypass. No `docker-compose up` without audit first (except emergency rollback).

---

## RELEASE FROZEN AT

| Component | Value |
|---|---|
| Version | v1.0.0-rc1 |
| Services | 33 (gateway + 32 microservices) |
| Frontend pages | 4 (home, login, register, deploy) |
| Active features at launch | payments, kyc, cybersecurity_ai, notification_ai |
| Features behind activation | wallet, thrift, express_delivery, chat, marketing_ai + 8 more |

---

## v1.1.0 PLANNING (NOT NOW — after 72h stable beta)

- HttpOnly cookie for JWT (replace localStorage)
- Loan ledger double-entry fix → activate thrift
- Mobile APK (Expo) scaffold
- Shareholder system spec

---

*Issued: 2026-06-15 — DUNAZOE CTO*  
*This document supersedes all prior feature requests.*
