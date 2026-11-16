"use client";
import { ArrowUp, Square, Plus } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
export default function DoopAIPromptInput({ value, onValueChange, state, disabled, placeholder, onSubmit, onStop, "aria-label": ariaLabel }: {
  value: string; onValueChange: (value: string) => void; state: "streaming" | "idle";
  disabled: boolean; placeholder: string; onSubmit: (value: string) => void;
  onStop: () => void; "aria-label": string;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const busy = state === "streaming";
  useLayoutEffect(() => {
    const textarea = field.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [value]);
  function submit() {
    if (busy) onStop();
    else if (!disabled && value.trim()) onSubmit(value.trim());
  }
  return <div className="doop-source-prompt">
    <Plus size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
    <textarea ref={field} rows={1} aria-label={ariaLabel} disabled={disabled} value={value}
      placeholder={placeholder} onChange={event => onValueChange(event.target.value)}
      onKeyDown={event => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault();
          if (!busy) submit();
        }
      }} />
    <button type="button" aria-label={busy ? "Stop generating" : "Send message"}
      disabled={disabled || (!busy && !value.trim())} onClick={submit}>
      {busy ? <Square size={14} /> : <ArrowUp size={16} />}
    </button>
  </div>;
}
