# SECRETS TEMPLATE
**Project:** DUNAZOE Supermaster v1.0.0-rc1  
**WARNING:** Never commit this file with real values. Use Replit Secrets or .env.docker (gitignored).

---

## .env.docker TEMPLATE

```bash
# ── DATABASE ──────────────────────────────────────────────────────────
DATABASE_URL=postgresql://dunazoe_user:CHANGE_ME@localhost:5432/dunazoe_db
DB_POOL_MIN=2
DB_POOL_MAX=10

# ── AUTHENTICATION ───────────────────────────────────────────────────
JWT_SECRET=GENERATE_WITH_openssl_rand_-hex_32
JWT_EXPIRES_IN=7d
INTERNAL_SECRET=GENERATE_WITH_openssl_rand_-hex_32
BCRYPT_ROUNDS=12

# ── PAYSTACK (NGN payments) ───────────────────────────────────────────
PAYSTACK_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX
PAYSTACK_PUBLIC_KEY=pk_live_XXXXXXXXXXXXXXXXXXXX
PAYSTACK_WEBHOOK_SECRET=COPY_FROM_PAYSTACK_DASHBOARD

# ── STRIPE (USD payments) ─────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXX

# ── REDIS ─────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── RABBITMQ ──────────────────────────────────────────────────────────
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# ── CLOUDINARY ────────────────────────────────────────────────────────
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# ── SMS (Termii) ──────────────────────────────────────────────────────
TERMII_API_KEY=your_termii_key

# ── LOGISTICS (Shipbubble) ────────────────────────────────────────────
SHIPBUBBLE_API_KEY=your_shipbubble_key

# ── APPLICATION ───────────────────────────────────────────────────────
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://dunazoe.com
FRONTEND_URL=https://dunazoe.com
ALLOWED_ORIGINS=https://dunazoe.com,https://www.dunazoe.com

# ── BUSINESS CONFIG (optional — defaults exist in code) ───────────────
COMMISSION_RATE=0.05
ESCROW_RELEASE_HOURS=72
FRAUD_MAX_ORDERS_PER_DAY=50
AGENT_FEE_PCT=0.02
```

---

## HOW TO GENERATE SECRETS

```bash
# Generate JWT_SECRET and INTERNAL_SECRET
openssl rand -hex 32

# Example output (use two separate runs):
# a3f9b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
```

---

## WHERE TO SET THEM

### Replit
Replit sidebar → 🔐 Secrets → add key/value pairs

### Contabo
```bash
nano /opt/dunazoe/apps/core/.env.docker
# Add each line, save with Ctrl+X, Y, Enter
```

---

## WEBHOOK REGISTRATION

### Paystack
1. Paystack Dashboard → Settings → API Keys & Webhooks
2. Webhook URL: `https://dunazoe.com/payments/webhook/paystack`
3. Copy the webhook secret → `PAYSTACK_WEBHOOK_SECRET`

### Stripe
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. Endpoint URL: `https://dunazoe.com/payments/webhook/stripe`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy signing secret → `STRIPE_WEBHOOK_SECRET`

---

*Template: 2026-06-16 — DUNAZOE Chief Security Engineer*  
*This file contains NO real secrets. All values are placeholders.*
