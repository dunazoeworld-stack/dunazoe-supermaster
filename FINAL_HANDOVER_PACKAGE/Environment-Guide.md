# ENVIRONMENT GUIDE
**Project:** DUNAZOE Supermaster v1.0.0-RC1

---

## WHERE TO SET SECRETS

### Replit
Replit sidebar → 🔐 Secrets → Add each key/value pair

### Contabo
```bash
nano /opt/dunazoe/apps/core/.env.docker
# Add KEY=value per line
```

---

## COMPLETE ENVIRONMENT VARIABLE LIST

### Database (REQUIRED)
```
DATABASE_URL=postgresql://user:pass@host:5432/dunazoe_db
```
Generate: Use your Replit PostgreSQL URL or external Supabase/Railway URL.

### Authentication (REQUIRED)
```
JWT_SECRET=[generate: openssl rand -hex 32]
INTERNAL_SECRET=[generate: openssl rand -hex 32 — DIFFERENT from JWT_SECRET]
```
These must be ≥64 characters. Keep them secret. Changing them invalidates all sessions.

### Payments (REQUIRED for live payments)
```
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_WEBHOOK_SECRET=[from Paystack dashboard → Settings → API & Webhooks]
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

### Cache + Queue (REQUIRED)
```
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

### Media Storage (REQUIRED for uploads)
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_secret_here
```
Get from: cloudinary.com → Dashboard

### SMS (REQUIRED for notifications)
```
TERMII_API_KEY=TL_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```
Get from: termii.com → API Keys

### Logistics (Optional — needed for shipment tracking)
```
SHIPBUBBLE_API_KEY=your_key_here
```

### Application (REQUIRED)
```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://[your-repl].replit.app
FRONTEND_URL=https://[your-repl].replit.app
ALLOWED_ORIGINS=https://[your-repl].replit.app
```

### Optional Business Config (defaults exist in code)
```
COMMISSION_RATE=0.05
ESCROW_RELEASE_HOURS=72
FRAUD_MAX_ORDERS_PER_DAY=50
```

---

## HOW TO GENERATE SECRETS

```bash
# Generate JWT_SECRET (run this, copy the output)
openssl rand -hex 32

# Generate INTERNAL_SECRET (run again for a DIFFERENT value)
openssl rand -hex 32
```

Example output (DO NOT use these):
```
a3f9b8c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0a3f9b8c2d1e4f5a6
```

---

## WHAT HAPPENS IF A SECRET IS MISSING

Each service uses `shared/envValidator.js`. If a critical secret is missing, the service throws:
```
FATAL: Required environment variable [NAME] is not set. 
Cannot start [service-name].
```

This is intentional — a service running with missing secrets is more dangerous than a service that refuses to start.

---

## SECRET ROTATION (If Compromised)

1. Generate new value: `openssl rand -hex 32`
2. Update in Replit Secrets (or `.env.docker`)
3. **Restart all services** — changing JWT_SECRET invalidates all sessions
4. Notify users to re-login
5. Update in Paystack/Stripe dashboard if payment keys changed

---

*DUNAZOE Environment Guide v1.0.0-RC1 — 2026-06-16*
