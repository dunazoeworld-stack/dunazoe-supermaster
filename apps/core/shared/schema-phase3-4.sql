-- ================================================================
-- DUNAZOE OS — SCHEMA ADDITIONS: PHASE 3 + 4
-- Run AFTER Phase 1+2 schema
-- CTO NOTE: Phase plan schema was too thin — these additions
--   prevent painful migrations later in Phases 6, 7, 8
-- ================================================================

-- ── PHASE 3: ORDERS (upgraded from plan's thin schema) ────────
CREATE TABLE IF NOT EXISTS orders (
  id                SERIAL PRIMARY KEY,
  customer_id       INTEGER REFERENCES users(id),
  vendor_id         INTEGER REFERENCES vendors(id),
  product_id        INTEGER REFERENCES products(id),
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_price        NUMERIC(12,2) NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  payment_type      TEXT DEFAULT 'full'
                    CHECK (payment_type IN ('full','thrift','split_50','on_delivery','wallet')),
  -- CTO ADD: No cash — enforced at DB + service level
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','fraud_review','reserved','paid',
                                      'processing','shipped','delivered','cancelled',
                                      'disputed','refunded')),
  tracking_status   TEXT DEFAULT 'pending'
                    CHECK (tracking_status IN ('pending','confirmed','ready',
                                               'shipped','delivered')),
  -- CTO ADD: Delivery intelligence (needed for Phase 6)
  is_inter_location BOOLEAN DEFAULT FALSE,
  source_city       TEXT,
  dest_city         TEXT,
  is_self_pickup    BOOLEAN DEFAULT FALSE,
  delivery_address  TEXT,
  delivery_agent_id INTEGER,
  delivery_photo    TEXT,
  -- CTO ADD: Financial breakdown (needed for Phase 7)
  platform_fee      NUMERIC(12,2) DEFAULT 0,
  agent_commission  NUMERIC(12,2) DEFAULT 0,
  copytrader_commission NUMERIC(12,2) DEFAULT 0,
  vendor_net        NUMERIC(12,2) DEFAULT 0,
  -- CTO ADD: Fraud + payment refs
  fraud_status      TEXT DEFAULT 'safe'
                    CHECK (fraud_status IN ('safe','suspicious','high_risk','reviewed')),
  paystack_ref      TEXT,
  dispute_id        INTEGER,
  -- CTO ADD: Referral tracking
  referrer_id       INTEGER REFERENCES vendors(id),
  ref_code          TEXT,
  -- AI tracking
  ai_assisted       BOOLEAN DEFAULT FALSE,
  notes             TEXT,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 3: ESCROW (upgraded) ────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER UNIQUE REFERENCES orders(id),
  amount          NUMERIC(12,2) NOT NULL,
  platform_fee    NUMERIC(12,2) DEFAULT 0,
  agent_fee       NUMERIC(12,2) DEFAULT 0,
  copytrader_fee  NUMERIC(12,2) DEFAULT 0,
  vendor_net      NUMERIC(12,2) DEFAULT 0,
  status          TEXT DEFAULT 'held'
                  CHECK (status IN ('held','released','locked','refunded','partial')),
  paystack_ref    TEXT,
  held_at         TIMESTAMP DEFAULT NOW(),
  released_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 3: FRAUD LOG (plan was missing this entirely) ───────
