// ============================================================
// SupportIQ — Conversations Routes
// GET    /api/conversations
// POST   /api/conversations
// GET    /api/conversations/:id
// GET    /api/conversations/:id/messages
// POST   /api/conversations/:id/messages
// PATCH  /api/conversations/:id/status
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables, validateBody } from '../lib/middleware'
import { generateId } from '../lib/auth'

const conversations = new Hono<{ Bindings: Env; Variables: Variables }>()

conversations.use('*', authMiddleware)

// ---- GET /api/conversations --------------------------------

conversations.get('/', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const list = await db.listConversations(user.tenant_id)
    return c.json({ conversations: list, total: list.length })
  } catch (err) {
    console.error('[GET /conversations]', err)
    return c.json({ error: 'Failed to fetch conversations' }, 500)
  }
})

// ---- POST /api/conversations (start a new conversation) ----

conversations.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      customer_identifier?: string; customer_name?: string
      customer_email?: string; channel?: string; kb_id?: string
    }>()

    const err = validateBody(body, ['customer_identifier'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const id = generateId('conv')

    await db.createConversation({
      id,
      tenant_id: user.tenant_id,
      customer_identifier: body.customer_identifier!,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      channel: body.channel,
      kb_id: body.kb_id
    })

    const conv = await db.getConversationById(id, user.tenant_id)
    return c.json({ conversation: conv }, 201)
  } catch (err) {
    console.error('[POST /conversations]', err)
    return c.json({ error: 'Failed to create conversation' }, 500)
  }
})

// ---- GET /api/conversations/:id ----------------------------

conversations.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const conv = await db.getConversationById(c.req.param('id'), user.tenant_id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)
    return c.json({ conversation: conv })
  } catch (err) {
    return c.json({ error: 'Failed to fetch conversation' }, 500)
  }
})

// ---- GET /api/conversations/:id/messages -------------------

conversations.get('/:id/messages', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const conv = await db.getConversationById(c.req.param('id'), user.tenant_id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)
    const msgs = await db.listMessages(c.req.param('id'), user.tenant_id)
    return c.json({ messages: msgs })
  } catch (err) {
    return c.json({ error: 'Failed to fetch messages' }, 500)
  }
})

// ---- POST /api/conversations/:id/messages (agent reply) ----

conversations.post('/:id/messages', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{ content?: string }>()
    const err = validateBody(body, ['content'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const conv = await db.getConversationById(c.req.param('id'), user.tenant_id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)

    const msgId = generateId('msg')
    await db.createMessage({
      id: msgId,
      conversation_id: c.req.param('id'),
      tenant_id: user.tenant_id,
      sender_type: 'agent',
      sender_id: user.sub,
      content: body.content!
    })

    const messages = await db.listMessages(c.req.param('id'), user.tenant_id)
    return c.json({ messages }, 201)
  } catch (err) {
    console.error('[POST /conversations/:id/messages]', err)
    return c.json({ error: 'Failed to send message' }, 500)
  }
})

// ---- PATCH /api/conversations/:id/status -------------------

conversations.patch('/:id/status', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{ status?: string; assigned_agent_id?: string }>()
    const err = validateBody(body, ['status'])
    if (err) return c.json({ error: err }, 422)

    const validStatuses = ['open', 'ai_handling', 'escalated', 'resolved', 'closed']
    if (!validStatuses.includes(body.status!)) {
      return c.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, 422)
    }

    const db = new DB(c.env.DB)
    const conv = await db.getConversationById(c.req.param('id'), user.tenant_id)
    if (!conv) return c.json({ error: 'Conversation not found' }, 404)

    await db.updateConversationStatus(
      c.req.param('id'),
      body.status as any,
      body.assigned_agent_id
    )

    // If escalated, log a system message
    if (body.status === 'escalated') {
      await db.createMessage({
        id: generateId('msg'),
        conversation_id: c.req.param('id'),
        tenant_id: user.tenant_id,
        sender_type: 'system',
        content: `Conversation escalated to human agent${body.assigned_agent_id ? ' and assigned' : ''}`
      })
    }

    const updated = await db.getConversationById(c.req.param('id'), user.tenant_id)
    return c.json({ conversation: updated })
  } catch (err) {
    console.error('[PATCH /conversations/:id/status]', err)
    return c.json({ error: 'Failed to update conversation' }, 500)
  }
})

export default conversations
