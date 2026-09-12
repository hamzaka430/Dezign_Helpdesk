# SupportIQ — Deployment Guide

Complete guide to deploying SupportIQ on Cloudflare Pages + Workers, including all Phase 1–6 features.

---

## Architecture Overview

```
Browser / Customers
      │
      ▼
Cloudflare Pages (static assets + _worker.js)
      │
      ├── /api/*          → Hono.js Edge Worker (D1 + R2 + external APIs)
      ├── /api/widget/widget.js → Embeddable chat widget
      └── /* → SSR HTML pages (dashboard, landing, auth)

External services:
  D1 (SQLite at edge)    ← tickets, conversations, messages, users
  R2 (object storage)    ← knowledge base documents
  OpenAI API             ← GPT-4o-mini responses + embeddings
  Qdrant Cloud           ← vector search (RAG pipeline)
  Stripe                 ← billing, subscriptions
  Resend                 ← email notifications
  Slack API              ← escalation alerts
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) ≥ 3  
  ```bash
  npm install -g wrangler
  wrangler login
  ```
- A Cloudflare account (free tier works)
- (Optional) Accounts for: OpenAI, Qdrant Cloud, Stripe, Resend

---

## Step 1 — Create D1 Database

```bash
# Create the database
wrangler d1 create supportiq-db

# Copy the database_id from the output into wrangler.jsonc:
# "database_id": "YOUR_D1_DATABASE_ID_HERE"

# Apply schema migrations
wrangler d1 migrations apply supportiq-db --local   # local dev
wrangler d1 migrations apply supportiq-db           # production
```

The migrations directory contains:
- `0001_initial_schema.sql` — Core 11-table schema + seed data
- `0002_phase2_additions.sql` — Stripe, widget, SSO, webhook columns + CSAT/notifications tables

---

## Step 2 — Create R2 Bucket

```bash
wrangler r2 bucket create supportiq-docs
wrangler r2 bucket create supportiq-docs-preview  # for local dev
```

---

## Step 3 — Build

```bash
npm install
npm run build
# Output: dist/_worker.js (~300KB)
```

---

## Step 4 — Create Cloudflare Pages Project

```bash
# One-time setup (first deploy)
npx wrangler pages project create supportiq

# Deploy
npx wrangler pages deploy dist --project-name supportiq
```

Or via GitHub CI:
1. Connect repo at dash.cloudflare.com → Pages → Connect to Git
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Add environment variables + secrets in CF Pages dashboard

---

## Step 5 — Set Secrets

All secrets must be set via Wrangler CLI (not wrangler.jsonc — never commit secrets).

### Required Secrets

```bash
# JWT signing key — generate a strong random string
wrangler pages secret put JWT_SECRET --project-name supportiq
# Enter: $(openssl rand -hex 32)
```

### Phase 2 — AI & RAG (enables real AI responses)

```bash
# OpenAI API Key
# Get from: https://platform.openai.com/api-keys
wrangler pages secret put OPENAI_API_KEY --project-name supportiq

# Qdrant Cloud URL (e.g. https://abc123.us-east4.gcp.cloud.qdrant.io)
# Get from: https://cloud.qdrant.io → Clusters
wrangler pages secret put QDRANT_URL --project-name supportiq

# Qdrant API Key
# Get from: https://cloud.qdrant.io → API Keys
wrangler pages secret put QDRANT_API_KEY --project-name supportiq
```

> **Without these:** The chat widget still works but returns a polite "AI unavailable" message.  
> All other features (tickets, inbox, knowledge base, analytics) work fully.

### Phase 4 — Stripe Billing (optional)

```bash
# Stripe Secret Key (sk_live_... or sk_test_... for testing)
# Get from: https://dashboard.stripe.com/apikeys
wrangler pages secret put STRIPE_SECRET_KEY --project-name supportiq

# Stripe Webhook Signing Secret
# 1. Go to: https://dashboard.stripe.com/webhooks
# 2. Add endpoint: https://YOUR_DOMAIN/api/billing/webhook
# 3. Select events: checkout.session.completed, customer.subscription.deleted
# 4. Copy the "Signing secret" (whsec_...)
wrangler pages secret put STRIPE_WEBHOOK_SECRET --project-name supportiq
```

### Phase 4 — Email Notifications (optional)

```bash
# Resend API Key for email alerts
# Get from: https://resend.com/api-keys
wrangler pages secret put RESEND_API_KEY --project-name supportiq
```

### Phase 6 — Slack Integration (optional)

```bash
# Slack Bot Token (xoxb-...)
# 1. Go to: https://api.slack.com/apps → Create New App
# 2. Add OAuth scopes: chat:write, channels:read
# 3. Install to your workspace
# 4. Copy Bot User OAuth Token
wrangler pages secret put SLACK_BOT_TOKEN --project-name supportiq
```

---

## Step 6 — Update APP_URL

Edit `wrangler.jsonc`:
```jsonc
"vars": {
  "ENVIRONMENT": "production",
  "APP_URL": "https://YOUR_PROJECT.pages.dev"  // ← update this
}
```

Then redeploy:
```bash
npm run build && npx wrangler pages deploy dist --project-name supportiq
```

---

## Step 7 — First Login

1. Navigate to `https://YOUR_PROJECT.pages.dev/signup`
2. Create your admin account
3. Go to **Settings → Widget Design** → click **Generate Key** to create an API key
4. Copy the embed code and add it to your website

