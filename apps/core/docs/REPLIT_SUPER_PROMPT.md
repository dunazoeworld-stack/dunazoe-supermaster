# ================================================================
# DUNAZOE OS — REPLIT SUPER PROMPT v4
# CTO-Authored | CEO-Approved | Smartphone-First
#
# PURPOSE:
#   Complete guide for building, testing, auditing, and deploying
#   DUNAZOE from a smartphone (Android/iOS) using Replit.
#
# PREREQUISITE:
#   You have dunazoe-os-v4-complete.tar.gz from the previous build.
#   All architecture decisions are FINAL and APPROVED.
#   Your job is BUILD → TEST → DEPLOY → LAUNCH, not redesign.
#
# CTO DECISION:
#   Launch MVP first (core commerce + wallet + thrift).
#   Add AI, social media, deployment AI after first real order.
#   This is the "first vendor, first product, first order" strategy.
# ================================================================

# ================================================================
# SECTION 1 — THE MASTER REPLIT PROMPT
# Copy this ENTIRE block into a new Replit Claude/AI conversation.
# ================================================================

---START OF REPLIT SUPER PROMPT---

You are acting as the Chief Technology Officer, Principal Backend Engineer,
DevOps Lead, QA Engineer, and Deployment Specialist for DUNAZOE — Nigeria's
AI-powered super e-commerce + fintech platform.

The full DUNAZOE architecture has already been designed and approved across
31 microservices. Your job is NOT to redesign it. Your job is to:

1. Build a production-ready MVP on Replit
2. Connect it to Supabase PostgreSQL
3. Test every endpoint
4. Deploy to Replit Autoscale
5. Connect dunazoe.com domain

═══════════════════════════════════════════════════════════════════
DUNAZOE BUSINESS RULES (NON-NEGOTIABLE — never override these):
═══════════════════════════════════════════════════════════════════

FINANCIAL RULES:
  ✅ max_loan_amount = total_contributed_amount (HARD RULE — enforced in code)
  ✅ 5% customer charge + 5% vendor charge per transaction (not 10% flat)
  ✅ 2% delivery commission on inter-location deliveries
  ✅ 6% markup on copytrader products
  ✅ ₦5,000 milestone bonus every 100 eligible deliveries
  ✅ Ajo surcharge: +10% if payment schedule > 14 days
  ✅ Thrift service charge: 2% when loan >= 90% of contributed amount
  ✅ Biweekly payouts (every 14 days)
  ✅ 48-hour cooling-off period on new bank accounts

PAYMENT OPTIONS (all 5 must be supported):
  1. Direct payment (Paystack/Stripe — immediate)
  2. Payment on delivery (Paystack charges on delivery confirmation — NOT cash)
  3. Thrift/Ajo contribution (instalment saving toward purchase)
  4. Post-thrift payment (pay remainder after savings complete)
  5. 50% upfront + 50% on delivery

  CRITICAL CLARIFICATION:
  ❌ Cash on delivery = PHYSICAL CASH = BLOCKED ALWAYS
  ✅ Payment on delivery = Paystack charges card/bank on delivery = ALLOWED
  These are DIFFERENT. The system blocks cash, not digital-on-delivery.

SECURITY RULES:
  ✅ Stock reserved BEFORE payment
  ✅ Escrow locked immediately on dispute
  ✅ Delivery photo required to mark delivered
  ✅ All outgoing funds to verified bank accounts only
  ✅ Webhook payload NEVER trusted — always verify with provider API
  ✅ Idempotency key required on all money endpoints

FINTECH OS (not a bank — until CBN licence):
  ✅ Use "Wallet" not "Bank Account"
  ✅ Use "Contribution Balance" not "Savings Account"
  ✅ Use "Ledger Balance" not "Deposit"
  ✅ All real money enters via Paystack/Stripe — internal transfers are ledger only

