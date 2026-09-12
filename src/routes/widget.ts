// ============================================================
// SupportIQ — Widget API Routes (Phase 5)
// GET  /api/widget/config     — Fetch widget config by API key
// POST /api/widget/init       — Init conversation (returns conv ID)
// POST /api/widget/message    — Send message, get AI reply
// GET  /api/widget/messages   — Get conversation history
// GET  /api/widget.js         — Serve the embeddable widget script
// ============================================================

import { Hono } from 'hono'
import { Env, Variables } from '../lib/middleware'
import { generateId } from '../lib/auth'
import { DB } from '../lib/db'
import { ragAnswer, ChatMessage } from '../lib/ai'

const widget = new Hono<{ Bindings: Env; Variables: Variables }>()

// ── Helper: resolve tenant from API key header ───────────────
async function resolveTenant(
  c: { req: { header: (k: string) => string | undefined }; env: Env }
): Promise<{ tenant_id: string; kb_id: string | null } | null> {
  const apiKey = c.req.header('X-API-Key')
  if (!apiKey) return null

  const row = await c.env.DB.prepare(
    `SELECT ak.id as ak_id, u.tenant_id, ak.kb_id
     FROM api_keys ak
     JOIN users u ON u.id = ak.created_by
     WHERE ak.key_prefix = ? AND ak.is_active = 1`
  ).bind(apiKey.slice(0, 8)).first<{ ak_id: string; tenant_id: string; kb_id: string | null }>()

  if (!row) return null

  // Update last_used_at
  await c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), row.ak_id).run()

  return { tenant_id: row.tenant_id, kb_id: row.kb_id }
}

// ---- GET /api/widget/config --------------------------------

widget.get('/config', async (c) => {
  c.header('Access-Control-Allow-Origin', '*')
  try {
    const tenant = await resolveTenant(c)
    if (!tenant) {
      // Return default config for demo
      return c.json({
        tenant_id: 'demo',
        name: 'SupportIQ',
        primary_color: '#6a4cf5',
        greeting: 'Hello! How can I help you today?',
        placeholder: 'Type your message...',
        ai_enabled: false,
        widget_position: 'bottom-right',
      })
    }

    const db = new DB(c.env.DB)
    const settings = await db.getSettings(tenant.tenant_id)
    const tenantData = await db.getTenantById(tenant.tenant_id)

    return c.json({
      tenant_id: tenant.tenant_id,
      name: tenantData?.name || 'Support',
      primary_color: settings?.widget_primary_color || '#6a4cf5',
      greeting: settings?.widget_greeting || 'Hello! How can I help you today?',
      placeholder: settings?.widget_placeholder || 'Type your message...',
      ai_enabled: !!c.env.OPENAI_API_KEY,
      widget_position: settings?.widget_position || 'bottom-right',
    })
  } catch (err) {
    console.error('[GET /widget/config]', err)
    return c.json({ error: 'Failed to fetch config' }, 500)
  }
})

// ---- POST /api/widget/init ---------------------------------

widget.post('/init', async (c) => {
  c.header('Access-Control-Allow-Origin', '*')
  try {
    const body = await c.req.json<{
      customer_name?: string
      customer_email?: string
      customer_id?: string
      metadata?: Record<string, string>
    }>()

    const tenant = await resolveTenant(c)
    const tenantId = tenant?.tenant_id || 'tenant_demo_001'

    const db = new DB(c.env.DB)
    const convId = generateId('conv')

    await db.createConversation({
      id: convId,
      tenant_id: tenantId,
      customer_identifier: body.customer_id || body.customer_email || generateId('vis'),
      customer_name: body.customer_name || 'Website Visitor',
      customer_email: body.customer_email || null,
      channel: 'widget',
      kb_id: tenant?.kb_id || null,
    })

    return c.json({
      conversation_id: convId,
      tenant_id: tenantId,
    })
  } catch (err) {
    console.error('[POST /widget/init]', err)
    return c.json({ error: 'Failed to initialize conversation' }, 500)
  }
})

// ---- POST /api/widget/message ------------------------------

