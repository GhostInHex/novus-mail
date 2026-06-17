import { env } from "@/lib/env";

const CONNECT_PLUGINS = ["gmail", "googlecalendar"] as const;

export type ConnectPlugin = (typeof CONNECT_PLUGINS)[number];

export function isConnectPlugin(value: string): value is ConnectPlugin {
  return (CONNECT_PLUGINS as readonly string[]).includes(value);
}

export function corsairOAuthRedirectUri() {
  return `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/auth/corsair/callback`;
}

export function isCorsairOAuthConfigError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /client_id|client_secret|credentials|integration .*not found|run setupcorsair|not configured/i.test(
    error.message,
  );
}
