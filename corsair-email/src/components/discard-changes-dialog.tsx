"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};

export function DiscardChangesDialog({ open, onKeepEditing, onDiscard }: Props) {
  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onKeepEditing(); }}>
      <DialogContent className="doop-modal" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Discard unsaved changes?</DialogTitle>
          <DialogDescription>Your changes haven’t been saved. Keep editing to finish them.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button autoFocus variant="outline" onClick={onKeepEditing}>Keep editing</Button>
          <Button variant="destructive" onClick={onDiscard}>Discard changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
