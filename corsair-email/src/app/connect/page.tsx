import { redirect } from "next/navigation";

import { ConnectState } from "@/components/connect-state";
import { ROUTES } from "@/lib/routes";
import { getSession } from "@/lib/session";
import { ensureTenant, getConnectionStatus } from "@/server/workspace";

type ConnectPageProps = {
  searchParams: Promise<{ connection_error?: string }>;
};

export default async function ConnectPage({ searchParams }: ConnectPageProps) {
  const session = await getSession();

  if (!session) {
    redirect(ROUTES.start);
  }

  const { connection_error } = await searchParams;
  const setupLog = await ensureTenant(session);
  const status = await getConnectionStatus(session.tenantId, setupLog);

  if (status.ready) {
    redirect(ROUTES.dashboard);
  }

  return (
    <ConnectState
      session={session}
      status={status}
      connectionError={connection_error}
    />
  );
}