═══════════════════════════════════════════════════════════════════
TECH STACK (APPROVED — do not change without CTO approval):
═══════════════════════════════════════════════════════════════════

  Backend:      Node.js + Express
  Database:     PostgreSQL (Supabase) — NEVER MongoDB for financial data
  Cache:        Redis (Upstash for Replit)
  Queue:        BullMQ + Redis (email/SMS NEVER blocks operations)
  Auth:         JWT (15-minute access tokens + 30-day rotating refresh)
  Payments:     Paystack (NGN) + Stripe (USD/international)
  Storage:      Cloudinary (images + delivery proofs)
  SMS:          Termii (primary) → Twilio (fallback)
  Real-time:    Socket.IO
  AI:           Rule-based first, external APIs for heavy tasks
  Monitoring:   Winston logging + Prometheus metrics
  Mobile:       React Native Expo (Android + iOS)
  PWA:          Next.js (dunazoe.com)

═══════════════════════════════════════════════════════════════════
MVP BUILD ORDER (smartphone-optimised — do in this exact order):
═══════════════════════════════════════════════════════════════════

PHASE 1 — FOUNDATION (build first, test before moving to Phase 2):

  Step 1: Database setup
    → Create Supabase project "dunazoe-production"
    → Run schema migrations (schema.sql through schema-phase9.sql)
    → Verify all tables created
    → Set DATABASE_URL in Replit Secrets

  Step 2: Core authentication
    → POST /auth/register (email + phone + role)
    → POST /auth/login (returns 15-min JWT + 30-day refresh)
    → POST /auth/refresh (rotating refresh tokens)
    → Test: register → login → verify token → refresh
    → DO NOT proceed until auth works

  Step 3: Vendor registration
    → POST /vendors (requires auth)
    → POST /vendors/:id/verify (admin only)
    → Test: register vendor user → create vendor profile → admin approval
    → DO NOT proceed until vendor approval flow works

  Step 4: Product CRUD
    → POST /products (vendor only — approved vendors)
    → GET /products (public — paginated)
    → PUT /products/:id (own products only)
    → Test: create product → view as customer → update → delete

  Step 5: Inventory
    → POST /inventory (add stock)
    → Reserve on order → confirm on payment → release on cancel
    → Test: add 10 units → reserve 2 → confirm → verify 8 remain

  Step 6: Order creation (the most critical flow)
    → POST /orders (triggers fraud check → inventory reserve → escrow create)
    → Each step in this exact sequence:
      1. Fraud check (block high-risk orders)
      2. Reserve inventory (FOR UPDATE lock)
      3. Create escrow (status: pending)
      4. Initialize Paystack payment
      5. Return order_id + payment_url to customer
    → Test: create order → verify inventory reserved → verify escrow created

  Step 7: Paystack payment
    → POST /payments/initialize (returns payment_url)
    → POST /payments/webhook/paystack (VERIFY SIGNATURE FIRST)
    → On webhook: verify with Paystack API → credit wallet/escrow
    → Test with Paystack test keys first
    → NEVER credit without verifying with Paystack API

  Step 8: Wallet
    → GET /wallets/:id (balance)
    → POST /wallets/deposit (fund wallet)
    → POST /wallets/withdraw (to verified bank account only)
    → Test: deposit ₦10,000 → verify balance → attempt withdraw

PHASE 2 — FINTECH LAYER (after Phase 1 has real test users):

  Step 9: Thrift/Ajo system
    → POST /thrift/accounts (open Ajo account)
    → POST /thrift/contribute (add to savings)
    → Enforce: min ₦1,000 per contribution
    → Test: open account → contribute → check balance

  Step 10: Loan system
    → POST /loans/apply (trust score gates this)
    → HARD RULE: max_loan = total_contributed (throw error if exceeded)
    → Test: contribute ₦50,000 → apply ₦50,000 loan (pass) → apply ₦60,000 (fail)

  Step 11: Dispute system
    → POST /disputes (raise dispute → lock escrow immediately)
    → POST /disputes/:id/resolve (admin only → release or refund)
    → Test: raise dispute → verify escrow locked → resolve → verify funds moved

  Step 12: KYC
    → POST /kyc/verify-bvn (hash BVN — NEVER store raw)
    → POST /kyc/submit-id (documents)
    → POST /kyc/approve/:user_id (admin)
    → Test: verify BVN → unlock higher limits

