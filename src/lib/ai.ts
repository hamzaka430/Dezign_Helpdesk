// ============================================================
// SupportIQ — AI Layer
// OpenAI GPT-4o + Qdrant vector search (RAG pipeline)
// ============================================================

export interface EmbeddingResult {
  embedding: number[]
  model: string
  usage: { prompt_tokens: number; total_tokens: number }
}

export interface QdrantPoint {
  id: string
  vector: number[]
  payload: {
    tenant_id: string
    kb_id: string
    doc_id: string
    chunk_index: number
    text: string
    filename: string
  }
}

export interface SearchResult {
  id: string
  score: number
  payload: QdrantPoint['payload']
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIResponse {
  content: string
  confidence: number
  sources: string[]
  escalate: boolean
  model: string
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

// ── Text chunking ────────────────────────────────────────────
const CHUNK_SIZE = 500   // target tokens (~400 words)
const CHUNK_OVERLAP = 50 // overlap tokens

export function chunkText(text: string): string[] {
  // Split on sentence boundaries
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text]
  const chunks: string[] = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).split(/\s+/).length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim())
      // Start new chunk with overlap from previous
      const words = current.split(/\s+/)
      current = words.slice(-CHUNK_OVERLAP).join(' ') + ' ' + sentence
    } else {
      current += sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks.filter(c => c.length > 20)
}

// ── Extract text from uploaded file ─────────────────────────
export async function extractTextFromFile(
  arrayBuffer: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer)
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

  if (mimeType === 'text/plain' || filename.endsWith('.txt') || filename.endsWith('.md')) {
    return text
  }
  if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
    return text.replace(/,/g, ' ').replace(/\r\n/g, '\n')
  }
  if (mimeType === 'application/json' || filename.endsWith('.json')) {
    try {
      const obj = JSON.parse(text)
      return JSON.stringify(obj, null, 2)
    } catch { return text }
  }

  // For PDF/Word/other: extract visible text (simplified extraction)
  // In production use CF Workers AI pdf parsing or a 3rd party service
  const cleaned = text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
    .replace(/\s{3,}/g, '\n\n')
    .trim()

  return cleaned.length > 100 ? cleaned : `[File: ${filename}] Content extraction not fully supported for this format. Text preview: ${text.slice(0, 500)}`
}

