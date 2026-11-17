"use client";
import { ArrowUpRight } from "lucide-react";
import { DoopMailIcon as Mail, DoopCalendarIcon as Calendar } from "./source-icons";
export type DoopSuggestion = { id: string; label: string };
export function DoopAIWelcomeSuggestions({ suggestions, disabled = false, onSelect, className = "" }: {
  suggestions: DoopSuggestion[]; disabled?: boolean; onSelect: (suggestion: DoopSuggestion) => void; className?: string;
}) {
  return <ul className={`doop-source-suggestions ${className}`} data-node-label="AI Suggestions">
    {suggestions.map(suggestion => <li key={suggestion.id}><button type="button" disabled={disabled} onClick={() => onSelect(suggestion)} data-node-label="Suggestion Button">{className.includes("doop-triage-suggestions") && ( /draft|repl/i.test(suggestion.label) ? <Mail as="div" size={16} aria-hidden="true" /> : <Calendar as="div" size={16} aria-hidden="true" />)}<span>{suggestion.label}</span>{!className.includes("doop-triage-suggestions") && <ArrowUpRight size={16} aria-hidden="true" />}</button></li>)}
  </ul>;
}
