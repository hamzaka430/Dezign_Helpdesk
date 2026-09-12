// ============================================================
// SupportIQ — D1 Database Helpers
// Typed query wrappers for every table
// ============================================================

export interface Tenant {
  id: string
  name: string
  subdomain: string
  plan: 'free' | 'pro' | 'enterprise'
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  tenant_id: string
  email: string
  password_hash: string
  first_name: string
  last_name: string
  role: 'admin' | 'agent' | 'viewer'
  avatar_url: string | null
  is_active: number
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface KnowledgeBase {
  id: string
  tenant_id: string
  name: string
  description: string
  status: 'empty' | 'indexing' | 'indexed' | 'error'
  color: string
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  kb_id: string
  tenant_id: string
  filename: string
  file_size: number
  mime_type: string
  r2_key: string
  chunk_count: number
  status: 'uploaded' | 'chunking' | 'embedding' | 'indexed' | 'error'
  error_msg: string | null
  indexed_at: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  tenant_id: string
  customer_identifier: string
  customer_name: string
  customer_email: string | null
  channel: 'widget' | 'email' | 'api'
  status: 'open' | 'ai_handling' | 'escalated' | 'resolved' | 'closed'
  assigned_agent_id: string | null
  kb_id: string | null
  ai_confidence_last: number | null
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  tenant_id: string
  sender_type: 'customer' | 'ai' | 'agent' | 'system'
  sender_id: string | null
  content: string
  confidence: number | null
  sources: string
  escalate: number
  created_at: string
}

export interface Ticket {
  id: string
  tenant_id: string
  conversation_id: string | null
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  assigned_agent_id: string | null
  customer_name: string
  customer_email: string
  sla_deadline: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface WorkspaceSettings {
  tenant_id: string
  ai_confidence_threshold: number
  escalation_keywords: string
  ai_welcome_message: string
  allow_human_request: number
  widget_color: string
  api_key: string | null
  timezone: string
  updated_at: string
}

export interface TicketComment {
  id: string
  ticket_id: string
  tenant_id: string
  author_id: string
  content: string
  is_internal: number
  created_at: string
}

// ============================================================
// DB helper class
// ============================================================

export class DB {
  constructor(private d1: D1Database) {}

  // ---- Tenants ---------------------------------------------

  async getTenantBySubdomain(subdomain: string): Promise<Tenant | null> {
    return this.d1.prepare('SELECT * FROM tenants WHERE subdomain = ?')
      .bind(subdomain).first<Tenant>()
  }

  async getTenantById(id: string): Promise<Tenant | null> {
    return this.d1.prepare('SELECT * FROM tenants WHERE id = ?')
      .bind(id).first<Tenant>()
  }

  async createTenant(data: { id: string; name: string; subdomain: string; plan?: string }): Promise<void> {
    await this.d1.prepare(
      'INSERT INTO tenants (id, name, subdomain, plan) VALUES (?, ?, ?, ?)'
    ).bind(data.id, data.name, data.subdomain, data.plan || 'free').run()
    // seed default workspace settings
    await this.d1.prepare('INSERT OR IGNORE INTO workspace_settings (tenant_id) VALUES (?)')
      .bind(data.id).run()
  }

  // ---- Users -----------------------------------------------

  async getUserByEmail(email: string): Promise<User | null> {
    return this.d1.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
      .bind(email.toLowerCase()).first<User>()
  }

  async getUserById(id: string): Promise<User | null> {
    return this.d1.prepare('SELECT * FROM users WHERE id = ? AND is_active = 1')
      .bind(id).first<User>()
  }

