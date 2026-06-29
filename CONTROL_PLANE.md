# CONTROL_PLANE.md
# DUNAZOE — Deployment AI Control Plane

**Generated:** 2026-06-29  
**Version:** v1.0.0-rc1  
**Mode:** PATCH ONLY — Architecture frozen

---

## New Routes

| Route | Phase | Purpose |
|-------|-------|---------|
| `/deploy/studio` | Phase 1 | Build Studio — Import, Analyze, Generate, Deploy |
| `/deploy/assistant` | Phase 2 | Operator Assistant — Beginner/Intermediate/Advanced |
| `/deploy/apis` | Phase 3 | API Control Center — Connect, Validate, Monitor |
| `/deploy/scaling` | Phase 4 | Scale Migration Center — Migration plans |
| `/deploy/portability` | Phase 5 | Portability Mode — Docker, VPS, Standalone |
| `/deploy/features` | Phase 6 | Feature Control Center — Toggle only |
| `/deploy` | Phase 7 | Deployment Engine — Full Validate→Deploy flow |
| `/deploy/self` | Phase 8 | Self Management — Backup, Health, Export |
| `/deploy/github` | Phase 9 | GitHub Integration — Push, Pull, Secrets |

## Updated Routes

| Route | Update |
|-------|--------|
| `/deploy/github` | Added Push/Pull/Secrets/Commands tabs |
| All deploy pages | Updated navigation to include all 12 links |

## API Backend Routes (deployment-ai-service:4027)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/deployment/studio/analyze` | Code/plan analysis |
| POST | `/deployment/studio/proposal` | Generate BUILD_PLAN + CHANGESET |
| GET | `/deployment/assistant/guide` | Generate STEP_GUIDE |
| POST | `/deployment/apis/validate` | Validate provider credentials |
| POST | `/deployment/self/:action` | backup/export/health/restart/restore |
| POST | `/deployment/github/secrets` | Store GitHub credentials |
| POST | `/deployment/github/push` | Push to GitHub |
| POST | `/deployment/github/pull` | Pull from GitHub |
| GET | `/deployment/github` | GitHub status (enhanced) |

## Status

| Component | Status |
|-----------|--------|
| Portable | ✅ YES |
| Build Studio | ✅ READY |
| Operator Assistant | ✅ READY |
| API Center | ✅ READY |
| Feature Control | ✅ READY |
| GitHub Integration | ✅ READY |
| Self Management | ✅ READY |
| Scaling Center | ✅ READY |
| Portability Mode | ✅ READY |
| Publish Ready | ✅ YES (audit must pass first) |

---
*DUNAZOE Deployment AI Control Plane — STOP: Not published automatically*