// ── OpenAI Embeddings ────────────────────────────────────────
export async function createEmbedding(
  text: string,
  openaiKey: string
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // max tokens
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI embeddings error: ${response.status} ${err}`)
  }

  const data = await response.json() as {
    data: Array<{ embedding: number[] }>
  }
  return data.data[0].embedding
}

// ── Qdrant vector DB ─────────────────────────────────────────
export class QdrantClient {
  constructor(
    private url: string,
    private apiKey: string,
    private collectionName = 'supportiq_docs'
  ) {}

  async ensureCollection(): Promise<void> {
    const checkRes = await fetch(`${this.url}/collections/${this.collectionName}`, {
      headers: { 'api-key': this.apiKey },
    })

    if (checkRes.status === 404) {
      // Create collection with 1536-dim vectors (text-embedding-3-small)
      const createRes = await fetch(`${this.url}/collections/${this.collectionName}`, {
        method: 'PUT',
        headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vectors: { size: 1536, distance: 'Cosine' },
          optimizers_config: { default_segment_number: 2 },
          replication_factor: 1,
        }),
      })
      if (!createRes.ok) {
        const err = await createRes.text()
        throw new Error(`Qdrant create collection error: ${createRes.status} ${err}`)
      }
    }
  }

  async upsertPoints(points: QdrantPoint[]): Promise<void> {
    const res = await fetch(`${this.url}/collections/${this.collectionName}/points`, {
      method: 'PUT',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Qdrant upsert error: ${res.status} ${err}`)
    }
  }

  async search(
    vector: number[],
    tenantId: string,
    kbId: string | null,
    limit = 5
  ): Promise<SearchResult[]> {
    const filter: Record<string, unknown> = {
      must: [{ key: 'tenant_id', match: { value: tenantId } }]
    }
    if (kbId) {
      (filter.must as unknown[]).push({ key: 'kb_id', match: { value: kbId } })
    }

    const res = await fetch(`${this.url}/collections/${this.collectionName}/points/search`, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vector,
        filter,
        limit,
        with_payload: true,
        score_threshold: 0.5,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Qdrant search error: ${res.status} ${err}`)
    }

    const data = await res.json() as { result: SearchResult[] }
    return data.result || []
  }

  async deleteByDocId(docId: string, tenantId: string): Promise<void> {
    await fetch(`${this.url}/collections/${this.collectionName}/points/delete`, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'doc_id', match: { value: docId } },
            { key: 'tenant_id', match: { value: tenantId } },
          ],
        },
      }),
    })
  }

  async deleteByKbId(kbId: string, tenantId: string): Promise<void> {
    await fetch(`${this.url}/collections/${this.collectionName}/points/delete`, {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filter: {
          must: [
            { key: 'kb_id', match: { value: kbId } },
            { key: 'tenant_id', match: { value: tenantId } },
          ],
        },
      }),
    })
  }
}

// ── GPT-4o Chat Completion ───────────────────────────────────
export async function chatCompletion(
  messages: ChatMessage[],
  openaiKey: string,
  model = 'gpt-4o-mini'
): Promise<{ content: string; usage: AIResponse['usage'] }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 600,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`OpenAI chat error: ${response.status} ${err}`)
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  }

  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  }
}

// ── Full RAG pipeline ────────────────────────────────────────
export async function ragAnswer(opts: {
  query: string
  tenantId: string
  kbId: string | null
  conversationHistory: ChatMessage[]
  openaiKey: string
  qdrantUrl: string
  qdrantKey: string
}): Promise<AIResponse> {
  const qdrant = new QdrantClient(opts.qdrantUrl, opts.qdrantKey)

  // 1. Embed the user query
  let queryEmbedding: number[]
  try {
    queryEmbedding = await createEmbedding(opts.query, opts.openaiKey)
  } catch (e) {
    console.error('Embedding failed:', e)
    return {
      content: "I'm having trouble accessing my knowledge base right now. Let me connect you with a human agent.",
      confidence: 0.1,
      sources: [],
      escalate: true,
      model: 'fallback',
    }
  }

  // 2. Semantic search in Qdrant
  let searchResults: SearchResult[] = []
  try {
    searchResults = await qdrant.search(queryEmbedding, opts.tenantId, opts.kbId)
  } catch (e) {
    console.error('Qdrant search failed:', e)
  }

  // 3. Build context from search results
  const hasContext = searchResults.length > 0
  const contextChunks = searchResults.map(r =>
    `[Source: ${r.payload.filename}]\n${r.payload.text}`
  )
  const uniqueSources = [...new Set(searchResults.map(r => r.payload.filename))]

  // 4. Build system prompt
  const systemPrompt = hasContext
    ? `You are a helpful AI customer support agent for a SaaS company. 
Answer the customer's question using ONLY the provided knowledge base context.
Be concise, friendly, and accurate. If the context doesn't fully answer the question, say so.
At the end of your response, rate your confidence from 0.0 to 1.0.
Format: [CONFIDENCE: 0.85]

KNOWLEDGE BASE CONTEXT:
${contextChunks.join('\n\n---\n\n')}`
    : `You are a helpful AI customer support agent.
You don't have specific documentation to reference for this question.
Try to give a helpful general answer, but if it requires company-specific information,
acknowledge that and offer to escalate to a human agent.
At the end of your response, rate your confidence from 0.0 to 1.0.
Format: [CONFIDENCE: 0.35]`

  // 5. Build messages array
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...opts.conversationHistory.slice(-6), // last 3 turns for context
    { role: 'user', content: opts.query },
  ]

  // 6. Call GPT-4o
  let rawContent: string
  let usage: AIResponse['usage']
  try {
    const result = await chatCompletion(messages, opts.openaiKey, 'gpt-4o-mini')
    rawContent = result.content
    usage = result.usage
  } catch (e) {
    console.error('GPT-4o failed:', e)
    return {
      content: "I'm experiencing technical difficulties. Let me connect you with a human agent.",
      confidence: 0.1,
      sources: [],
      escalate: true,
      model: 'fallback',
    }
  }

  // 7. Parse confidence from response
  const confidenceMatch = rawContent.match(/\[CONFIDENCE:\s*([\d.]+)\]/i)
  const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : (hasContext ? 0.75 : 0.3)
  const content = rawContent.replace(/\[CONFIDENCE:\s*[\d.]+\]/i, '').trim()

  // 8. Auto-escalate if low confidence
  const escalate = confidence < 0.5

  return {
    content,
    confidence: Math.min(1, Math.max(0, confidence)),
    sources: uniqueSources,
    escalate,
    model: 'gpt-4o-mini',
    usage,
  }
}
