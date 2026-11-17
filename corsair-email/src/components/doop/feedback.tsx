"use client";

import { toast } from "sonner";
import "./feedback.css";

type Options = {
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  id?: string;
};
function FeedbackIcon({ kind }: { kind: "success" | "close" | "open" }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "success" ? <><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></> : kind === "close" ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M7 7h10v10" /><path d="M7 17 17 7" /></>}
  </svg>;
}
export function notifySuccess(title: string, { description, action, duration, id }: Options = {}) {
  return toast.custom(toastId => <section className="doop-feedback-card" aria-label={title}>
    <div className="doop-feedback-content">
      <div className="doop-feedback-heading">
        <div><FeedbackIcon kind="success" /><strong>{title}</strong></div>
        <button type="button" aria-label="Dismiss notification" onClick={() => toast.dismiss(toastId)}><FeedbackIcon kind="close" /><span /></button>
      </div>
      {description && <span className="doop-feedback-description"><br />{description}</span>}
      {action && <div className="doop-feedback-action"><button type="button" onClick={action.onClick}><FeedbackIcon kind="open" /><span>{action.label}</span></button></div>}
    </div>
  </section>, { duration, id });
}
