"use client";

import { useEffect, useState } from "react";
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

function toComposeState(initialDraft?: Partial<ComposeInput> | null): ComposeInput {
  return {
    ...EMPTY_COMPOSE,
    ...initialDraft,
  };
}

export function ComposeSheet({ open, initialDraft, onClose, onSend, onDraft }: ComposeSheetProps) {
  const [draft, setDraft] = useState<ComposeInput>(EMPTY_COMPOSE);

  useEffect(() => {
    if (!open) {
      setDraft(EMPTY_COMPOSE);
      return;
    }

    setDraft(toComposeState(initialDraft));
  }, [initialDraft, open]);

  const isReply = Boolean(initialDraft?.threadId);
  const canSend = Boolean(draft.to.trim() && draft.subject.trim() && draft.body.trim());

  async function handleSend() {
    if (!canSend) {
      return;
    }

    await onSend(draft);
    onClose();
  }

  async function handleDraft() {
    await onDraft(draft);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="sm:max-w-xl"
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            void handleSend();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{isReply ? "Respond while the context is warm." : "Send with intent."}</DialogTitle>
          <DialogDescription>Cmd/Ctrl + Enter sends immediately.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="compose-to">To</Label>
              <Input
                id="compose-to"
                autoFocus={!draft.to}
                value={draft.to}
                onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-cc">Cc</Label>
              <Input
                id="compose-cc"
                value={draft.cc}
                onChange={(event) => setDraft((current) => ({ ...current, cc: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-bcc">Bcc</Label>
              <Input
                id="compose-bcc"
                value={draft.bcc}
                onChange={(event) => setDraft((current) => ({ ...current, bcc: event.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                autoFocus={Boolean(draft.to)}
                value={draft.subject}
                onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
                placeholder="Board follow-up"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="compose-body">Body</Label>
            <Textarea
              id="compose-body"
              value={draft.body}
              onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              rows={10}
              placeholder="Write plainly. Move quickly."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => void handleDraft()}>
            Save draft
          </Button>
          <Button type="button" disabled={!canSend} onClick={() => void handleSend()}>
            <SendIcon className="size-4" />
            {isReply ? "Send reply" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
