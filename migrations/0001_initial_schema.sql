-- ============================================================
-- SupportIQ D1 Initial Schema
-- Migration: 0001_initial_schema.sql
-- ============================================================

-- ---- TENANTS -----------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  subdomain   TEXT NOT NULL UNIQUE,
  plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- USERS -------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  first_name     TEXT NOT NULL DEFAULT '',
  last_name      TEXT NOT NULL DEFAULT '',
  role           TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin','agent','viewer')),
  avatar_url     TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);

-- ---- SESSIONS ----------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- ---- KNOWLEDGE BASES ---------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'empty' CHECK (status IN ('empty','indexing','indexed','error')),
  color       TEXT NOT NULL DEFAULT '#6a4cf5',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_kb_tenant_id ON knowledge_bases(tenant_id);

-- ---- DOCUMENTS ---------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  kb_id        TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  tenant_id    TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  file_size    INTEGER NOT NULL DEFAULT 0,
  mime_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  r2_key       TEXT NOT NULL,
  chunk_count  INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','chunking','embedding','indexed','error')),
  error_msg    TEXT,
  indexed_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_documents_kb_id     ON documents(kb_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);

-- ---- CONVERSATIONS -----------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
  id                    TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id             TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_identifier   TEXT NOT NULL,
  customer_name         TEXT DEFAULT 'Anonymous',
  customer_email        TEXT,
  channel               TEXT NOT NULL DEFAULT 'widget' CHECK (channel IN ('widget','email','api')),
  status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','ai_handling','escalated','resolved','closed')),
  assigned_agent_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  kb_id                 TEXT REFERENCES knowledge_bases(id) ON DELETE SET NULL,
  ai_confidence_last    REAL DEFAULT NULL,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_conv_tenant_id ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conv_status    ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conv_agent_id  ON conversations(assigned_agent_id);

-- ---- MESSAGES ----------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_type     TEXT NOT NULL CHECK (sender_type IN ('customer','ai','agent','system')),
  sender_id       TEXT,
  content         TEXT NOT NULL,
  confidence      REAL DEFAULT NULL,
  sources         TEXT DEFAULT '[]',
  escalate        INTEGER DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_id   ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON messages(tenant_id);

-- ---- TICKETS -----------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id         TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id   TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  subject           TEXT NOT NULL,
  description       TEXT DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority          TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name     TEXT DEFAULT '',
  customer_email    TEXT DEFAULT '',
  sla_deadline      TEXT,
  resolved_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id  ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status     ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_agent_id   ON tickets(assigned_agent_id);

-- ---- TICKET COMMENTS ---------------------------------------
CREATE TABLE IF NOT EXISTS ticket_comments (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ticket_id   TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_internal INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ---- WORKSPACE SETTINGS ------------------------------------
CREATE TABLE IF NOT EXISTS workspace_settings (
  tenant_id                 TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  ai_confidence_threshold   REAL NOT NULL DEFAULT 0.70,
  escalation_keywords       TEXT NOT NULL DEFAULT 'refund,cancel,angry,lawsuit,urgent',
  ai_welcome_message        TEXT NOT NULL DEFAULT 'Hi! I''m the AI support assistant. How can I help you today?',
  allow_human_request       INTEGER NOT NULL DEFAULT 1,
  widget_color              TEXT NOT NULL DEFAULT '#6a4cf5',
  api_key                   TEXT,
  timezone                  TEXT NOT NULL DEFAULT 'UTC',
  updated_at                TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---- API KEYS ----------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  key_hash    TEXT NOT NULL UNIQUE,
  key_prefix  TEXT NOT NULL,
  last_used   TEXT,
  expires_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash  ON api_keys(key_hash);

-- ---- SEED: Default demo tenant + admin ---------------------
INSERT OR IGNORE INTO tenants (id, name, subdomain, plan)
VALUES ('tenant_demo_001', 'Acme Corp', 'acme', 'pro');

INSERT OR IGNORE INTO workspace_settings (tenant_id)
VALUES ('tenant_demo_001');
