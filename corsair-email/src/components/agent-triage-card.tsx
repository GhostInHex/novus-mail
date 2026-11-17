"use client";
import { z } from "zod";
import { ArrowUpRight } from "lucide-react";
import { DoopMailIcon as Mail } from "@/components/doop/source-icons";
import AIArtifact from "@/components/doop/ai-artifact";
const snapshotSchema = z.object({
  total: z.number().nonnegative(),
  threads: z.array(
    z.object({
      threadId: z.string(),
      sender: z.string(),
      subject: z.string(),
      priorityBand: z.string(),
      summaryReason: z.string(),
    }),
  ),
});
export type TriageSnapshot = z.infer<typeof snapshotSchema>;
export function parseTriageSnapshot(
  value: unknown,
): TriageSnapshot | undefined {
  const result = snapshotSchema.safeParse(value);
  return result.success ? result.data : undefined;
}
export function AgentTriageCard({
  result,
  onOpenThread,
}: {
  result: TriageSnapshot;
  onOpenThread?: (id: string) => void;
}) {
  const high = result.threads.filter((t) => t.priorityBand === "high").length;
  const groups = new Map<string, TriageSnapshot["threads"]>();
  for (const thread of result.threads) {
    const group = groups.get(thread.sender) ?? [];
    group.push(thread);
    groups.set(thread.sender, group);
  }
  return (
    <AIArtifact
      showHeader={false}
      title="Inbox triage"
      className="doop-agent-triage"
      preview={
        <>
          <header>
            <h3><span>
              {result.threads.length === result.total
                ? result.total
                : `${result.threads.length} of ${result.total}`}{" "}
              {result.total === 1 ? "thread" : "threads"}
            </span></h3>
            <p><span>
              {`${high} high priority · ${result.threads.length - high} normal`}
            </span></p>
          </header>
          <div className="doop-source-results">
            {[...groups].map(([sender, threads]) => (
              <button
                key={sender}
                type="button"
                disabled={!onOpenThread}
                onClick={() => onOpenThread?.(threads[0].threadId)}
              >
                <Mail size={16} aria-hidden="true" />
                <span className="doop-source-result-details"><strong>
                  {sender}
                  {threads.length > 1
                    ? ` · ${threads.length} threads`
                    : threads[0].priorityBand === "high"
                      ? " · High priority"
                      : ""}
                </strong>
                <small>
                  {threads.length > 1
                    ? threads[0].summaryReason || [...new Set(threads.map((t) => t.subject))].join(", ")
                    : threads[0].summaryReason || threads[0].subject}
                </small></span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      }
    />
  );
}
