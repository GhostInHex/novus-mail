"use client";
import "@/components/doop/assistant-fidelity.css";
import "@/components/doop/compose-fidelity.css";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import type { ComposeInput } from "@/lib/types";

type Props = {
  open: boolean;
  initialDraft?: Partial<ComposeInput> | null;
  recipientName?: string;
  onClose: () => void;
  onSend: (input: ComposeInput) => Promise<void>;
  onDraft: (input: ComposeInput) => Promise<void>;
};
const EMPTY: ComposeInput = { to: "", cc: "", bcc: "", subject: "", body: "" };
export function ComposeSheet({
  open,
  initialDraft,
  recipientName,
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
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const regionRef = useRef<HTMLElement | null>(null);
  const restoreFrame = useRef<number | null>(null);
  useEffect(() => {
    if (restoreFrame.current !== null) cancelAnimationFrame(restoreFrame.current);
    const target = document.activeElement;
    if (!returnFocus.current) returnFocus.current = target instanceof HTMLElement ? target : null;
    document.getElementById(initialDraft?.to ? "compose-body" : "compose-to")?.focus({ preventScroll: true });
    return () => {
      const target = returnFocus.current;
      const region = regionRef.current;
      restoreFrame.current = requestAnimationFrame(() => {
        if (region?.isConnected) return;
        const visible = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return element.isConnected && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= window.innerWidth;
        };
        const fallback = Array.from(document.querySelectorAll<HTMLElement>('.dashboard-mobile-menu, .dashboard-compose-button')).find(visible);
        (target && visible(target) ? target : fallback)?.focus({ preventScroll: true });
      });
    };
  }, []);
  function requestClose() {
    if (lock.current) return;
    if (JSON.stringify(draft) !== JSON.stringify({ ...EMPTY, ...initialDraft })) setConfirmDiscard(true);
    else onClose();
  }
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
        <span className="dashboard-compose-field-display" aria-hidden="true">{`${label} / ${draft[name] ?? ""}`}</span>
        <div className="dashboard-compose-field-editor">
          <label htmlFor={"compose-" + name}>{label}{" / "}</label>
          <input
            id={"compose-" + name}
            ref={(node) => {
              if (node && focusRecipient.current === name) {
                node.focus();
                focusRecipient.current = null;
              }
            }}
            aria-label={label}
            value={draft[name] ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
            autoComplete="off"
            disabled={pending}
          />
        </div>
      </div>
    );
  }
  return (
    <section
      ref={regionRef}
      className="dashboard-composer"
      role="region"
      aria-label={isReply ? "Reply composer" : "New message composer"}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          if (!confirmDiscard) requestClose();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          void submit("send");
        }
      }}
    >
      <header>
        <h2>
          {isReply
            ? "Reply to " + (recipientName || draft.to.split("@")[0] || "conversation")
            : "New message"}
        </h2>
        <button type="button" disabled={pending} onClick={requestClose}>
          Close
        </button>
      </header>
      {field("to", "To")}
      <div className="dashboard-compose-cc">
        <span className="dashboard-compose-cc-display" aria-hidden="true">Cc Bcc</span>
        <div className="dashboard-compose-cc-controls">
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
          </button>{" "}
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
          <span>{pending ? "Saving…" : isReply ? "Send reply" : "Send"}</span>
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
      <DiscardChangesDialog open={confirmDiscard} onKeepEditing={() => setConfirmDiscard(false)} onDiscard={onClose} />
    </section>
  );
}
