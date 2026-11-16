"use client";
import { useEffect, useRef, useState } from "react";
import { CalendarIcon, MailIcon, SearchIcon, TerminalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import type { ThreadDetail } from "@/lib/types";

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
      detail: "Tomorrow at 9:00 AM",
      value: `schedule meeting with ${sender} tomorrow 9am :: ${activeThread?.subject || "Follow up"}`,
      icon: CalendarIcon,
    },
    {
      label: "Schedule and prepare an email",
      detail: "Create an event and draft a follow-up",
      value: `schedule meeting with ${sender} tomorrow 9am and send email saying Looking forward to it.`,
      icon: MailIcon,
    },
    {
      label: "Search mail",
      detail: `from:${sender} newer_than:7d`,
      value: `from:${sender} newer_than:7d`,
      icon: SearchIcon,
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
      <DialogContent instant className="gap-0 overflow-hidden p-0 sm:max-w-[780px]">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <TerminalIcon className="size-4" />
            Command console
          </DialogTitle>
          <DialogDescription>
            Search, schedule, send, or do both in one sentence.
          </DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false} className="bg-card">
          <CommandInput
            aria-label="Command"
            value={command}
            onValueChange={setCommand}
            placeholder="Search mail or describe your next step..."
            disabled={pending}
          />
          <CommandList className="p-3">
            <CommandGroup heading="Commands">
              {command.trim() && (
                <CommandItem
                  value="run-typed-command"
                  onSelect={() => void run(command)}
                  disabled={pending}
                >
                  Run: {command}
                </CommandItem>
              )}
              {suggestions.map((item) => (
                <CommandItem
                  key={item.label}
                  value={item.label}
                  onSelect={() => setCommand(item.value)}
                  disabled={pending}
                  className="gap-3 px-3 py-3"
                >
                  <item.icon className="size-4" />
                  <span>
                    <span className="block text-sm">{item.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
        {error && (
          <p role="alert" className="px-6 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <span className="text-xs text-muted-foreground">
            Arrow keys navigate · Enter Select · Escape Close
          </span>
          <Button
            disabled={pending || !command.trim()}
            aria-busy={pending}
            onClick={() => void run()}
          >
            Run command
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
