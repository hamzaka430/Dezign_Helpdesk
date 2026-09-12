// ============================================================
// SupportIQ — Real AI Chat Route (Phase 2)
// POST /api/chat           — RAG-powered chat (widget/external)
// POST /api/chat/agent     — Agent-side GPT assist
// GET  /api/chat/status    — Check AI configuration
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { Env, Variables, apiKeyMiddleware, authMiddleware } from '../lib/middleware'
import { generateId } from '../lib/auth'
import { ragAnswer, ChatMessage } from '../lib/ai'

const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

// ---- GET /api/chat/status ----------------------------------
// Public endpoint: check if AI is configured

chat.get('/status', (c) => {
  return c.json({
    ai_enabled: !!c.env.OPENAI_API_KEY,
    vector_search: !!(c.env.QDRANT_URL && c.env.QDRANT_API_KEY),
    model: c.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'fallback',
    version: '2.0.0',
  })
})

// ---- POST /api/chat ----------------------------------------
// Widget/external: accepts X-API-Key header OR public (for demo)

chat.post('/', async (c) => {
  try {
    const body = await c.req.json<{
      message?: string
      conversation_id?: string
      kb_id?: string
      customer_name?: string
      customer_email?: string
      customer_id?: string
    }>()

    const { message, conversation_id, kb_id, customer_name, customer_email, customer_id } = body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return c.json({ error: 'message is required' }, 422)
    }

    // Determine tenant (from API key header or fall back to demo tenant)
    const apiKey = c.req.header('X-API-Key')
    let tenantId = 'tenant_demo_001'
    let convId = conversation_id

    if (c.env.DB) {
      const db = new DB(c.env.DB)

      // If API key provided, resolve tenant
      if (apiKey) {
        const keyRow = await c.env.DB.prepare(
          `SELECT ak.*, u.tenant_id FROM api_keys ak
           JOIN users u ON u.id = ak.created_by
           WHERE ak.key_prefix = ? AND ak.is_active = 1`
        ).bind(apiKey.slice(0, 8)).first() as Record<string, unknown> | null
        if (keyRow) tenantId = keyRow.tenant_id as string
      }

      // Ensure conversation exists
      if (!convId) {
        convId = generateId('conv')
        await db.createConversation({
          id: convId,
          tenant_id: tenantId,
          customer_identifier: customer_id || customer_email || generateId('cust'),
          customer_name: customer_name || 'Website Visitor',
          customer_email: customer_email || null,
          channel: 'widget',
          kb_id: kb_id || null,
        })
      }

      // Load recent conversation history for context
      const history = await db.listMessages(convId, tenantId)
      const conversationHistory: ChatMessage[] = history.slice(-10).map(m => ({
        role: m.sender_type === 'customer' ? 'user' : 'assistant',
        content: m.content,
      }))

      // Save customer message
      await db.createMessage({
        id: generateId('msg'),
        conversation_id: convId,
        tenant_id: tenantId,
        sender_type: 'customer',
        content: message.trim(),
      })

      // Run RAG pipeline (real or fallback)
      let aiResponse
      if (c.env.OPENAI_API_KEY) {
        aiResponse = await ragAnswer({
          query: message.trim(),
          tenantId,
          kbId: kb_id || null,
          conversationHistory,
          openaiKey: c.env.OPENAI_API_KEY,
          qdrantUrl: c.env.QDRANT_URL || '',
          qdrantKey: c.env.QDRANT_API_KEY || '',
        })
      } else {
        // Graceful fallback if no OpenAI key
        aiResponse = {
          content: getFallbackResponse(message),
          confidence: 0.6,
          sources: [],
          escalate: false,
          model: 'fallback',
        }
      }

      // Save AI response message
      const aiMsgId = generateId('msg')
      await db.createMessage({
        id: aiMsgId,
        conversation_id: convId,
        tenant_id: tenantId,
        sender_type: 'ai',
        content: aiResponse.content,
        confidence: aiResponse.confidence,
        sources: aiResponse.sources,
        escalate: aiResponse.escalate,
      })

      // Auto-escalate conversation if confidence too low
      if (aiResponse.escalate) {
        await c.env.DB.prepare(
          `UPDATE conversations SET status = 'escalated', updated_at = ? WHERE id = ? AND tenant_id = ?`
        ).bind(new Date().toISOString(), convId, tenantId).run()

        // Add system message about escalation
        await db.createMessage({
          id: generateId('msg'),
          conversation_id: convId,
          tenant_id: tenantId,
          sender_type: 'system',
          content: 'This conversation has been escalated to a human agent.',
        })
      }

      // Update conversation's last activity
      await c.env.DB.prepare(
        `UPDATE conversations SET ai_confidence_last = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`
      ).bind(aiResponse.confidence, new Date().toISOString(), convId, tenantId).run()

      return c.json({
        message: aiResponse.content,
        content: aiResponse.content,
        confidence: aiResponse.confidence,
        sources: aiResponse.sources,
        escalate: aiResponse.escalate,
        conversation_id: convId,
        message_id: aiMsgId,
        model: aiResponse.model,
      })
    }

    // No DB — pure AI response without persistence
    if (c.env.OPENAI_API_KEY) {
      const aiResponse = await ragAnswer({
        query: message.trim(),
        tenantId,
        kbId: kb_id || null,
        conversationHistory: [],
        openaiKey: c.env.OPENAI_API_KEY,
        qdrantUrl: c.env.QDRANT_URL || '',
        qdrantKey: c.env.QDRANT_API_KEY || '',
      })
      return c.json({ ...aiResponse, content: aiResponse.content, message: aiResponse.content })
    }

    return c.json({
      message: getFallbackResponse(message),
      content: getFallbackResponse(message),
      confidence: 0.6,
      sources: [],
      escalate: false,
      model: 'fallback',
    })
  } catch (err) {
    console.error('[POST /api/chat]', err)
    return c.json({
      message: "I'm having technical difficulties. Please try again in a moment.",
      content: "I'm having technical difficulties. Please try again in a moment.",
      confidence: 0.1,
      sources: [],
      escalate: true,
      model: 'error',
    }, 200) // 200 so the widget doesn't crash
  }
})

