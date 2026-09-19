/**
 * One-time production Superuser bootstrap/reset.
 *
 * This is intentionally an operator command, not a public HTTP endpoint.
 * Supply the token and password through Replit Secrets or the deployment
 * environment; never put either value in source control or command history.
 *
 * Bootstrap:
 *   SUPERUSER_BOOTSTRAP_TOKEN=... SUPERUSER_EMAIL=... \
 *   SUPERUSER_INITIAL_PASSWORD=... node scripts/bootstrap-superuser.mjs bootstrap
 *
 * Reset:
 *   SUPERUSER_RESET_TOKEN=... SUPERUSER_EMAIL=... \
 *   SUPERUSER_NEW_PASSWORD=... node scripts/bootstrap-superuser.mjs reset
 */
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const action = process.argv[2] || "bootstrap";
if (!["bootstrap", "reset"].includes(action)) {
  throw new Error("Usage: node scripts/bootstrap-superuser.mjs <bootstrap|reset>");
}

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required; provide it through Replit Secrets or the deployment environment.`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const email = required("SUPERUSER_EMAIL").toLowerCase();
const token = required(action === "bootstrap" ? "SUPERUSER_BOOTSTRAP_TOKEN" : "SUPERUSER_RESET_TOKEN");
const password = required(action === "bootstrap" ? "SUPERUSER_INITIAL_PASSWORD" : "SUPERUSER_NEW_PASSWORD");

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SUPERUSER_EMAIL must be a valid email address.");
if (token.length < 32) throw new Error("The operator token must be at least 32 characters.");
if (password.length < 12) throw new Error("The Superuser password must be at least 12 characters.");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

try {
  await pool.query("BEGIN");

  // Keep this migration in the operator path so an existing database is
  // upgraded safely instead of relying on schema.sql being rerun manually.
  const constraints = await pool.query(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%role%'
  `);
  for (const row of constraints.rows) {
    await pool.query(`ALTER TABLE users DROP CONSTRAINT ${quoteIdent(row.conname)}`);
  }
  await pool.query(`
    ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('customer','vendor','agent','admin','super_admin','coordinator'))
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS superuser_bootstrap_tokens (
      id SERIAL PRIMARY KEY,
      action TEXT NOT NULL CHECK (action IN ('bootstrap','reset')),
      token_hash TEXT NOT NULL UNIQUE,
      consumed_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  const consumed = await pool.query(
    "SELECT id FROM superuser_bootstrap_tokens WHERE token_hash=$1 LIMIT 1",
    [tokenHash],
  );
  if (consumed.rows[0]) throw new Error("This operator token has already been consumed.");

  const existing = await pool.query(
    "SELECT id, role FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1",
    [email],
  );
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 12));

  if (action === "bootstrap") {
    if (existing.rows[0]) {
      throw new Error("That email already exists. Use the reset action instead; bootstrap will not take over an existing account.");
    }
    await pool.query(
      `INSERT INTO users(name,email,password_hash,role,is_active)
       VALUES($1,$2,$3,'super_admin',TRUE)`,
      ["DUNAZOE Superuser", email, passwordHash],
    );
  } else {
    if (!existing.rows[0]) throw new Error("No account exists for SUPERUSER_EMAIL.");
    await pool.query(
      `UPDATE users
       SET password_hash=$1, role='super_admin', is_active=TRUE, last_seen=NULL
       WHERE id=$2`,
      [passwordHash, existing.rows[0].id],
    );
    // Invalidate every prior login after a reset.
    await pool.query("DELETE FROM sessions WHERE user_id=$1", [existing.rows[0].id]);
  }

  await pool.query(
    "INSERT INTO superuser_bootstrap_tokens(action,token_hash) VALUES($1,$2)",
    [action, tokenHash],
  );
  await pool.query("COMMIT");
  console.log(`Superuser ${action} completed for ${email}. The operator token is now single-use.`);
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await pool.end();
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}