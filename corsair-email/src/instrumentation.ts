/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * We validate the environment up front (fail-fast on a misconfigured production
 * deploy) and warm the Corsair runtime so the first request doesn't pay the
 * cold schema-setup cost. Both are guarded to the Node.js runtime; the Edge
 * runtime can't load the Postgres client.
 */
export async function register() {
  const { validateEnv, warnEnv } = await import("@/lib/env");

  // Throws on missing/insecure secrets in production — surfaces immediately in logs.
  validateEnv();
  warnEnv();

  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { getRuntime } = await import("@/server/corsair-runtime");
      await getRuntime();
    } catch (error) {
      // Don't crash startup on a transient DB hiccup; /api/health will report it
      // and getRuntime() retries on the next request.
      console.error("[instrumentation] runtime warmup failed:", error);
    }
  }
}
