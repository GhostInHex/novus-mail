import type { ReactNode } from "react";

export function WorkspaceActionLabel({ children }: { children: ReactNode }) {
  return <span className="dashboard-action-label">{children}</span>;
}
