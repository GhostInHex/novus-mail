"use client";
import "@/components/doop/assistant-fidelity.css";
import "@/components/doop/overlay-fidelity.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const SHORTCUTS = [
  { label: "Search", keys: "/" },
  { label: "Command console", keys: "Ctrl / Cmd K" },
  { label: "Agent chat", keys: "A or Ctrl / Cmd J" },
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
                <kbd>{shortcut.keys}</kbd>
              </span>
            </div>
          ))}
        </div>

      </DialogContent>
    </Dialog>
  );
}
