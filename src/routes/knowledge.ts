// ============================================================
// SupportIQ — Knowledge Base Routes
// GET    /api/knowledge-bases
// POST   /api/knowledge-bases
// DELETE /api/knowledge-bases/:id
// GET    /api/knowledge-bases/:id/documents
// POST   /api/knowledge-bases/:id/upload     (R2 upload)
// DELETE /api/knowledge-bases/:id/documents/:docId
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables, validateBody } from '../lib/middleware'
import { generateId } from '../lib/auth'

const knowledge = new Hono<{ Bindings: Env; Variables: Variables }>()

knowledge.use('*', authMiddleware)

// ---- GET /api/knowledge-bases ------------------------------

knowledge.get('/', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const kbs = await db.listKBs(user.tenant_id)
    return c.json({ kbs })
  } catch (err) {
    console.error('[GET /knowledge-bases]', err)
    return c.json({ error: 'Failed to fetch knowledge bases' }, 500)
  }
})

// ---- POST /api/knowledge-bases -----------------------------

knowledge.post('/', async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{ name?: string; description?: string; color?: string }>()
    const err = validateBody(body, ['name'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const id = generateId('kb')

    await db.createKB({
      id,
      tenant_id: user.tenant_id,
      name: body.name!,
      description: body.description,
      color: body.color
    })

    const kb = await db.getKBById(id, user.tenant_id)
    return c.json({ kb }, 201)
  } catch (err) {
    console.error('[POST /knowledge-bases]', err)
    return c.json({ error: 'Failed to create knowledge base' }, 500)
  }
})

// ---- DELETE /api/knowledge-bases/:id -----------------------

knowledge.delete('/:id', async (c) => {
  try {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const db = new DB(c.env.DB)
    const kb = await db.getKBById(c.req.param('id'), user.tenant_id)
    if (!kb) return c.json({ error: 'Knowledge base not found' }, 404)

    // Delete all R2 objects for this KB
    if (c.env.STORAGE) {
      const docs = await db.listDocuments(c.req.param('id'), user.tenant_id)
      await Promise.allSettled(docs.map(d => c.env.STORAGE.delete(d.r2_key)))
    }

    await db.deleteKB(c.req.param('id'), user.tenant_id)
    return c.json({ message: 'Knowledge base deleted' })
  } catch (err) {
    console.error('[DELETE /knowledge-bases/:id]', err)
    return c.json({ error: 'Failed to delete knowledge base' }, 500)
  }
})

// ---- GET /api/knowledge-bases/:id/documents ----------------

knowledge.get('/:id/documents', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const kb = await db.getKBById(c.req.param('id'), user.tenant_id)
    if (!kb) return c.json({ error: 'Knowledge base not found' }, 404)

    const docs = await db.listDocuments(c.req.param('id'), user.tenant_id)
    return c.json({ documents: docs })
  } catch (err) {
    console.error('[GET /knowledge-bases/:id/documents]', err)
    return c.json({ error: 'Failed to fetch documents' }, 500)
  }
})

// ---- POST /api/knowledge-bases/:id/upload ------------------
// Accepts multipart/form-data with field "file"

knowledge.post('/:id/upload', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const kb = await db.getKBById(c.req.param('id'), user.tenant_id)
    if (!kb) return c.json({ error: 'Knowledge base not found' }, 404)

    // Parse multipart form
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: 'No file provided' }, 422)

    // Validate file type
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/x-markdown'
    ]
    const allowedExts = ['.pdf', '.docx', '.txt', '.md']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedExts.includes(ext)) {
      return c.json({ error: `File type not supported. Allowed: ${allowedExts.join(', ')}` }, 422)
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 50MB limit' }, 422)
    }

    const docId = generateId('doc')
    const r2Key = `${user.tenant_id}/${c.req.param('id')}/${docId}/${file.name}`

    // Upload to R2 (if STORAGE binding exists)
    if (c.env.STORAGE) {
      const fileBuffer = await file.arrayBuffer()
      await c.env.STORAGE.put(r2Key, fileBuffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
        customMetadata: {
          tenant_id: user.tenant_id,
          kb_id: c.req.param('id'),
          doc_id: docId,
          original_name: file.name
        }
      })
    }

    // Save document record to D1
    await db.createDocument({
      id: docId,
      kb_id: c.req.param('id'),
      tenant_id: user.tenant_id,
      filename: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      r2_key: r2Key
    })

    // Update KB status to indexing
    await db.updateKBStatus(c.req.param('id'), 'indexing')

    // In Phase 2 this will trigger a real RAG pipeline (Qdrant + OpenAI embeddings)
    // For now, simulate indexing after a short delay via a queued message
    // Mark as indexed immediately for Phase 1 demo
    const mockChunkCount = Math.floor(file.size / 2000) + 1
    await db.updateDocumentStatus(docId, 'indexed', { chunk_count: mockChunkCount })
    await db.updateKBStatus(c.req.param('id'), 'indexed')

    const doc = (await db.listDocuments(c.req.param('id'), user.tenant_id)).find(d => d.id === docId)
    return c.json({
      message: 'Document uploaded successfully',
      document: doc,
      r2_key: r2Key,
      chunk_count: mockChunkCount
    }, 201)

  } catch (err) {
    console.error('[POST /knowledge-bases/:id/upload]', err)
    return c.json({ error: 'Failed to upload document' }, 500)
  }
})

// ---- DELETE /api/knowledge-bases/:id/documents/:docId ------

knowledge.delete('/:id/documents/:docId', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)

    const kb = await db.getKBById(c.req.param('id'), user.tenant_id)
    if (!kb) return c.json({ error: 'Knowledge base not found' }, 404)

    const docs = await db.listDocuments(c.req.param('id'), user.tenant_id)
    const doc = docs.find(d => d.id === c.req.param('docId'))
    if (!doc) return c.json({ error: 'Document not found' }, 404)

    // Delete from R2
    if (c.env.STORAGE) {
      await c.env.STORAGE.delete(doc.r2_key)
    }

    // Delete from D1
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND tenant_id = ?')
      .bind(doc.id, user.tenant_id).run()

    // Re-check if KB still has indexed docs
    const remaining = await db.listDocuments(c.req.param('id'), user.tenant_id)
    const newStatus = remaining.length === 0 ? 'empty' : 'indexed'
    await db.updateKBStatus(c.req.param('id'), newStatus)

    return c.json({ message: 'Document deleted' })
  } catch (err) {
    console.error('[DELETE document]', err)
    return c.json({ error: 'Failed to delete document' }, 500)
  }
})

export default knowledge
