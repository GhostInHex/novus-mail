"use client";
import "@/components/doop/assistant-fidelity.css";
import "@/components/doop/overlay-fidelity.css";
import { useEffect, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { ArrowUpRight, CommandIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import type { ThreadDetail } from "@/lib/types";

function CommandMailIcon() {
  return (
    <svg className="size-4" aria-hidden="true" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function CommandSearchIcon() {
  return (
    <svg className="size-4 shrink-0" aria-hidden="true" stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

type Props = {
  open: boolean;
  activeThread?: ThreadDetail | null;
  onClose: () => void;
  onRun: (command: string) => Promise<void>;
};
export function CommandPalette({ open, activeThread, onClose, onRun }: Props) {
  const [command, setCommand] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    if (open) {
      setCommand("");
      setError("");
    }
  }, [open]);
  const sender = activeThread?.senderEmail || "teammate@example.com";
  const suggestions = [
    {
      label: "Schedule a meeting",
      detail: `Tomorrow at 9:00 AM${activeThread?.sender ? ` · ${activeThread.sender}` : ""}`,
      value: `schedule meeting with ${sender} tomorrow 9am :: ${activeThread?.subject || "Follow up"}`,

    },
    {
      label: "Schedule and prepare an email",
      detail: "Create an event and draft a follow-up",
      value: `schedule meeting with ${sender} tomorrow 9am and send email saying Looking forward to it.`,

    },
    {
      label: "Search mail",
      detail: `from:${sender} newer_than:7d`,
      value: `from:${sender} newer_than:7d`,

    },
  ];
  async function run(value = command) {
    if (!value.trim() || lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      await onRun(value);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Command failed. Please try again.",
      );
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !value && !pending && onClose()}
    >
      <DialogContent instant showCloseButton={false} className="doop-modal doop-command-modal">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <CommandIcon aria-hidden="true" />Command console
          </DialogTitle>
          <DialogDescription>
            Search, schedule, send, or do both in one sentence.
          </DialogDescription>
        </DialogHeader>
        <DialogClose className="doop-command-escape" aria-label="Close"><XIcon className="size-4" aria-hidden="true" /><span>esc</span></DialogClose>
        <Command label="Command" shouldFilter={false} className="bg-card">
          <div data-slot="command-input-wrapper" className="flex items-center"><CommandSearchIcon /><CommandPrimitive.Input
            data-slot="command-input"
            className="w-full bg-transparent outline-none"
            aria-label="Command"
            value={command}
            onValueChange={setCommand}
            placeholder="Search mail or describe your next step..."
            disabled={pending}
            onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && command.trim()) {
                event.preventDefault();
                void run(command);
              }
            }}
          />
          </div>
          <CommandList className="p-3">
            <CommandGroup heading="Commands">
              {suggestions.map((item) => (
                <CommandItem
                  key={item.label}
                  value={item.label}
                  onSelect={() => setCommand(item.value)}
                  disabled={pending}
                  className="gap-3 px-3 py-3"
                >
                  <CommandMailIcon />
                  <span>
                    <span className="block text-sm">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <ArrowUpRight className="ml-auto size-4 shrink-0" />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <p className="doop-command-help">
            ↑ ↓ Navigate · Enter Run · Escape Close
          </p>
        </Command>
        {error && (
          <p role="alert" className="px-6 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            {`Context: ${activeThread?.subject || "All mail"}`}
          </span>
          <Button
            disabled={pending || !command.trim()}
            aria-busy={pending}
            onClick={() => void run()}
          >
            <span className="doop-command-run-label">Run command</span>
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