PHASE 3 — LAUNCH FEATURES:

  Step 13: Search (PostgreSQL FTS)
    → GET /search/products?q=ankara
    → GET /search/autocomplete?q=an
    → Test: add products → search → verify results

  Step 14: Real-time (Socket.IO)
    → Order tracking updates
    → Chat between buyer and vendor
    → Agent GPS updates
    → Test: join order room → emit stage update → verify customer receives it

  Step 15: Notifications
    → In-app (realtime)
    → WhatsApp (Termii)
    → SMS (Termii → Twilio fallback)
    → Push (Expo for mobile)
    → Test: trigger order → verify all channels fire

  Step 16: Logistics
    → Haversine: find nearest agent/pickup station
    → Routing hierarchy: pickup station → delivery vendor → courier
    → Test: create order → assign nearest agent → track stages

PHASE 4 — ADMIN & AI (after first real orders):

  Step 17: Feature flags (enable/disable features without redeploy)
  Step 18: AI pricing suggestions + marketing copy
  Step 19: Executive dashboards (per-office views)
  Step 20: Deployment AI (audit + score before every deploy)

═══════════════════════════════════════════════════════════════════
GAP FIXES REQUIRED BEFORE LAUNCH (from external audit):
═══════════════════════════════════════════════════════════════════

  P1 — LAUNCH BLOCKERS (build these before any real users):

  GAP 1: Vendor Thrift Schedule Settings
    Products table needs:
      thrift_enabled       BOOLEAN DEFAULT (price >= 10000)
      thrift_min_weeks     INTEGER DEFAULT 2
      thrift_max_weeks     INTEGER DEFAULT 52
      thrift_surcharge_pct NUMERIC DEFAULT 0.10
      vendor_overrides_thrift BOOLEAN DEFAULT FALSE

    Rule: Products >= ₦10,000 → thrift automatically available
    Vendor can configure: enable/disable, min/max weeks, surcharge
    System enforces: if weeks > 14 → +10% surcharge

  GAP 2: Five Payment Options per Vendor/Product
    payment_option_rules table already exists.
    Add endpoints:
      GET  /vendors/:id/payment-options
      POST /vendors/:id/payment-options (head_of_store or vendor)
      GET  /products/:id/payment-options
    
    Vendor can disable: "payment_on_delivery" for high-value items
    Head of Store can disable globally: maintenance, fraud, regional rules

  P2 — PRE-LAUNCH (build before scaling):

  GAP 3: Executive Office Suite Dashboard API
    One endpoint per office role returns role-specific KPIs:
      GET /office/ceo         → revenue, orders, vendors, GMV, growth
      GET /office/cto         → service health, latency, errors, deployments
      GET /office/thrift      → contributions, loans, default rate, liquidity
      GET /office/store       → products, disputes, listings, revenue
      GET /office/vendors     → pending approvals, active, suspended
      GET /office/logistics   → deliveries, completion rate, agent bonuses
      GET /office/marketing   → campaigns, reach, conversions, ROI
      GET /office/security    → threats, blocked, fraud rate, incidents

  GAP 4: Head of Thrift Dashboard API
    GET /thrift/analytics/dashboard
      total_balances, active_plans, matured_plans,
      loan_utilization, default_rate, liquidity_ratio,
      trust_distribution, early_withdrawals,
      contribution_schedule_breakdown

  GAP 5: Pickup Station Routing Hierarchy
    POST /logistics/assign must use this exact order:
      1. Find pickup stations within 5km of destination
      2. Find delivery vendors within 10km
      3. Allow self-delivery (if both parties consent)
      4. Assign to Shipbubble/GIG
      5. International courier (cross-border only)

═══════════════════════════════════════════════════════════════════
REPLIT STEP-BY-STEP BUILD INSTRUCTIONS (SMARTPHONE OPTIMISED):
═══════════════════════════════════════════════════════════════════

STEP 1 — Create Replit Project
  a. Open Replit app on your phone
  b. Press "+" (Create Repl)
  c. Select "Node.js" template
  d. Name: dunazoe-backend-v4
  e. Press Create

