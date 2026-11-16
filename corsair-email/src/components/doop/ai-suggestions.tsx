"use client";
import { ArrowUpRight } from "lucide-react";
export type DoopSuggestion = { id: string; label: string };
export function DoopAIWelcomeSuggestions({ suggestions, disabled = false, onSelect, className = "" }: {
  suggestions: DoopSuggestion[]; disabled?: boolean; onSelect: (suggestion: DoopSuggestion) => void; className?: string;
}) {
  return <ul className={`doop-source-suggestions ${className}`} data-node-label="AI Suggestions">
    {suggestions.map(suggestion => <li key={suggestion.id}><button type="button" disabled={disabled} onClick={() => onSelect(suggestion)} data-node-label="Suggestion Button"><span>{suggestion.label}</span><ArrowUpRight size={16} aria-hidden="true" /></button></li>)}
  </ul>;
}
