-- ================================================================
-- DUNAZOE OS — SCHEMA PHASE 10: GAP FIXES (Audit Response)
-- Fixes: Vendor thrift settings, payment options, geo zones,
--        office suite, thrift goals, pickup routing
-- ================================================================

-- ── GAP 1: VENDOR THRIFT SCHEDULE SETTINGS ────────────────────
-- Products >= ₦10,000 → thrift auto-available
-- Vendor can override: enable below ₦10k or disable above ₦10k
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS thrift_enabled_override   BOOLEAN DEFAULT NULL, -- NULL = use price rule
  ADD COLUMN IF NOT EXISTS thrift_min_weeks          INTEGER DEFAULT 2,
  ADD COLUMN IF NOT EXISTS thrift_max_weeks          INTEGER DEFAULT 52,
  ADD COLUMN IF NOT EXISTS thrift_custom_surcharge   NUMERIC(5,4) DEFAULT NULL, -- NULL = use platform 10%
  ADD COLUMN IF NOT EXISTS thrift_vendor_configured  BOOLEAN DEFAULT FALSE;

-- Function: is thrift available for this product?
-- Rule: price >= 10000 → auto-enable (unless vendor explicitly disabled)
-- Rule: vendor explicitly enabled → enable regardless of price
-- Rule: vendor explicitly disabled → disable regardless of price
CREATE OR REPLACE FUNCTION is_thrift_available(price NUMERIC, override BOOLEAN)
RETURNS BOOLEAN AS $$
BEGIN
  IF override IS TRUE  THEN RETURN TRUE; END IF;   -- vendor enabled
  IF override IS FALSE THEN RETURN FALSE; END IF;   -- vendor disabled
  RETURN price >= 10000;                             -- default: price rule
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── GAP 2: PAYMENT ON DELIVERY CLARIFICATION ──────────────────
-- CRITICAL: Add status field to clarify NO CASH policy
-- payment_type = 'on_delivery' = Paystack charges on delivery
-- payment_type = 'cash' = BLOCKED at DB level via CHECK constraint

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_type_check
  CHECK (payment_type IN (
    'full',           -- immediate full payment (Paystack/Stripe/Wallet)
    'on_delivery',    -- Paystack/digital charge when order is delivered (NOT cash)
    'thrift',         -- contribute via Ajo savings plan
    'post_thrift',    -- pay remainder after Ajo cycle completes
    'split_50',       -- 50% now + 50% on delivery (both via Paystack)
    'wallet'          -- pay from DUNAZOE wallet balance
    -- NOTE: 'cash' is intentionally omitted — cash is BLOCKED at DB level
  ));

-- Comment in DB for future devs
COMMENT ON COLUMN orders.payment_type IS
  'Payment method. on_delivery = Paystack digital charge on delivery confirmation, NOT physical cash. Cash is permanently blocked.';

