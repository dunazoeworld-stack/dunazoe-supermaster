-- ================================================================
-- DUNAZOE OS — SCHEMA PHASE 5-8
-- Payments, Webhooks, Disputes, Notifications, Logistics
-- Run AFTER schema-phase3-4.sql
-- ================================================================

-- ── WEBHOOK LOG (idempotency + audit) ─────────────────────────
CREATE TABLE IF NOT EXISTS webhook_log (
  id          SERIAL PRIMARY KEY,
  provider    TEXT NOT NULL CHECK (provider IN ('paystack','stripe','shipbubble')),
  event_type  TEXT NOT NULL,
  reference   TEXT UNIQUE,
  payload     TEXT,
  processed   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_ref      ON webhook_log(reference);
CREATE INDEX IF NOT EXISTS idx_webhook_provider ON webhook_log(provider);

-- ── DISPUTES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER REFERENCES orders(id),
  raised_by     INTEGER REFERENCES users(id),
  against       INTEGER REFERENCES users(id),
  reason        TEXT NOT NULL,
  evidence_urls TEXT,
  status        TEXT DEFAULT 'open'
                CHECK (status IN ('open','evidence_pending','under_review',
                                  'resolved_buyer','resolved_vendor','escalated','closed')),
  decision      TEXT,
  decided_by    INTEGER REFERENCES users(id),
  refund_issued BOOLEAN DEFAULT FALSE,
  refund_amount NUMERIC(12,2) DEFAULT 0,
  raised_at     TIMESTAMP DEFAULT NOW(),
  evidence_deadline TIMESTAMP,
  resolved_at   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disputes_order  ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ── LOGISTICS / DELIVERY ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_agents (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) UNIQUE,
  vendor_id         INTEGER REFERENCES vendors(id),
  state             TEXT,
  city              TEXT,
  lat               NUMERIC(10,6) DEFAULT 0,
  lng               NUMERIC(10,6) DEFAULT 0,
  is_available      BOOLEAN DEFAULT TRUE,
  total_deliveries  INTEGER DEFAULT 0,
  milestone_count   INTEGER DEFAULT 0,
  total_earned      NUMERIC(12,2) DEFAULT 0,
  pending_bonus     NUMERIC(12,2) DEFAULT 0,
  rating            NUMERIC(3,2) DEFAULT 5.00,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_assignments (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER REFERENCES orders(id),
  agent_id      INTEGER REFERENCES delivery_agents(id),
  status        TEXT DEFAULT 'assigned'
                CHECK (status IN ('assigned','accepted','picked_up',
                                  'in_transit','nearby','delivered','failed')),
  accepted_at   TIMESTAMP,
  picked_up_at  TIMESTAMP,
  delivered_at  TIMESTAMP,
  photo_proof   TEXT,
  gps_lat       NUMERIC(10,6),
  gps_lng       NUMERIC(10,6),
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipbubble_shipments (
  id                  SERIAL PRIMARY KEY,
  order_id            INTEGER REFERENCES orders(id),
  shipbubble_ref      TEXT UNIQUE,
  tracking_url        TEXT,
  origin_city         TEXT,
  dest_city           TEXT,
  status              TEXT DEFAULT 'initiated'
                      CHECK (status IN ('initiated','picked_up','in_transit',
                                        'out_for_delivery','delivered','failed','returned')),
  estimated_delivery  DATE,
  actual_delivery     TIMESTAMP,
  cost                NUMERIC(12,2) DEFAULT 0,
  carrier             TEXT,
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_del_agents_state  ON delivery_agents(state, city);
CREATE INDEX IF NOT EXISTS idx_del_assign_order  ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_del_assign_agent  ON delivery_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_shipbubble_order  ON shipbubble_shipments(order_id);

-- ── AUDIT LOG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          SERIAL PRIMARY KEY,
  actor_id    INTEGER REFERENCES users(id),
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  detail      TEXT,
  ip_address  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON audit_log(created_at);

-- ── IN-APP CHAT ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_messages (
  id          SERIAL PRIMARY KEY,
  sender_id   INTEGER REFERENCES users(id),
  receiver_id INTEGER REFERENCES users(id),
  order_id    INTEGER REFERENCES orders(id),
  message     TEXT NOT NULL,
  msg_type    TEXT DEFAULT 'text' CHECK (msg_type IN ('text','image','file')),
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sender   ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_receiver ON chat_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_chat_order    ON chat_messages(order_id);

-- ── WHATSAPP / SMS QUEUE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_queue (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  channel     TEXT DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','email')),
  status      TEXT DEFAULT 'queued'   CHECK (status IN ('queued','sent','failed')),
  attempts    INTEGER DEFAULT 0,
  sent_at     TIMESTAMP,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_msg_queue_status ON message_queue(status);

-- ── REVIEWS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  reviewer_id   INTEGER REFERENCES users(id),
  vendor_id     INTEGER REFERENCES vendors(id),
  product_id    INTEGER REFERENCES products(id),
  order_id      INTEGER REFERENCES orders(id) UNIQUE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  is_verified   BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vendor  ON reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- ── COPY TRADERS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS copy_traders (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) UNIQUE,
  source_vendor_id  INTEGER REFERENCES vendors(id),
  markup_pct        NUMERIC(5,4) DEFAULT 0.06,
  total_sales       INTEGER DEFAULT 0,
  total_earned      NUMERIC(12,2) DEFAULT 0,
  is_active         BOOLEAN DEFAULT TRUE,
  shareable_link    TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

-- ── SESSIONS (if not already created) ────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ── ADMIN STAFF ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_staff (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER REFERENCES users(id),
  office        TEXT NOT NULL,
  jurisdiction  TEXT,
  level         TEXT DEFAULT 'staff',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);
