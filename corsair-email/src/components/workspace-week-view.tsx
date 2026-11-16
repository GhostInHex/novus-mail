"use client";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AgendaEvent, EventInput } from "@/lib/types";

export function WorkspaceWeekView({
  events,
  onSelectEvent,
  onCreateEvent,
}: {
  events: AgendaEvent[];
  onSelectEvent: (event: AgendaEvent) => void;
  onCreateEvent: (preset?: Partial<EventInput>) => void;
}) {
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const days = Array.from({ length: 5 }, (_, i) => addDays(week, i));
  return (
    <section
      aria-label="Calendar week"
      className="doop-week-view min-h-0 overflow-auto p-5 lg:col-span-2 lg:p-7"
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl tracking-tight">
          {format(week, "MMMM d")}–{format(addDays(week, 4), "d, yyyy")}
        </h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => onCreateEvent()}>New event</Button>
          <Button
            variant="ghost"
            onClick={() =>
              setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))
            }
          >
            Today
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Previous week"
            onClick={() => setWeek(addWeeks(week, -1))}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Next week"
            onClick={() => setWeek(addWeeks(week, 1))}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </header>
      <div className="grid min-w-[600px] grid-cols-5 overflow-hidden rounded-xl border border-border bg-card">
        {days.map((day) => (
          <section
            key={day.toISOString()}
            className="min-h-[520px] border-r border-border p-3 last:border-r-0"
          >
            <h2 className="mb-6 text-sm font-medium">{format(day, "EEE d")}</h2>
            <div className="space-y-3">
              {events
                .filter(
                  (event) =>
                    event.start && isSameDay(new Date(event.start), day),
                )
                .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
                .map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full rounded-lg border border-border bg-muted p-3 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => onSelectEvent(event)}
                  >
                    <span className="block font-medium">{event.summary}</span>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      {format(new Date(event.start!), "HH:mm")}
                      {event.end &&
                        ` – ${format(new Date(event.end), "HH:mm")}`}
                    </span>
                  </button>
                ))}
              <button
                type="button"
                className="w-full rounded-lg border border-dashed border-border px-3 py-5 text-left text-sm text-muted-foreground hover:bg-accent"
                onClick={() => {
                  const start = new Date(day);
                  start.setHours(15, 0, 0, 0);
                  const end = new Date(start);
                  end.setMinutes(30);
                  onCreateEvent({
                    start: start.toISOString(),
                    end: end.toISOString(),
                  });
                }}
              >
                <span className="block">
                  {events.some(
                    (event) =>
                      event.start && isSameDay(new Date(event.start), day),
                  )
                    ? "Add an event"
                    : "Open afternoon"}
                </span>
                <span className="mt-2 block text-xs">
                  Choose time for your work
                </span>
              </button>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
