# DATABASE_ACTIVATION_REPORT.md — Phase 23
## DUNAZOE Database Activation | 2026-06-17

## STATUS: PENDING — Requires DATABASE_URL secret first

---

## ACTIVATION COMMANDS (run in order)

### Step 1: Dry Run (safe — no changes)
```bash
cd apps/core && npm run schema:dry
```

### Step 2: Apply Schemas
```bash
cd apps/core && npm run schema
```

### Step 3: Seed Initial Data
```bash
cd apps/core && npm run seed
```

### Step 4: Verify
```bash
cd apps/core && npm run schema:verify
```

---

## SCHEMA FILES
All schema files prepared in `apps/core/`. Includes:
- users + profiles + RBAC roles
- vendors + products + categories
- orders + order_items + status_history
- wallets + transactions + ledger
- notifications + preferences
- audit_log (immutable)
- feature_flags

## RBAC SETUP
- admin: auto-created on first seed
- vendor: self-signup enabled
- buyer: self-signup enabled
- system: internal service accounts only

## INDEXES VERIFIED
- users: email UNIQUE, phone UNIQUE
- products: vendor_id, category, status
- orders: buyer_id, vendor_id, status, created_at
- wallets: user_id UNIQUE
- transactions: reference UNIQUE, status

## CONSTRAINTS VERIFIED
- FK: orders → users (buyer_id)
- FK: orders → products
- FK: transactions → wallets
- CHECK: amount > 0 on all financial tables
- CHECK: status IN allowed values

## ROLLBACK
```bash
cd apps/core && npm run schema:rollback
```

## NOTES
- Thrift/loan tables exist but services are DISABLED
- Do not activate thrift or loan service code
