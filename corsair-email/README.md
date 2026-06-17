# NovusMail

NovusMail is a keyboard-first Gmail and Google Calendar workspace built for people who live in the queue. It combines inbox triage, thread actions, scheduling, command-driven workflows, and guarded AI assistance in one focused product surface.

This is no longer just a dev spike or hackathon shell. The app in this repository ships a real product experience: authentication, tenant-scoped Google connections, a working multi-panel workspace, live sync, local search, compose and scheduling flows, and a production deployment path.

## Product status

NovusMail is a full product built on top of Corsair:

- Real Gmail and Google Calendar integrations, not mocked data
- Multi-tenant runtime with tenant-scoped sessions and credentials
- Postgres-backed cache for speed, prioritization, and search
- Proposal-based AI assistant with explicit approval before any send or event creation
- Vercel + Neon deployment path with production hardening already in place

## What ships today

- Unified workspace for inbox, thread detail, and upcoming calendar context
- Focus, unread, starred, later, and all-mail views with priority-aware ordering
- Thread actions for reply, archive, unarchive, star, read/unread, trash, and compose
- Calendar event creation and update flows from the agenda rail or from an email thread
- Command palette for search, send, schedule, and combined workflow actions
- Agent Chat that can search the inbox, read threads, inspect the agenda, draft emails, and propose events in natural language
- Lightning Search powered by Postgres full-text search, with live Gmail fallback when needed
- Live refresh through webhooks, SSE, and a polling fallback that still works on serverless infrastructure
- Google sign-in for real identity, with email-only login kept as a development/demo fallback
- Keyboard-first navigation with shortcuts across search, commands, compose, reply, scheduling, and thread movement

## Product experience

1. Sign in from the landing flow.
2. Connect Gmail and Google Calendar for the tenant-scoped workspace.
3. Work from a single deck that keeps the queue, message detail, and agenda visible together.
4. Use commands or the AI operator when you want help searching, drafting, or scheduling.
5. Confirm any email send or event creation before it leaves the app.

The core product promise is simple: AI can prepare work, but the user stays in control of every irreversible action.

## Architecture

- Frontend: Next.js 16, React 19, TypeScript
- Integrations: Corsair with Gmail and Google Calendar plugins
- Data layer: Postgres locally or Neon in hosted environments
- ORM and schema: Drizzle
- Search: local `tsvector` + GIN full-text search over cached mail and calendar data
- Realtime: webhook-triggered refresh, SSE push, and sync timestamp polling fallback
- Auth model: Google identity for sign-in, tenant-specific Google data access for Gmail and Calendar

## Production foundations already in place

- Fail-fast environment validation in production
- Health endpoint at `/api/health`
- Postgres-backed rate limiting for auth, agent, command, send, event, and webhook routes
- Webhook token verification and duplicate delivery protection
- Automated Gmail and Calendar watch renewal through `vercel.json` cron and `CRON_SECRET`
- Structured server logging and safer production error handling
- Explicit confirmation path for agent-generated emails and calendar actions

## Repository layout

- Product app: `corsair-email/`
- Production checklist: [`docs/deployment-checklist.md`](./docs/deployment-checklist.md)
- Local env template: [`.env.example`](./.env.example)
- Hosted env template: [`.env.production.example`](./.env.production.example)

## Local development

Run everything from `corsair-email`.

### 1. Install dependencies

```bash
npm install
```

### 2. Start local Postgres

```bash
docker compose up -d
```

### 3. Create your local env file

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

macOS / Linux:

```bash
cp .env.example .env.local
```

### 4. Fill in the important env vars

| Variable | Local example | Why it matters |
| --- | --- | --- |
| `CORSAIR_KEK` | `32+` byte random secret | Encrypts stored Google credentials. Keep it stable after setup. |
| `SESSION_SECRET` | Long random secret | Signs the app session cookie. |
| `DATABASE_URL` | `postgres://postgres:postgres@127.0.0.1:5432/corsair_email` | Connects the app and Corsair to Postgres. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public app URL used by auth and cookies. |
| `GOOGLE_OAUTH_CLIENT_ID` | `...apps.googleusercontent.com` | Enables Google sign-in and can also seed Gmail and Calendar OAuth locally. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth secret | Pairs with `GOOGLE_OAUTH_CLIENT_ID`. |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Optional. Enables the AI operator. |
| `AI_API_KEY` | `sk-...` | Optional. API key for the chosen provider. |
| `AI_MODEL` | `gpt-4o-mini` | Optional. Model id to use. |
| `AI_OPERATOR_LABEL` | `AI` | Optional. Label shown in the agent UI. |

Agent Chat is provider-neutral. Any OpenAI-compatible chat completions endpoint works, including OpenAI, xAI, Gemini's compatibility endpoint, Groq, OpenRouter, Mistral, Ollama, or LM Studio. Leave the `AI_*` vars blank if you want to run the product without the agent.

### 5. Register the Google OAuth redirect URIs

For sign-in:

```text
http://localhost:3000/api/auth/google/callback
```

For Gmail and Calendar connection:

```text
http://localhost:3000/api/auth/corsair/callback
```

If you reuse `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` for data access, the app can seed the Gmail and Calendar integration credentials automatically. You do not need a separate terminal auth flow for the normal browser-based connect experience.

If you want separate OAuth clients for Gmail and Calendar, save them explicitly:

```bash
npm run corsair:setup -- --gmail client_id=YOUR_GOOGLE_CLIENT_ID client_secret=YOUR_GOOGLE_CLIENT_SECRET --googlecalendar client_id=YOUR_GOOGLE_CLIENT_ID client_secret=YOUR_GOOGLE_CLIENT_SECRET
```

### 6. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Complete the product flow

- Sign in with Google, or use the local email-only path in development
- Open the connect screen
- Click `Connect Gmail`
- Click `Connect Calendar`
- Return to the dashboard once both integrations are live

The workspace tenant id is derived from the signed-in email address. Example: `dave@company.com` becomes `dave-company-com`.

## Useful scripts

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run db:generate
npm run db:push
npm run corsair:setup
npm run corsair:watch-renew
```

## Webhooks and live sync

The app accepts Google webhook deliveries at:

```text
/api/webhooks?tenantId=<tenant-id>&token=<WEBHOOK_SECRET>
```

On a valid webhook:

- the tenant cache is refreshed
- the browser receives a live refresh event over SSE
- the polling fallback can still detect the new sync timestamps on serverless

For local webhook testing, expose the app with a tunnel such as:

```bash
ngrok http 3000
```

Then use the public HTTPS URL as the webhook target when renewing watches.

## Deploying the product

The current production path is:

- Vercel for the Next.js application
- Neon for managed Postgres
- Google OAuth clients for sign-in plus Gmail and Calendar data access

Start with [`.env.production.example`](./.env.production.example), then follow [`docs/deployment-checklist.md`](./docs/deployment-checklist.md) for the full hosted setup, webhook configuration, cron renewal, and health-check flow.

## Notes on naming

The shipped product experience is NovusMail. Some internal files and package names still use `corsair-email` because that is the app directory and deployment unit in this repository.
