// Centralised, validated environment access.
//
// In development we keep convenient fallbacks so `npm run dev` works with zero
// setup. In production those fallbacks are refused: `validateEnv()` (called once
// from `src/instrumentation.ts`) throws on any missing/insecure required value,
// so a misconfigured deploy fails fast instead of booting with broken secrets.

const isProduction = process.env.NODE_ENV === "production";
// `next build` evaluates server modules with NODE_ENV=production; we must not
// fail the build for missing runtime secrets, only the running server.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const DEV_FALLBACKS = {
  CORSAIR_KEK: "local-dev-corsair-kek-change-me",
  SESSION_SECRET: "local-dev-session-secret-change-me",
  DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/corsair_email",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
} as const;

function read(name: keyof typeof DEV_FALLBACKS): string {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }
  // No insecure fallbacks in production — validateEnv() will flag the gap.
  return isProduction ? "" : DEV_FALLBACKS[name];
}

function readOptional(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function readBool(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

// SESSION_SECRET historically fell back to CORSAIR_KEK. That conflates two
// security domains (cookie signing vs. token encryption), so the reuse is now
// dev-only and explicitly rejected in production by validateEnv().
const sessionSecret =
  process.env.SESSION_SECRET?.trim() ||
  (isProduction ? "" : process.env.CORSAIR_KEK?.trim() || DEV_FALLBACKS.SESSION_SECRET);

const googleOAuthClientId = readOptional("GOOGLE_OAUTH_CLIENT_ID");
const googleOAuthClientSecret = readOptional("GOOGLE_OAUTH_CLIENT_SECRET");

export const env = {
  CORSAIR_KEK: read("CORSAIR_KEK"),
  SESSION_SECRET: sessionSecret,
  DATABASE_URL: read("DATABASE_URL"),
  NEXT_PUBLIC_APP_URL: read("NEXT_PUBLIC_APP_URL"),

  // Google sign-in (identity). Distinct from the Gmail/Calendar data-access
  // OAuth client, which lives encrypted in Postgres via `corsair setup`.
  GOOGLE_OAUTH_CLIENT_ID: googleOAuthClientId,
  GOOGLE_OAUTH_CLIENT_SECRET: googleOAuthClientSecret,

  // Google data-access OAuth clients used by Corsair for Gmail/Calendar. If
  // omitted, local/demo setups reuse the sign-in OAuth client so browser-based
  // connection works without a separate CLI-only credential path.
  GMAIL_CLIENT_ID: readOptional("GMAIL_CLIENT_ID") || googleOAuthClientId,
  GMAIL_CLIENT_SECRET: readOptional("GMAIL_CLIENT_SECRET") || googleOAuthClientSecret,
  GOOGLECALENDAR_CLIENT_ID: readOptional("GOOGLECALENDAR_CLIENT_ID") || googleOAuthClientId,
  GOOGLECALENDAR_CLIENT_SECRET: readOptional("GOOGLECALENDAR_CLIENT_SECRET") || googleOAuthClientSecret,

  // Shared secret carried in the webhook URL (`?token=`) and used as the
  // Calendar push channel token, so only Google's registered callbacks are honoured.
  WEBHOOK_SECRET: readOptional("WEBHOOK_SECRET"),
  // Bearer token Vercel Cron sends to the watch-renewal endpoint.
  CRON_SECRET: readOptional("CRON_SECRET"),
  // Full Pub/Sub topic name for Gmail watches, e.g. projects/<id>/topics/<topic>.
  GMAIL_TOPIC_ID: readOptional("GMAIL_TOPIC_ID"),

  // Dev/demo email-only login. Always available in development; in production it
  // is off unless explicitly enabled (real identity is Google sign-in).
  ALLOW_EMAIL_LOGIN: readBool("ALLOW_EMAIL_LOGIN") || !isProduction,

  // Provider-neutral AI operator. Any OpenAI-compatible chat-completions endpoint:
  // OpenAI, xAI/Grok, Gemini (compat), Groq, OpenRouter, Mistral, or a local model
  // (Ollama/LM Studio). All optional — when unset, the Agent Chat is simply disabled.
  AI_BASE_URL: readOptional("AI_BASE_URL"),
  AI_API_KEY: readOptional("AI_API_KEY"),
  AI_MODEL: readOptional("AI_MODEL"),
  AI_OPERATOR_LABEL: readOptional("AI_OPERATOR_LABEL") || "AI",

  DEMO_LOGIN_ENABLED: readBool("DEMO_LOGIN_ENABLED") || !isProduction,
  DEMO_TENANT_ID: readOptional("DEMO_TENANT_ID") || "demo-workspace",
  DEMO_EMAIL: readOptional("DEMO_EMAIL") || "demo@novusmail.local",
  DEMO_DISPLAY_NAME: readOptional("DEMO_DISPLAY_NAME") || "NovusMail Demo",

  IS_PRODUCTION: isProduction,
};

export function isGoogleLoginConfigured(): boolean {
  return Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Fail-fast validation of required production configuration. No-op in
 * development and during the build phase. Throws a single aggregated error so
 * the server refuses to start with missing or insecure secrets.
 */
export function validateEnv(): void {
  if (!isProduction || isBuildPhase) {
    return;
  }

  const errors: string[] = [];

  const required: Array<[keyof typeof DEV_FALLBACKS, string]> = [
    ["CORSAIR_KEK", env.CORSAIR_KEK],
    ["SESSION_SECRET", env.SESSION_SECRET],
    ["DATABASE_URL", env.DATABASE_URL],
    ["NEXT_PUBLIC_APP_URL", env.NEXT_PUBLIC_APP_URL],
  ];

  for (const [name, value] of required) {
    if (!value) {
      errors.push(`${name} is required in production.`);
    } else if (value === DEV_FALLBACKS[name]) {
      errors.push(`${name} must not use the insecure development fallback value.`);
    }
  }

  if (env.CORSAIR_KEK && env.CORSAIR_KEK.length < 16) {
    errors.push("CORSAIR_KEK must be at least 16 characters (use a 32-byte hex secret).");
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET.length < 16) {
    errors.push("SESSION_SECRET must be at least 16 characters.");
  }
  if (env.SESSION_SECRET && env.SESSION_SECRET === env.CORSAIR_KEK) {
    errors.push("SESSION_SECRET must differ from CORSAIR_KEK (separate security domains).");
  }
  if (env.NEXT_PUBLIC_APP_URL && !env.NEXT_PUBLIC_APP_URL.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_APP_URL must be an https:// URL in production.");
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid production environment configuration:\n - ${errors.join("\n - ")}\n` +
        "See corsair-email/.env.production.example and docs/deployment-checklist.md.",
    );
  }
}

/**
 * Non-fatal warnings for optional production features that are silently
 * disabled when unconfigured. Logged once at startup.
 */
export function warnEnv(): void {
  if (!isProduction || isBuildPhase) {
    return;
  }

  const warnings: string[] = [];
  if (!isGoogleLoginConfigured()) {
    warnings.push(
      "Google sign-in is disabled (GOOGLE_OAUTH_CLIENT_ID/SECRET unset). " +
        (env.ALLOW_EMAIL_LOGIN
          ? "Email-only login is enabled — fine for demos, not for real identity."
          : "No login method is enabled; set Google OAuth or ALLOW_EMAIL_LOGIN."),
    );
  }
  if (!env.WEBHOOK_SECRET) {
    warnings.push("WEBHOOK_SECRET unset — /api/webhooks accepts unauthenticated POSTs.");
  }
  if (!env.CRON_SECRET) {
    warnings.push("CRON_SECRET unset — /api/cron/renew-watches is disabled.");
  }

  for (const warning of warnings) {
    console.warn(`[env] ${warning}`);
  }
}
