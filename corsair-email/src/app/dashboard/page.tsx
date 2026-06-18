import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { aiOperatorInfo } from "@/server/ai";
import { log } from "@/server/log";
import { getStoredConnectionStatus, isAuthError, loadWorkspace } from "@/server/workspace";

export default async function DashboardPage() {
  const startedAt = Date.now();
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.start);
  }

  const status = await getStoredConnectionStatus(session.tenantId);

  if (!status.readyForWorkspace) {
    log.info("dashboard_route_decision_timing", {
      tenantId: session.tenantId,
      decision: "redirect_connect",
      readyForWorkspace: false,
      durationMs: Date.now() - startedAt,
    });
    redirect(ROUTES.connect);
  }

  try {
    const initialWorkspace = await loadWorkspace(session.tenantId, "", {
      allowRemoteFallback: false,
    });
    log.info("dashboard_route_decision_timing", {
      tenantId: session.tenantId,
      decision: "render_dashboard",
      readyForWorkspace: true,
      durationMs: Date.now() - startedAt,
    });

    return (
      <WorkspaceShell
        session={session}
        initialWorkspace={initialWorkspace}
        aiOperator={aiOperatorInfo()}
      />
    );
  } catch (error) {
    if (isAuthError(error)) {
      redirect(ROUTES.connect);
    }

    throw error;
  }
}
