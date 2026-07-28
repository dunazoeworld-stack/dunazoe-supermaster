/**
 * Shared PostgreSQL pool — used by all Next.js API routes.
 *
 * Priority order:
 *   1. SUPABASE_DATABASE_URL  (production Supabase — eu-west-1 pooler, port 6543)
 *   2. DATABASE_URL           (Replit built-in Postgres — dev fallback)
 *
 * SSL is enabled only when the connection string includes sslmode=require
 * (Replit's built-in Postgres has no SSL; Supabase requires it).
 */
import { Pool } from "pg";

const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "";

const ssl = connStr.includes("sslmode=require")
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool({
  connectionString: connStr,
  ssl,
  // Pooler-friendly settings — Supabase transaction pooler resets connections
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

pool.on("error", (err) => {
  console.error("[DB] Pool error:", err.message);
});

export default pool;
