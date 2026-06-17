import postgres from "postgres";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { createCorsair } from "corsair";
import type { Sql } from "postgres";

import { env } from "@/lib/env";
import { type AppDrizzleDatabase, createDrizzleDb } from "@/server/db";

type RuntimeBundle = {
  appDb: Sql;
  drizzleDb: AppDrizzleDatabase;
  corsair: ReturnType<typeof createCorsair>;
  ready: Promise<void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __corsairRuntime__: RuntimeBundle | undefined;
}

// Transaction-pooled connection strings (Neon's `-pooler` host, or PgBouncer
// with `pgbouncer=true`) don't support server-side prepared statements. In
// production prod `DATABASE_URL` should be the POOLED string — see the
// deployment checklist.
const isPooledUrl = /-pooler\.|pgbouncer=true|pooler=true/i.test(env.DATABASE_URL);

function createRuntime(): RuntimeBundle {
  const appDb = postgres(env.DATABASE_URL, {
    connect_timeout: 30,
    // Serverless instances are short-lived and numerous: keep the per-instance
    // pool small and connections short so we don't exhaust Postgres' limit.
    idle_timeout: env.IS_PRODUCTION ? 10 : 20,
    max: env.IS_PRODUCTION ? 3 : 10,
    // Disable prepared statements on pooled URLs (required) and in production
    // generally (serverless-safe); keep them for fast local direct connections.
    prepare: isPooledUrl ? false : !env.IS_PRODUCTION,
  });
  const drizzleDb = createDrizzleDb(appDb);

  const ready = appDb`SELECT 1`.then(() => undefined);

  const corsair = createCorsair({
    database: appDb,
    kek: env.CORSAIR_KEK,
    multiTenancy: true,
    plugins: [
      gmail({
        permissions: {
          mode: "open",
        },
      }),
      googlecalendar({
        permissions: {
          mode: "open",
        },
      }),
    ],
  });

  return {
    appDb,
    drizzleDb,
    corsair,
    ready,
  };
}

export async function getRuntime() {
  globalThis.__corsairRuntime__ ??= createRuntime();

  try {
    await globalThis.__corsairRuntime__.ready;
  } catch (error) {
    // Readiness failed (e.g. DB briefly unreachable). Don't poison the
    // singleton with a permanently-rejected `ready` — drop it so the next call
    // retries with a fresh client instead of staying broken until restart.
    globalThis.__corsairRuntime__ = undefined;
    throw error;
  }

  return globalThis.__corsairRuntime__;
}

export async function getCorsair() {
  return (await getRuntime()).corsair;
}

export async function getAppDb() {
  return (await getRuntime()).appDb;
}

export async function getDrizzleDb() {
  return (await getRuntime()).drizzleDb;
}
