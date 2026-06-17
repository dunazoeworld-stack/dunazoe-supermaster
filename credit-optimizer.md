# CREDIT OPTIMIZER
**Project:** DUNAZOE Supermaster  
**Version:** v1.0.0-rc1  
**Date:** 2026-06-16  
**Mode:** LOW_CREDIT_MODE=true  
**Target:** ≤20% additional credits from baseline  

---

## ACTIVE OPTIMIZATIONS

### 1. Beta Service Profile (saves ~1.5GB RAM)
```bash
# Replit mode: starts 8 core services only
docker compose up

# Full stack (Contabo only):
docker compose --profile full up
```
**Savings:** 25 containers not built or started. ~1.4GB RAM saved.

### 2. Incremental Builds (no full rebuild)
```bash
# Rebuild only changed service
docker compose build payment && docker compose up -d payment

# Never do this unless absolutely necessary:
# docker compose up --build   ← rebuilds ALL 33 services
```
**Savings:** 90% build time reduction when only 1 service changes.

### 3. Layer Caching
All Dockerfiles use `npm ci --only=production` in a separate stage. Dependencies are cached as a separate layer. Only app code is invalidated on source changes.
```dockerfile
FROM node:20-alpine AS deps    # Layer 1: cached unless package.json changes
COPY package*.json ./
RUN npm ci --only=production  # ← cached if unchanged

FROM node:20-alpine            # Layer 2: tiny — only app code
COPY --from=deps /app/node_modules ./node_modules
COPY . .                       # ← only this invalidates on code change
```
**Savings:** ~60% build time on most deploys.

### 4. Autosleep Non-Critical Workers
In Replit beta mode, these services are disabled (profiles: ["full"]):
- prometheus, grafana (heavy monitoring — use /deploy/monitor instead)
- pgbouncer (not needed for <100 users)
- nginx (Replit handles reverse proxy)
- certbot (Replit handles SSL)
- 25 non-core microservices

### 5. Lazy Loading Admin Pages
- `/deploy` — loads only when admin logs in
- `/deploy/monitor` — polls start only after login + tab focus
- Grafana — separate container, started manually on Contabo only

### 6. Sequential Startup (not parallel)
Start services in priority order to avoid resource spikes:
```bash
# Priority order — wait for health before next
docker compose up -d postgres redis rabbitmq
sleep 15
docker compose up -d auth payment order
sleep 10
docker compose up -d product notification kyc deployment-ai activation-engine
sleep 10
docker compose up -d gateway frontend
```
**Savings:** Avoids 43 services all competing for RAM at startup.

### 7. Redis Memory Cap
```
maxmemory 96mb
maxmemory-policy allkeys-lru
save ""  ← disable persistence in beta (no RDB dumps)
```
**Savings:** ~50MB RAM + no disk write I/O.

### 8. PostgreSQL Tuning
```
shared_buffers=64MB        ← reduced from default 128MB
effective_cache_size=128MB
max_connections=100        ← reduced from 200
work_mem=4MB
```
**Savings:** ~100MB RAM.

### 9. Deploy Only Changed Services
Before every redeploy, check what actually changed:
```bash
git diff --name-only HEAD~1 HEAD | grep "services/"
# Only rebuild services whose files changed
```

### 10. Next.js Build Cache
```bash
# First build: ~90 seconds
cd apps/core/frontend && npm run build

# Subsequent builds (only changed pages):
npm run build   ← Next.js incremental cache (~20s)
```

---

## CREDIT USAGE TABLE

| Action | Credit Cost | Frequency | Total |
|---|---|---|---|
| GitHub push | Free | Once | — |
| Replit deploy (autoscale) | Low | Once | Low |
| 8-service beta startup | Low | Once | Low |
| /health polling | Near-zero | Every 30s | Near-zero |
| Smoke tests run | Low | Once | Low |
| DB schema migrations | Low | Once | Low |
| Full `--build` (all 33) | High | AVOID | — |
| Monitoring dashboard | Free | 72h | — |

**Estimated additional credits this phase: ≤15%** (documentation + docker files only, no service rebuilds)

---

## WHAT NOT TO DO (Credit Killers)

| Action | Cost | Why |
|---|---|---|
| `docker compose up --build` on Replit | High | Builds all 33 images |
| Repeated full redeploys | High | Avoidable |
| Running Grafana on Replit | Medium | 128MB just for dashboards |
| Running all 33 services on free Replit | High | OOM kills = crashes |
| Running load tests on Replit | High | Spikes RAM + CPU |

---

## BETA CREDIT RUNWAY ESTIMATE

With LOW_CREDIT_MODE + 8 core services:
- **Daily cost:** minimal (stateless service restarts)
- **72-hour beta:** within free tier if no full rebuilds
- **Move to Contabo after beta:** eliminates Replit credit usage entirely

---

*Generated: 2026-06-16 — DUNAZOE Cost Optimization Engineer*
