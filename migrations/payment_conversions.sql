-- payment_conversions table
-- Stores NGN → USD conversions made during Stripe payment initialization.
-- Run once against your database.

CREATE TABLE IF NOT EXISTS payment_conversions (
  id         SERIAL PRIMARY KEY,
  ngn_amount NUMERIC(12,2) NOT NULL,
  usd_amount NUMERIC(12,4) NOT NULL,
  rate_used  NUMERIC(10,4) NOT NULL,
  order_ref  TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_conversions_order_ref ON payment_conversions(order_ref);
CREATE INDEX IF NOT EXISTS idx_payment_conversions_created_at ON payment_conversions(created_at);
