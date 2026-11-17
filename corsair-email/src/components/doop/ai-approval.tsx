"use client";
import { DoopWarningIcon as AlertTriangle } from "./source-icons";
import type { ReactNode } from "react";
type Option = { id: string; label: string };
export default function DoopAIApproval({ question, children, options, onDecide }: {
  question: string; children: ReactNode; options: Option[];
  onDecide: (option: Option) => void; className?: string;
}) {
  return <section className="doop-source-approval" aria-label={question}>
    <div className="doop-approval-inner"><h3><AlertTriangle size={22} />{question}</h3>
    <div>{children}</div>
    <footer>{options.map(option => <button type="button" key={option.id} data-primary={option.id === "review"} onClick={() => onDecide(option)}>{option.id !== "review" && <AlertTriangle size={16} />}<span className="doop-accent-label">{option.label}</span></button>)}</footer></div>
  </section>;
}