CREATE TABLE IF NOT EXISTS fraud_log (
  id          SERIAL PRIMARY KEY,
  order_id    INTEGER,
  user_id     INTEGER REFERENCES users(id),
  ip_address  TEXT,
  amount      NUMERIC(12,2),
  quantity    INTEGER,
  risk_level  TEXT CHECK (risk_level IN ('safe','suspicious','high_risk')),
  rules_fired TEXT,   -- JSON array of which rules triggered
  action      TEXT,   -- allowed, flagged, blocked
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 4: WALLETS (upgraded) ───────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER UNIQUE REFERENCES users(id),
  balance_ngn  NUMERIC(12,2) DEFAULT 0,
  balance_usd  NUMERIC(12,2) DEFAULT 0,
  locked_ngn   NUMERIC(12,2) DEFAULT 0,
  locked_usd   NUMERIC(12,2) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_ngn_positive CHECK (balance_ngn >= 0),
  CONSTRAINT chk_usd_positive CHECK (balance_usd >= 0),
  CONSTRAINT chk_locked_ngn   CHECK (locked_ngn <= balance_ngn),
  CONSTRAINT chk_locked_usd   CHECK (locked_usd <= balance_usd)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  type          TEXT NOT NULL
                CHECK (type IN ('deposit','withdraw','transfer_in','transfer_out',
                                'escrow_lock','escrow_release','commission','interest',
                                'loan_disbursement','loan_repayment','payout')),
  currency      TEXT DEFAULT 'NGN' CHECK (currency IN ('NGN','USD')),
  amount        NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL, -- CTO ADD: critical for auditing
  reference     TEXT,
  note          TEXT,
  status        TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 4: THRIFT (upgraded from plan's thin schema) ────────
CREATE TABLE IF NOT EXISTS thrift_accounts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER UNIQUE REFERENCES users(id),
  balance         NUMERIC(12,2) DEFAULT 0,
  locked          NUMERIC(12,2) DEFAULT 0,
  interest_earned NUMERIC(12,2) DEFAULT 0,
  purpose         TEXT DEFAULT 'personal'
                  CHECK (purpose IN ('personal','commerce','group')),
  plan_type       TEXT DEFAULT 'monthly'
                  CHECK (plan_type IN ('daily','weekly','monthly')),
  target_amount   NUMERIC(12,2) DEFAULT 0,
  target_date     DATE,
  ajo_weeks       INTEGER DEFAULT 0,
  group_id        INTEGER,
  created_at      TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_thrift_bal CHECK (balance >= 0),
  CONSTRAINT chk_thrift_lock CHECK (locked <= balance)
);

CREATE TABLE IF NOT EXISTS thrift_contributions (
  id          SERIAL PRIMARY KEY,
  account_id  INTEGER REFERENCES thrift_accounts(id),
  user_id     INTEGER REFERENCES users(id),
  type        TEXT DEFAULT 'contribution'
              CHECK (type IN ('contribution','withdrawal','interest','lock','release')),
  amount      NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2),
  reference   TEXT,
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS thrift_groups (
  id                  SERIAL PRIMARY KEY,
  name                TEXT NOT NULL,
  coordinator_id      INTEGER REFERENCES users(id),
  contribution_amount NUMERIC(12,2),
  cycle_days          INTEGER DEFAULT 30,
  current_round       INTEGER DEFAULT 1,
  member_ids          INTEGER[],
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 4: TRUST SCORES (upgraded formula) ──────────────────
CREATE TABLE IF NOT EXISTS trust_scores (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id),
  score             NUMERIC(5,2) DEFAULT 50.0,
  -- component scores
  consistency_score   NUMERIC(5,2) DEFAULT 0,
  cycle_score         NUMERIC(5,2) DEFAULT 0,
  timeliness_score    NUMERIC(5,2) DEFAULT 0,
  activity_score      NUMERIC(5,2) DEFAULT 0,
  -- raw data
  total_contributions INTEGER DEFAULT 0,
  on_time_payments    INTEGER DEFAULT 0,
  missed_payments     INTEGER DEFAULT 0,
  completed_cycles    INTEGER DEFAULT 0,
  total_orders        INTEGER DEFAULT 0,
  disputes_raised     INTEGER DEFAULT 0,
  label               TEXT DEFAULT 'new',
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 4: LOANS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id),
  amount            NUMERIC(12,2) NOT NULL,
  trust_score_at_approval NUMERIC(5,2),
  trust_multiplier  NUMERIC(3,1) DEFAULT 1.0,
  interest_rate     NUMERIC(5,4) DEFAULT 0.05,  -- 5% flat
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','disbursed','closed')),
  repayment_status  TEXT DEFAULT 'not_started'
                    CHECK (repayment_status IN ('not_started','partial','completed','defaulted')),
  amount_repaid     NUMERIC(12,2) DEFAULT 0,
  due_date          DATE,
  approved_by       INTEGER REFERENCES users(id),
  approved_at       TIMESTAMP,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_repayments (
  id         SERIAL PRIMARY KEY,
  loan_id    INTEGER REFERENCES loans(id),
  user_id    INTEGER REFERENCES users(id),
  amount     NUMERIC(12,2) NOT NULL,
  source     TEXT CHECK (source IN ('wallet','thrift')),
  reference  TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── REFERRAL / COPYTRADER TRACKING ───────────────────────────
CREATE TABLE IF NOT EXISTS referrals (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER REFERENCES products(id),
  referrer_id   INTEGER REFERENCES vendors(id),
  buyer_id      INTEGER REFERENCES users(id),
  order_id      INTEGER REFERENCES orders(id),
  ref_code      TEXT NOT NULL,
  commission    NUMERIC(12,2) DEFAULT 0,
  commission_pct NUMERIC(5,4) DEFAULT 0.06,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','paid','rejected')),
  paid_at       TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── PAYOUT LEDGER (Phase 7) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_ledger (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  type          TEXT NOT NULL
                CHECK (type IN ('vendor_sale','delivery_commission','milestone_bonus',
                                'copytrader_commission','thrift_withdrawal',
                                'loan_disbursement','interest')),
  amount        NUMERIC(12,2) NOT NULL,
  source        TEXT,
  order_id      INTEGER,
  status        TEXT DEFAULT 'pending'
                CHECK (status IN ('pending','paid','failed')),
  payout_method TEXT DEFAULT 'bank'
                CHECK (payout_method IN ('bank','opay','moniepoint')),
  bank_name     TEXT, account_no TEXT, account_name TEXT,
  processed_at  TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ── NOTIFICATIONS TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  type       TEXT DEFAULT 'info'
             CHECK (type IN ('info','success','warning','error','chat','marketing')),
  channel    TEXT DEFAULT 'in_app'
             CHECK (channel IN ('in_app','whatsapp','sms','email','push')),
  is_read    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_customer   ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor     ON orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_paystack   ON orders(paystack_ref);
CREATE INDEX IF NOT EXISTS idx_escrow_order      ON escrow(order_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status     ON escrow(status);
CREATE INDEX IF NOT EXISTS idx_fraud_log_user    ON fraud_log(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_user       ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user   ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_thrift_user       ON thrift_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_thrift_contrib    ON thrift_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_trust_user        ON trust_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_user        ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_ref     ON referrals(ref_code);
CREATE INDEX IF NOT EXISTS idx_referrals_order   ON referrals(order_id);
CREATE INDEX IF NOT EXISTS idx_payout_user       ON payout_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_status     ON payout_ledger(status);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id);
