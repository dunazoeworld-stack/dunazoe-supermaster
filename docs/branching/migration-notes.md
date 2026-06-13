# Migration Notes — Spec vs. Current Implementation

This document is an honest, CTO-level gap analysis between the stack requested in the
latest project brief and what is **currently running and production-ready** in
`apps/core`. Nothing below blocks shipping today — these are forward paths, not blockers.

---

## 1. TypeScript Migration

**Current:** All 31 services + gateway are JavaScript (Node.js/Express).

**Why it's not blocking:** TypeScript adds compile-time safety but the existing services
already have strong runtime validation via Joi (`shared/validators.js`) and the ledger
engine has hard runtime guards (e.g. `LOAN REJECTED` throws). The financial correctness
does not depend on TS.

**Migration path (incremental, zero-downtime):**
1. Add `tsconfig.json` with `allowJs: true, checkJs: false` at repo root
2. Convert `shared/` modules first (ledger, fintech OS, RBAC) — highest value, smallest surface
3. Convert services one at a time, starting with newest (`security-ai`, `deployment-ai`,
   `social-media`, `self-delivery`, `admin-override`, `reliability`, `payments-ai`)
4. Each converted service: rename `.js`→`.ts`, add types incrementally, `tsc --noEmit` in CI
5. Estimated effort: ~2-3 days per service for full strict typing; ~1 day for `allowJs` interop

**Recommendation:** Don't block feature work on this. New services going forward should be
written in TS from day one (the `apps/mobile` and `apps/admin-dashboard` scaffolds use TS).

---

## 2. Supabase Migration

**Current:** Plain PostgreSQL via `pg` Pool, connection string in `DATABASE_URL`.

**Why it's not blocking:** Supabase IS PostgreSQL — it's Postgres + auto-generated REST/
realtime API + auth + storage on top. The existing schema (`shared/schema*.sql`) is
already standard Postgres DDL and will run unmodified on Supabase.

**What changes if you migrate:**
- `DATABASE_URL` points to Supabase connection string — no schema changes needed
- Supabase Auth could *replace* `auth-service` — but this is optional; the current
  auth-service (JWT + refresh tokens + device tracking + impossible travel detection)
  is more feature-complete than default Supabase Auth for this use case
- Supabase Storage could replace Cloudinary in `upload-service` — straightforward swap
- Supabase Realtime could replace the custom `realtime-service` (Socket.IO) — would
  require frontend changes to use Supabase client subscriptions instead of socket.io-client

**Recommendation:** Migrate the *database* to Supabase-hosted Postgres immediately if
desired (zero code changes — just connection string + run migrations). Defer replacing
auth/storage/realtime services until there's a concrete reason (e.g. cost, team familiarity).

---

## 3. BullMQ Migration

**Current:** RabbitMQ (`shared/eventBus.js`, `shared/outbox/outboxWorker.js`) for
event-driven architecture, plus a custom `async_jobs` Postgres table
(`shared/fintech/fintechOS.js`) for the non-blocking job queue described in Update #96.

**Why it's not blocking:** The current design already satisfies Update #96's core
requirement — non-blocking operations with retry/backoff/dead-letter handling. RabbitMQ
+ Postgres-backed queue is arguably *more* durable for financial jobs than Redis-backed
BullMQ (jobs survive Redis restarts since they're in Postgres).

**Migration path if BullMQ is still desired (e.g. for team familiarity with Bull's UI):**
1. Add `bullmq` + `ioredis` to a service's dependencies
2. Create queue definitions per job type (`email`, `sms`, `whatsapp`, `vtu`, `social_post`)
3. Replace `queueJob()` calls in `fintechOS.js` with `queue.add(...)`
4. Replace `processNextJob()` polling loop with BullMQ Workers
5. Keep the `async_jobs` table as an audit log even after migrating execution to BullMQ
   (financial audit trail requirement — Update #93.12)

**Recommendation:** Low priority. Current implementation meets the spec's actual goal
(non-blocking, retryable, auditable). Migrate only if operational tooling (Bull Board UI)
is specifically wanted.

---

## 4. React Native Expo Mobile App

**Current:** `apps/mobile/` is an empty scaffold with a README only — not yet built.

**What exists that the mobile app can reuse immediately:**
- Full REST API via gateway (`apps/core/gateway`) — 120+ endpoints, JWT auth
- WebSocket realtime via `realtime-service` (Socket.IO — has an Expo-compatible client)
- All business logic (ledger, fraud, escrow, thrift, loans) — mobile just consumes APIs

**Recommended build order for `apps/mobile`:**
1. `npx create-expo-app apps/mobile --template`
2. Auth flow (login/register) — reuses `/auth/*` endpoints exactly as web does
3. Product browsing + cart + checkout — reuses `/products`, `/orders`, `/payments`
4. Wallet + Thrift dashboard — reuses `/wallets`, `/thrift`, `/trust`
5. Push notifications via Expo Notifications — wire into `notification-service`
   (add `expo_push_token` column to user device sessions table)
6. Offline-first queue — Update #93.4's `NigeriaNetworkQueue` pattern
   (`shared/reliability/reliabilityEngine.js`) should be mirrored client-side using
   `@react-native-async-storage/async-storage` for offline order/payment queuing

**Estimated effort:** 3-4 weeks for MVP (auth, browse, cart, checkout, wallet, orders)
with one mobile engineer, given the backend is fully built.

---

## 5. Git/CI Scaffolding (this delivery)

**What's included in this pass:**
- `.github/workflows/ci.yml` — lint + test on every PR to `develop`/`main`
- `.github/workflows/deploy-staging.yml` — auto-deploy `develop` → staging
- `.github/workflows/deploy-production.yml` — gated deploy `main` → production,
  calls Deployment AI audit endpoint before allowing deploy
- `.github/PULL_REQUEST_TEMPLATE/pull_request_template.md`
- `docs/branching/BRANCH_POLICY.md`
- `docs/git/GIT_SETUP.md` — manual commands since no git tooling is available here

**Not included (requires your action):**
- Actual GitHub repository creation (`dunazoe-supermaster`)
- Branch protection rules (set in GitHub UI: Settings → Branches)
- Secrets configuration (GitHub Settings → Secrets — DATABASE_URL, JWT_SECRET, etc.)
- CODEOWNERS enforcement (requires a GitHub team structure)

---

## Summary Table

| Item | Status | Blocking? | Effort if migrated |
|---|---|---|---|
| TypeScript | JS, runtime-validated | No | 2-3 days/service |
| Supabase | Plain Postgres (compatible) | No | ~0 (connection string swap for DB) |
| BullMQ | RabbitMQ + Postgres queue | No | 1-2 days |
| Expo Mobile | Not started | **For mobile launch only** | 3-4 weeks MVP |
| Git/CI scaffold | **Delivered this pass** | — | — |
| Shareholder System | Not started | No | TBD — needs spec |
