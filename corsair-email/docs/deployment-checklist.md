# Vercel + Neon Deployment Checklist

A hardened path to a hosted Corsair Mail. The app **fails fast** in production:
if a required secret is missing, still a dev fallback, or insecure, the server
refuses to boot (`src/lib/env.ts` → `validateEnv()`, run from `src/instrumentation.ts`).

## 1. Create the hosted infrastructure

- Create a Neon project. **Copy the _pooled_ connection string** (the host
  contains `-pooler`). The app disables prepared statements automatically for
  pooled/PgBouncer URLs, which is required for serverless.
- Create a Vercel project pointed at the `corsair-email` directory.
- Decide the exact public URL: `https://your-project.vercel.app` or a custom domain.

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

Generate secrets with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

| Variable | Required | Notes |
| --- | --- | --- |
| `CORSAIR_KEK` | Yes | Encrypts Google tokens. **Never changes** once tokens exist. |
| `SESSION_SECRET` | Yes | Signs the session cookie. **Must differ from `CORSAIR_KEK`.** |
| `DATABASE_URL` | Yes | Neon **pooled** string. |
| `NEXT_PUBLIC_APP_URL` | Yes | Real `https://` origin. Drives cookie `secure` + OAuth redirect. |
| `GOOGLE_OAUTH_CLIENT_ID` | For login | Google sign-in (identity) client. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For login | Pairs with the above. |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | Optional | Separate Gmail data-access OAuth client. Defaults to `GOOGLE_OAUTH_CLIENT_ID/SECRET` when unset. |
| `GOOGLECALENDAR_CLIENT_ID` / `GOOGLECALENDAR_CLIENT_SECRET` | Optional | Separate Calendar data-access OAuth client. Defaults to `GOOGLE_OAUTH_CLIENT_ID/SECRET` when unset. |
| `WEBHOOK_SECRET` | For webhooks | Shared secret in the webhook URL + Calendar channel token. |
| `CRON_SECRET` | For cron | Bearer token Vercel Cron sends to the renewal endpoint. |
| `GMAIL_TOPIC_ID` | For Gmail push | `projects/<project>/topics/<topic>`. |
| `ALLOW_EMAIL_LOGIN` | Optional | `true` re-enables the unverified demo login in prod (default off). |
| `AI_BASE_URL` / `AI_API_KEY` / `AI_MODEL` / `AI_OPERATOR_LABEL` | Optional | Enables Agent Chat (any OpenAI-compatible endpoint). |

Validation rules enforced at boot: all four required vars present and non-fallback,
`SESSION_SECRET !== CORSAIR_KEK`, secrets ≥ 16 chars, `NEXT_PUBLIC_APP_URL` is
`https://`. Change any var → redeploy.

## 3. First deploy + health check

- Deploy from Vercel or `vercel --prod`.
- Hit `GET /api/health` → expect `200 {"status":"ok","db":true,...}` (returns `503`
  if Postgres is unreachable). Use this as your uptime check.
- Load the site logged-out and confirm the sign-in screen renders.

## 4. Two Google OAuth clients (don't conflate them)

1. **Login identity client** → set as `GOOGLE_OAUTH_CLIENT_ID/SECRET`.
   - Authorized redirect URI: `https://your-domain/api/auth/google/callback`
   - Scopes: `openid email profile` (no Gmail scopes).
2. **Data-access client** (Gmail + Calendar) → defaults to
   `GOOGLE_OAUTH_CLIENT_ID/SECRET`, or use the separate `GMAIL_CLIENT_*` /
   `GOOGLECALENDAR_CLIENT_*` vars.
   - Authorized redirect URI: `https://your-domain/api/auth/corsair/callback`

You can reuse one Google Cloud project and OAuth client for both demo flows. Use
separate OAuth clients later if you want cleaner production separation.

## 5. Provision Corsair against the hosted database

If you provide `GMAIL_CLIENT_*` / `GOOGLECALENDAR_CLIENT_*` env vars, the app seeds
Corsair automatically on first login. If you prefer to store credentials manually,
run locally from `corsair-email` with your **production** env values loaded into the
shell (the app need not be running):

```bash
npm run corsair:setup -- --gmail client_id=... client_secret=... --googlecalendar client_id=... client_secret=...
```

The tenant slug is derived from the login email (e.g. `dave@company.com` →
`dave-company-com`). After sign-in, users connect Gmail and Calendar from the
browser with the **Connect Gmail** and **Connect Calendar** buttons.

## 6. Google Cloud setup

- Enable the **Gmail API** and **Google Calendar API**.
- Configure the OAuth consent screen; add demo accounts as test users if unpublished.
- For Gmail push: create a Pub/Sub topic, grant publish to
  `gmail-api-push@system.gserviceaccount.com`, and create a **push subscription**
  targeting `https://your-domain/api/webhooks?tenantId=<tenant-id>&token=<WEBHOOK_SECRET>`.
- Set `GMAIL_TOPIC_ID` to the full topic name.

## 7. Webhooks + automated watch renewal

- `/api/webhooks` rejects any POST whose `?token=` (or `X-Goog-Channel-Token`)
  doesn't match `WEBHOOK_SECRET`, dedupes redeliveries (`webhook_log`), and acks
  fast (200) to avoid Google retry storms.
- Gmail/Calendar watches expire (~7 days). `vercel.json` registers a daily cron:

  ```json
  { "crons": [ { "path": "/api/cron/renew-watches", "schedule": "0 6 * * *" } ] }
  ```

  Vercel sends `Authorization: Bearer $CRON_SECRET`; the endpoint refreshes each
  tenant's watches and records expiry in `watch_state`. Trigger manually with:

  ```bash
  curl -X POST https://your-domain/api/cron/renew-watches -H "Authorization: Bearer $CRON_SECRET"
  ```

  `npm run corsair:watch-renew` remains as an interactive fallback.

## 8. Realtime behaviour on serverless

Live updates use SSE (`/api/stream`) **plus** a polling fallback. The in-memory
event bus can't bridge serverless instances, so the browser also polls
`/api/sync/status` (~25s, paused when the tab is hidden, immediate on focus) and
reloads only when sync timestamps change. SSE still gives instant updates on a
single instance / local dev.

## 9. Security headers / CSP tradeoff

`next.config.ts` sends `X-Content-Type-Options`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`, HSTS, and a CSP. The CSP keeps
`script-src 'unsafe-inline'` because next-themes injects a pre-paint script and
Next injects inline bootstrap (dev also needs `'unsafe-eval'`). Tightening to a
nonce + `strict-dynamic` is a sensible follow-up but not required for launch.

## 10. Abuse protection

Postgres-backed fixed-window rate limits (no Redis) guard `/api/agent`,
`/api/command`, `/api/messages/send`, `/api/events`, `/api/auth/*`, `/api/login`,
and `/api/webhooks`; over-budget callers get `429` + `Retry-After`. The AI and
command routes also cap request body size.

## 11. Judge-demo readiness

- Use one clean demo account; pre-authorize the exact tenant you'll present.
- Seed high/low-priority emails and a couple of calendar events.
- Verify the public URL logged-out, and `/api/health` returns `200`, before submitting.

## 12. Remaining SaaS hardening (post-hackathon)

- Tighten the CSP (nonce + `strict-dynamic`).
- Add JWKS signature verification to the Google `id_token` check (currently
  trusted as received directly from Google's token endpoint over TLS).
- Per-tenant lifecycle tooling and audit logging; separate demo vs customer tenants.
