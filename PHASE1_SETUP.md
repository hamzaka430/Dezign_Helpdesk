# Phase 1 Setup Guide — SupportIQ

## Prerequisites
- Cloudflare account with Pages & Workers enabled
- `wrangler` CLI (already in devDependencies)

---

## Step 1: Create D1 Database

```bash
# Create the D1 database
npx wrangler d1 create supportiq-db

# Copy the `database_id` from the output and update wrangler.jsonc:
# Replace "REPLACE_WITH_YOUR_D1_DATABASE_ID" with the actual ID
```

## Step 2: Run Migrations

```bash
# Apply schema to production D1
npx wrangler d1 execute supportiq-db --file=./migrations/0001_initial_schema.sql

# Apply schema to local D1 (for dev)
npx wrangler d1 execute supportiq-db --local --file=./migrations/0001_initial_schema.sql
```

## Step 3: Create R2 Bucket

```bash
# Create R2 bucket for document storage
npx wrangler r2 bucket create supportiq-docs

# Create preview bucket for local dev
npx wrangler r2 bucket create supportiq-docs-preview
```

## Step 4: Set JWT Secret

```bash
# For Pages deployment
npx wrangler pages secret put JWT_SECRET
# Enter a strong random secret (min 32 chars) when prompted

# Example secret generation:
# openssl rand -hex 32
```

## Step 5: Build & Deploy

```bash
# Build the project
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name supportiq
```

## Step 6: Local Development

```bash
# Build first
npm run build

# Run locally with D1 + R2 bindings
npm run dev:sandbox
```

---

## API Reference (Phase 1)

### Auth
| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | `{email, password, first_name, last_name, company_name}` | Register + create workspace |
| POST | `/api/auth/login` | `{email, password}` | Returns JWT token |
| GET | `/api/auth/me` | — (Bearer token) | Get current user |
| POST | `/api/auth/logout` | — | Invalidate session |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List tickets (`?status=open&priority=high`) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/:id` | Get ticket |
| PATCH | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket (admin only) |
| GET | `/api/tickets/:id/comments` | List comments |
| POST | `/api/tickets/:id/comments` | Add comment |

### Knowledge Bases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/knowledge-bases` | List KBs |
| POST | `/api/knowledge-bases` | Create KB |
| DELETE | `/api/knowledge-bases/:id` | Delete KB + R2 files |
| GET | `/api/knowledge-bases/:id/documents` | List documents |
| POST | `/api/knowledge-bases/:id/upload` | Upload file to R2 (multipart) |
| DELETE | `/api/knowledge-bases/:id/documents/:docId` | Delete document |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Start conversation |
| GET | `/api/conversations/:id` | Get conversation |
| GET | `/api/conversations/:id/messages` | Get messages |
| POST | `/api/conversations/:id/messages` | Send agent message |
| PATCH | `/api/conversations/:id/status` | Update status/assign |

### Settings & Team
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get workspace settings |
| PATCH | `/api/settings` | Update settings (admin) |
| POST | `/api/settings/api-key` | Generate API key (admin) |
| GET | `/api/settings/team` | List team members |
| POST | `/api/settings/team/invite` | Add team member (admin) |
| GET | `/api/stats` | Dashboard analytics |

---

## Auth Flow

All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

The JWT token is issued on login/signup and stored in `localStorage` as `siq_token`.

Token expires after **7 days**.

---

## D1 Schema Tables

| Table | Description |
|-------|-------------|
| `tenants` | Workspace per company |
| `users` | Agent/admin accounts |
| `sessions` | (Reserved for Phase 4 SSO) |
| `knowledge_bases` | KB containers |
| `documents` | Uploaded files metadata |
| `conversations` | Customer chat sessions |
| `messages` | Individual chat messages |
| `tickets` | Support tickets |
| `ticket_comments` | Internal/external comments |
| `workspace_settings` | AI config, widget settings |
| `api_keys` | Widget API keys |
