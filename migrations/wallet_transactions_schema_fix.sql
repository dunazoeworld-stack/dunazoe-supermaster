-- ============================================================
-- DUNAZOE Wallet Transactions Schema Fix & Security Migration
-- Part 1: Wallet Double-Credit Prevention
-- Created: 2026-07-30
-- Run ONCE on production database before deploying webhook update.
-- ============================================================

-- 1. Create wallet_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER       NOT NULL,
  type        VARCHAR(50)   NOT NULL DEFAULT 'deposit',
  amount      NUMERIC(15,2) NOT NULL,
  currency    VARCHAR(10)   NOT NULL DEFAULT 'NGN',
  reference   VARCHAR(255)  UNIQUE NOT NULL,   -- UNIQUE prevents duplicate credits
  note        TEXT,
  status      VARCHAR(50)   NOT NULL DEFAULT 'completed',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 2. Add UNIQUE constraint on reference (idempotency key)
--    The ON CONFLICT DO NOTHING in the webhook relies on this.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_transactions_reference_key'
    AND conrelid = 'wallet_transactions'::regclass
  ) THEN
    ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_reference_key UNIQUE (reference);
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL; -- Table doesn't exist yet; handled by CREATE TABLE above
END $$;

-- 3. Create index for fast reference lookups
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference ON wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id   ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created   ON wallet_transactions(created_at DESC);

-- 4. Add commission_transactions table for the 5% system fee tracking
CREATE TABLE IF NOT EXISTS commission_transactions (
  id             BIGSERIAL PRIMARY KEY,
  product_id     INTEGER       NOT NULL,
  order_id       INTEGER       NOT NULL,
  vendor_id      INTEGER       NOT NULL,
  gross_amount   NUMERIC(15,2) NOT NULL,
  system_fee     NUMERIC(15,2) NOT NULL,
  vendor_amount  NUMERIC(15,2) NOT NULL,
  status         VARCHAR(50)   NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  released_at    TIMESTAMPTZ,
  UNIQUE(order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_commission_vendor   ON commission_transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_commission_order    ON commission_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_status   ON commission_transactions(status);

-- 5. Add delivery_vendor_profiles table
CREATE TABLE IF NOT EXISTS delivery_vendor_profiles (
  id               BIGSERIAL PRIMARY KEY,
  user_id          INTEGER       NOT NULL,
  vendor_id        INTEGER,
  full_name        VARCHAR(255)  NOT NULL,
  phone            VARCHAR(30)   NOT NULL,
  whatsapp         VARCHAR(30),
  email            VARCHAR(255)  NOT NULL,
  home_address     TEXT          NOT NULL,
  business_address TEXT,
  cac_name         VARCHAR(255),
  logo_url         TEXT,
  flyer_url        TEXT,
  service_area     VARCHAR(100)  DEFAULT 'local',
  pickup_lat       DECIMAL(9,6),
  pickup_lng       DECIMAL(9,6),
  can_deliver      BOOLEAN       NOT NULL DEFAULT FALSE,
  status           VARCHAR(50)   NOT NULL DEFAULT 'pending',
  bank_verified    BOOLEAN       NOT NULL DEFAULT FALSE,
  kyc_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
  total_deliveries INTEGER       NOT NULL DEFAULT 0,
  total_earned     NUMERIC(15,2) NOT NULL DEFAULT 0,
  rating           DECIMAL(3,1)  DEFAULT 5.0,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 6. Add logo_url column to vendors table if missing
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS flyer_url TEXT;

-- ============================================================
-- VERIFICATION QUERIES (run manually to confirm)
-- ============================================================
-- SELECT COUNT(*) FROM wallet_transactions;
-- SELECT conname FROM pg_constraint WHERE conrelid = 'wallet_transactions'::regclass;
-- SELECT COUNT(*) FROM commission_transactions;

-- ============================================================
-- WALLET LEDGER SCHEMA VALIDATION
-- On startup, the app should verify:
-- SELECT 1 FROM pg_tables WHERE tablename = 'wallet_transactions';
-- SELECT 1 FROM pg_constraint WHERE conname = 'wallet_transactions_reference_key';
-- ============================================================