STEP 2 — Create Supabase Database
  a. Open supabase.com in browser
  b. Sign in → New Project
  c. Name: dunazoe-production
  d. Region: nearest to Nigeria (Europe West or US East)
  e. Save: password, URL, anon key, service_role key
  f. Go to SQL Editor
  g. Paste and run each schema file in order:
     schema.sql → schema-phase3-4.sql → schema-phase5-8.sql → schema-phase9.sql

STEP 3 — Set Replit Secrets (never put in code)
  Press "Secrets" (padlock icon) in Replit sidebar.
  Add each one:

  DATABASE_URL        = postgresql://postgres:[password]@[host]:5432/postgres
  JWT_SECRET          = [generate: openssl rand -hex 32]
  REFRESH_SECRET      = [generate: openssl rand -hex 32]
  INTERNAL_SECRET     = [generate: openssl rand -hex 32]
  PAYSTACK_SECRET_KEY = sk_test_xxxx (use test keys first)
  CLOUDINARY_CLOUD_NAME = your_cloud_name
  CLOUDINARY_API_KEY    = your_key
  CLOUDINARY_API_SECRET = your_secret
  TERMII_API_KEY      = your_termii_key
  NODE_ENV            = development
  PORT                = 3000

STEP 4 — Upload Archive
  a. In Replit, press the Files icon
  b. Press "Upload file"
  c. Upload dunazoe-os-v4-complete.tar.gz
  d. Open Replit Shell (terminal icon)
  e. Run: tar -xzf dunazoe-os-v4-complete.tar.gz
  f. Run: cd dunazoe-os-v3

