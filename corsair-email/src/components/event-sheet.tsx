"use client";

import { useEffect, useState } from "react";
import { CalendarCheckIcon } from "lucide-react";

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

  return value.slice(0, 16);
}

function toDraftValue(initialEvent?: AgendaEvent | null, draftPreset?: Partial<EventInput> | null): EventInput {
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

export function EventSheet({ open, initialEvent, draftPreset, onClose, onSubmit }: EventSheetProps) {
  const [draft, setDraft] = useState<EventInput>(EMPTY_EVENT);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(toDraftValue(initialEvent, draftPreset));
  }, [draftPreset, initialEvent, open]);

  const canSubmit = Boolean(draft.summary.trim() && draft.start && draft.end);

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    await onSubmit({
      ...draft,
      id: initialEvent?.id,
      start: new Date(draft.start).toISOString(),
      end: new Date(draft.end).toISOString(),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initialEvent ? "Move the meeting cleanly." : "Protect calendar focus."}</DialogTitle>
          <DialogDescription>Start with the attendee, then lock the slot.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-summary">Title</Label>
              <Input
                id="event-summary"
                value={draft.summary}
                onChange={(event) => setDraft((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Investor prep"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-attendees">Attendees</Label>
              <Input
                id="event-attendees"
                value={draft.attendees}
                onChange={(event) => setDraft((current) => ({ ...current, attendees: event.target.value }))}
                placeholder="name@company.com, another@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={draft.start}
                onChange={(event) => setDraft((current) => ({ ...current, start: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={draft.end}
                onChange={(event) => setDraft((current) => ({ ...current, end: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="event-location">Location</Label>
              <Input
                id="event-location"
                value={draft.location}
                onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                placeholder="Zoom or conference room"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Description</Label>
            <Textarea
              id="event-description"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              rows={6}
              placeholder="Agenda, context, expected outcome."
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            <CalendarCheckIcon className="size-4" />
            {initialEvent ? "Update event" : "Create event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
