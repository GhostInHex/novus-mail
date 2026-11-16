"use client";
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { useState } from "react";
import { useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs } from "@animate-ui/react/primitives/radix-ui";
import { Button } from "@/components/ui/button";
import type { AgendaEvent, EventInput } from "@/lib/types";

type Props = {
  expanded?: boolean;
  events: AgendaEvent[];
  onCreateEvent: (preset?: Partial<EventInput>) => void;
  onSelectEvent: (event: AgendaEvent) => void;
};
export function WorkspaceCalendarPanel({
  expanded = false,
  events,
  onCreateEvent,
  onSelectEvent,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [selected, setSelected] = useState(() => new Date());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [view, setView] = useState("month");
  const dayEvents = events
    .filter((e) => e.start && isSameDay(new Date(e.start), selected))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const next = events
    .filter((e) => e.start && new Date(e.start) >= new Date())
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];
  const days = Array.from({ length: 42 }, (_, i) =>
    addDays(startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), i),
  );
  const time = (e: AgendaEvent) =>
    e.start
      ? format(new Date(e.start), "h:mm a") +
        (e.end ? " – " + format(new Date(e.end), "h:mm a") : "")
      : "Time to be confirmed";
  function create() {
    const start = new Date(selected);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(30);
    onCreateEvent({ start: start.toISOString(), end: end.toISOString() });
  }
  return (
    <div className="dashboard-calendar-panel">
      {expanded && (
        <Tabs.Root
          value={view}
          onValueChange={setView}
          className="dashboard-month"
        >
          <header>
            <h3>{format(month, "MMMM yyyy")}</h3>
            <div>
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(subMonths(month, 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </header>
          <Tabs.List aria-label="Calendar view">
            <Tabs.Trigger value="month">Month</Tabs.Trigger>
            <Tabs.Trigger value="week">Week</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content
            transition={reducedMotion ? { duration: 0 } : undefined}
            exitTransition={reducedMotion ? { duration: 0 } : undefined}
            value="month"
          >
            <div className="dashboard-month-labels">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="dashboard-month-grid">
              {days.map((day) => {
                const count = events.filter(
                  (e) => e.start && isSameDay(new Date(e.start), day),
                ).length;
                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    aria-label={format(day, "EEEE, MMMM d")}
                    aria-pressed={isSameDay(day, selected)}
                    data-outside={!isSameMonth(day, month)}
                    onClick={() => setSelected(day)}
                  >
                    <span>{format(day, "d")}</span>
                    {count > 0 && <i aria-label={`${count} events`} />}
                  </button>
                );
              })}
            </div>
          </Tabs.Content>
          <Tabs.Content
            transition={reducedMotion ? { duration: 0 } : undefined}
            exitTransition={reducedMotion ? { duration: 0 } : undefined}
            value="week"
          >
            <div className="dashboard-week-picker">
              {Array.from({ length: 7 }, (_, i) =>
                addDays(startOfWeek(selected, { weekStartsOn: 1 }), i),
              ).map((day) => (
                <button
                  key={day.toISOString()}
                  type="button"
                  aria-pressed={isSameDay(day, selected)}
                  onClick={() => setSelected(day)}
                >
                  {format(day, "EEE")}
                  <span>{format(day, "d")}</span>
                </button>
              ))}
            </div>
          </Tabs.Content>
        </Tabs.Root>
      )}
      <p className="dashboard-agenda-date">
        {format(selected, "EEEE, MMMM d")}
      </p>
      <div className="dashboard-agenda-list">
        {dayEvents.length ? (
          dayEvents.map((e) => (
            <button key={e.id} type="button" onClick={() => onSelectEvent(e)}>
              <time>{e.start && format(new Date(e.start), "HH:mm")}</time>
              <span>{e.summary}</span>
            </button>
          ))
        ) : (
          <p>No events on this day.</p>
        )}
      </div>
      {next && (
        <section className="dashboard-next-event">
          <p>Next up</p>
          <h3>{next.summary}</h3>
          <p>
            {time(next)}
            {next.location && (
              <>
                <br />
                {next.location}
              </>
            )}
          </p>
          <Button
            className="w-full"
            size="sm"
            onClick={() => onSelectEvent(next)}
          >
            View event
          </Button>
        </section>
      )}
      {expanded && (
        <Button
          variant="ghost"
          className="dashboard-new-on-day"
          onClick={create}
        >
          New on this day
        </Button>
      )}
    </div>
  );
}
