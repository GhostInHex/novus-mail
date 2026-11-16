"use client";
import { addDays, addWeeks, format, isSameDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AgendaEvent, EventInput } from "@/lib/types";

const HOURS = [9, 10, 12, 15];
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
  function create(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(30);
    onCreateEvent({ start: start.toISOString(), end: end.toISOString() });
  }
  return (
    <section aria-label="Calendar week" className="dashboard-week-view">
      <header>
        <h1>
          {format(week, "MMMM d")}–{format(addDays(week, 4), "d")}
        </h1>
        <Button onClick={() => onCreateEvent()}>New event</Button>
      </header>
      <div className="dashboard-week-navigation">
        <button
          type="button"
          onClick={() => setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
        >
          Today
        </button>
        <button
          type="button"
          aria-label="Previous week"
          onClick={() => setWeek(addWeeks(week, -1))}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          aria-label="Next week"
          onClick={() => setWeek(addWeeks(week, 1))}
        >
          <ChevronRight size={16} />
        </button>
        <span>Week view</span>
      </div>
      <div className="dashboard-week-scroll">
        <div className="dashboard-week-grid">
          {days.map((day) => {
            const dayEvents = events
              .filter((e) => e.start && isSameDay(new Date(e.start), day))
              .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
            return (
              <section key={day.toISOString()} className="dashboard-week-day">
                <h2 data-today={isSameDay(day, new Date())}>
                  {format(day, "EEE d")}
                </h2>
                {HOURS.map((hour, index) => {
                  const items = dayEvents.filter((e) => {
                    const h = new Date(e.start!).getHours();
                    return (
                      (index === 0 || h >= hour) &&
                      (index === HOURS.length - 1 || h < HOURS[index + 1])
                    );
                  });
                  return (
                    <div
                      className="dashboard-week-slot"
                      key={hour}
                      data-occupied={!!items.length}
                    >
                      {items.length ? (
                        items.map((event) => (
                          <button
                            type="button"
                            className="dashboard-week-event"
                            key={event.id}
                            onClick={() => onSelectEvent(event)}
                          >
                            <span>{event.summary}</span>
                            <time>
                              {format(new Date(event.start!), "HH:mm")}
                              {event.end &&
                                ` – ${format(new Date(event.end), "HH:mm")}`}
                            </time>
                          </button>
                        ))
                      ) : (
                        <button
                          type="button"
                          className="dashboard-week-empty"
                          aria-label={`New event ${format(day, "EEEE, MMMM d")} at ${hour}:00`}
                          onClick={() => create(day, hour)}
                        >
                          <time>{String(hour).padStart(2, "0")}:00</time>
                        </button>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
