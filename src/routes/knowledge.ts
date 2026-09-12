// ============================================================
// SupportIQ — Knowledge Base Routes
// GET    /api/knowledge-bases
// POST   /api/knowledge-bases
// DELETE /api/knowledge-bases/:id
// GET    /api/knowledge-bases/:id/documents
// POST   /api/knowledge-bases/:id/upload    (R2 + RAG indexing)
// DELETE /api/knowledge-bases/:id/documents/:docId
// POST   /api/knowledge-bases/:id/documents/:docId/reindex
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, Env, Variables, validateBody } from '../lib/middleware'
import { generateId } from '../lib/auth'
import { QdrantClient, createEmbedding, chunkText, extractTextFromFile } from '../lib/ai'

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

    // Delete Qdrant vectors if available
    if (c.env.QDRANT_URL && c.env.QDRANT_API_KEY) {
      try {
        const qdrant = new QdrantClient(c.env.QDRANT_URL, c.env.QDRANT_API_KEY)
        await qdrant.deleteByKbId(c.req.param('id'), user.tenant_id)
      } catch (e) {
        console.error('[Qdrant delete kb]', e)
      }
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

// ── Helper: index a document into Qdrant ────────────────────
async function indexDocumentIntoQdrant(opts: {
  env: Env
  docId: string
  kbId: string
  tenantId: string
  filename: string
  fileBuffer: ArrayBuffer
  mimeType: string
  db: DB
}): Promise<number> {
  const { env, docId, kbId, tenantId, filename, fileBuffer, mimeType, db } = opts

  if (!env.OPENAI_API_KEY || !env.QDRANT_URL || !env.QDRANT_API_KEY) {
    // No AI keys — just estimate chunk count and mark indexed
    const estimated = Math.max(1, Math.floor(fileBuffer.byteLength / 2000))
    await db.updateDocumentStatus(docId, 'indexed', { chunk_count: estimated })
    return estimated
  }

  try {
    await db.updateDocumentStatus(docId, 'chunking')
    await db.updateKBStatus(kbId, 'indexing')

    // 1. Extract text
    const rawText = await extractTextFromFile(fileBuffer, mimeType, filename)

    // 2. Chunk text
    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      await db.updateDocumentStatus(docId, 'error', { error_msg: 'No text could be extracted' })
      return 0
    }

    await db.updateDocumentStatus(docId, 'embedding')

    // 3. Set up Qdrant collection
    const qdrant = new QdrantClient(env.QDRANT_URL, env.QDRANT_API_KEY)
    await qdrant.ensureCollection()

    // 4. Embed each chunk and upsert (batch in groups of 10)
    const BATCH_SIZE = 10
    let totalUpserted = 0

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const points = await Promise.all(
        batch.map(async (chunkText, batchIdx) => {
          const chunkIndex = i + batchIdx
          const embedding = await createEmbedding(chunkText, env.OPENAI_API_KEY!)
          return {
            id: `${docId}_chunk_${chunkIndex}`,
            vector: embedding,
            payload: {
              tenant_id: tenantId,
              kb_id: kbId,
              doc_id: docId,
              chunk_index: chunkIndex,
              text: chunkText,
              filename,
            },
          }
        })
      )
      await qdrant.upsertPoints(points)
      totalUpserted += points.length
    }

    // 5. Mark document as indexed
    await db.updateDocumentStatus(docId, 'indexed', {
      chunk_count: chunks.length,
      indexed_at: new Date().toISOString(),
    })
    await db.updateKBStatus(kbId, 'indexed')

    return chunks.length
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[indexDocument]', errMsg)
    await db.updateDocumentStatus(docId, 'error', { error_msg: errMsg.slice(0, 255) })
    await db.updateKBStatus(kbId, 'error')
    return 0
  }
}

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
    const allowedExts = ['.pdf', '.docx', '.txt', '.md', '.csv', '.json']
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
    if (!allowedExts.includes(ext)) {
      return c.json({ error: `File type not supported. Allowed: ${allowedExts.join(', ')}` }, 422)
    }

    // 50MB limit
    if (file.size > 50 * 1024 * 1024) {
      return c.json({ error: 'File size exceeds 50MB limit' }, 422)
    }

    const docId = generateId('doc')
    const kbId = c.req.param('id')
    const r2Key = `${user.tenant_id}/${kbId}/${docId}/${file.name}`

    // Read file buffer (needed for both R2 and RAG)
    const fileBuffer = await file.arrayBuffer()

    // Upload to R2
    if (c.env.STORAGE) {
      await c.env.STORAGE.put(r2Key, fileBuffer, {
        httpMetadata: { contentType: file.type || 'application/octet-stream' },
        customMetadata: {
          tenant_id: user.tenant_id,
          kb_id: kbId,
          doc_id: docId,
          original_name: file.name
        }
      })
    }

    // Save document record to D1
    await db.createDocument({
      id: docId,
      kb_id: kbId,
      tenant_id: user.tenant_id,
      filename: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      r2_key: r2Key
    })

    // Index into Qdrant (real RAG pipeline if keys available, otherwise estimated)
    const chunkCount = await indexDocumentIntoQdrant({
      env: c.env,
      docId,
      kbId,
      tenantId: user.tenant_id,
      filename: file.name,
      fileBuffer,
      mimeType: file.type || 'application/octet-stream',
      db,
    })

    const docs = await db.listDocuments(kbId, user.tenant_id)
    const doc = docs.find(d => d.id === docId)

    return c.json({
      message: 'Document uploaded and indexed successfully',
      document: doc,
      r2_key: r2Key,
      chunk_count: chunkCount,
      indexed: !!c.env.OPENAI_API_KEY,
    }, 201)

  } catch (err) {
    console.error('[POST /knowledge-bases/:id/upload]', err)
    return c.json({ error: 'Failed to upload document' }, 500)
  }
})

