"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ComposeInput } from "@/lib/types";

type ComposeSheetProps = {
  open: boolean;
  initialDraft?: Partial<ComposeInput> | null;
  onClose: () => void;
  onSend: (input: ComposeInput) => Promise<void>;
  onDraft: (input: ComposeInput) => Promise<void>;
};

const EMPTY_COMPOSE: ComposeInput = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
};

function toComposeState(
  initialDraft?: Partial<ComposeInput> | null,
): ComposeInput {
  return {
    ...EMPTY_COMPOSE,
    ...initialDraft,
  };
}

export function ComposeSheet({
  open,
  initialDraft,
  onClose,
  onSend,
  onDraft,
}: ComposeSheetProps) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<ComposeInput>(EMPTY_COMPOSE);

  useEffect(() => {
    if (!open) {
      setDraft(EMPTY_COMPOSE);
      return;
    }

    setError("");
    setDraft(toComposeState(initialDraft));
  }, [initialDraft, open]);

  const isReply = Boolean(initialDraft?.threadId);
  const canSend = Boolean(
    draft.to.trim() && draft.subject.trim() && draft.body.trim(),
  );

  async function submit(kind: "send" | "draft") {
    if (pendingRef.current || (kind === "send" && !canSend)) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await (kind === "send" ? onSend(draft) : onDraft(draft));
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Your message could not be saved. Please try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  const handleSend = () => submit("send");
  const handleDraft = () => submit("draft");

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && !pending && onClose()}
    >
      <DialogContent
        className="doop-compose sm:max-w-[780px]"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void handleSend();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {isReply
              ? "Reply to " + (draft.to || "your conversation")
              : "New message"}
          </DialogTitle>
          <DialogDescription>
            Review your reply. Nothing is sent until you choose Send.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="compose-to">To</Label>
              <Input
                id="compose-to"
                autoFocus={!draft.to}
                value={draft.to}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-cc">Cc</Label>
              <Input
                id="compose-cc"
                value={draft.cc}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    cc: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-bcc">Bcc</Label>
              <Input
                id="compose-bcc"
                value={draft.bcc}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bcc: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                autoFocus={Boolean(draft.to)}
                value={draft.subject}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    subject: event.target.value,
                  }))
                }
                placeholder="Board follow-up"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-body">Body</Label>
            <Textarea
              id="compose-body"
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  body: event.target.value,
                }))
              }
              rows={10}
              placeholder="Write your message..."
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => void handleDraft()}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={pending || !canSend}
            aria-busy={pending}
            onClick={() => void handleSend()}
          >
            <SendIcon className="size-4" />
            {isReply ? "Send reply" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