widget.post('/message', async (c) => {
  c.header('Access-Control-Allow-Origin', '*')
  try {
    const body = await c.req.json<{
      conversation_id: string
      message: string
      customer_name?: string
      customer_email?: string
    }>()

    if (!body.conversation_id || !body.message) {
      return c.json({ error: 'conversation_id and message required' }, 422)
    }

    const tenant = await resolveTenant(c)
    const tenantId = tenant?.tenant_id || 'tenant_demo_001'

    const db = new DB(c.env.DB)

    // Verify conversation belongs to this tenant
    const conv = await c.env.DB.prepare(
      `SELECT * FROM conversations WHERE id = ? AND tenant_id = ?`
    ).bind(body.conversation_id, tenantId).first() as Record<string, unknown> | null

    if (!conv) return c.json({ error: 'Conversation not found' }, 404)

    // Persist customer message
    await db.createMessage({
      id: generateId('msg'),
      conversation_id: body.conversation_id,
      tenant_id: tenantId,
      sender_type: 'customer',
      content: body.message,
    })

    // Load history for context
    const history = await db.listMessages(body.conversation_id, tenantId)
    const conversationHistory: ChatMessage[] = history.slice(-8).map(m => ({
      role: m.sender_type === 'customer' ? 'user' : 'assistant',
      content: m.content,
    }))

    // Run AI
    let aiResp
    if (c.env.OPENAI_API_KEY) {
      aiResp = await ragAnswer({
        query: body.message,
        tenantId,
        kbId: (conv.kb_id as string) || null,
        conversationHistory,
        openaiKey: c.env.OPENAI_API_KEY,
        qdrantUrl: c.env.QDRANT_URL || '',
        qdrantKey: c.env.QDRANT_API_KEY || '',
      })
    } else {
      aiResp = {
        content: getFallbackResponse(body.message),
        confidence: 0.6,
        sources: [] as string[],
        escalate: false,
        model: 'fallback',
      }
    }

    // Persist AI reply
    const aiMsgId = generateId('msg')
    await db.createMessage({
      id: aiMsgId,
      conversation_id: body.conversation_id,
      tenant_id: tenantId,
      sender_type: 'ai',
      content: aiResp.content,
      confidence: aiResp.confidence,
      sources: aiResp.sources,
      escalate: aiResp.escalate,
    })

    // Update conversation status
    if (aiResp.escalate) {
      await c.env.DB.prepare(
        `UPDATE conversations SET status='escalated', updated_at=? WHERE id=? AND tenant_id=?`
      ).bind(new Date().toISOString(), body.conversation_id, tenantId).run()
    } else {
      await c.env.DB.prepare(
        `UPDATE conversations SET ai_confidence_last=?, updated_at=? WHERE id=? AND tenant_id=?`
      ).bind(aiResp.confidence, new Date().toISOString(), body.conversation_id, tenantId).run()
    }

    return c.json({
      reply: aiResp.content,
      confidence: aiResp.confidence,
      sources: aiResp.sources,
      escalate: aiResp.escalate,
      message_id: aiMsgId,
    })
  } catch (err) {
    console.error('[POST /widget/message]', err)
    return c.json({
      reply: "I'm sorry, I'm having trouble right now. Please try again.",
      confidence: 0.1,
      sources: [],
      escalate: false,
    }, 200)
  }
})

// ---- GET /api/widget/messages ------------------------------

widget.get('/messages', async (c) => {
  c.header('Access-Control-Allow-Origin', '*')
  try {
    const convId = c.req.query('conversation_id')
    if (!convId) return c.json({ error: 'conversation_id required' }, 422)

    const tenant = await resolveTenant(c)
    const tenantId = tenant?.tenant_id || 'tenant_demo_001'

    const db = new DB(c.env.DB)
    const messages = await db.listMessages(convId, tenantId)

    return c.json({
      messages: messages.map(m => ({
        id: m.id,
        role: m.sender_type,
        content: m.content,
        confidence: m.confidence,
        sources: m.sources ? JSON.parse(m.sources) : [],
        created_at: m.created_at,
      })),
    })
  } catch (err) {
    console.error('[GET /widget/messages]', err)
    return c.json({ error: 'Failed to fetch messages' }, 500)
  }
})

// ── Widget JS bundle (embeddable) ────────────────────────────
// Served at /api/widget/widget.js for embedding on any website

