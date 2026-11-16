"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ComposeInput } from "@/lib/types";

type Props = {
  open: boolean;
  initialDraft?: Partial<ComposeInput> | null;
  onClose: () => void;
  onSend: (input: ComposeInput) => Promise<void>;
  onDraft: (input: ComposeInput) => Promise<void>;
};
const EMPTY: ComposeInput = { to: "", cc: "", bcc: "", subject: "", body: "" };
export function ComposeSheet({
  open,
  initialDraft,
  onClose,
  onSend,
  onDraft,
}: Props) {
  const [draft, setDraft] = useState<ComposeInput>(EMPTY);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [bccOpen, setBccOpen] = useState(false);
  const lock = useRef(false);
  const focusRecipient = useRef<"cc" | "bcc" | null>(null);
  useEffect(() => {
    if (open) {
      setDraft({ ...EMPTY, ...initialDraft });
      setError("");
      setCcOpen(!!initialDraft?.cc);
      setBccOpen(!!initialDraft?.bcc);
    }
  }, [open, initialDraft]);
  const isReply = !!initialDraft?.threadId;
  const canSend = !!(
    draft.to.trim() &&
    draft.subject.trim() &&
    draft.body.trim()
  );
  async function submit(kind: "send" | "draft") {
    if (lock.current || (kind === "send" && !canSend)) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await (kind === "send" ? onSend(draft) : onDraft(draft));
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save your message. Please try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  function field(name: "to" | "cc" | "bcc" | "subject", label: string) {
    return (
      <div className="dashboard-compose-field">
        <label htmlFor={"compose-" + name}>{label} /</label>
        <input
          id={"compose-" + name}
          ref={(node) => {
            if (node && focusRecipient.current === name) {
              node.focus();
              focusRecipient.current = null;
            }
          }}
          aria-label={label}
          autoFocus={name === "to" && !draft.to}
          value={draft[name] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
          autoComplete="off"
          disabled={pending}
        />
      </div>
    );
  }
  return (
    <section
      className="dashboard-composer"
      role="region"
      aria-label={isReply ? "Reply composer" : "New message composer"}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          void submit("send");
        }
      }}
    >
      <header>
        <h2>
          {isReply
            ? "Reply to " + (draft.to.split("@")[0] || "conversation")
            : "New message"}
        </h2>
        <button type="button" disabled={pending} onClick={onClose}>
          Close
        </button>
      </header>
      {field("to", "To")}
      <div className="dashboard-compose-cc">
        <button
          type="button"
          aria-expanded={ccOpen}
          aria-controls="compose-cc"
          disabled={pending}
          onClick={() => {
            focusRecipient.current = ccOpen ? null : "cc";
            setCcOpen(!ccOpen);
          }}
        >
          Cc
        </button>
        <button
          type="button"
          aria-expanded={bccOpen}
          aria-controls="compose-bcc"
          disabled={pending}
          onClick={() => {
            focusRecipient.current = bccOpen ? null : "bcc";
            setBccOpen(!bccOpen);
          }}
        >
          Bcc
        </button>
      </div>
      {ccOpen && field("cc", "Cc")}
      {bccOpen && field("bcc", "Bcc")}
      {field("subject", "Subject")}
      <div className="dashboard-compose-body">
        <label className="sr-only" htmlFor="compose-body">
          Body
        </label>
        <textarea
          id="compose-body"
          value={draft.body}
          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
          placeholder="Write your message…"
          disabled={pending}
        />
      </div>
      {error && (
        <p role="alert" className="dashboard-compose-error">
          {error}
        </p>
      )}
      <footer>
        <Button
          type="button"
          disabled={pending || !canSend}
          aria-busy={pending}
          onClick={() => void submit("send")}
        >
          {pending ? "Saving…" : isReply ? "Send reply" : "Send"}
        </Button>
        <div className="dashboard-compose-secondary">
          <button
            type="button"
            disabled={pending}
            onClick={() => void submit("draft")}
          >
            Save draft
          </button>
          <span>/</span>
          <button type="button" disabled={pending} onClick={onClose}>
            Discard
          </button>
        </div>
      </footer>
    </section>
  );
}
