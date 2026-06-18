import type { AgendaEvent, SessionUser, ThreadDetail, ThreadSummary, WorkspacePayload } from "@/lib/types";
import { env } from "@/lib/env";

export function isDemoTenant(tenantId: string) {
  return tenantId === env.DEMO_TENANT_ID;
}

export function buildDemoSession(): SessionUser {
  return {
    tenantId: env.DEMO_TENANT_ID,
    email: env.DEMO_EMAIL,
    displayName: env.DEMO_DISPLAY_NAME,
    mode: "demo",
  };
}

export type DemoWorkspace = WorkspacePayload & {
  allThreads: ThreadDetail[];
};

export type DemoSeed = {
  threads: ThreadDetail[];
  events: AgendaEvent[];
};

export function emptyDemoSeed(): DemoSeed {
  return { threads: [], events: [] };
}
