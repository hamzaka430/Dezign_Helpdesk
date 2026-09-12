// ============================================================
// SupportIQ — Tickets Routes
// GET    /api/tickets
// POST   /api/tickets
// GET    /api/tickets/:id
// PATCH  /api/tickets/:id
// DELETE /api/tickets/:id
// GET    /api/tickets/:id/comments
// POST   /api/tickets/:id/comments
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables, validateBody } from '../lib/middleware'
import { generateId } from '../lib/auth'

const tickets = new Hono<{ Bindings: Env; Variables: Variables }>()

// All ticket routes require auth
tickets.use('*', authMiddleware)

// ---- GET /api/tickets --------------------------------------

tickets.get('/', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const status = c.req.query('status') || ''
    const priority = c.req.query('priority') || ''

    const list = await db.listTickets(user.tenant_id, {
      status: status || undefined,
      priority: priority || undefined
    })

    return c.json({ tickets: list, total: list.length })
  } catch (err) {
    console.error('[GET /tickets]', err)
    return c.json({ error: 'Failed to fetch tickets' }, 500)
  }
})

// ---- POST /api/tickets -------------------------------------

tickets.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      subject?: string; description?: string; priority?: string
      customer_name?: string; customer_email?: string
      conversation_id?: string; assigned_agent_id?: string
    }>()

    const err = validateBody(body, ['subject'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const id = generateId('tkt')

    await db.createTicket({
      id,
      tenant_id: user.tenant_id,
      subject: body.subject!,
      description: body.description,
      priority: body.priority,
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      conversation_id: body.conversation_id,
      assigned_agent_id: body.assigned_agent_id
    })

    const ticket = await db.getTicketById(id, user.tenant_id)
    return c.json({ ticket }, 201)
  } catch (err) {
    console.error('[POST /tickets]', err)
    return c.json({ error: 'Failed to create ticket' }, 500)
  }
})

// ---- GET /api/tickets/:id ----------------------------------

tickets.get('/:id', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const ticket = await db.getTicketById(c.req.param('id'), user.tenant_id)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)
    return c.json({ ticket })
  } catch (err) {
    console.error('[GET /tickets/:id]', err)
    return c.json({ error: 'Failed to fetch ticket' }, 500)
  }
})

// ---- PATCH /api/tickets/:id --------------------------------

tickets.patch('/:id', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      status?: string; priority?: string; subject?: string; assigned_agent_id?: string
    }>()

    const db = new DB(c.env.DB)
    const existing = await db.getTicketById(c.req.param('id'), user.tenant_id)
    if (!existing) return c.json({ error: 'Ticket not found' }, 404)

    await db.updateTicket(c.req.param('id'), user.tenant_id, body as any)
    const updated = await db.getTicketById(c.req.param('id'), user.tenant_id)
    return c.json({ ticket: updated })
  } catch (err) {
    console.error('[PATCH /tickets/:id]', err)
    return c.json({ error: 'Failed to update ticket' }, 500)
  }
})

// ---- DELETE /api/tickets/:id -------------------------------

tickets.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    // Only admins can delete tickets
    if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const db = new DB(c.env.DB)
    const existing = await db.getTicketById(c.req.param('id'), user.tenant_id)
    if (!existing) return c.json({ error: 'Ticket not found' }, 404)

    await db.deleteTicket(c.req.param('id'), user.tenant_id)
    return c.json({ message: 'Ticket deleted' })
  } catch (err) {
    console.error('[DELETE /tickets/:id]', err)
    return c.json({ error: 'Failed to delete ticket' }, 500)
  }
})

// ---- GET /api/tickets/:id/comments -------------------------

tickets.get('/:id/comments', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const ticket = await db.getTicketById(c.req.param('id'), user.tenant_id)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)

    const comments = await db.listTicketComments(c.req.param('id'))
    return c.json({ comments })
  } catch (err) {
    console.error('[GET /tickets/:id/comments]', err)
    return c.json({ error: 'Failed to fetch comments' }, 500)
  }
})

// ---- POST /api/tickets/:id/comments ------------------------

tickets.post('/:id/comments', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{ content?: string; is_internal?: boolean }>()
    const err = validateBody(body, ['content'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const ticket = await db.getTicketById(c.req.param('id'), user.tenant_id)
    if (!ticket) return c.json({ error: 'Ticket not found' }, 404)

    const id = generateId('cmt')
    await db.addTicketComment({
      id,
      ticket_id: c.req.param('id'),
      tenant_id: user.tenant_id,
      author_id: user.sub,
      content: body.content!,
      is_internal: body.is_internal
    })

    const comments = await db.listTicketComments(c.req.param('id'))
    return c.json({ comments }, 201)
  } catch (err) {
    console.error('[POST /tickets/:id/comments]', err)
    return c.json({ error: 'Failed to add comment' }, 500)
  }
})

export default tickets
