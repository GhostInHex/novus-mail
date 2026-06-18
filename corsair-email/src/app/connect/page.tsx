import { redirect } from "next/navigation";

import { ConnectState } from "@/components/connect-state";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { log } from "@/server/log";
import { getConnectionHealth, getStoredConnectionStatus } from "@/server/workspace";

type ConnectPageProps = {
  searchParams: Promise<{ connection_error?: string }>;
};

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const startedAt = Date.now();
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.start);
  }

  const { connection_error } = await searchParams;
  const storedStatus = await getStoredConnectionStatus(session.tenantId);

  if (storedStatus.readyForWorkspace) {
    log.info("connect_route_decision_timing", {
      tenantId: session.tenantId,
      decision: "redirect_dashboard",
      readyForWorkspace: true,
      durationMs: Date.now() - startedAt,
    });
    redirect(ROUTES.dashboard);
  }

  const status = await getConnectionHealth(session.tenantId, storedStatus.setupLog);
  log.info("connect_route_decision_timing", {
    tenantId: session.tenantId,
    decision: "render_connect",
    readyForWorkspace: status.readyForWorkspace,
    degraded: status.degraded,
    durationMs: Date.now() - startedAt,
  });

  return (
    <ConnectState
      session={session}
      status={status}
      connectionError={connection_error}
    />
  );
}