// ---- POST /api/chat/agent ----------------------------------
// Agent-assisted reply: GPT drafts a reply for the agent to review

chat.post('/agent', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{ conversation_id: string; draft_context?: string }>()

    if (!body.conversation_id) return c.json({ error: 'conversation_id required' }, 422)
    if (!c.env.OPENAI_API_KEY) return c.json({ error: 'AI not configured' }, 503)

    const db = new DB(c.env.DB)
    const messages = await db.listMessages(body.conversation_id, user.tenant_id)
    if (!messages.length) return c.json({ error: 'Conversation not found' }, 404)

    // Build history for GPT
    const history: ChatMessage[] = messages.slice(-8).map(m => ({
      role: m.sender_type === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }))

    // Ask GPT to draft a helpful agent reply
    const { chatCompletion } = await import('../lib/ai')
    const systemPrompt = `You are a customer support agent assistant. 
Based on the conversation below, draft a helpful, empathetic, and professional reply to the customer.
The reply should be ready for the agent to send with minimal editing.
Keep it concise (2-4 sentences max). ${body.draft_context ? `Additional context: ${body.draft_context}` : ''}`

    const result = await chatCompletion(
      [{ role: 'system', content: systemPrompt }, ...history],
      c.env.OPENAI_API_KEY,
      'gpt-4o-mini'
    )

    return c.json({ draft: result.content, usage: result.usage })
  } catch (err) {
    console.error('[POST /api/chat/agent]', err)
    return c.json({ error: 'Failed to generate draft' }, 500)
  }
})

// ── Fallback responses when AI is not configured ────────────
function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('password') || lower.includes('reset') || lower.includes('login')) {
    return "For password resets, click 'Forgot Password' on the login page. You'll receive an email within 5 minutes. Check your spam folder if needed."
  }
  if (lower.includes('billing') || lower.includes('invoice') || lower.includes('charge') || lower.includes('payment')) {
    return "Billing charges are processed on the 1st of each month. For specific billing questions, please provide your invoice number or email our billing team."
  }
  if (lower.includes('cancel') || lower.includes('refund')) {
    return "To cancel or request a refund, please contact our support team. Cancellations take effect at the end of your current billing period."
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hello! How can I help you today? I can assist with account issues, billing questions, or technical problems."
  }
  return "I want to make sure you get the best help possible. Let me connect you with one of our support agents who can assist you further."
}

export default chat