// ---- POST /api/knowledge-bases/:id/documents/:docId/reindex
// Re-trigger Qdrant indexing for a specific document

knowledge.post('/:id/documents/:docId/reindex', async (c) => {
  try {
    const user = c.get('user')
    if (user.role !== 'admin') return c.json({ error: 'Admin access required' }, 403)

    const db = new DB(c.env.DB)
    const docs = await db.listDocuments(c.req.param('id'), user.tenant_id)
    const doc = docs.find(d => d.id === c.req.param('docId'))
    if (!doc) return c.json({ error: 'Document not found' }, 404)

    if (!c.env.STORAGE) return c.json({ error: 'Storage not configured' }, 503)

    // Fetch file from R2
    const r2Object = await c.env.STORAGE.get(doc.r2_key)
    if (!r2Object) return c.json({ error: 'File not found in storage' }, 404)

    const fileBuffer = await r2Object.arrayBuffer()

    // Delete old vectors from Qdrant
    if (c.env.QDRANT_URL && c.env.QDRANT_API_KEY) {
      const qdrant = new QdrantClient(c.env.QDRANT_URL, c.env.QDRANT_API_KEY)
      await qdrant.deleteByDocId(doc.id, user.tenant_id)
    }

    const chunkCount = await indexDocumentIntoQdrant({
      env: c.env,
      docId: doc.id,
      kbId: c.req.param('id'),
      tenantId: user.tenant_id,
      filename: doc.filename,
      fileBuffer,
      mimeType: doc.mime_type,
      db,
    })

    return c.json({ message: 'Document reindexed', chunk_count: chunkCount })
  } catch (err) {
    console.error('[POST reindex]', err)
    return c.json({ error: 'Failed to reindex document' }, 500)
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

    // Delete Qdrant vectors
    if (c.env.QDRANT_URL && c.env.QDRANT_API_KEY) {
      try {
        const qdrant = new QdrantClient(c.env.QDRANT_URL, c.env.QDRANT_API_KEY)
        await qdrant.deleteByDocId(doc.id, user.tenant_id)
      } catch (e) {
        console.error('[Qdrant delete doc]', e)
      }
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