-- ── GAP 3: GEOPOLITICAL ZONES (all 6 Nigerian zones) ──────────
INSERT INTO delivery_zones(name, zone_code, state, cities) VALUES
  -- South West (already partially seeded, add remaining)
  ('Lagos Zone',       'SW-LG', 'lagos',        ARRAY['lagos island','lekki','victoria island','ajah','ikorodu','badagry','epe']),
  -- South East
  ('Enugu Zone',       'SE-EN', 'enugu',        ARRAY['enugu','nsukka','agbani','oji river']),
  ('Anambra Zone',     'SE-AN', 'anambra',      ARRAY['awka','onitsha','nnewi','ekwulobia']),
  ('Imo Zone',         'SE-IM', 'imo',          ARRAY['owerri','orlu','okigwe','mbaise']),
  ('Abia Zone',        'SE-AB', 'abia',         ARRAY['umuahia','aba','arochukwu']),
  ('Ebonyi Zone',      'SE-EB', 'ebonyi',       ARRAY['abakaliki','onueke','afikpo']),
  -- South South
  ('Rivers Zone',      'SS-RV', 'rivers',       ARRAY['port harcourt','obio akpor','eleme','bonny']),
  ('Delta Zone',       'SS-DT', 'delta',        ARRAY['asaba','warri','sapele','ughelli']),
  ('Edo Zone',         'SS-ED', 'edo',          ARRAY['benin city','auchi','ekpoma','uromi']),
  ('Cross River Zone', 'SS-CR', 'cross river',  ARRAY['calabar','ogoja','ikom']),
  ('Akwa Ibom Zone',   'SS-AK', 'akwa ibom',    ARRAY['uyo','eket','ikot ekpene']),
  ('Bayelsa Zone',     'SS-BY', 'bayelsa',      ARRAY['yenagoa','sagbama','brass']),
  -- North Central
  ('FCT Zone',         'NC-FC', 'fct',          ARRAY['abuja','gwagwalada','kuje','bwari']),
  ('Kogi Zone',        'NC-KG', 'kogi',         ARRAY['lokoja','okene','idah','ankpa']),
  ('Niger Zone',       'NC-NG', 'niger',        ARRAY['minna','suleja','bida','kontagora']),
  ('Kwara Zone',       'NC-KW', 'kwara',        ARRAY['ilorin','offa','share','lafiagi']),
  ('Benue Zone',       'NC-BN', 'benue',        ARRAY['makurdi','gboko','otukpo','katsina ala']),
  -- North West
  ('Kano Zone',        'NW-KN', 'kano',         ARRAY['kano','wudil','rano','gaya']),
  ('Kaduna Zone',      'NW-KD', 'kaduna',       ARRAY['kaduna','zaria','kafanchan','kaura']),
  ('Lagos Metro',      'NW-SO', 'sokoto',       ARRAY['sokoto','tambuwal','wurno']),
  -- North East
  ('Borno Zone',       'NE-BO', 'borno',        ARRAY['maiduguri','biu','bama','kukawa']),
  ('Adamawa Zone',     'NE-AD', 'adamawa',      ARRAY['yola','mubi','jimeta','numan'])
ON CONFLICT(zone_code) DO NOTHING;

-- Zone type classification
ALTER TABLE delivery_zones
  ADD COLUMN IF NOT EXISTS geo_zone TEXT CHECK (geo_zone IN (
    'south_west','south_east','south_south',
    'north_central','north_west','north_east'
  ));

-- Update SW zones
UPDATE delivery_zones SET geo_zone='south_west'
WHERE zone_code LIKE 'SW-%' OR zone_code LIKE 'LG-%';
UPDATE delivery_zones SET geo_zone='south_east'   WHERE zone_code LIKE 'SE-%';
UPDATE delivery_zones SET geo_zone='south_south'  WHERE zone_code LIKE 'SS-%';
UPDATE delivery_zones SET geo_zone='north_central' WHERE zone_code LIKE 'NC-%';
UPDATE delivery_zones SET geo_zone='north_west'   WHERE zone_code LIKE 'NW-%';
UPDATE delivery_zones SET geo_zone='north_east'   WHERE zone_code LIKE 'NE-%';

-- ── GAP 4: PERSONAL FINANCE THRIFT GOALS ─────────────────────
CREATE TABLE IF NOT EXISTS thrift_goals (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  thrift_account_id INTEGER REFERENCES thrift_accounts(id),
  goal_type       TEXT NOT NULL CHECK (goal_type IN (
    'rent','school_fees','travel','emergency_fund',
    'business_capital','wedding','equipment','custom'
  )),
  title           TEXT NOT NULL,
  target_amount   NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount  NUMERIC(12,2) DEFAULT 0,
  currency        TEXT DEFAULT 'NGN',
  schedule_type   TEXT NOT NULL CHECK (schedule_type IN ('daily','weekly','biweekly','monthly')),
  contribution_amount NUMERIC(12,2) NOT NULL,
  auto_debit      BOOLEAN DEFAULT FALSE,
  start_date      DATE NOT NULL,
  target_date     DATE NOT NULL,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  early_withdrawal_penalty_pct NUMERIC(5,4) DEFAULT 0,
  reward_on_completion_pct     NUMERIC(5,4) DEFAULT 0.05, -- 5% reward
  notes           TEXT,
  progress_pct    NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_amount > 0
    THEN LEAST(100, ROUND((current_amount/target_amount)*100, 2))
    ELSE 0 END
  ) STORED,
  created_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tg_user   ON thrift_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_tg_status ON thrift_goals(status);

