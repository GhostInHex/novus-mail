"use client";

import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceCalendarPanel } from "@/components/workspace-calendar-panel";
import { WorkspaceWeekView } from "@/components/workspace-week-view";
import type {
  AgendaEvent,
  ConnectionStatus,
  EventInput,
  SessionUser,
  ThreadDetail,
  ThreadSummary,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import * as Sidebar from "@animate-ui/react/primitives/sidebar";
import { format, isToday, isYesterday } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Menu,
  MoreHorizontal,
} from "lucide-react";
import { useState, type ReactNode, type RefObject } from "react";
import "./dashboard.css";

type MailView =
  "focus" | "unread" | "starred" | "drafts" | "sent" | "later" | "all";
type Folder = { id: MailView; label: string; count: number; hint: string };
type Props = {
  mobileReaderOpen: boolean;
  onMobileReader: (open: boolean) => void;
  composerTitle: string;
  session: SessionUser;
  threads: ThreadSummary[];
  thread: ThreadDetail | null;
  folders: Folder[];
  view: MailView;
  search: string;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (value: string) => void;
  onSearchAll: () => void;
  onView: (view: MailView) => void;
  onThread: (id: string) => void;
  onBack: () => void;
  threadLoading: boolean;
  onCompose: () => void;
  onReply: () => void;
  onForward: () => void;
  onDraft: (thread: ThreadDetail) => void;
  onThreadAction: (action: string) => void;
  onCommand: () => void;
  onAssistant: () => void;
  onShortcuts: () => void;
  onSync: () => void;
  syncing: boolean;
  syncedAt: string | null;
  connection: ConnectionStatus | null;
  events: AgendaEvent[];
  onEvent: (event: AgendaEvent) => void;
  onNewEvent: (preset?: Partial<EventInput>) => void;
  agendaCollapsed: boolean;
  onAgenda: (collapsed: boolean) => void;
  calendarView: boolean;
  onCalendar: (value: boolean) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onMoreThreads: () => void;
  composer?: ReactNode;
  assistant?: ReactNode;
  renderHtml: (message: ThreadDetail["messages"][number]) => ReactNode;
};
function mailTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return isToday(d)
    ? format(d, "H:mm")
    : isYesterday(d)
      ? "Yesterday"
      : format(d, "MMM d");
}
function Message({
  message,
  renderHtml,
}: {
  message: ThreadDetail["messages"][number];
  renderHtml: Props["renderHtml"];
}) {
  return message.body?.trim() ? (
    <div className="dashboard-message-body">{message.body}</div>
  ) : (
    <div className="dashboard-message-html">{renderHtml(message)}</div>
  );
}
export function DashboardView(p: Props) {
  const { resolvedTheme, setResolvedTheme } = useTheme();
  const [mobileNav, setMobileNav] = useState(false);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<"month" | "week" | "day">(
    "week",
  );
  const mobileThread = p.mobileReaderOpen;
  const setMobileThread = p.onMobileReader;
  const [earlier, setEarlier] = useState(false);
  const initials = p.session.displayName
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const selected = p.thread?.messages.at(-1);
  const label = p.folders.find((f) => f.id === p.view)?.label ?? "Mail";
  const ordered = ["focus", "all", "starred", "drafts", "sent"]
    .map((id) => p.folders.find((f) => f.id === id))
    .filter((f): f is Folder => !!f);
  function choose(view: MailView) {
    p.onView(view);
    p.onCalendar(false);
    setMobileNav(false);
    setMobileThread(false);
  }
  const openThread = (id: string) => {
    setMobileThread(true);
    setEarlier(false);
    p.onThread(id);
  };
  return (
    <main
      className="dashboard"
      data-theme-mode={resolvedTheme}
      data-compose={!!p.composer}
    >
      <header className="dashboard-toolbar">
        <button
          type="button"
          className="dashboard-mobile-menu"
          aria-label="Open folders"
          onClick={() => setMobileNav(!mobileNav)}
        >
          <Menu size={19} />
        </button>
        <a className="dashboard-brand" href="/">
          NovusMail
        </a>
        <div className="dashboard-search">
          <input
            ref={p.searchRef}
            aria-label="Search mail"
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") p.onSearchAll();
            }}
            placeholder="Search mail, people, or commands"
          />
          <button
            type="button"
            aria-label="Open command console"
            onClick={p.onCommand}
          >
            Ctrl K
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="dashboard-account"
              aria-label="Workspace menu"
            >
              <span>
                {p.syncing
                  ? "Syncing…"
                  : p.syncedAt
                    ? "Synced " + mailTime(p.syncedAt)
                    : "Not synced yet"}
              </span>
              <span className="dashboard-account-divider">/</span>
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() =>
                setResolvedTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} mode
            </DropdownMenuItem>
            <DropdownMenuItem disabled={p.syncing} onSelect={p.onSync}>
              Sync now
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={p.onCommand}>
              Command console
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => p.onNewEvent()}>
              New event
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={p.onAssistant}>
              Ask assistant
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={p.onShortcuts}>
              Keyboard shortcuts
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action="/api/logout" method="post">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  Switch workspace
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      <Sidebar.Provider open={true} className="dashboard-body">
        {mobileNav && (
          <button
            className="dashboard-nav-scrim"
            aria-label="Close folders"
            onClick={() => setMobileNav(false)}
          />
        )}
        <Sidebar.Container
          className={cn("dashboard-sidebar", mobileNav && "is-mobile-open")}
          style={{ width: 200 }}
          role="navigation"
          aria-label="Workspace"
        >
          <Button
            className="dashboard-compose-button"
            onClick={() => {
              p.onCompose();
              setMobileNav(false);
            }}
            aria-label="Compose"
          >
            Compose
          </Button>
          <nav aria-label="Mail folders">
            {ordered.map((folder) => (
              <button
                key={folder.id}
                type="button"
                aria-label={
                  folder.id === "focus" ? "Focus queue" : folder.label
                }
                aria-current={
                  !p.calendarView && p.view === folder.id ? "page" : undefined
                }
                onClick={() => choose(folder.id)}
              >
                {folder.id === "focus" ? "Focus queue" : folder.label}
                {folder.id !== "sent" && <span>{folder.count}</span>}
              </button>
            ))}
            <button
              type="button"
              aria-label="Calendar"
              aria-current={p.calendarView ? "page" : undefined}
              onClick={() => {
                p.onCalendar(true);
                setMobileNav(false);
                setMobileThread(false);
              }}
            >
              Calendar
            </button>
          </nav>
          <p className="dashboard-connections">
            Gmail{" "}
            {p.connection?.gmail.authorized === false
              ? "not connected"
              : "connected"}
            <br />
            Calendar{" "}
            {p.connection?.calendar.authorized === false
              ? "not connected"
              : "connected"}
          </p>
        </Sidebar.Container>
        {p.composer ? (
          <div className="dashboard-compose-layout">
            <section className="dashboard-compose-main">
              <h1>{p.composerTitle}</h1>
              {p.composer}
            </section>
            {p.assistant}
          </div>
        ) : (
          <div
            className={cn(
              "dashboard-content",
              p.calendarView && calendarMode === "day" && "calendar-day-view",
              p.agendaCollapsed && "agenda-is-collapsed",
            )}
          >
            {p.calendarView ? (
              <WorkspaceWeekView
                view={calendarMode}
                onViewChange={setCalendarMode}
                selectedDay={selectedDay}
                onSelectDay={(day) => {
                  setSelectedDay(day);
                  setCalendarMode("day");
                }}
                events={p.events}
                onCreateEvent={p.onNewEvent}
                onSelectEvent={p.onEvent}
              />
            ) : (
              <>
                <section
                  className={cn(
                    "dashboard-queue",
                    mobileThread && "mobile-is-hidden",
                  )}
                  aria-label="Inbox"
                >
                  <div className="dashboard-queue-card">
                    <header>
                      <h1>{p.view === "focus" ? "Focus queue" : label}</h1>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="dashboard-queue-more"
                            aria-label="More inbox views"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => choose("unread")}>
                            Unread mail
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => choose("later")}>
                            Later mail
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </header>
                    {p.threads.length ? (
                      <ul>
                        {p.threads.map((thread) => (
                          <li key={thread.threadId}>
                            <button
                              type="button"
                              onClick={() => openThread(thread.threadId)}
                              aria-current={
                                p.thread?.threadId === thread.threadId
                                  ? "true"
                                  : undefined
                              }
                            >
                              <span className="dashboard-mail-meta">
                                <span>{thread.sender}</span>
                                <time dateTime={thread.receivedAt ?? undefined}>
                                  {mailTime(thread.receivedAt)}
                                </time>
                              </span>
                              <span className="dashboard-mail-subject">
                                {thread.subject || "(no subject)"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="dashboard-empty">
                        No messages in this view.
                      </p>
                    )}
                    {p.hasMore && (
                      <button
                        type="button"
                        className="dashboard-load-more"
                        disabled={p.loadingMore}
                        onClick={p.onMoreThreads}
                      >
                        {p.loadingMore ? "Loading…" : "Load more messages"}
                      </button>
                    )}
                  </div>
                </section>
                <section
                  className={cn(
                    "dashboard-reader",
                    !mobileThread && "mobile-is-hidden",
                  )}
                  aria-label="Message reader"
                >
                  <button
                    type="button"
                    className="dashboard-reader-back"
                    onClick={() => {
                      setMobileThread(false);
                      p.onBack();
                    }}
                  >
                    <ChevronLeft size={16} />
                    Back to inbox
                  </button>
                  {p.threadLoading ? (
                    <div
                      className="dashboard-reader-loading"
                      aria-label="Loading message"
                    >
                      <div />
                      <div />
                      <div />
                    </div>
                  ) : p.thread ? (
                    <>
                      <div className="dashboard-reader-topline">
                        <span>
                          Inbox /{" "}
                          {p.thread.unread ? "Needs reply" : "Conversation"}
                        </span>
                        <div>
                          <button
                            type="button"
                            onClick={() =>
                              p.onThreadAction(
                                p.thread!.archived ? "unarchive" : "archive",
                              )
                            }
                          >
                            {p.thread.archived ? "Unarchive" : "Archive"}
                          </button>
                          <button
                            type="button"
                            aria-pressed={p.thread.starred}
                            onClick={() =>
                              p.onThreadAction(
                                p.thread!.starred ? "unstar" : "star",
                              )
                            }
                          >
                            {p.thread.starred ? "Unstar" : "Star"}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button">More</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() =>
                                  p.onThreadAction(
                                    p.thread!.unread ? "read" : "unread",
                                  )
                                }
                              >
                                Mark {p.thread.unread ? "read" : "unread"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => p.onNewEvent()}>
                                Schedule a meeting
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => p.onAgenda(!p.agendaCollapsed)}
                              >
                                {p.agendaCollapsed ? "Show" : "Hide"} agenda
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onSelect={() => p.onThreadAction("trash")}
                              >
                                Move to trash
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <h2>{p.thread.subject || "(no subject)"}</h2>
                      <div className="dashboard-reader-sender">
                        {p.thread.sender} &lt;{p.thread.senderEmail}&gt;
                        <br />
                        To {p.thread.recipients.join(", ") || "you"} ·{" "}
                        {selected?.receivedAt
                          ? format(
                              new Date(selected.receivedAt),
                              "MMM d, h:mm a",
                            )
                          : ""}
                      </div>
                      {p.thread.messages.length > 1 && (
                        <button
                          type="button"
                          className="dashboard-earlier"
                          onClick={() => setEarlier(!earlier)}
                        >
                          {earlier ? "Hide" : "Show"}{" "}
                          {p.thread.messages.length - 1} earlier message
                          {p.thread.messages.length > 2 ? "s" : ""}
                        </button>
                      )}
                      {earlier && (
                        <div className="dashboard-earlier-messages">
                          {p.thread.messages.slice(0, -1).map((message) => (
                            <article key={message.id}>
                              <p>{message.from}</p>
                              <Message
                                message={message}
                                renderHtml={p.renderHtml}
                              />
                            </article>
                          ))}
                        </div>
                      )}
                      {selected && (
                        <Message message={selected} renderHtml={p.renderHtml} />
                      )}
                      <div className="dashboard-reply-actions">
                        <Button
                          onClick={
                            p.view === "drafts"
                              ? () => p.onDraft(p.thread!)
                              : p.onReply
                          }
                        >
                          {p.view === "drafts" ? "Edit draft" : "Reply"}
                        </Button>
                        <button type="button" onClick={p.onForward}>
                          Forward
                        </button>
                      </div>
                      <section className="dashboard-suggestion">
                        <p>Suggested next step</p>
                        <h3>Prepare a reply and check your calendar</h3>
                        <p>Review the draft before sending.</p>
                        <Button
                          className="w-full"
                          onClick={p.onAssistant}
                          aria-label="Ask assistant about this thread"
                        >
                          Ask assistant
                        </Button>
                      </section>
                    </>
                  ) : (
                    <div className="dashboard-reader-empty">
                      <h2>Select a conversation</h2>
                      <p>Choose a message from your queue.</p>
                    </div>
                  )}
                </section>
              </>
            )}
            <aside className="dashboard-agenda" aria-label="Calendar agenda">
              {p.agendaCollapsed ? (
                <button
                  className="dashboard-expand-agenda"
                  aria-label="Expand agenda"
                  onClick={() => p.onAgenda(false)}
                >
                  <ChevronLeft size={18} />
                  <span>Agenda</span>
                </button>
              ) : (
                <>
                  <header>
                    <h2>{isToday(selectedDay) ? "Today" : "Agenda"}</h2>
                    <div className="dashboard-agenda-controls">
                      <button
                        aria-label="Open month calendar"
                        title="Month calendar"
                        onClick={() => {
                          setCalendarMode("month");
                          p.onCalendar(true);
                        }}
                      >
                        <CalendarDays size={15} />
                      </button>
                      <button
                        aria-label="Collapse agenda"
                        onClick={() => p.onAgenda(true)}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </header>
                  <WorkspaceCalendarPanel
                    selectedDate={selectedDay}
                    events={p.events}
                    onCreateEvent={p.onNewEvent}
                    onSelectEvent={p.onEvent}
                  />
                </>
              )}
            </aside>
          </div>
        )}
      </Sidebar.Provider>
      <footer className="dashboard-footer">
        <button onClick={p.onShortcuts}>
          C Compose / J K Navigate / R Reply
        </button>
        <span>
          {p.connection?.degraded ? "Connection delayed" : "Google connected"} ·
          All changes need your review
        </span>
      </footer>
    </main>
  );
}