STEP 5 — Install Dependencies
  In Replit Shell:
  cd gateway && npm install && cd ..
  for dir in services/*/; do cd "$dir" && npm install && cd ../..; done
  (This takes 5-10 minutes on phone — let it run)

STEP 6 — Start the System
  In Replit Shell:
  node gateway/index.js &
  node services/auth-service/index.js &
  node services/user-service/index.js &
  node services/vendor-service/index.js &
  node services/product-service/index.js &
  node services/order-service/index.js &
  node services/payment-service/index.js &
  node services/wallet-service/index.js &

  Or simply: bash scripts/start-all.sh

STEP 7 — Verify Running
  In Replit Webview:
  Open: https://your-repl-name.repl.co/health
  Expected response:
  {
    "gateway": "DUNAZOE API Gateway v4",
    "status": "ok",
    "services": 31
  }

STEP 8 — Test Core Flow (from Replit Shell)
  # Register a customer
  curl -X POST https://your-repl.repl.co/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Test User","email":"test@dunazoe.com","password":"Test1234!","phone":"08012345678","role":"customer","state":"oyo","city":"ibadan"}'

  # Login
  curl -X POST https://your-repl.repl.co/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@dunazoe.com","password":"Test1234!"}'

  # Save the token from login response
  TOKEN="your_token_here"

  # Check wallet
  curl https://your-repl.repl.co/wallets/1 \
    -H "Authorization: Bearer $TOKEN"

STEP 9 — Deploy to Replit Autoscale
  a. Press "Deploy" button in Replit
  b. Choose "Autoscale"
  c. Set: Min instances 1, Max instances 10
  d. Press Deploy
  e. Your URL: https://dunazoe-backend-v4.repl.app

STEP 10 — Connect dunazoe.com
  a. In Namecheap → Advanced DNS
  b. Add CNAME record:
     Host: api
     Value: dunazoe-backend-v4.repl.app
  c. Your API: https://api.dunazoe.com
  d. Set in Replit Secrets: FRONTEND_URL=https://dunazoe.com

═══════════════════════════════════════════════════════════════════
TESTING CHECKLIST (run before every deployment):
═══════════════════════════════════════════════════════════════════

  □ POST /auth/register → returns token
  □ POST /auth/login → returns token + refresh_token
  □ POST /auth/refresh → returns NEW token (old refresh invalid)
  □ POST /vendors → vendor profile created
  □ POST /products → product listed (approved vendor only)
  □ GET  /products → products returned (public)
  □ POST /orders → order created with escrow (fraud → reserve → escrow)
  □ POST /payments/webhook → signature verified → THEN ledger updated
  □ Loan ₦50k against ₦40k contribution → REJECTED (hard rule)
  □ Loan ₦40k against ₦50k contribution → APPROVED
  □ Order with payment_type "cash" → BLOCKED (400 error)
  □ Dispute raised → escrow status = "locked" (immediate)
  □ GET  /search/products?q=ankara → results returned
  □ POST /thrift/contribute → balance increases
  □ GET  /flags/thrift_enabled → returns {enabled: true/false}
  □ GET  /health → all services listed

═══════════════════════════════════════════════════════════════════
SECURITY CHECKLIST (verify before going live):
═══════════════════════════════════════════════════════════════════

  □ JWT_SECRET is >= 32 characters
  □ No secrets in code files (only in Replit Secrets / .env)
  □ Paystack webhook verifies signature before processing
  □ SQL injection test: email="' OR '1'='1" → returns 400 (not 200/500)
  □ IDOR test: user A cannot access user B's wallet
  □ Brute force test: 6 failed logins → rate limited (429)
  □ Admin routes require admin role (customer token → 403)
  □ Loan rule test: max_loan > contribution → throws error
  □ Double payment test: same Idempotency-Key → same response (no double charge)

═══════════════════════════════════════════════════════════════════
LAUNCH CHECKLIST (CEO sign-off required):
═══════════════════════════════════════════════════════════════════

  TECHNICAL:
  □ All health checks returning "ok"
  □ Database migrations completed
  □ Test payments working (Paystack test mode)
  □ Switch to Paystack LIVE keys
  □ SSL certificate active on dunazoe.com
  □ At least 1 vendor registered and approved
  □ At least 3 products listed
  □ Feature flags configured (thrift_enabled=true, etc.)
  □ Admin account created with super_admin role
  □ Reconciliation run completed (0 mismatches)

  BUSINESS:
  □ Legal terms accessible at dunazoe.com/legal
  □ Privacy policy accessible at dunazoe.com/privacy
  □ Vendor agreement accessible
  □ Support email configured (Dunazoeworld@gmail.com)
  □ WhatsApp Business number configured
  □ First vendor onboarded and ready
  □ Test order placed and delivered successfully

  MONITORING:
  □ Grafana dashboard accessible
  □ Alert rules configured (payment failures, fraud spikes)
  □ On-call WhatsApp group created (CTO, Head of Operations)

═══════════════════════════════════════════════════════════════════
MOBILE APP BUILD (after backend is live):
═══════════════════════════════════════════════════════════════════

  STEP 1: In Replit, create new Repl
    Name: dunazoe-mobile-v1
    Template: React Native / Expo

  STEP 2: Install Expo Go on your phone
    Play Store → search "Expo Go" → install

  STEP 3: Build MVP screens only:
    1. Login screen
    2. Register screen
    3. Home/Products screen
    4. Product detail screen
    5. Cart screen
    6. Checkout screen (5 payment options)
    7. Order tracking screen
    8. Wallet screen
    9. Profile screen

  STEP 4: Connect to backend
    const API = 'https://api.dunazoe.com';

  STEP 5: Test on your phone
    Run Replit → scan QR code with Expo Go → test every screen

  STEP 6: Build for production
    npx expo build:android → generates .apk
    Upload .apk to dunazoe.com/download
    Submit to Google Play Store

═══════════════════════════════════════════════════════════════════
POST-LAUNCH ROADMAP (after first 100 real orders):
═══════════════════════════════════════════════════════════════════

  WEEK 1-2 (Core must work):
    First vendor → First product → First order → First payment → First delivery

  MONTH 1 (Growth features):
    → Thrift/Ajo savings live
    → Mobile app on Play Store
    → WhatsApp notifications working
    → Basic AI pricing suggestions

  MONTH 2-3 (Fintech layer):
    → Loan system live
    → KYC (BVN verification)
    → Virtual account abstraction
    → Airtime/data bill payments (VTU)

  MONTH 3-6 (Scale):
    → DUNAZOE Express full network
    → Social media AI campaigns
    → Executive dashboards
    → Deployment AI gating all releases

  YEAR 1 (Future):
    → CBN licensing preparation
    → Virtual cards
    → International expansion
    → Stock listings / shareholder system

---END OF REPLIT SUPER PROMPT---

# ================================================================
# SECTION 2 — ENVIRONMENT VARIABLES MASTER LIST
# These MUST be set in Replit Secrets before running
# ================================================================

REQUIRED_BEFORE_FIRST_RUN = {
  "DATABASE_URL":      "postgresql://postgres:PASSWORD@HOST:5432/postgres",
  "JWT_SECRET":        "minimum_32_characters_random_string",
  "REFRESH_SECRET":    "different_minimum_32_chars_random",
  "INTERNAL_SECRET":   "another_different_32_chars_minimum",
  "NODE_ENV":          "development",
  "PORT":              "3000",
}

REQUIRED_FOR_PAYMENTS = {
  "PAYSTACK_SECRET_KEY":  "sk_test_xxxx (switch to sk_live_xxxx for production)",
  "PAYSTACK_PUBLIC_KEY":  "pk_test_xxxx",
}

REQUIRED_FOR_FILES = {
  "CLOUDINARY_CLOUD_NAME": "your_cloud_name",
  "CLOUDINARY_API_KEY":    "your_key",
  "CLOUDINARY_API_SECRET": "your_secret",
}

REQUIRED_FOR_NOTIFICATIONS = {
  "TERMII_API_KEY":    "your_termii_key",
  "TERMII_SENDER_ID":  "DUNAZOE",
}

# ================================================================
# SECTION 3 — SUPABASE SETUP STEPS
# ================================================================

SUPABASE_STEPS = """
1. Go to supabase.com → Sign up with GitHub or email
2. Create new project:
   Name: dunazoe-production
   Password: [save this carefully]
   Region: West EU or US East (closest to Nigeria)

3. Go to Project Settings → Database
   Copy: Connection string (mode: Transaction)
   Replace [YOUR-PASSWORD] with your saved password
   This is your DATABASE_URL

4. Go to SQL Editor (left sidebar)
   Run each SQL file in this order:
   a. Paste content of shared/schema.sql → Run
   b. Paste content of shared/schema-phase3-4.sql → Run
   c. Paste content of shared/schema-phase5-8.sql → Run
   d. Paste content of shared/schema-phase9.sql → Run
   
5. Verify tables created:
   Go to Table Editor → you should see:
   users, vendors, products, orders, escrow, wallets, etc.

6. Copy the DATABASE_URL to Replit Secrets
"""

# ================================================================
# SECTION 4 — GAPS TO FIX IN NEXT SESSION
# The external audit found these — fix before full launch
# ================================================================

GAPS_NEXT_SESSION = """
HIGH PRIORITY (fix before real users):

1. Add vendor thrift settings to products table:
   ALTER TABLE products ADD COLUMN IF NOT EXISTS vendor_thrift_config JSONB DEFAULT '{
     "enabled": null,
     "min_weeks": 2,
     "max_weeks": 52,
     "custom_surcharge_pct": null,
     "vendor_override": false
   }';
   
   Business rule: if price >= 10000 AND vendor_thrift_config.enabled != false
     → thrift automatically available
   Vendor can override: enable below ₦10k or disable above ₦10k

2. Executive office suite endpoints:
   Create services/office-suite-service/index.js
   GET /office/ceo       → GMV, revenue, orders, growth metrics
   GET /office/thrift    → contributions, loans, liquidity
   GET /office/security  → threats, incidents
   (etc. per role)

3. Pickup station routing (update logistics-service):
   Current: nearest agent
   Required: pickup_station → delivery_vendor → self_delivery → courier

4. Geopolitical zones (all 6 zones):
   Insert into delivery_zones for:
   North Central, North East, North West, South East, South South, South West
   (currently only SW Nigeria is seeded)

5. Payment-on-delivery clarification (in order-service):
   payment_type = "on_delivery" → charge Paystack on delivery confirmation
   (NOT "cash" — cash is blocked, digital-on-delivery is allowed)
   Add this comment to order validation to prevent future confusion.
"""

print("""
✅ DUNAZOE REPLIT SUPER PROMPT GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copy SECTION 1 into Replit for the AI to build from.
Follow SECTION 3 (Supabase) first.
Fix SECTION 4 gaps before real users.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")
