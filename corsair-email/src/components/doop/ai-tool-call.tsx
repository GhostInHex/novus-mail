import { CheckCircle2, LoaderCircle } from "lucide-react";
export default function DoopAIToolCall({ name, status = "success" }: {
  name: string; status?: "running" | "success"; className?: string;
}) {
  return <div className="doop-source-tool" data-state={status} data-node-label="Completed Activity" role="status">
    {status === "running" ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" /> : <CheckCircle2 size={16} />}
    <span>{name}</span>
  </div>;
}