  async createUser(data: {
    id: string; tenant_id: string; email: string; password_hash: string
    first_name: string; last_name: string; role?: string
  }): Promise<void> {
    await this.d1.prepare(
      `INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.id, data.tenant_id, data.email.toLowerCase(),
      data.password_hash, data.first_name, data.last_name, data.role || 'admin'
    ).run()
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await this.d1.prepare(
      "UPDATE users SET last_login_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
    ).bind(id).run()
  }

  async listUsersByTenant(tenant_id: string): Promise<User[]> {
    const result = await this.d1.prepare(
      'SELECT * FROM users WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC'
    ).bind(tenant_id).all<User>()
    return result.results
  }

  // ---- Knowledge Bases -------------------------------------

  async listKBs(tenant_id: string): Promise<(KnowledgeBase & { doc_count: number })[]> {
    const result = await this.d1.prepare(`
      SELECT kb.*,
        (SELECT COUNT(*) FROM documents d WHERE d.kb_id = kb.id) AS doc_count
      FROM knowledge_bases kb
      WHERE kb.tenant_id = ?
      ORDER BY kb.created_at DESC
    `).bind(tenant_id).all<KnowledgeBase & { doc_count: number }>()
    return result.results
  }

  async getKBById(id: string, tenant_id: string): Promise<KnowledgeBase | null> {
    return this.d1.prepare('SELECT * FROM knowledge_bases WHERE id = ? AND tenant_id = ?')
      .bind(id, tenant_id).first<KnowledgeBase>()
  }

  async createKB(data: { id: string; tenant_id: string; name: string; description?: string; color?: string }): Promise<void> {
    await this.d1.prepare(
      'INSERT INTO knowledge_bases (id, tenant_id, name, description, color) VALUES (?, ?, ?, ?, ?)'
    ).bind(data.id, data.tenant_id, data.name, data.description || '', data.color || '#6a4cf5').run()
  }

  async updateKBStatus(id: string, status: KnowledgeBase['status']): Promise<void> {
    await this.d1.prepare(
      "UPDATE knowledge_bases SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(status, id).run()
  }

  async deleteKB(id: string, tenant_id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM knowledge_bases WHERE id = ? AND tenant_id = ?')
      .bind(id, tenant_id).run()
  }

  // ---- Documents -------------------------------------------

  async listDocuments(kb_id: string, tenant_id: string): Promise<Document[]> {
    const result = await this.d1.prepare(
      'SELECT * FROM documents WHERE kb_id = ? AND tenant_id = ? ORDER BY created_at DESC'
    ).bind(kb_id, tenant_id).all<Document>()
    return result.results
  }

  async createDocument(data: {
    id: string; kb_id: string; tenant_id: string; filename: string
    file_size: number; mime_type: string; r2_key: string
  }): Promise<void> {
    await this.d1.prepare(
      `INSERT INTO documents (id, kb_id, tenant_id, filename, file_size, mime_type, r2_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(data.id, data.kb_id, data.tenant_id, data.filename,
           data.file_size, data.mime_type, data.r2_key).run()
  }

  async updateDocumentStatus(id: string, status: Document['status'], extra: Partial<Document> = {}): Promise<void> {
    await this.d1.prepare(
      `UPDATE documents SET status = ?, chunk_count = COALESCE(?, chunk_count),
       error_msg = COALESCE(?, error_msg),
       indexed_at = CASE WHEN ? = 'indexed' THEN datetime('now') ELSE indexed_at END,
       updated_at = datetime('now') WHERE id = ?`
    ).bind(status, extra.chunk_count ?? null, extra.error_msg ?? null, status, id).run()
  }

  // ---- Conversations ---------------------------------------

  async listConversations(tenant_id: string, limit = 50): Promise<Conversation[]> {
    const result = await this.d1.prepare(
      'SELECT * FROM conversations WHERE tenant_id = ? ORDER BY updated_at DESC LIMIT ?'
    ).bind(tenant_id, limit).all<Conversation>()
    return result.results
  }

  async getConversationById(id: string, tenant_id: string): Promise<Conversation | null> {
    return this.d1.prepare('SELECT * FROM conversations WHERE id = ? AND tenant_id = ?')
      .bind(id, tenant_id).first<Conversation>()
  }

  async createConversation(data: {
    id: string; tenant_id: string; customer_identifier: string
    customer_name?: string; customer_email?: string; channel?: string; kb_id?: string
  }): Promise<void> {
    await this.d1.prepare(
      `INSERT INTO conversations
        (id, tenant_id, customer_identifier, customer_name, customer_email, channel, kb_id, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ai_handling')`
    ).bind(
      data.id, data.tenant_id, data.customer_identifier,
      data.customer_name || 'Anonymous', data.customer_email || null,
      data.channel || 'widget', data.kb_id || null
    ).run()
  }

  async updateConversationStatus(
    id: string,
    status: Conversation['status'],
    agent_id?: string
  ): Promise<void> {
    await this.d1.prepare(
      `UPDATE conversations SET status = ?, assigned_agent_id = COALESCE(?, assigned_agent_id),
       updated_at = datetime('now') WHERE id = ?`
    ).bind(status, agent_id || null, id).run()
  }

  // ---- Messages --------------------------------------------

  async listMessages(conversation_id: string, tenant_id: string): Promise<Message[]> {
    const result = await this.d1.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? AND tenant_id = ? ORDER BY created_at ASC'
    ).bind(conversation_id, tenant_id).all<Message>()
    return result.results
  }

  async createMessage(data: {
    id: string; conversation_id: string; tenant_id: string
    sender_type: Message['sender_type']; sender_id?: string
    content: string; confidence?: number; sources?: string[]; escalate?: boolean
  }): Promise<void> {
    await this.d1.prepare(
      `INSERT INTO messages (id, conversation_id, tenant_id, sender_type, sender_id, content, confidence, sources, escalate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.id, data.conversation_id, data.tenant_id,
      data.sender_type, data.sender_id || null, data.content,
      data.confidence ?? null,
      JSON.stringify(data.sources || []),
      data.escalate ? 1 : 0
    ).run()
    // bump conversation updated_at
    await this.d1.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
      .bind(data.conversation_id).run()
  }

  // ---- Tickets ---------------------------------------------

  async listTickets(tenant_id: string, filters: { status?: string; priority?: string } = {}): Promise<Ticket[]> {
    let query = 'SELECT * FROM tickets WHERE tenant_id = ?'
    const binds: unknown[] = [tenant_id]
    if (filters.status) { query += ' AND status = ?'; binds.push(filters.status) }
    if (filters.priority) { query += ' AND priority = ?'; binds.push(filters.priority) }
    query += ' ORDER BY created_at DESC LIMIT 100'
    const result = await this.d1.prepare(query).bind(...binds).all<Ticket>()
    return result.results
  }

  async getTicketById(id: string, tenant_id: string): Promise<Ticket | null> {
    return this.d1.prepare('SELECT * FROM tickets WHERE id = ? AND tenant_id = ?')
      .bind(id, tenant_id).first<Ticket>()
  }

  async createTicket(data: {
    id: string; tenant_id: string; subject: string; description?: string
    priority?: string; customer_name?: string; customer_email?: string
    conversation_id?: string; assigned_agent_id?: string
  }): Promise<void> {
    // SLA: urgent=4h, high=8h, medium=24h, low=72h
    const slaHours: Record<string, number> = { urgent: 4, high: 8, medium: 24, low: 72 }
    const priority = data.priority || 'medium'
    const sla = new Date(Date.now() + (slaHours[priority] || 24) * 3_600_000).toISOString()
    await this.d1.prepare(
      `INSERT INTO tickets (id, tenant_id, conversation_id, subject, description, priority,
        customer_name, customer_email, assigned_agent_id, sla_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.id, data.tenant_id, data.conversation_id || null,
      data.subject, data.description || '', priority,
      data.customer_name || '', data.customer_email || '',
      data.assigned_agent_id || null, sla
    ).run()
  }

  async updateTicket(id: string, tenant_id: string, updates: Partial<Ticket>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    if (updates.status !== undefined)  { fields.push('status = ?');  values.push(updates.status)  }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority) }
    if (updates.assigned_agent_id !== undefined) { fields.push('assigned_agent_id = ?'); values.push(updates.assigned_agent_id) }
    if (updates.subject !== undefined)  { fields.push('subject = ?');  values.push(updates.subject)  }
    if (fields.length === 0) return
    if (updates.status === 'resolved') {
      fields.push("resolved_at = datetime('now')")
    }
    fields.push("updated_at = datetime('now')")
    values.push(id, tenant_id)
    await this.d1.prepare(
      `UPDATE tickets SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...values).run()
  }

  async deleteTicket(id: string, tenant_id: string): Promise<void> {
    await this.d1.prepare('DELETE FROM tickets WHERE id = ? AND tenant_id = ?')
      .bind(id, tenant_id).run()
  }

  // ---- Ticket Comments -------------------------------------

  async listTicketComments(ticket_id: string): Promise<TicketComment[]> {
    const result = await this.d1.prepare(
      'SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC'
    ).bind(ticket_id).all<TicketComment>()
    return result.results
  }

  async addTicketComment(data: {
    id: string; ticket_id: string; tenant_id: string; author_id: string; content: string; is_internal?: boolean
  }): Promise<void> {
    await this.d1.prepare(
      'INSERT INTO ticket_comments (id, ticket_id, tenant_id, author_id, content, is_internal) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(data.id, data.ticket_id, data.tenant_id, data.author_id, data.content, data.is_internal ? 1 : 0).run()
  }

  // ---- Workspace Settings ----------------------------------

  async getSettings(tenant_id: string): Promise<WorkspaceSettings | null> {
    return this.d1.prepare('SELECT * FROM workspace_settings WHERE tenant_id = ?')
      .bind(tenant_id).first<WorkspaceSettings>()
  }

  async upsertSettings(tenant_id: string, updates: Partial<WorkspaceSettings>): Promise<void> {
    const fields = Object.keys(updates).filter(k => k !== 'tenant_id')
    if (fields.length === 0) return
    const setClauses = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => (updates as Record<string, unknown>)[f])
    await this.d1.prepare(
      `INSERT INTO workspace_settings (tenant_id) VALUES (?)
       ON CONFLICT(tenant_id) DO UPDATE SET ${setClauses}, updated_at = datetime('now')`
    ).bind(tenant_id, ...values).run()
  }

  // ---- Analytics ------------------------------------------

  async getStats(tenant_id: string): Promise<{
    tickets: { total: number; open: number; in_progress: number; resolved: number }
    conversations: { total: number; ai_handling: number; escalated: number }
    ai_resolution_rate: number
  }> {
    const ticketStats = await this.d1.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) AS resolved
      FROM tickets WHERE tenant_id = ?
    `).bind(tenant_id).first<{ total: number; open: number; in_progress: number; resolved: number }>()

    const convStats = await this.d1.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'ai_handling' THEN 1 ELSE 0 END) AS ai_handling,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved
      FROM conversations WHERE tenant_id = ?
    `).bind(tenant_id).first<{ total: number; ai_handling: number; escalated: number; resolved: number }>()

    const t = ticketStats || { total: 0, open: 0, in_progress: 0, resolved: 0 }
    const c = convStats || { total: 0, ai_handling: 0, escalated: 0, resolved: 0 }
    const aiRate = c.total > 0 ? Math.round(((c.resolved - c.escalated) / c.total) * 100 * 10) / 10 : 0

    return {
      tickets: { total: t.total, open: t.open, in_progress: t.in_progress, resolved: t.resolved },
      conversations: { total: c.total, ai_handling: c.ai_handling, escalated: c.escalated },
      ai_resolution_rate: Math.max(0, aiRate)
    }
  }
}