widget.get('/widget.js', (c) => {
  c.header('Content-Type', 'application/javascript')
  c.header('Access-Control-Allow-Origin', '*')
  c.header('Cache-Control', 'public, max-age=3600')

  const js = `
(function() {
  'use strict';
  
  // ── Config ──────────────────────────────────────────────────
  const script = document.currentScript || document.querySelector('script[data-supportiq-key]');
  const API_KEY = script && (script.getAttribute('data-supportiq-key') || script.dataset.supportiqKey);
  const BASE_URL = script && (script.getAttribute('data-supportiq-url') || window.location.origin);
  const POSITION = (script && script.getAttribute('data-position')) || 'bottom-right';
  
  if (!API_KEY && !window.SupportIQ) {
    console.warn('[SupportIQ] No API key found. Add data-supportiq-key attribute.');
  }
  
  let convId = sessionStorage.getItem('siq_conv_id');
  let config = { primary_color: '#6a4cf5', greeting: 'Hello! How can I help?', name: 'Support', placeholder: 'Type a message...' };
  
  // ── Styles ──────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = \`
    #siq-widget-btn { position:fixed; width:56px; height:56px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 20px rgba(0,0,0,0.3); z-index:9999; transition:transform 0.2s, box-shadow 0.2s; background:var(--siq-color,#6a4cf5); }
    #siq-widget-btn:hover { transform:scale(1.08); box-shadow:0 6px 28px rgba(0,0,0,0.4); }
    #siq-widget-btn svg { width:24px; height:24px; }
    #siq-chat-window { position:fixed; width:380px; height:600px; background:#111; border:1px solid #262626; border-radius:20px; overflow:hidden; display:none; flex-direction:column; z-index:9998; box-shadow:0 20px 60px rgba(0,0,0,0.6); font-family:system-ui,-apple-system,sans-serif; }
    #siq-chat-window.open { display:flex; }
    #siq-header { padding:16px 20px; display:flex; align-items:center; gap:10px; background:#1a1a1a; flex-shrink:0; }
    #siq-header-avatar { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; }
    #siq-messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
    #siq-messages::-webkit-scrollbar { width:3px; }
    #siq-messages::-webkit-scrollbar-thumb { background:#333; border-radius:2px; }
    .siq-msg { max-width:82%; padding:10px 14px; border-radius:12px; font-size:14px; line-height:1.5; }
    .siq-msg-ai { background:rgba(106,76,245,0.15); border:1px solid rgba(106,76,245,0.2); color:#e0e0e0; align-self:flex-start; border-radius:12px 12px 12px 4px; }
    .siq-msg-user { background:#333; color:#e0e0e0; align-self:flex-end; border-radius:12px 12px 4px 12px; }
    .siq-msg-sources { margin-top:6px; display:flex; flex-wrap:wrap; gap:4px; }
    .siq-source { font-size:11px; background:rgba(106,76,245,0.25); color:#a090ff; padding:2px 8px; border-radius:100px; }
    #siq-input-area { padding:12px 16px; background:#1a1a1a; display:flex; gap:8px; flex-shrink:0; border-top:1px solid #262626; }
    #siq-input { flex:1; background:#262626; border:1px solid #333; border-radius:100px; padding:10px 16px; color:#e0e0e0; font-size:13px; outline:none; font-family:inherit; }
    #siq-input:focus { border-color:rgba(106,76,245,0.5); }
    #siq-send { width:38px; height:38px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    #siq-send:hover { opacity:0.9; }
    .siq-typing { display:flex; gap:4px; align-items:center; padding:10px 14px; }
    .siq-dot { width:5px; height:5px; border-radius:50%; background:#666; animation:siq-pulse 1.4s infinite ease-in-out; }
    .siq-dot:nth-child(2) { animation-delay:0.2s; }
    .siq-dot:nth-child(3) { animation-delay:0.4s; }
    @keyframes siq-pulse { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1);opacity:1} }
    #siq-escalated { background:rgba(255,122,61,0.15); border:1px solid rgba(255,122,61,0.3); color:#ff7a3d; margin:8px 16px; padding:10px 14px; border-radius:8px; font-size:12px; display:none; }
  \`;
  document.head.appendChild(style);
  
  // ── Load config ─────────────────────────────────────────────
  function loadConfig() {
    const headers = API_KEY ? { 'X-API-Key': API_KEY } : {};
    fetch(BASE_URL + '/api/widget/config', { headers })
      .then(r => r.json())
      .then(cfg => {
        config = cfg;
        document.getElementById('siq-widget-btn').style.background = cfg.primary_color || '#6a4cf5';
        document.getElementById('siq-send').style.background = cfg.primary_color || '#6a4cf5';
        document.getElementById('siq-header-avatar').style.background = cfg.primary_color || '#6a4cf5';
        document.getElementById('siq-header-name').textContent = cfg.name || 'Support';
        document.getElementById('siq-input').placeholder = cfg.placeholder || 'Type a message...';
        document.getElementById('siq-greeting').textContent = cfg.greeting || 'Hello! How can I help?';
      }).catch(() => {});
  }
  
  // ── Create UI ───────────────────────────────────────────────
  function init() {
    const isRight = !POSITION.includes('left');
    const isBottom = !POSITION.includes('top');
    const hPos = isRight ? 'right:20px' : 'left:20px';
    const vPos = isBottom ? 'bottom:20px' : 'top:20px';
    const wTop = isBottom ? 'bottom:80px' : 'top:80px';
    const wRight = isRight ? 'right:20px' : 'left:20px';
    
    // Widget button
    const btn = document.createElement('button');
    btn.id = 'siq-widget-btn';
    btn.style.cssText = \`\${hPos};\${vPos};\`;
    btn.innerHTML = \`<svg viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>\`;
    btn.onclick = toggleChat;
    document.body.appendChild(btn);
    
    // Chat window
    const win = document.createElement('div');
    win.id = 'siq-chat-window';
    win.style.cssText = \`\${wRight};\${wTop};\`;
    win.innerHTML = \`
      <div id="siq-header">
        <div id="siq-header-avatar" style="background:#6a4cf5;color:white;">⚡</div>
        <div>
          <div id="siq-header-name" style="font-size:14px;font-weight:600;color:#fff;">Support</div>
          <div style="font-size:11px;color:#22c55e;">● Online</div>
        </div>
        <button onclick="toggleChat()" style="margin-left:auto;background:none;border:none;color:#666;font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      <div id="siq-messages">
        <div class="siq-msg siq-msg-ai" id="siq-greeting">Hello! How can I help you today?</div>
      </div>
      <div id="siq-escalated">🧑 A human agent will be with you shortly.</div>
      <div id="siq-input-area">
        <input id="siq-input" type="text" placeholder="Type a message..." autocomplete="off">
        <button id="siq-send" style="background:#6a4cf5;color:white;" onclick="sendMessage()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>\`;
    document.body.appendChild(win);
    
    document.getElementById('siq-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    
    loadConfig();
  }
  
  // ── Toggle ──────────────────────────────────────────────────
  function toggleChat() {
    const win = document.getElementById('siq-chat-window');
    win.classList.toggle('open');
    if (win.classList.contains('open') && !convId) {
      initConversation();
    }
  }
  
  // ── Init conversation ────────────────────────────────────────
  function initConversation() {
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    fetch(BASE_URL + '/api/widget/init', { method: 'POST', headers, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => {
        convId = d.conversation_id;
        sessionStorage.setItem('siq_conv_id', convId);
      }).catch(() => {});
  }
  
  // ── Send message ────────────────────────────────────────────
  function sendMessage() {
    const input = document.getElementById('siq-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    
    appendMessage(text, 'user');
    showTyping();
    
    const headers = { 'Content-Type': 'application/json' };
    if (API_KEY) headers['X-API-Key'] = API_KEY;
    
    const payload = { conversation_id: convId || generateTempId(), message: text };
    
    fetch(BASE_URL + '/api/widget/message', { method: 'POST', headers, body: JSON.stringify(payload) })
      .then(r => r.json())
      .then(d => {
        hideTyping();
        if (!convId && payload.conversation_id) {
          convId = payload.conversation_id;
          sessionStorage.setItem('siq_conv_id', convId);
        }
        appendMessage(d.reply, 'ai', d.sources, d.confidence);
        if (d.escalate) {
          document.getElementById('siq-escalated').style.display = 'block';
        }
      }).catch(() => {
        hideTyping();
        appendMessage("I'm having trouble connecting. Please try again.", 'ai');
      });
  }
  
  function appendMessage(text, role, sources, confidence) {
    const msgs = document.getElementById('siq-messages');
    const div = document.createElement('div');
    div.className = 'siq-msg siq-msg-' + role;
    div.innerHTML = text.replace(/\\n/g, '<br>');
    if (sources && sources.length) {
      const src = document.createElement('div');
      src.className = 'siq-msg-sources';
      src.innerHTML = sources.map(s => \`<span class="siq-source">📄 \${s}</span>\`).join('');
      div.appendChild(src);
    }
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }
  
  let typingEl = null;
  function showTyping() {
    const msgs = document.getElementById('siq-messages');
    typingEl = document.createElement('div');
    typingEl.className = 'siq-msg siq-msg-ai siq-typing';
    typingEl.innerHTML = '<div class="siq-dot"></div><div class="siq-dot"></div><div class="siq-dot"></div>';
    msgs.appendChild(typingEl);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function hideTyping() { if (typingEl) { typingEl.remove(); typingEl = null; } }
  
  function generateTempId() { return 'conv_' + Math.random().toString(36).slice(2); }
  
  window.SupportIQ = { toggleChat, sendMessage, init };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`

  return c.text(js)
})

// ── Fallback responses ────────────────────────────────────────
function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase()
  if (lower.includes('password') || lower.includes('login')) {
    return "For password resets, click 'Forgot Password' on the login page. The email arrives within 5 minutes — also check your spam folder."
  }
  if (lower.includes('billing') || lower.includes('invoice') || lower.includes('payment')) {
    return "For billing questions, please provide your invoice number or contact our billing team at billing@example.com."
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return "Hello! How can I help you today?"
  }
  return "I want to make sure you get the best help. Let me connect you with a support agent who can assist you directly."
}

export default widget
