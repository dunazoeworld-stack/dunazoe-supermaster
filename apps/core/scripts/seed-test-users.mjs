import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const roleConfig = [
  ["SUPER_ADMIN", "super_admin"],
  ["ADMIN", "admin"],
  ["VENDOR", "vendor"],
  ["CUSTOMER", "customer"],
  ["DELIVERY_AGENT", "agent"],
];

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required; provide it through Replit Secrets or the development environment.`);
  return value;
}

const databaseUrl = required("DATABASE_URL");
const accounts = roleConfig.map(([label, role]) => ({
  label,
  role,
  email: required(`TEST_${label}_EMAIL`).toLowerCase(),
  password: required(`TEST_${label}_PASSWORD`),
}));

for (const account of accounts) {
  if (account.password.length < 12) throw new Error(`${account.label} password must be at least 12 characters.`);
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

try {
  await pool.query("BEGIN");
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, Number(process.env.BCRYPT_ROUNDS || 12));
    const existing = await pool.query("SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1", [account.email]);
    if (existing.rows[0]) {
      await pool.query(
        "UPDATE users SET password_hash=$1, role=$2, status='active', updated_at=NOW() WHERE id=$3",
        [passwordHash, account.role, existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO users(name,email,password_hash,role,status,phone,whatsapp)
         VALUES($1,$2,$3,$4,'active',$5,$5)`,
        [`DUNAZOE ${account.label.replace("_", " ")}`, account.email, passwordHash, account.role, `080${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`]
      );
    }
  }
  await pool.query("COMMIT");
  console.log(`Seeded ${accounts.length} development accounts: ${accounts.map(account => `${account.role}=${account.email}`).join(", ")}`);
} catch (error) {
  await pool.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await pool.end();
}