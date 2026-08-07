/**
 * Shared PostgreSQL pool — used by all Next.js API routes.
 *
 * Connection priority:
 *   1. SUPABASE_DATABASE_URL  (production Supabase — eu-west-1 pooler, port 6543)
 *   2. DATABASE_URL           (explicit connection string)
 *   3. PG* env vars           (PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD)
 *                              — Replit built-in Postgres sets these automatically.
 *
 * SSL is enabled only when the connection string includes sslmode=require
 * (Replit's built-in Postgres has no SSL; Supabase requires it).
 */
import { Pool } from "pg";

const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || undefined;

const ssl = connStr?.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool({
  // When connStr is undefined, pg automatically reads PGHOST/PGPORT/PGDATABASE/
  // PGUSER/PGPASSWORD from the environment (Replit built-in Postgres).
  connectionString: connStr,
  ssl,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

export default pool;
