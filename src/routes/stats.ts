// ============================================================
// SupportIQ — Stats / Analytics Route
// GET /api/stats  (protected)
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables } from '../lib/middleware'

const stats = new Hono<{ Bindings: Env; Variables: Variables }>()

stats.use('*', authMiddleware)

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
    const monthMap = new Map(monthlyResult.results.map(r => [r.month, r.count]))
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      ticketVolume.push(monthMap.get(key) || 0)
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

    return c.json({
      tickets: data.tickets,
      conversations: data.conversations,
      aiResolutionRate: data.ai_resolution_rate,
      avgResponseTime: '2m 34s',  // Phase 5: calculate from message timestamps
      csatScore: 4.7,              // Phase 5: from CSAT survey table
      ticketVolume,
      resolutionBreakdown: {
        resolved: breakdown?.resolved || 0,
        escalated: breakdown?.escalated || 0,
        pending: breakdown?.pending || 0
      }
    })
  } catch (err) {
    console.error('[GET /stats]', err)
    return c.json({ error: 'Failed to fetch stats' }, 500)
  }
})

export default stats
