import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export default function DoopAIArtifact({ title, preview, className }: {
  title: string; preview: ReactNode; className?: string; showHeader?: boolean;
}) {
  return <section aria-label={title} data-node-label="Feature Card" className={cn("doop-source-artifact", className)}>{preview}</section>;
}
