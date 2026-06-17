"use client";

import { useEffect, useState } from "react";
import { CornerDownLeftIcon, TerminalIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ThreadDetail } from "@/lib/types";

type CommandPaletteProps = {
  open: boolean;
  activeThread?: ThreadDetail | null;
  onClose: () => void;
  onRun: (command: string) => Promise<void>;
};

function buildSuggestions(activeThread?: ThreadDetail | null) {
  const suggestions = [
    "from:boss newer_than:7d",
    "email teammate@example.com about Launch follow-up :: Great meeting today.",
    "schedule meeting with teammate@example.com tomorrow 9am :: Product review",
    "schedule meeting with teammate@example.com tomorrow 9am and send email saying Looking forward to it.",
  ];

  if (activeThread?.senderEmail) {
    suggestions.unshift(`from:${activeThread.senderEmail}`);
    suggestions.unshift(
      `schedule meeting with ${activeThread.senderEmail} tomorrow 9am :: Follow up on ${activeThread.subject}`,
    );
  }

  return suggestions;
}

export function CommandPalette({ open, activeThread, onClose, onRun }: CommandPaletteProps) {
  const [command, setCommand] = useState("");

  useEffect(() => {
    if (!open) {
      setCommand("");
    }
  }, [open]);

  const suggestions = buildSuggestions(activeThread);

  async function handleRun() {
    if (!command.trim()) {
      return;
    }

    await onRun(command);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleRun();
          }
        }}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <TerminalIcon className="size-4" />
            Command console
          </DialogTitle>
          <DialogDescription>Search, schedule, send, or do both in one sentence.</DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <div className="relative">
            <Input
              autoFocus
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              className="h-11 pr-10 font-mono text-sm"
              placeholder="schedule meeting with teammate@example.com tomorrow 9am and send email saying …"
            />
            <CornerDownLeftIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>

          <p className="mt-5 mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Try one of these
          </p>
          <div className="scroll-area-thin max-h-64 space-y-1.5 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="motion-state w-full rounded-md border border-border bg-card px-3 py-2 text-left outline-none hover:border-primary/30 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setCommand(suggestion)}
              >
                <code className="font-mono text-xs text-foreground/80">{suggestion}</code>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end border-t border-border px-5 py-3">
          <Button type="button" disabled={!command.trim()} onClick={() => void handleRun()}>
            Run command
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