---

## Embed Widget on Your Website

After generating an API key in Settings, add this to any webpage:

```html
<script
  src="https://YOUR_PROJECT.pages.dev/api/widget/widget.js"
  data-supportiq-key="YOUR_API_KEY"
  data-color="#6a4cf5"
></script>
```

The widget auto-initializes, creates conversations, and routes messages through the RAG pipeline.

---

## Local Development

```bash
# Install deps
npm install

# Start local D1 + Wrangler dev server
wrangler pages dev dist --d1=DB=supportiq-db

# Or use Vite for fast iteration (no D1 - API calls will fail)
npm run dev
```

For local dev with D1, apply migrations first:
```bash
wrangler d1 migrations apply supportiq-db --local
```

---

## Environment Variables Reference

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `JWT_SECRET` | Secret | ✅ | JWT signing key |
| `OPENAI_API_KEY` | Secret | Phase 2 | OpenAI API key for GPT-4o-mini + embeddings |
| `QDRANT_URL` | Secret | Phase 2 | Qdrant cluster URL |
| `QDRANT_API_KEY` | Secret | Phase 2 | Qdrant API key |
| `STRIPE_SECRET_KEY` | Secret | Phase 4 | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Secret | Phase 4 | Stripe webhook signing secret |
| `RESEND_API_KEY` | Secret | Phase 4 | Resend API key for emails |
| `SLACK_BOT_TOKEN` | Secret | Phase 6 | Slack bot token |
| `ENVIRONMENT` | Var | No | `"production"` or `"development"` |
| `APP_URL` | Var | Yes | Your deployed URL, e.g. `https://supportiq.pages.dev` |
| `TENANT_SUBDOMAIN_ENABLED` | Var | No | `"true"` for subdomain multi-tenant routing |

---

## API Endpoints Reference

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | None | Register + create tenant |
| POST | `/api/auth/login` | None | Login, returns JWT |
| GET | `/api/auth/me` | JWT | Current user |
| POST | `/api/auth/logout` | JWT | Invalidate session |

### Tickets
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/tickets` | JWT | List tickets (filter: status, priority) |
| POST | `/api/tickets` | JWT | Create ticket |
| GET | `/api/tickets/:id` | JWT | Get ticket + comments |
| PATCH | `/api/tickets/:id` | JWT | Update ticket |
| DELETE | `/api/tickets/:id` | JWT | Delete ticket |
| POST | `/api/tickets/:id/comments` | JWT | Add comment |

### Conversations (Inbox)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/conversations` | JWT | List conversations |
| GET | `/api/conversations/:id/messages` | JWT | Get messages |
| POST | `/api/conversations/:id/messages` | JWT | Send message |
| PATCH | `/api/conversations/:id/status` | JWT | Update status |

### AI Chat
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/chat/status` | None | AI availability status |
| POST | `/api/chat` | API Key | Widget RAG chat |
| POST | `/api/chat/agent` | JWT | AI draft reply for agents |

### Widget
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/widget/widget.js` | None | Embeddable widget script |
| GET | `/api/widget/config` | API Key | Widget color/greeting config |
| POST | `/api/widget/init` | API Key | Create conversation |
| POST | `/api/widget/message` | API Key | Send message + get AI reply |
| GET | `/api/widget/messages` | API Key | Conversation history |

### Knowledge Base
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/knowledge-bases` | JWT | List KBs |
| POST | `/api/knowledge-bases` | JWT | Create KB |
| POST | `/api/knowledge-bases/:id/documents` | JWT | Upload document (triggers indexing) |
| POST | `/api/knowledge-bases/:id/documents/:docId/reindex` | JWT | Reindex document |
| DELETE | `/api/knowledge-bases/:id/documents/:docId` | JWT | Delete + remove from Qdrant |

### Settings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | JWT | Get workspace settings |
| PATCH | `/api/settings` | JWT (Admin) | Update settings |
| POST | `/api/settings/api-key` | JWT (Admin) | Generate API key |
| GET | `/api/settings/team` | JWT | List team members |
| POST | `/api/settings/team/invite` | JWT (Admin) | Add team member |

### Billing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/billing/plans` | None | Plan definitions |
| GET | `/api/billing/subscription` | JWT | Current plan + usage |
| POST | `/api/billing/checkout` | JWT | Stripe checkout session |
| POST | `/api/billing/portal` | JWT | Stripe billing portal |
| POST | `/api/billing/webhook` | Stripe sig | Stripe webhook handler |

