-- ============================================================
-- SupportIQ D1 Migration: Phase 2-6 additions
-- Migration: 0002_phase2_additions.sql
-- ============================================================

-- ---- Add Stripe customer ID to tenants ---------------------
ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT;

-- ---- Add widget and notification settings ------------------
ALTER TABLE workspace_settings ADD COLUMN widget_primary_color TEXT DEFAULT '#6a4cf5';
ALTER TABLE workspace_settings ADD COLUMN widget_greeting TEXT DEFAULT 'Hello! How can I help you today?';
ALTER TABLE workspace_settings ADD COLUMN widget_placeholder TEXT DEFAULT 'Type your message...';
ALTER TABLE workspace_settings ADD COLUMN widget_position TEXT DEFAULT 'bottom-right';
ALTER TABLE workspace_settings ADD COLUMN email_notifications INTEGER DEFAULT 0;
ALTER TABLE workspace_settings ADD COLUMN notification_email TEXT;
ALTER TABLE workspace_settings ADD COLUMN slack_webhook_url TEXT;
ALTER TABLE workspace_settings ADD COLUMN ai_model TEXT DEFAULT 'gpt-4o-mini';
ALTER TABLE workspace_settings ADD COLUMN max_tokens INTEGER DEFAULT 600;

-- ---- Add kb_id to api_keys for widget scoping ---------------
ALTER TABLE api_keys ADD COLUMN kb_id TEXT REFERENCES knowledge_bases(id);

-- ---- Add channel field to tickets ---------------------------
ALTER TABLE tickets ADD COLUMN channel TEXT DEFAULT 'manual' CHECK (channel IN ('manual','widget','email','api'));

-- ---- CSAT / Feedback table (Phase 5) -----------------------
CREATE TABLE IF NOT EXISTS csat_ratings (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id),
  ticket_id       TEXT REFERENCES tickets(id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_csat_tenant ON csat_ratings(tenant_id);

-- ---- Notifications log (Phase 4) ---------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     TEXT REFERENCES users(id),
  type        TEXT NOT NULL CHECK (type IN ('email','slack','webhook','in_app')),
  subject     TEXT,
  content     TEXT,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_tenant ON notifications(tenant_id, created_at);

-- ---- Webhooks table (Phase 6) ------------------------------
CREATE TABLE IF NOT EXISTS webhooks (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  secret      TEXT,
  events      TEXT NOT NULL DEFAULT '["ticket.created","ticket.updated","conversation.escalated"]',
  is_active   INTEGER NOT NULL DEFAULT 1,
  last_fired  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

-- ---- SLA due date on tickets --------------------------------
ALTER TABLE tickets ADD COLUMN sla_due_at TEXT;

-- ---- SSO settings (Phase 6) --------------------------------
ALTER TABLE workspace_settings ADD COLUMN sso_enabled INTEGER DEFAULT 0;
ALTER TABLE workspace_settings ADD COLUMN sso_provider TEXT;
ALTER TABLE workspace_settings ADD COLUMN sso_metadata_url TEXT;
ALTER TABLE workspace_settings ADD COLUMN sso_entity_id TEXT;
ALTER TABLE workspace_settings ADD COLUMN sso_acs_url TEXT;
ALTER TABLE workspace_settings ADD COLUMN sso_enforce INTEGER DEFAULT 0;

-- ---- Tenant slug for subdomain routing (Phase 6) ------------
ALTER TABLE tenants ADD COLUMN slug TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug) WHERE slug IS NOT NULL;

-- ---- API key timezone on workspace settings -----------------
ALTER TABLE workspace_settings ADD COLUMN timezone TEXT DEFAULT 'UTC+0';
