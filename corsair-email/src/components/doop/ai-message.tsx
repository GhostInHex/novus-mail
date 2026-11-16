"use client";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export default function DoopAIMessage({ from = "assistant", children, className }: {
  from?: "user" | "assistant"; children: ReactNode; className?: string;
}) {
  return <div className={cn("doop-source-message", className)} data-from={from} data-node-label={from === "user" ? "User Message" : "Assistant Message"}>{children}</div>;
}
