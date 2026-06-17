import { redirect } from "next/navigation";

import { WorkspaceShell } from "@/components/workspace-shell";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { aiOperatorInfo } from "@/server/ai";
import { ensureTenant, getConnectionStatus, isAuthError, loadWorkspace } from "@/server/workspace";

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.start);
  }

  const setupLog = await ensureTenant(session);
  const status = await getConnectionStatus(session.tenantId, setupLog);

  if (!status.ready) {
    redirect(ROUTES.connect);
  }

  try {
    const initialWorkspace = await loadWorkspace(session.tenantId, "", {
      allowRemoteFallback: false,
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
