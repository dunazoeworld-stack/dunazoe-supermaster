# DUNAZOE — HANDOVER DOCUMENT
**From:** REPLIT4 (Chief DevOps + Release Manager)  
**To:** DUNAZOE Operations Team  
**Version:** v1.0.0-RC1  
**Date:** 2026-06-16  

---

## CURRENT STATE

Everything is built, debugged, and documented. The platform is **code-complete**.

**The operator must complete 5 steps before pressing Deploy.**

---

## 5 OPERATOR STEPS

1. **Set 17 secrets** in Replit Secrets panel (see `HANDOVER_PACKAGE/SECRETS_TEMPLATE.md`)
2. **Run 5 SQL schema files** against the database (`apps/core/shared/schema*.sql`)
3. **Create 10 Replit workflows** (see `REPLIT_GO_LIVE_REPORT.md`)
4. **Register webhooks** — Paystack + Stripe (see `HANDOVER_PACKAGE/SECRETS_TEMPLATE.md`)
5. **Click Deploy → Autoscale** in Replit

---

## KEY PEOPLE / RESPONSIBILITIES

| Role | Responsibility |
|---|---|
| CTO | Final deploy approval. Sign off on GO_NO_GO.md |
| Operations | Set secrets, run schemas, create workflows |
| Vendor Manager | Invite first 10 beta vendors |
| Finance | Monitor first payments in Paystack dashboard |
| Support | Watch /deploy/monitor during 72h beta |

---

## KEY URLS (after deploy)

| Page | URL | Purpose |
|---|---|---|
| Deployment AI | `/deploy` | One-tap deploy/rollback |
| Monitor | `/deploy/monitor` | 72h live health watch |
| Status | `/deploy/status` | All 14 service checks |
| Health | `/deploy/health` | Deep service health |
| Logs | `/deploy/logs` | Audit history |
| Releases | `/deploy/releases` | Version tracker |
| GitHub | `/deploy/github` | Push commands |
| Credits | `/deploy/credits` | RAM/cost savings |
| Checklist | `/deploy/checklist` | Live GO/NO-GO |

---

## KEY FILES

| File | What It Is |
|---|---|
| `GO_NO_GO.md` | Final DECISION: GO |
| `HANDOVER_PACKAGE/PRODUCTION_CHECKLIST.md` | Operator gate — tick all before launch |
| `HANDOVER_PACKAGE/SECRETS_TEMPLATE.md` | `.env.docker` template |
| `HANDOVER_PACKAGE/DEPLOYMENT_GUIDE.md` | Full deploy steps |
| `HANDOVER_PACKAGE/ROLLBACK_GUIDE.md` | 4 rollback methods |
| `FINAL_LAUNCH_CHECKLIST.md` | Quick launch checklist |
| `smoke-tests/run.sh` | Run after deploy to validate |
| `github_release_check.sh` | Run to verify repo is clean |
| `deployment-report.json` | AI audit pre-populated |
| `72h-beta-report.md` | Fill during beta watch |

---

## ROLLBACK (if anything goes wrong)

1. **Fastest:** Replit → History → Restore checkpoint `a20abd7c`
2. **API:** `POST /deployment/rollback` with admin token
3. **Git:** `git checkout v1.0.0` on Contabo
4. **One service:** `docker compose restart [service-name]`

---

## WHAT NOT TO DO

- Do NOT activate thrift or loans (known bugs/compliance)
- Do NOT run `docker compose --build` for all 33 services on Replit (OOM)
- Do NOT commit `.env.docker` to GitHub
- Do NOT deploy to Contabo until 50 orders + 72h stable on Replit

---

## SPRINT 2 BACKLOG (After Beta)

1. JWT → HttpOnly cookie migration
2. Thrift loan ledger fix
3. CBN licence review (loans)
4. Expo mobile APK
5. Load test (1,000 users)
6. Shareholder system spec + build
7. Admin bulk actions

---

*Handover completed: 2026-06-16 — REPLIT4*
