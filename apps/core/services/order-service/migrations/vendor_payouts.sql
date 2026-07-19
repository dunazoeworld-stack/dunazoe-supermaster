-- DUNAZOE — vendor_payouts table
-- Tracks the 5% service charge deduction from vendor payouts.
-- Scheduled 24 hours after each confirmed delivery.
-- Run once: psql $DATABASE_URL -f vendor_payouts.sql

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id                  SERIAL PRIMARY KEY,
  vendor_id           INT         NOT NULL REFERENCES vendors(id),
  order_id            INT         NOT NULL UNIQUE REFERENCES orders(id),
  gross_amount        NUMERIC(12,2) NOT NULL,   -- full product amount
  service_charge      NUMERIC(12,2) NOT NULL,   -- 5% of gross
  service_charge_pct  NUMERIC(5,4)  NOT NULL DEFAULT 0.05,
  net_amount          NUMERIC(12,2) NOT NULL,   -- gross - service_charge
  status              VARCHAR(20)   NOT NULL DEFAULT 'scheduled',
                                    -- scheduled | processing | paid | failed
  scheduled_at        TIMESTAMPTZ   NOT NULL,   -- when to process (delivery + 24h)
  processed_at        TIMESTAMPTZ,
  note                TEXT,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_id   ON vendor_payouts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_status       ON vendor_payouts(status);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_scheduled_at ON vendor_payouts(scheduled_at)
  WHERE status = 'scheduled';

COMMENT ON TABLE vendor_payouts IS
  '5% DUNAZOE service charge deducted from gross product amount. '
  'Net payout credited to vendor wallet 24 hours after delivery confirmation.';
