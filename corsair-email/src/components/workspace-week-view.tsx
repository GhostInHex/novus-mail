"use client";
import {
  addDays,
  addWeeks,
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Tabs } from "@animate-ui/react/primitives/radix-ui";
import { useReducedMotion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WorkspaceActionLabel } from "@/components/dashboard/workspace-action-label";
import type { AgendaEvent, EventInput } from "@/lib/types";

const HOURS = [9, 10, 12, 15];
export function WorkspaceWeekView({
  events,
  view,
  onViewChange,
  selectedDay,
  onSelectDay,
  onSelectEvent,
  onCreateEvent,
}: {
  events: AgendaEvent[];
  view: "month" | "week" | "day";
  onViewChange: (view: "month" | "week" | "day") => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  onSelectEvent: (event: AgendaEvent) => void;
  onCreateEvent: (preset?: Partial<EventInput>) => void;
}) {
  const [week, setWeek] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const reducedMotion = useReducedMotion();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const monthDays = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
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
          {view !== "week"
            ? format(month, "MMMM yyyy")
            : `${format(week, "MMMM d")}–${format(addDays(week, 4), isSameMonth(week, addDays(week, 4)) ? "d" : "MMM d")}`}
        </h1>
        <Button onClick={() => onCreateEvent()}><WorkspaceActionLabel>New event</WorkspaceActionLabel></Button>
      </header>
      <Tabs.Root
        value={view === "day" ? "month" : view}
        onValueChange={(value) =>
          onViewChange(value as "month" | "week" | "day")
        }
      >
        <div className="dashboard-week-navigation">
          <button
            type="button"
            onClick={() => {
              setWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));
              setMonth(startOfMonth(new Date()));
              onSelectDay(new Date());
            }}
          >
            Today
          </button>
          <button
            type="button"
            aria-label={view === "month" ? "Previous month" : "Previous week"}
            onClick={() =>
              view === "month"
                ? setMonth(addMonths(month, -1))
                : setWeek(addWeeks(week, -1))
            }
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            aria-label={view === "month" ? "Next month" : "Next week"}
            onClick={() =>
              view === "month"
                ? setMonth(addMonths(month, 1))
                : setWeek(addWeeks(week, 1))
            }
          >
            <span aria-hidden="true">›</span>
          </button>
          <Tabs.List aria-label="Calendar view">
            <Tabs.Trigger value="month" data-view="month">
              Month
            </Tabs.Trigger>
            <Tabs.Trigger value="week" data-view="week" aria-label="Week">
              Week view
            </Tabs.Trigger>
          </Tabs.List>
        </div>
        <Tabs.Content
          value="week"
          transition={reducedMotion ? { duration: 0 } : undefined}
          exitTransition={reducedMotion ? { duration: 0 } : undefined}
        >
          <div className="dashboard-week-scroll">
            <div className="dashboard-week-grid">
              {days.map((day) => {
                const dayEvents = events
                  .filter((e) => e.start && isSameDay(new Date(e.start), day))
                  .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
                return (
                  <section
                    key={day.toISOString()}
                    className="dashboard-week-day"
                  >
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
                                  {`${format(new Date(event.start!), "HH:mm")}${event.end ? ` – ${format(new Date(event.end), "HH:mm")}` : ""}`}
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
                              {hour === 15 ? (
                                <>
                                  <span>Open afternoon</span>
                                  <time>Room for your work</time>
                                </>
                              ) : (
                                <time>{`${String(hour).padStart(2, "0")}:00`}</time>
                              )}
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
        </Tabs.Content>
        <Tabs.Content
          value="month"
          transition={reducedMotion ? { duration: 0 } : undefined}
          exitTransition={reducedMotion ? { duration: 0 } : undefined}
        >
          <div
            className={
              view === "day" ? "dashboard-selected-day-layout" : undefined
            }
          >
            {view === "day" && (
              <section className="dashboard-selected-day">
                <p>Selected day</p>
                <h2 className="dashboard-agenda-date">
                  {format(selectedDay, "EEEE, MMMM d")}
                </h2>
                <Button onClick={() => create(selectedDay, 9)}>
                  New on this day
                </Button>
                <div className="dashboard-selected-events">
                  {events
                    .filter(
                      (e) =>
                        e.start && isSameDay(new Date(e.start), selectedDay),
                    )
                    .map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => onSelectEvent(e)}
                      >
                        <span className="dashboard-day-event-title">
                          {e.summary}
                          <small>{e.status}</small>
                        </span>
                        <span>
                          {e.start && format(new Date(e.start), "h:mm a")}
                          {e.end && " - " + format(new Date(e.end), "h:mm a")}
                        </span>
                        {e.location && <span>{e.location}</span>}
                        {e.attendees.length > 0 && (
                          <span>{e.attendees.join(", ")}</span>
                        )}
                      </button>
                    ))}
                  {!events.some(
                    (e) => e.start && isSameDay(new Date(e.start), selectedDay),
                  ) && <p>No events on this day.</p>}
                </div>
                <p>Agenda runway</p>
                <div className="dashboard-day-runway">
                  {events
                    .filter(
                      (e) =>
                        e.start &&
                        new Date(e.start) > selectedDay &&
                        !isSameDay(new Date(e.start), selectedDay),
                    )
                    .slice(0, 4)
                    .map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onSelectDay(new Date(e.start!))}
                      >
                        <span>
                          {format(new Date(e.start!), "EEEE, MMMM d")}
                        </span>
                        <small>{e.summary}</small>
                      </button>
                    ))}
                </div>
              </section>
            )}
            <div className="dashboard-calendar-month">
              <div className="dashboard-month-weekdays">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="dashboard-calendar-dates">
                {monthDays.map((day) => {
                  const items = events.filter(
                    (e) => e.start && isSameDay(new Date(e.start), day),
                  );
                  return (
                    <button
                      type="button"
                      key={day.toISOString()}
                      aria-label={format(day, "EEEE, MMMM d")}
                      aria-pressed={isSameDay(day, selectedDay)}
                      data-outside={!isSameMonth(day, month)}
                      onClick={() => onSelectDay(day)}
                    >
                      <span>{format(day, "d")}</span>
                      {items.slice(0, 2).map((e) => (
                        <small key={e.id}>{e.summary}</small>
                      ))}
                      {items.length > 2 && (
                        <small>+{items.length - 2} more</small>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </section>
  );
}
