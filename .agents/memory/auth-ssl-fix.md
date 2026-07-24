---
name: Auth SSL Fix
description: Why all DB/auth routes use conditional SSL and what broke before
---

# Conditional SSL for PostgreSQL on Replit

## The Rule
Every `new Pool(...)` in Next.js API routes must use:

```js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false,
});
```

**Never** hardcode `ssl: { rejectUnauthorized: false }`.

**Why:** Replit's built-in PostgreSQL does **not** support SSL connections. Hardcoding SSL causes `"The server does not support SSL connections"` and a 500 on every auth/DB endpoint. External DBs (Neon, Supabase, Railway) include `sslmode=require` in their connection string, so the conditional correctly enables SSL for them.

**How to apply:** Any new route that creates a `new Pool(...)` must use this pattern. Affected files as of July 2026: all 8 auth routes + wallet/balance + admin/stats + products/[id].

## Also fixed in this session
- `params` in Next.js 16 App Router client components is a Promise — use `React.use(params)` to unwrap. Direct destructuring resolves to `undefined` silently in dev but crashes in prod.
- `DATABASE_URL` is available to workflow processes (Next.js, Node microservices) via Replit Secrets. It is NOT available to interactive shell commands or `node -e` called from bash. `psql "$DATABASE_URL"` works in shell only because the Replit agent proxies the expansion; `[ -n "$DATABASE_URL" ]` returns false in pure bash.
