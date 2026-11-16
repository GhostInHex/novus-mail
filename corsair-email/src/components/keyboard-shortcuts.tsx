"use client";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const SHORTCUTS = [
  { label: "Search", keys: "/" },
  { label: "Command console", keys: "Cmd/Ctrl K" },
  { label: "Agent chat", keys: "A or Cmd/Ctrl J" },
  { label: "Compose", keys: "C" },
  { label: "Reply", keys: "R" },
  { label: "Schedule event", keys: "G" },
  { label: "Next / previous", keys: "J / K" },
  { label: "Archive", keys: "E" },
  { label: "Star", keys: "S" },
  { label: "Toggle unread", keys: "U" },
  { label: "Trash", keys: "Del" },
  { label: "Shortcuts", keys: "?" },
];
export function KeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  function keys(value: string) {
    return value.split(/ (or|\/) /).map((part, index) =>
      part === "or" || (part === "/" && value !== "/") ? (
        <span key={index} className="doop-key-alternative">
          {part}
        </span>
      ) : (
        <span key={index} className="doop-key-combination">
          {part.split(" ").map((key, i) => (
            <kbd key={i}>
              {key === "Cmd/Ctrl" ? (mac ? "\u2318" : "Ctrl") : key}
            </kbd>
          ))}
        </span>
      ),
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="doop-modal doop-shortcuts-modal">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move through the workspace without the mouse.
          </DialogDescription>
        </DialogHeader>
        <div
          className="doop-shortcut-grid"
          role="list"
          aria-label="Workspace shortcuts"
        >
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.label}
              className="doop-shortcut-row"
              role="listitem"
            >
              <span>{shortcut.label}</span>
              <span className="doop-shortcut-keys" aria-label={shortcut.keys}>
                {keys(shortcut.keys)}
              </span>
            </div>
          ))}
        </div>
        <footer className="doop-shortcuts-footer">
          <span>Close this menu</span>
          <kbd>Esc</kbd>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
