"use client";

import { ArrowUpRight } from "lucide-react";
import type { DoopSuggestion as AISuggestion } from "./ai-suggestions";
import "./ai-welcome.css";
import { DoopBotIcon } from "./source-icons";

/** AI Welcome Content from Doop sa5ThibhQK / 0XY1pUt-1N. */
export function DoopAIWelcome({ suggestions, disabled, onSelect }: {
  suggestions: AISuggestion[];
  disabled: boolean;
  onSelect: (suggestion: AISuggestion) => void;
}) {
  return (
    <section className="doop-source-welcome" data-node-label="AI Welcome Content">
      <DoopBotIcon size={30} />
      <h2>What needs your attention?</h2>
      <p>Ask about your inbox, prepare a reply, or find time to meet.</p>
      <ul data-node-label="AI Suggestions">
        {suggestions.map((suggestion) => (
          <li key={suggestion.id}>
            <button type="button" disabled={disabled} onClick={() => onSelect(suggestion)} data-node-label="Suggestion Button">
              <span>{suggestion.label}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
