"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
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
import type { AgendaEvent, EventInput } from "@/lib/types";

type EventSheetProps = {
  open: boolean;
  initialEvent?: AgendaEvent | null;
  draftPreset?: Partial<EventInput> | null;
  onClose: () => void;
  onSubmit: (input: EventInput & { id?: string }) => Promise<void>;
};

const EMPTY_EVENT: EventInput = {
  summary: "",
  description: "",
  location: "",
  start: "",
  end: "",
  attendees: "",
};

function toEditableDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

function toDraftValue(
  initialEvent?: AgendaEvent | null,
  draftPreset?: Partial<EventInput> | null,
): EventInput {
  if (initialEvent) {
    return {
      summary: initialEvent.summary,
      description: initialEvent.description,
      location: initialEvent.location,
      start: toEditableDateTime(initialEvent.start),
      end: toEditableDateTime(initialEvent.end),
      attendees: initialEvent.attendees.join(", "),
    };
  }

  return {
    ...EMPTY_EVENT,
    ...draftPreset,
    start: toEditableDateTime(draftPreset?.start),
    end: toEditableDateTime(draftPreset?.end),
  };
}

export function EventSheet({
  open,
  initialEvent,
  draftPreset,
  onClose,
  onSubmit,
}: EventSheetProps) {
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  function requestClose() {
    if (pendingRef.current) return;
    if (JSON.stringify(draft) !== JSON.stringify(toDraftValue(initialEvent, draftPreset))) setConfirmDiscard(true);
    else onClose();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    setError("");
    setConfirmDiscard(false);
    setDraft(toDraftValue(initialEvent, draftPreset));
  }, [draftPreset, initialEvent, open]);

  const canSubmit = Boolean(
    draft.summary.trim() &&
    draft.start &&
    draft.end &&
    new Date(draft.end) > new Date(draft.start),
  );

  async function handleSubmit() {
    if (!canSubmit || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError("");
    try {
      await onSubmit({
        ...draft,
        id: initialEvent?.id,
        start: new Date(draft.start).toISOString(),
        end: new Date(draft.end).toISOString(),
      });
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The event could not be saved. Please try again.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  return (
    <><Dialog
      open={open}
      onOpenChange={(value) => !value && requestClose()}
    >
      <DialogContent className="doop-modal doop-event-modal">
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            Plan time directly from the conversation.
          </DialogDescription>
        </DialogHeader>

        <fieldset disabled={pending} className="doop-event-fields">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-summary">Title</Label>
              <Input
                id="event-summary"
                value={draft.summary}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    summary: event.target.value,
                  }))
                }
                placeholder="Investor prep"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-attendees">Attendees</Label>
              <Input
                id="event-attendees"
                value={draft.attendees}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    attendees: event.target.value,
                  }))
                }
                placeholder="name@company.com, another@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={draft.start}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    start: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={draft.end}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    end: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={draft.location}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Zoom or conference room"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              rows={6}
              placeholder="Agenda, context, expected outcome."
            />
          </div>
        </fieldset>

        {draft.start &&
          draft.end &&
          new Date(draft.end) <= new Date(draft.start) && (
            <p role="alert" className="text-sm text-destructive">
              End time must be after start time.
            </p>
          )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" disabled={pending} onClick={requestClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !canSubmit}
            aria-busy={pending}
            onClick={() => void handleSubmit()}
          >
            {initialEvent ? "Update event" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <DiscardChangesDialog open={confirmDiscard} onKeepEditing={() => setConfirmDiscard(false)} onDiscard={() => { setConfirmDiscard(false); onClose(); }} /></>
  );
}
