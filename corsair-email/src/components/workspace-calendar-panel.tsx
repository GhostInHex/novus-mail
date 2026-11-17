"use client";
import { format, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { WorkspaceActionLabel } from "@/components/dashboard/workspace-action-label";
import type { AgendaEvent } from "@/lib/types";
type Props = {
  events: AgendaEvent[];
  selectedDate: Date;
  onSelectEvent: (event: AgendaEvent) => void;
};
export function WorkspaceCalendarPanel({
  events,
  selectedDate,
  onSelectEvent,
}: Props) {
  const dayEvents = events
    .filter((e) => e.start && isSameDay(new Date(e.start), selectedDate))
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const next = events
    .filter((e) => e.start && new Date(e.start) >= new Date())
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))[0];
  return (
    <div className="dashboard-calendar-panel">
      <p className="dashboard-agenda-date">
        {format(selectedDate, "EEEE, MMMM d")}
      </p>
      <div className="dashboard-agenda-list">
        {dayEvents.length ? (
          dayEvents.map((e) => (
            <button key={e.id} type="button" onClick={() => onSelectEvent(e)}>
              <span>{`${e.start ? format(new Date(e.start), "HH:mm") : ""} ${e.summary}`}</span>
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
            {`${next.start ? format(new Date(next.start), "h:mm a") : ""}${next.end ? ` \u2013 ${format(new Date(next.end), "h:mm a")}` : ""}`}
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
            <WorkspaceActionLabel>View event</WorkspaceActionLabel>
          </Button>
        </section>
      )}
    </div>
  );
}