### Analytics
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/stats` | JWT | Dashboard metrics |
| GET | `/api/stats/ai` | JWT | AI confidence + escalation stats |

### Integrations (Phase 6)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/integrations/slack/test` | JWT (Admin) | Test Slack webhook |
| POST | `/api/integrations/slack/notify` | JWT (Admin) | Send Slack alert |
| GET | `/api/integrations/webhooks` | JWT | List outbound webhooks |
| POST | `/api/integrations/webhooks` | JWT (Admin) | Register webhook |
| DELETE | `/api/integrations/webhooks/:id` | JWT (Admin) | Remove webhook |
| POST | `/api/integrations/webhooks/:id/test` | JWT (Admin) | Fire test event |
| GET | `/api/integrations/sso/config` | JWT (Admin) | SSO configuration |
| POST | `/api/integrations/sso/config` | JWT (Admin) | Save SSO config |
| GET | `/api/integrations/sso/metadata/:tenantId` | None | SAML SP metadata XML |
| POST | `/api/integrations/sso/acs/:tenantId` | IdP POST | SAML assertion consumer |

---

## Stripe Webhook Setup

1. Deploy your app and get your URL
2. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
3. Add endpoint: `https://YOUR_DOMAIN/api/billing/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `customer.subscription.updated` (optional)
5. Copy the signing secret → `wrangler pages secret put STRIPE_WEBHOOK_SECRET`

---

## Qdrant Setup

1. Create account at [cloud.qdrant.io](https://cloud.qdrant.io)
2. Create a cluster (free tier: 1 node, 0.5GB RAM)
3. Note the cluster URL (e.g. `https://abc123.us-east4.gcp.cloud.qdrant.io`)
4. Create an API key in the cluster settings
5. Set secrets:
   ```bash
   wrangler pages secret put QDRANT_URL --project-name supportiq
   wrangler pages secret put QDRANT_API_KEY --project-name supportiq
   ```
6. The `supportiq_knowledge` collection is created automatically on first document upload

---

## SSO / SAML Setup (Phase 6)

1. Deploy your app
2. Go to **Dashboard → Settings → Integrations → SSO**
3. Note your **ACS URL** and **Entity ID**
4. Configure your IdP (Okta, Azure AD, Google Workspace):
   - Set ACS URL to: `https://YOUR_DOMAIN/api/integrations/sso/acs/YOUR_TENANT_ID`
   - Set Entity ID to: `https://YOUR_DOMAIN/api/integrations/sso`
   - Download metadata from: `https://YOUR_DOMAIN/api/integrations/sso/metadata/YOUR_TENANT_ID`
5. Enter your IdP's metadata URL in SupportIQ Settings → SSO
6. Enable SSO

---

## Multi-tenant Subdomain Routing (Phase 6)

To enable tenant routing via subdomains (e.g. `acme.yourdomain.com`):

1. Set `TENANT_SUBDOMAIN_ENABLED = "true"` in `wrangler.jsonc`
2. Set `APP_URL` to your base domain (e.g. `https://yourdomain.com`)
3. Add a wildcard DNS record: `*.yourdomain.com → Cloudflare Pages`
4. In Cloudflare Dashboard → Pages → Custom Domains, add `*.yourdomain.com`
5. Each tenant's `slug` field (set in D1 `tenants` table) maps to their subdomain

---

## Monitoring & Health

```bash
# Health check endpoint
curl https://YOUR_DOMAIN/api/health

# Response:
{
  "status": "ok",
  "service": "SupportIQ",
  "version": "2.0.0",
  "db": "connected",
  "storage": "connected",
  "ai": "enabled",        ← "disabled" if OPENAI_API_KEY not set
  "vector_search": true,  ← false if Qdrant not configured
  "timestamp": "2024-..."
}
```

---

## Troubleshooting

### "AI unavailable" in widget
- Check `OPENAI_API_KEY` is set: `wrangler pages secret list --project-name supportiq`
- Check `QDRANT_URL` and `QDRANT_API_KEY` are set
- Visit `/api/health` to confirm `ai: "enabled"`

### D1 migration errors
```bash
# Check migration status
wrangler d1 migrations list supportiq-db

# Force re-apply (caution: data loss)
wrangler d1 execute supportiq-db --file=migrations/0001_initial_schema.sql
```

### Widget not loading
- Check API key is correct (generated in Settings → Widget Design)
- Check browser console for CORS errors
- Ensure `data-supportiq-key` attribute is set on the `<script>` tag

### Stripe webhook not firing
- Verify endpoint URL is correct in Stripe Dashboard
- Check `STRIPE_WEBHOOK_SECRET` matches the signing secret
- Test with `stripe trigger checkout.session.completed`

---

## Cost Estimate

| Service | Free Tier | Paid |
|---------|-----------|------|
| Cloudflare Pages | 500 builds/mo, unlimited traffic | $20/mo (Pro) |
| Cloudflare D1 | 5GB storage, 25M row reads/day | $0.001/GB |
| Cloudflare R2 | 10GB, 10M class A ops | $0.015/GB |
| OpenAI (GPT-4o-mini) | Pay-per-use | ~$0.60/1M tokens |
| OpenAI (embeddings) | Pay-per-use | ~$0.02/1M tokens |
| Qdrant Cloud | 1GB cluster free | $9/mo+ |
| Stripe | No monthly fee | 2.9% + 30¢/transaction |

For a typical small SaaS with 1,000 AI conversations/month: **~$5–20/month** in API costs.