-- ── GAP 5: PICKUP STATION ROUTING HIERARCHY ───────────────────
-- Explicit routing priority table
CREATE TABLE IF NOT EXISTS routing_rules (
  id          SERIAL PRIMARY KEY,
  rule_name   TEXT UNIQUE NOT NULL,
  priority    INTEGER NOT NULL, -- lower = higher priority
  type        TEXT NOT NULL CHECK (type IN (
    'pickup_station','delivery_vendor','self_delivery',
    'shipbubble','gig','jumia_logistics','dhl','fedex','ups'
  )),
  max_distance_km NUMERIC(8,2),
  is_active   BOOLEAN DEFAULT TRUE,
  geo_zone    TEXT,  -- NULL = applies everywhere
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

INSERT INTO routing_rules(rule_name,priority,type,max_distance_km,description) VALUES
  ('local_pickup_station', 1, 'pickup_station',  5,   'Nearest pickup station within 5km'),
  ('local_delivery_vendor',2, 'delivery_vendor', 10,  'Nearest delivery vendor within 10km'),
  ('self_delivery',        3, 'self_delivery',   NULL,'Both parties consent to self-delivery'),
  ('shipbubble_national',  4, 'shipbubble',      NULL,'Shipbubble for national deliveries'),
  ('gig_logistics',        5, 'gig',             NULL,'GIG for bulk/large items'),
  ('jumia_logistics',      6, 'jumia_logistics', NULL,'Jumia logistics for compatible areas'),
  ('dhl_international',    7, 'dhl',             NULL,'DHL for international orders'),
  ('fedex_international',  8, 'fedex',           NULL,'FedEx premium international')
ON CONFLICT(rule_name) DO NOTHING;

-- ── GAP 6: EXECUTIVE OFFICE SUITE KPI CACHE ──────────────────
CREATE TABLE IF NOT EXISTS office_kpi_cache (
  id          SERIAL PRIMARY KEY,
  office      TEXT NOT NULL CHECK (office IN (
    'ceo','cto','thrift','store','vendors',
    'logistics','marketing','security','finance'
  )),
  kpis        JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  expires_at   TIMESTAMP DEFAULT NOW() + INTERVAL '15 minutes'
);
CREATE INDEX IF NOT EXISTS idx_okc_office ON office_kpi_cache(office, expires_at);

-- ── GAP 7: SERVICE MARKETPLACE MILESTONES ─────────────────────
CREATE TABLE IF NOT EXISTS service_milestones (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER REFERENCES orders(id),
  listing_id      INTEGER,
  title           TEXT NOT NULL,
  description     TEXT,
  amount          NUMERIC(12,2) NOT NULL,
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending','in_progress','submitted','approved','paid','disputed'
  )),
  proof_url       TEXT,
  due_date        DATE,
  completed_at    TIMESTAMP,
  approved_by     INTEGER REFERENCES users(id),
  sequence        INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── GAP 8: OFFLINE AI CACHE (for executive offline use) ───────
CREATE TABLE IF NOT EXISTS offline_ai_cache (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  cache_type  TEXT NOT NULL CHECK (cache_type IN (
    'revenue_summary','fraud_summary','vendor_summary',
    'logistics_summary','thrift_summary','security_summary'
  )),
  data        JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  valid_until  TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_oac_user   ON offline_ai_cache(user_id, cache_type);
CREATE INDEX IF NOT EXISTS idx_oac_expire ON offline_ai_cache(valid_until);
