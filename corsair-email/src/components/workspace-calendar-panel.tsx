"use client";

import {
  addDays,
  addMinutes,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isThisWeek,
  isToday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { AgendaEvent, EventInput } from "@/lib/types";
import { cn } from "@/lib/utils";

type AgendaSection = {
  label: string;
  items: AgendaEvent[];
};

type CalendarPanelProps = {
  events: AgendaEvent[];
  agendaSections: AgendaSection[];
  onCreateEvent: (preset?: Partial<EventInput>) => void;
  onSelectEvent: (event: AgendaEvent) => void;
};

type CalendarView = "month" | "week";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dateKey(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function formatTimeRange(event: AgendaEvent) {
  if (!event.start) {
    return "Time TBD";
  }

  const start = new Date(event.start);
  if (!event.end) {
    return format(start, "h:mm a");
  }

  return `${format(start, "h:mm a")} - ${format(new Date(event.end), "h:mm a")}`;
}

function buildPresetForDay(date: Date): Partial<EventInput> {
  const base = startOfDay(date);
  const now = new Date();
  const start =
    isToday(date) && now > base
      ? setSeconds(setMinutes(setHours(now, Math.min(now.getHours() + 1, 20)), 0), 0)
      : setSeconds(setMinutes(setHours(base, 9), 0), 0);

  return {
    start: start.toISOString(),
    end: addMinutes(start, 30).toISOString(),
  };
}

function statusClasses(status: AgendaEvent["status"]) {
  switch (status) {
    case "tentative":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    case "cancelled":
      return "bg-destructive/15 text-destructive";
    case "confirmed":
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

function DayEventRow({
  event,
  onSelect,
}: {
  event: AgendaEvent;
  onSelect: (event: AgendaEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="motion-interactive w-full rounded-xl border border-border/70 bg-card px-3 py-3 text-left outline-none hover:border-primary/30 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{event.summary}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3Icon className="size-3.5" />
              {formatTimeRange(event)}
            </span>
            {event.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" />
                {event.location}
              </span>
            ) : null}
          </div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[0.68rem] font-medium capitalize", statusClasses(event.status))}>
          {event.status}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">
          {event.attendees.join(", ") || "No attendees yet"}
        </span>
        {event.attendees.length > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            <UsersIcon className="size-3.5" />
            {event.attendees.length}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export function WorkspaceCalendarPanel({
  events,
  agendaSections,
  onCreateEvent,
  onSelectEvent,
}: CalendarPanelProps) {
  const initialDate = useMemo(() => {
    const upcoming = events.find((event) => event.start && new Date(event.start) >= startOfDay(new Date()));
    const fallback = upcoming?.start ?? events.find((event) => event.start)?.start;
    return fallback ? startOfDay(new Date(fallback)) : startOfDay(new Date());
  }, [events]);

  const [view, setView] = useState<CalendarView>("month");
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [visibleMonth, setVisibleMonth] = useState<Date>(startOfMonth(initialDate));

  function shiftPeriod(direction: -1 | 1) {
    if (view === "week") {
      const nextDate = addDays(selectedDate, direction * 7);
      setSelectedDate(nextDate);
      setVisibleMonth(startOfMonth(nextDate));
      return;
    }

    const nextMonth = direction === -1 ? subMonths(visibleMonth, 1) : addMonths(visibleMonth, 1);
    setVisibleMonth(nextMonth);
    setSelectedDate((current) => {
      const nextDate = addDays(startOfMonth(nextMonth), current.getDate() - 1);
      return isSameMonth(nextDate, nextMonth) ? nextDate : startOfMonth(nextMonth);
    });
  }

  const eventsByDay = useMemo(() => {
    const mapped = new Map<string, AgendaEvent[]>();

    for (const event of events) {
      if (!event.start) {
        continue;
      }

      const key = dateKey(new Date(event.start));
      const bucket = mapped.get(key) ?? [];
      bucket.push(event);
      bucket.sort((left, right) => {
        if (!left.start || !right.start) {
          return 0;
        }
        return new Date(left.start).getTime() - new Date(right.start).getTime();
      });
      mapped.set(key, bucket);
    }

    return mapped;
  }, [events]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 1 });
    const days: Date[] = [];

    for (let day = start; day <= end; day = addDays(day, 1)) {
      days.push(day);
    }

    return days;
  }, [visibleMonth]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [selectedDate]);

  const selectedDayEvents = useMemo(
    () => eventsByDay.get(dateKey(selectedDate)) ?? [],
    [eventsByDay, selectedDate],
  );
  const periodLabel = useMemo(() => {
    if (view === "week") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
    }

    return format(visibleMonth, "MMMM yyyy");
  }, [selectedDate, view, visibleMonth]);

  const todayCount = useMemo(
    () => events.filter((event) => event.start && isToday(new Date(event.start))).length,
    [events],
  );
  const weekCount = useMemo(
    () => events.filter((event) => event.start && isThisWeek(new Date(event.start), { weekStartsOn: 1 })).length,
    [events],
  );
  const tentativeCount = useMemo(() => events.filter((event) => event.status === "tentative").length, [events]);

  return (
    <div className="space-y-4 px-4 py-4">
      <section className="rounded-[22px] border border-border/70 bg-card/90 p-4 shadow-elevation-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Calendar deck</p>
            <h3 className="mt-1 text-lg font-semibold tracking-tight">{periodLabel}</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/80 bg-muted/70 p-1">
              {(["month", "week"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setView(option)}
                  className={cn(
                    "motion-interactive rounded-md px-3 py-1.5 text-xs font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    view === option ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={view === "week" ? "Previous week" : "Previous month"}
              onClick={() => shiftPeriod(-1)}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={view === "week" ? "Next week" : "Next month"}
              onClick={() => shiftPeriod(1)}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { label: "Today", value: todayCount, hint: "on deck" },
            { label: "This week", value: weekCount, hint: "scheduled" },
            { label: "Tentative", value: tentativeCount, hint: "needs clarity" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-muted/65 px-3 py-2.5">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{stat.value}</p>
              <p className="text-[0.68rem] text-muted-foreground">{stat.hint}</p>
            </div>
          ))}
        </div>

        {view === "month" ? (
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-2">
              {weekdayLabels.map((label) => (
                <p key={label} className="px-1 text-center text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {label}
                </p>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((day) => {
                const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
                const active = isSameDay(day, selectedDate);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => {
                      setSelectedDate(day);
                      setVisibleMonth(startOfMonth(day));
                    }}
                    className={cn(
                      "motion-interactive min-h-[92px] rounded-2xl border px-2.5 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active
                        ? "border-primary/40 bg-secondary/65 text-secondary-foreground"
                        : "border-border/70 bg-background/80 hover:border-primary/25 hover:bg-accent",
                      !isSameMonth(day, visibleMonth) && "opacity-55",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday(day) && !active && "bg-primary text-primary-foreground",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {dayEvents.length > 0 ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.62rem] font-medium text-muted-foreground">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className="block truncate rounded-md bg-primary/10 px-1.5 py-1 text-[0.65rem] font-medium text-primary"
                        >
                          {event.summary}
                        </span>
                      ))}
                      {dayEvents.length > 2 ? (
                        <span className="block text-[0.62rem] font-medium text-muted-foreground">
                          +{dayEvents.length - 2} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {weekDays.map((day) => {
              const dayEvents = eventsByDay.get(dateKey(day)) ?? [];
              const active = isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "motion-interactive rounded-2xl border px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-secondary/60"
                      : "border-border/70 bg-background/80 hover:border-primary/25 hover:bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {format(day, "EEE")}
                      </p>
                      <p className="mt-1 text-sm font-semibold">{format(day, "MMM d")}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
                      {dayEvents.length}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {dayEvents.length > 0 ? (
                      dayEvents.slice(0, 3).map((event) => (
                        <div key={event.id} className="truncate text-xs text-foreground/80">
                          {formatTimeRange(event)} · {event.summary}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No events scheduled.</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-border/70 bg-card/90 p-4 shadow-elevation-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Selected day</p>
            <h3 className="mt-1 text-base font-semibold tracking-tight">{format(selectedDate, "EEEE, MMM d")}</h3>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => onCreateEvent(buildPresetForDay(selectedDate))}>
            <CalendarDaysIcon className="size-4" />
            New on this day
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents.map((event) => <DayEventRow key={event.id} event={event} onSelect={onSelectEvent} />)
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-6 text-center">
              <p className="text-sm font-medium">No events on this day.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Keep the runway clean or block time directly from here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-border/70 bg-card/90 p-4 shadow-elevation-1">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Agenda runway</p>
            <h3 className="mt-1 text-base font-semibold tracking-tight">All upcoming agendas</h3>
          </div>
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            {events.length} total
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {agendaSections.some((section) => section.items.length > 0) ? (
            agendaSections.map((section) =>
              section.items.length > 0 ? (
                <div key={section.label}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {section.label}
                    </p>
                    <span className="text-xs text-muted-foreground">{section.items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((event) => (
                      <DayEventRow key={event.id} event={event} onSelect={onSelectEvent} />
                    ))}
                  </div>
                </div>
              ) : null,
            )
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-6 text-center">
              <p className="text-sm font-medium">No upcoming agenda yet.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create the next meeting from the rail or schedule directly from a thread.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
