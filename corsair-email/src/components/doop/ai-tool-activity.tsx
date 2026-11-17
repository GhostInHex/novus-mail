import { CheckCircle2, ChevronDown, LoaderCircle } from "lucide-react";

type Props = {
  heading: string;
  tools: string[];
  progressLabel: string;
  threadContext?: { sender: string; subject: string };
};

export function DoopAIToolActivity({ heading, tools, progressLabel, threadContext }: Props) {
  const checksMailAndCalendar = tools.some(tool => /calendar/i.test(tool)) && tools.some(tool => /thread|reply|inbox/i.test(tool));
  return <section className="doop-tool-activity" aria-label="Tool activity">
    <h3>{heading}</h3>
    <details open className="doop-tool-activity-card">
      <summary><ChevronDown size={16} aria-hidden="true" /><strong>{checksMailAndCalendar ? "Inbox and calendar checks" : "Preparing your response"}</strong><span>Working</span></summary>
      <ol>
        {tools.map((tool, index) => <li key={`${index}-${tool}`}><CheckCircle2 size={16} aria-hidden="true" /><span>{tool}</span></li>)}
        <li data-running="true" role="status"><LoaderCircle size={16} aria-hidden="true" className="animate-spin motion-reduce:animate-none" /><span>{progressLabel}</span></li>
      </ol>
      {threadContext && <div className="doop-tool-context"><span>Read thread</span><code>{`${threadContext.sender} / ${threadContext.subject}`}</code></div>}
    </details>
    <p>{/draft/i.test(progressLabel) ? "Your drafts will appear here for review. Nothing has been sent." : "Your response will appear here when the checks finish."}</p>
  </section>;
}
