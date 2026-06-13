-- ================================================================
-- DUNAZOE OS — MASTER DATABASE SCHEMA
-- Phase 1 (Auth + User + Vendor) + Phase 2 (Product + Inventory)
-- Run this ONCE in PostgreSQL before starting any service
-- ================================================================

-- ── PHASE 1 TABLES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  whatsapp      TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'customer'
                CHECK (role IN ('customer','vendor','agent','admin','coordinator')),
  state         TEXT,
  city          TEXT,
  town          TEXT,
  lat           NUMERIC(10,6) DEFAULT 0,
  lng           NUMERIC(10,6) DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  consent       BOOLEAN DEFAULT TRUE,
  last_seen     TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token         TEXT PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT,
  expires_at    TIMESTAMP NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  business_name   TEXT NOT NULL,
  description     TEXT,
  type            TEXT DEFAULT 'direct'
                  CHECK (type IN ('direct','delivery','copytrader','pickup_station')),
  category        TEXT,
  state           TEXT,
  city            TEXT,
  town            TEXT,
  lat             NUMERIC(10,6) DEFAULT 0,
  lng             NUMERIC(10,6) DEFAULT 0,
  pickup_address  TEXT,
  is_pickup_station BOOLEAN DEFAULT FALSE,
  verified_auto   BOOLEAN DEFAULT FALSE,
  verified_manual BOOLEAN DEFAULT FALSE,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending','active','suspended','rejected')),
  shareable_link  TEXT,
  payout_method   TEXT DEFAULT 'bank'
                  CHECK (payout_method IN ('bank','opay','moniepoint')),
  bank_name       TEXT,
  account_no      TEXT,
  account_name    TEXT,
  coordinator_id  INTEGER,
  total_sales     INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  rating          NUMERIC(3,2) DEFAULT 0.00,
  created_at      TIMESTAMP DEFAULT NOW()
);

-- ── PHASE 2 TABLES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  vendor_id           INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT,
  type                TEXT DEFAULT 'physical'
                      CHECK (type IN ('physical','digital','service')),
  category            TEXT,
  price               NUMERIC(12,2) NOT NULL,
  cost                NUMERIC(12,2) DEFAULT 0,
  ai_suggested_price  NUMERIC(12,2),
  ajo_enabled         BOOLEAN DEFAULT FALSE,
  ajo_weeks           INTEGER DEFAULT 0,
  ajo_surcharge_pct   NUMERIC(5,4) DEFAULT 0,
  images              TEXT,
  is_copy             BOOLEAN DEFAULT FALSE,
  original_product_id INTEGER,
  copy_markup_pct     NUMERIC(5,4) DEFAULT 0.06,
  shareable_link      TEXT,
  demand_score        NUMERIC(4,3) DEFAULT 0.60,
  data_quality_score  NUMERIC(4,2) DEFAULT 0,
  annotation_status   TEXT DEFAULT 'pending',
  is_active           BOOLEAN DEFAULT TRUE,
  ai_badge            TEXT,
  ai_cta              TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER REFERENCES products(id) ON DELETE CASCADE,
  vendor_id     INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
  quantity      INTEGER NOT NULL DEFAULT 0,
  reserved      INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER DEFAULT 5,
  status        TEXT DEFAULT 'active'
                CHECK (status IN ('active','inactive','discontinued')),
  updated_at    TIMESTAMP DEFAULT NOW(),
  CONSTRAINT chk_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_reserved CHECK (reserved >= 0),
  CONSTRAINT chk_reserved_lte_qty CHECK (reserved <= quantity)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id          SERIAL PRIMARY KEY,
  product_id  INTEGER REFERENCES products(id),
  vendor_id   INTEGER REFERENCES vendors(id),
  type        TEXT NOT NULL
              CHECK (type IN ('sale','restock','reserve','release','adjustment','return')),
  quantity    INTEGER NOT NULL,
  reference   TEXT,
  note        TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ── INDEXES ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email       ON users(email);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id   ON vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_city      ON vendors(city);
CREATE INDEX IF NOT EXISTS idx_vendors_status    ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_products_vendor   ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_type     ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements     ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
