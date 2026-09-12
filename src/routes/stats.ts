// ============================================================
// SupportIQ — Stats / Analytics Route
// GET /api/stats  (protected)
// GET /api/stats/ai   — AI performance metrics
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables } from '../lib/middleware'

const stats = new Hono<{ Bindings: Env; Variables: Variables }>()

stats.use('*', authMiddleware)

// ---- GET /api/stats ----------------------------------------

stats.get('/', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const data = await db.getStats(user.tenant_id)

    // Build last-12-month ticket volume from D1
    const monthlyResult = await c.env.DB.prepare(`
      SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
      FROM tickets
      WHERE tenant_id = ?
        AND created_at >= datetime('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `).bind(user.tenant_id).all<{ month: string; count: number }>()

    // Fill gaps for all 12 months
    const now = new Date()
    const ticketVolume: number[] = []
    const monthLabels: string[] = []
    const monthMap = new Map(monthlyResult.results.map(r => [r.month, r.count]))
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      ticketVolume.push(monthMap.get(key) || 0)
      monthLabels.push(d.toLocaleString('en-US', { month: 'short' }))
    }

    // Monthly AI-resolved conversations
    const aiMonthly = await c.env.DB.prepare(`
      SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
      FROM conversations
      WHERE tenant_id = ?
        AND status = 'resolved'
        AND created_at >= datetime('now', '-12 months')
      GROUP BY month
      ORDER BY month ASC
    `).bind(user.tenant_id).all<{ month: string; count: number }>()

    const aiVolumeMap = new Map(aiMonthly.results.map(r => [r.month, r.count]))
    const aiVolume: number[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      aiVolume.push(aiVolumeMap.get(key) || 0)
    }

    // Resolution breakdown (last 30 days)
    const breakdown = await c.env.DB.prepare(`
      SELECT
        SUM(CASE WHEN status = 'resolved' OR status = 'closed' THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) AS escalated,
        SUM(CASE WHEN status = 'open' OR status = 'ai_handling' THEN 1 ELSE 0 END) AS pending
      FROM conversations
      WHERE tenant_id = ? AND created_at >= datetime('now', '-30 days')
    `).bind(user.tenant_id).first<{ resolved: number; escalated: number; pending: number }>()

    // Avg response time: diff between first customer msg and first AI msg
    const avgResp = await c.env.DB.prepare(`
      SELECT AVG(
        (julianday(m2.created_at) - julianday(m1.created_at)) * 24 * 60
      ) AS avg_minutes
      FROM messages m1
      JOIN messages m2 ON m1.conversation_id = m2.conversation_id
        AND m2.sender_type IN ('ai','agent')
        AND m2.created_at > m1.created_at
      WHERE m1.sender_type = 'customer'
        AND m1.tenant_id = ?
        AND m1.created_at >= datetime('now', '-30 days')
    `).bind(user.tenant_id).first<{ avg_minutes: number | null }>()

    const avgMinutes = avgResp?.avg_minutes || null
    let avgResponseTime = 'N/A'
    if (avgMinutes !== null && avgMinutes >= 0) {
      if (avgMinutes < 1) avgResponseTime = Math.round(avgMinutes * 60) + 's'
      else if (avgMinutes < 60) avgResponseTime = Math.round(avgMinutes) + 'm'
      else avgResponseTime = Math.round(avgMinutes / 60) + 'h ' + Math.round(avgMinutes % 60) + 'm'
    }

    // Ticket priority breakdown
    const priorityBreakdown = await c.env.DB.prepare(`
      SELECT priority, COUNT(*) AS count
      FROM tickets WHERE tenant_id = ?
      GROUP BY priority
    `).bind(user.tenant_id).all<{ priority: string; count: number }>()

    const priorityMap = Object.fromEntries(priorityBreakdown.results.map(r => [r.priority, r.count]))

    return c.json({
      tickets: data.tickets,
      conversations: data.conversations,
      aiResolutionRate: data.ai_resolution_rate,
      avgResponseTime,
      csatScore: null,  // Phase 5: CSAT surveys
      ticketVolume,
      aiVolume,
      monthLabels,
      resolutionBreakdown: {
        resolved: breakdown?.resolved || 0,
        escalated: breakdown?.escalated || 0,
        pending: breakdown?.pending || 0
      },
      priorityBreakdown: priorityMap,
    })
  } catch (err) {
    console.error('[GET /stats]', err)
    return c.json({ error: 'Failed to fetch stats' }, 500)
  }
})

// ---- GET /api/stats/ai -------------------------------------
// AI performance: confidence distribution, top KB sources

stats.get('/ai', async (c) => {
  try {
    const user = c.get('user')

    // Average confidence by day (last 30 days)
    const confidenceByDay = await c.env.DB.prepare(`
      SELECT
        strftime('%Y-%m-%d', created_at) AS day,
        AVG(confidence) AS avg_conf,
        COUNT(*) AS count
      FROM messages
      WHERE tenant_id = ? AND sender_type = 'ai'
        AND confidence IS NOT NULL
        AND created_at >= datetime('now', '-30 days')
      GROUP BY day
      ORDER BY day ASC
    `).bind(user.tenant_id).all<{ day: string; avg_conf: number; count: number }>()

    // Escalation rate
    const escalationStats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) AS total_ai,
        SUM(CASE WHEN escalate = 1 THEN 1 ELSE 0 END) AS escalated
      FROM messages
      WHERE tenant_id = ? AND sender_type = 'ai'
        AND created_at >= datetime('now', '-30 days')
    `).bind(user.tenant_id).first<{ total_ai: number; escalated: number }>()

    const escalationRate = escalationStats?.total_ai
      ? Math.round((escalationStats.escalated / escalationStats.total_ai) * 100)
      : 0

    return c.json({
      confidence_by_day: confidenceByDay.results,
      escalation_rate: escalationRate,
      total_ai_messages: escalationStats?.total_ai || 0,
    })
  } catch (err) {
    console.error('[GET /stats/ai]', err)
    return c.json({ error: 'Failed to fetch AI stats' }, 500)
  }
})

export default stats
