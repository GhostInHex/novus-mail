"use client";

import { addHours, addMinutes, format, isThisWeek, isToday, isTomorrow, startOfHour } from "date-fns";
import {
  ArchiveIcon,
  ArrowDownUpIcon,
  ArrowLeftFromLineIcon,
  ArrowRightFromLineIcon,
  CalendarPlusIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CommandIcon,
  KeyboardIcon,
  LogOutIcon,
  MailOpenIcon,
  PanelLeftOpenIcon,
  PanelRightOpenIcon,
  PenSquareIcon,
  ReplyIcon,
  SearchIcon,
  SparklesIcon,
  StarIcon,
  RefreshCwIcon,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { AgentPanel, type AgentOperator } from "@/components/agent-panel";
import { CommandPalette } from "@/components/command-palette";
import { ComposeSheet } from "@/components/compose-sheet";
import { EventSheet } from "@/components/event-sheet";
import { NovusLogo } from "@/components/novus-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { WorkspaceCalendarPanel } from "@/components/workspace-calendar-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  AgendaEvent,
  CommandResult,
  ComposeInput,
  ConnectionStatus,
  EventInput,
  SessionUser,
  ThreadDetail,
  ThreadSummary,
  WorkspacePayload,
} from "@/lib/types";
import { cn, firstEmail } from "@/lib/utils";

type WorkspaceShellProps = {
  session: SessionUser;
  initialWorkspace: WorkspacePayload;
  aiOperator: AgentOperator;
};

type WorkspaceView = "focus" | "unread" | "starred" | "later" | "all";
type ThreadSortMode = "priority" | "newest" | "oldest" | "unread" | "starred" | "sender";
type AgendaSortMode = "soonest" | "latest" | "title" | "status";
type SortOption<T extends string> = {
  id: T;
  label: string;
  hint: string;
};

const SHORTCUTS: Array<{ label: string; keys: string }> = [
  { label: "Search", keys: "/" },
  { label: "Command console", keys: "Cmd/Ctrl K" },
  { label: "Agent chat", keys: "A or Cmd/Ctrl J" },
  { label: "Compose", keys: "C" },
  { label: "Reply", keys: "R" },
  { label: "Schedule event", keys: "G" },
  { label: "Next / previous", keys: "J / K" },
  { label: "Archive", keys: "E" },
  { label: "Star", keys: "S" },
  { label: "Toggle unread", keys: "U" },
  { label: "Trash", keys: "Del" },
  { label: "Shortcuts", keys: "?" },
];

const railAction =
  "motion-interactive flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 outline-none hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const compactRailAction =
  "motion-interactive flex size-11 items-center justify-center rounded-xl bg-sidebar-accent/55 text-sidebar-foreground/80 outline-none ring-1 ring-sidebar-border/60 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring";

const THREAD_SORT_OPTIONS: Array<SortOption<ThreadSortMode>> = [
  { id: "priority", label: "Priority", hint: "Priority score, then newest" },
  { id: "newest", label: "Newest first", hint: "Latest received at the top" },
  { id: "oldest", label: "Oldest first", hint: "Earliest received at the top" },
  { id: "unread", label: "Unread first", hint: "Unread messages before read" },
  { id: "starred", label: "Starred first", hint: "Pinned messages before the rest" },
  { id: "sender", label: "Sender A-Z", hint: "Alphabetical by sender" },
];

const AGENDA_SORT_OPTIONS: Array<SortOption<AgendaSortMode>> = [
  { id: "soonest", label: "Soonest first", hint: "Earliest event in each section" },
  { id: "latest", label: "Latest first", hint: "Latest event in each section" },
  { id: "title", label: "Title A-Z", hint: "Alphabetical by event title" },
  { id: "status", label: "Status", hint: "Confirmed, tentative, then cancelled" },
];

// Polling fallback cadence for live updates when SSE can't reach this instance.
const POLL_INTERVAL_MS = 25_000;

const priorityDot: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-violet-soft",
  low: "bg-muted-foreground/50",
};

const PANEL_STATE_KEY = "corsair.workspace.panels";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildEmailDocument(message: ThreadDetail["messages"][number]) {
  const background = "#ffffff";
  const foreground = "#111827";
  const muted = "#4b5563";
  const link = "#0b57d0";
  const body = message.htmlBody
    ? message.htmlBody
    : `<pre class="plain-text">${escapeHtml(message.body || message.snippet)}</pre>`;

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="light">
    <base target="_blank">
    <style>
      :root { color-scheme: light; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${background};
        color: ${foreground};
        font-family: system-ui, sans-serif;
        font-size: 16px;
        line-height: 1.5;
      }
      body { padding: 24px; overflow-wrap: anywhere; }
      a { color: ${link}; }
      img { max-width: 100%; height: auto; }
      table { max-width: 100%; }
      .plain-text {
        margin: 0;
        white-space: pre-wrap;
        color: ${foreground};
        font: inherit;
      }
      blockquote {
        margin-inline: 0;
        padding: 8px 12px;
        border: 1px solid ${muted};
        border-radius: 6px;
        color: ${muted};
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

function EmailMessageBody({ message }: { message: ThreadDetail["messages"][number] }) {
  const srcDoc = useMemo(() => buildEmailDocument(message), [message]);

  return (
    <div className="mt-3 rounded-lg border border-border/70 bg-card p-3">
      <iframe
        title={`Message from ${message.from || "sender"}`}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        className="min-h-[420px] w-full rounded-md border border-border/60 bg-white"
      />
    </div>
  );
}

function DetailLoadingState() {
  return (
    <div className="flex h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border/80 bg-card/75 px-6 py-4 backdrop-blur">
        <div className="space-y-3">
          <Skeleton className="h-7 w-64 bg-accent/70" />
          <Skeleton className="h-4 w-56 bg-accent/60" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-28 rounded-full bg-accent/60" />
            <Skeleton className="h-6 w-32 rounded-full bg-accent/60" />
            <Skeleton className="h-6 w-24 rounded-full bg-accent/60" />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Skeleton className="h-8 w-24 bg-accent/70" />
            <Skeleton className="h-8 w-28 bg-accent/60" />
            <Skeleton className="h-8 w-24 bg-accent/60" />
          </div>
        </div>
      </header>

      <div className="space-y-3 px-6 py-5">
        {[0, 1].map((index) => (
          <article
            key={index}
            className="rounded-xl border border-border/70 bg-card p-4 shadow-elevation-1"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-44 bg-accent/60" />
              <Skeleton className="h-3 w-24 bg-accent/50" />
            </div>
            <Skeleton className="mt-2 h-3 w-36 bg-accent/50" />
            <div className="mt-4 rounded-lg border border-border/60 bg-muted/20 p-3">
              <Skeleton className="h-[360px] w-full rounded-md bg-accent/40" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Request failed");
    }

    const text = await response.text();
    throw new Error(text || "Request failed");
  }

  return response.json() as Promise<T>;
}

function canHandleGlobalShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return true;
  }

  const tag = target.tagName.toLowerCase();
  return !["input", "textarea", "select"].includes(tag) && !target.isContentEditable;
}

function threadNeedsReply(thread: ThreadSummary, session: SessionUser) {
  return thread.unread && !thread.archived && thread.senderEmail !== session.email;
}

function matchesView(thread: ThreadSummary, view: WorkspaceView, session: SessionUser) {
  switch (view) {
    case "focus":
      return thread.priorityBand === "high" || thread.starred || threadNeedsReply(thread, session);
    case "unread":
      return thread.unread;
    case "starred":
      return thread.starred;
    case "later":
      return thread.archived || thread.priorityBand === "low";
    case "all":
    default:
      return true;
  }
}

function formatInboxDate(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (isToday(date)) {
    return format(date, "h:mm a");
  }

  if (isThisWeek(date, { weekStartsOn: 1 })) {
    return format(date, "EEE");
  }

  return format(date, "MMM d");
}

function formatEventDate(value: string | null) {
  if (!value) {
    return "Time TBD";
  }

  const date = new Date(value);

  if (isToday(date)) {
    return `Today · ${format(date, "h:mm a")}`;
  }

  if (isTomorrow(date)) {
    return `Tomorrow · ${format(date, "h:mm a")}`;
  }

  return `${format(date, "EEE")} · ${format(date, "h:mm a")}`;
}

function formatSyncLabel(label: string, value: string | null) {
  if (!value) {
    return `${label} not synced yet`;
  }

  return `${label} ${format(new Date(value), "MMM d, h:mm a")}`;
}

function timestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function compareTimestamp(leftValue: string | null, rightValue: string | null, direction: "asc" | "desc") {
  const left = timestamp(leftValue);
  const right = timestamp(rightValue);

  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNewestThreads(left: ThreadSummary, right: ThreadSummary) {
  return compareTimestamp(left.receivedAt, right.receivedAt, "desc");
}

function sortThreadsForView(threads: ThreadSummary[], sortMode: ThreadSortMode) {
  return [...threads].sort((left, right) => {
    let result = 0;

    switch (sortMode) {
      case "newest":
        result = compareNewestThreads(left, right);
        break;
      case "oldest":
        result = compareTimestamp(left.receivedAt, right.receivedAt, "asc");
        break;
      case "unread":
        result = Number(right.unread) - Number(left.unread) || compareNewestThreads(left, right);
        break;
      case "starred":
        result = Number(right.starred) - Number(left.starred) || compareNewestThreads(left, right);
        break;
      case "sender":
        result =
          compareText(left.sender || left.senderEmail || "Unknown sender", right.sender || right.senderEmail || "Unknown sender") ||
          compareNewestThreads(left, right);
        break;
      case "priority":
      default:
        result = right.priorityScore - left.priorityScore || compareNewestThreads(left, right);
    }

    return result || left.threadId.localeCompare(right.threadId);
  });
}

const eventStatusRank: Record<AgendaEvent["status"], number> = {
  confirmed: 0,
  tentative: 1,
  cancelled: 2,
};

function sortAgendaEvents(events: AgendaEvent[], sortMode: AgendaSortMode) {
  return [...events].sort((left, right) => {
    let result = 0;

    switch (sortMode) {
      case "latest":
        result = compareTimestamp(left.start, right.start, "desc");
        break;
      case "title":
        result = compareText(left.summary || "Untitled event", right.summary || "Untitled event");
        break;
      case "status":
        result = eventStatusRank[left.status] - eventStatusRank[right.status];
        break;
      case "soonest":
      default:
        result = compareTimestamp(left.start, right.start, "asc");
    }

    return result || compareTimestamp(left.start, right.start, "asc") || left.id.localeCompare(right.id);
  });
}

function sortEvents(events: AgendaEvent[]) {
  return sortAgendaEvents(events, "soonest");
}

function buildReplyDraft(thread: ThreadDetail): Partial<ComposeInput> {
  return {
    to: thread.senderEmail || firstEmail(thread.messages.at(-1)?.from ?? ""),
    subject: /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`,
    body: "",
    threadId: thread.threadId,
  };
}

function buildFollowUpPreset(thread: ThreadDetail): Partial<EventInput> {
  const start = startOfHour(addHours(new Date(), 1));

  if (start.getHours() >= 18) {
    start.setDate(start.getDate() + 1);
    start.setHours(9, 0, 0, 0);
  }

  return {
    summary: `Follow up: ${thread.subject}`,
    attendees: thread.senderEmail || firstEmail(thread.messages.at(-1)?.from ?? ""),
    start: start.toISOString(),
    end: addMinutes(start, 30).toISOString(),
    description: `Continue the conversation with ${thread.sender || thread.senderEmail}.`,
  };
}

function groupAgenda(events: AgendaEvent[]) {
  return [
    {
      label: "Today",
      items: events.filter((event) => event.start && isToday(new Date(event.start))),
    },
    {
      label: "Soon",
      items: events.filter(
        (event) =>
          event.start &&
          !isToday(new Date(event.start)) &&
          (isTomorrow(new Date(event.start)) || isThisWeek(new Date(event.start), { weekStartsOn: 1 })),
      ),
    },
    {
      label: "Later",
      items: events.filter(
        (event) =>
          !event.start ||
          (!isToday(new Date(event.start)) &&
            !isTomorrow(new Date(event.start)) &&
            !isThisWeek(new Date(event.start), { weekStartsOn: 1 })),
      ),
    },
  ];
}

function SortDropdown<T extends string>({
  label,
  value,
  options,
  onValueChange,
  align = "end",
}: {
  label: string;
  value: T;
  options: Array<SortOption<T>>;
  onValueChange: (value: T) => void;
  align?: "start" | "center" | "end";
}) {
  const selectedOption = options.find((option) => option.id === value) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" aria-label={label} title={label}>
          <ArrowDownUpIcon className="size-4" />
          <span className="hidden sm:inline">{selectedOption.label}</span>
          <span className="sm:hidden">Sort</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id} title={option.hint}>
              <span className="flex min-w-0 flex-col">
                <span>{option.label}</span>
                <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function WorkspaceShell({ session, initialWorkspace, aiOperator }: WorkspaceShellProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>(initialWorkspace.threads);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(initialWorkspace.activeThread);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialWorkspace.activeThread?.threadId ?? null,
  );
  const [threadsPage, setThreadsPage] = useState(initialWorkspace.threadsPage);
  const [cacheState, setCacheState] = useState(initialWorkspace.cache);
  const [events, setEvents] = useState<AgendaEvent[]>(sortEvents(initialWorkspace.events));
  const [search, setSearch] = useState(initialWorkspace.search);
  const [view, setView] = useState<WorkspaceView>("focus");
  const [threadSort, setThreadSort] = useState<ThreadSortMode>("priority");
  const [agendaSort, setAgendaSort] = useState<AgendaSortMode>("soonest");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<Partial<ComposeInput> | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<AgendaEvent | null>(null);
  const [eventPreset, setEventPreset] = useState<Partial<EventInput> | null>(null);
  const [notice, setNotice] = useState("");
  const [syncedAt, setSyncedAt] = useState(initialWorkspace.syncedAt);
  const [connection, setConnection] = useState<ConnectionStatus | null>(initialWorkspace.connection ?? null);
  const [syncing, setSyncing] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agendaCollapsed, setAgendaCollapsed] = useState(false);
  const [agendaExpanded, setAgendaExpanded] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState(false);
  const [panelPrefsReady, setPanelPrefsReady] = useState(false);

  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const liveRefreshRef = useRef<() => void>(() => {});
  const selectedThreadIdRef = useRef(selectedThreadId);
  const openRequestIdRef = useRef(0);
  const lastSyncRef = useRef<string>(
    `${initialWorkspace.syncedAt.inbox ?? ""}|${initialWorkspace.syncedAt.calendar ?? ""}`,
  );

  const visibleThreads = useMemo(
    () => sortThreadsForView(threads.filter((thread) => matchesView(thread, view, session)), threadSort),
    [threads, view, session, threadSort],
  );
  const agendaGroups = useMemo(() => groupAgenda(sortAgendaEvents(events, agendaSort)), [events, agendaSort]);
  const currentIndex = visibleThreads.findIndex((thread) => thread.threadId === selectedThreadId);
  const selectedThread = activeThread?.threadId === selectedThreadId ? activeThread : null;

  const focusCount = threads.filter((thread) => matchesView(thread, "focus", session)).length;
  const unreadCount = threads.filter((thread) => matchesView(thread, "unread", session)).length;
  const starredCount = threads.filter((thread) => matchesView(thread, "starred", session)).length;
  const laterCount = threads.filter((thread) => matchesView(thread, "later", session)).length;
  const todayCount = events.filter((event) => event.start && isToday(new Date(event.start))).length;
  const replyCount = threads.filter((thread) => threadNeedsReply(thread, session)).length;
  const totalAgendaCount = events.length;

  const viewOptions: Array<{ id: WorkspaceView; label: string; count: number; hint: string }> = [
    { id: "focus", label: "Focus", count: focusCount, hint: "High priority and response-needed" },
    { id: "unread", label: "Unread", count: unreadCount, hint: "Open loops" },
    { id: "starred", label: "Starred", count: starredCount, hint: "Pinned by you" },
    { id: "later", label: "Later", count: laterCount, hint: "Low urgency and archived" },
    { id: "all", label: "All", count: threads.length, hint: "Full queue" },
  ];
  const currentViewLabel = viewOptions.find((option) => option.id === view)?.label ?? "Mail";

  const presentError = useCallback((error: unknown) => {
    setNotice(error instanceof Error ? error.message : "Something went wrong.");
  }, []);

  const selectNoThread = useCallback(() => {
    openRequestIdRef.current += 1;
    selectedThreadIdRef.current = null;
    setThreadLoading(false);
    setSelectedThreadId(null);
    setActiveThread(null);
  }, []);

  const selectThreadDetail = useCallback((thread: ThreadDetail | null) => {
    openRequestIdRef.current += 1;
    selectedThreadIdRef.current = thread?.threadId ?? null;
    setThreadLoading(false);
    setSelectedThreadId(thread?.threadId ?? null);
    setActiveThread(thread);
  }, []);

  const openThread = useCallback(async (threadId: string) => {
    const requestId = openRequestIdRef.current + 1;
    openRequestIdRef.current = requestId;
    selectedThreadIdRef.current = threadId;
    setThreadLoading(true);
    setSelectedThreadId(threadId);

    try {
      const payload = await parseJson<ThreadDetail>(
        await fetch(`/api/threads/${threadId}`, {
          cache: "no-store",
        }),
      );

      if (requestId !== openRequestIdRef.current || selectedThreadIdRef.current !== threadId) {
        return;
      }

      setActiveThread(payload);
      setThreadLoading(false);
    } catch (error) {
      if (requestId === openRequestIdRef.current && selectedThreadIdRef.current === threadId) {
        setThreadLoading(false);
      }
      presentError(error);
    }
  }, [presentError]);

  function applyWorkspacePayload(
    payload: WorkspacePayload,
    options: { selectDefault?: boolean; appendThreads?: boolean } = {},
  ) {
    setThreads((current) => {
      if (!options.appendThreads) {
        return payload.threads;
      }

      const seen = new Set(current.map((thread) => thread.threadId));
      const appended = payload.threads.filter((thread) => !seen.has(thread.threadId));
      return [...current, ...appended];
    });
    setThreadsPage(payload.threadsPage);
    setCacheState(payload.cache);
    setEvents(sortEvents(payload.events));
    setSyncedAt(payload.syncedAt);
    setConnection(payload.connection ?? null);

    if (options.selectDefault) {
      selectThreadDetail(payload.activeThread);
      return;
    }

    if (payload.activeThread?.threadId === selectedThreadIdRef.current) {
      setActiveThread(payload.activeThread);
    }
  }

  async function refreshWorkspace(query = search.trim(), options: { limit?: number; offset?: number; appendThreads?: boolean } = {}) {
    const params = new URLSearchParams();
    if (query) {
      params.set("search", query);
    }
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }

    const payload = await parseJson<WorkspacePayload>(
      await fetch(`/api/workspace${params.size ? `?${params.toString()}` : ""}`, {
        cache: "no-store",
      }),
    );

    applyWorkspacePayload(payload, { appendThreads: options.appendThreads });
  }

  // Keep a stable handle to the latest refresh so the live SSE listener (bound
  // once) always reloads with the current search term.
  liveRefreshRef.current = () => {
    void refreshWorkspace(search.trim(), {
      limit: search.trim() ? undefined : Math.max(threads.length, initialWorkspace.threadsPage.limit),
    });
  };

  async function searchAllMail() {
    const query = search.trim();
    if (!query) {
      return;
    }

    try {
      const payload = await parseJson<WorkspacePayload>(
        await fetch(`/api/workspace?search=${encodeURIComponent(query)}&remote=1`, { cache: "no-store" }),
      );

      applyWorkspacePayload(payload, { selectDefault: true });
      setView("all");
      setNotice(`Searched all mail for ${query}.`);
    } catch (error) {
      presentError(error);
    }
  }

  const runSearch = useEffectEvent(async (query: string) => {
    try {
      await refreshWorkspace(query);
    } catch (error) {
      presentError(error);
    }
  });

  const warmInboxCache = useEffectEvent(async () => {
    if (search.trim()) {
      return;
    }

    if (!cacheState.backgroundSyncing) {
      return;
    }

    try {
      await fetch(`/api/inbox/cache?target=${cacheState.backgroundSyncTarget}`, {
        method: "POST",
      });
    } catch {
      // Ignore background cache warm failures. The next refresh or visit retries.
    }
  });

  async function loadMoreThreads() {
    if (loadingMoreThreads || !threadsPage.hasMore || search.trim()) {
      return;
    }

    setLoadingMoreThreads(true);
    try {
      await refreshWorkspace("", {
        limit: threadsPage.limit,
        offset: threadsPage.nextOffset ?? threads.length,
        appendThreads: true,
      });
    } catch (error) {
      presentError(error);
    } finally {
      setLoadingMoreThreads(false);
    }
  }

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(PANEL_STATE_KEY);
      if (rawValue) {
        const parsed = JSON.parse(rawValue) as {
          sidebarCollapsed?: boolean;
          agendaCollapsed?: boolean;
        };
        if (typeof parsed.sidebarCollapsed === "boolean") {
          setSidebarCollapsed(parsed.sidebarCollapsed);
        }
        if (typeof parsed.agendaCollapsed === "boolean") {
          setAgendaCollapsed(parsed.agendaCollapsed);
        }
      }
    } catch {
      // Ignore invalid persisted panel preferences and keep defaults.
    } finally {
      setPanelPrefsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!panelPrefsReady) {
      return;
    }

    window.localStorage.setItem(
      PANEL_STATE_KEY,
      JSON.stringify({
        sidebarCollapsed,
        agendaCollapsed,
      }),
    );
  }, [agendaCollapsed, panelPrefsReady, sidebarCollapsed]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void runSearch(deferredSearch.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [deferredSearch, runSearch]);

  useEffect(() => {
    void warmInboxCache();
  }, [warmInboxCache]);

  useEffect(() => {
    let cancelled = false;
    const refreshConnection = async () => {
      try {
        const payload = await parseJson<ConnectionStatus>(await fetch("/api/connection/health", { cache: "no-store" }));
        if (!cancelled) {
          setConnection(payload);
        }
      } catch {
        // Ignore transient health-check failures. The next poll or reload will retry.
      }
    };

    void refreshConnection();

    if (connection?.degraded) {
      const interval = window.setInterval(refreshConnection, POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!connection?.degraded) {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const payload = await parseJson<ConnectionStatus>(await fetch("/api/connection/health", { cache: "no-store" }));
        if (!cancelled) {
          setConnection(payload);
        }
      } catch {
        // Ignore transient health-check failures. The next poll or reload will retry.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [connection?.degraded]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotice("");
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [notice]);

  // Live updates with a polling fallback.
  //
  // Instant path: a Corsair webhook publishes on this tenant's channel and the
  // /api/stream SSE forwards a "refresh" event. On serverless that in-memory bus
  // can't bridge instances, so we ALSO poll a cheap status endpoint and reload
  // only when the tenant's sync timestamps actually change. Polling is paused
  // while the tab is hidden and runs immediately on focus.
  useEffect(() => {
    const source = new EventSource("/api/stream");
    const onRefresh = () => liveRefreshRef.current();
    source.addEventListener("refresh", onRefresh);

    let cancelled = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      try {
        const response = await fetch("/api/sync/status", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const status = (await response.json()) as { inbox: string | null; calendar: string | null };
        const signature = `${status.inbox ?? ""}|${status.calendar ?? ""}`;
        if (!cancelled && signature !== lastSyncRef.current) {
          lastSyncRef.current = signature;
          liveRefreshRef.current();
        }
      } catch {
        // Ignore transient polling errors; the next tick retries.
      }
    };

    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      source.removeEventListener("refresh", onRefresh);
      source.close();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    if (visibleThreads.length === 0) {
      if (selectedThreadId !== null || activeThread !== null) {
        selectNoThread();
      }
      return;
    }

    if (!selectedThreadId || !visibleThreads.some((thread) => thread.threadId === selectedThreadId)) {
      void openThread(visibleThreads[0].threadId);
    }
  }, [activeThread, openThread, selectNoThread, selectedThreadId, visibleThreads]);

  function openReply() {
    if (!selectedThread) {
      return;
    }

    setComposeDraft(buildReplyDraft(selectedThread));
    setComposeOpen(true);
  }

  function openFollowUpEvent() {
    if (!selectedThread) {
      return;
    }

    setEventDraft(null);
    setEventPreset(buildFollowUpPreset(selectedThread));
    setEventOpen(true);
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!canHandleGlobalShortcut(event.target)) {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useHotkeys(
    "meta+k, ctrl+k",
    (event) => {
      event.preventDefault();
      setCommandOpen(true);
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    "meta+j, ctrl+j",
    (event) => {
      event.preventDefault();
      setAgentOpen(true);
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    "a",
    (event) => {
      if (!canHandleGlobalShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      setAgentOpen(true);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "shift+/",
    (event) => {
      if (!canHandleGlobalShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      setShortcutsOpen((open) => !open);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "esc",
    () => {
      if (shortcutsOpen) {
        setShortcutsOpen(false);
        return;
      }

      if (agentOpen) {
        setAgentOpen(false);
        return;
      }

      if (commandOpen) {
        setCommandOpen(false);
        return;
      }

      if (composeOpen) {
        setComposeOpen(false);
        return;
      }

      if (eventOpen) {
        setEventOpen(false);
      }
    },
    { enableOnFormTags: true },
  );

  useHotkeys(
    "c",
    (event) => {
      if (!canHandleGlobalShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      setComposeDraft(null);
      setComposeOpen(true);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "r",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || !selectedThread) {
        return;
      }

      event.preventDefault();
      openReply();
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "g",
    (event) => {
      if (!canHandleGlobalShortcut(event.target)) {
        return;
      }

      event.preventDefault();
      setEventDraft(null);
      setEventPreset(null);
      setEventOpen(true);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "u",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || !selectedThread) {
        return;
      }

      event.preventDefault();
      void runThreadAction(selectedThread.threadId, selectedThread.unread ? "read" : "unread");
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "backspace, del",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || !selectedThread) {
        return;
      }

      event.preventDefault();
      void runThreadAction(selectedThread.threadId, "trash");
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "j",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || currentIndex >= visibleThreads.length - 1) {
        return;
      }

      event.preventDefault();
      void openThread(visibleThreads[currentIndex + 1].threadId);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "k",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || currentIndex <= 0) {
        return;
      }

      event.preventDefault();
      void openThread(visibleThreads[currentIndex - 1].threadId);
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "e",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || !selectedThread) {
        return;
      }

      event.preventDefault();
      void runThreadAction(selectedThread.threadId, selectedThread.archived ? "unarchive" : "archive");
    },
    { enableOnFormTags: false },
  );

  useHotkeys(
    "s",
    (event) => {
      if (!canHandleGlobalShortcut(event.target) || !selectedThread) {
        return;
      }

      event.preventDefault();
      void runThreadAction(selectedThread.threadId, selectedThread.starred ? "unstar" : "star");
    },
    { enableOnFormTags: false },
  );

  async function runThreadAction(threadId: string, action: string) {
    try {
      const payload = await parseJson<ThreadDetail>(
        await fetch(`/api/threads/${threadId}/labels`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }),
      );

      selectThreadDetail(payload);
      setNotice(`Thread updated: ${action}.`);
      startTransition(() => {
        void refreshWorkspace(search.trim());
      });
    } catch (error) {
      presentError(error);
    }
  }

  async function sendMessage(input: ComposeInput) {
    try {
      const payload = await parseJson<ThreadDetail | null>(
        await fetch("/api/messages/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );

      if (payload) {
        selectThreadDetail(payload);
      }

      setComposeDraft(null);
      setNotice("Email sent.");
      startTransition(() => {
        void refreshWorkspace(search.trim());
      });
    } catch (error) {
      presentError(error);
    }
  }

  async function saveDraft(input: ComposeInput) {
    try {
      await parseJson(
        await fetch("/api/messages/draft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );

      setNotice("Draft saved.");
    } catch (error) {
      presentError(error);
    }
  }

  async function submitEvent(input: EventInput & { id?: string }) {
    try {
      const payload = await parseJson<AgendaEvent>(
        await fetch(input.id ? `/api/events/${input.id}` : "/api/events", {
          method: input.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }),
      );

      setNotice(input.id ? "Event updated." : "Event created.");
      setEventPreset(null);
      setEventDraft(null);
      setEvents((current) => {
        const others = current.filter((event) => event.id !== payload.id);
        return sortEvents([...others, payload]);
      });
    } catch (error) {
      presentError(error);
    }
  }

  async function runCommand(command: string) {
    try {
      const payload = await parseJson<CommandResult>(
        await fetch("/api/command", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command }),
        }),
      );

      setNotice(payload.message);

      if (payload.kind === "search") {
        setSearch(payload.payload.search);
        setView("all");
        applyWorkspacePayload(payload.payload, { selectDefault: true });
        return;
      }

      if (payload.kind === "email") {
        selectThreadDetail(payload.payload);
        startTransition(() => {
          void refreshWorkspace(search.trim());
        });
        return;
      }

      if (payload.kind === "workflow") {
        setEvents((current) => sortEvents([...current, payload.payload.event]));
        if (payload.payload.email) {
          selectThreadDetail(payload.payload.email);
        }
        startTransition(() => {
          void refreshWorkspace(search.trim());
        });
        return;
      }

      setEvents((current) => sortEvents([...current, payload.payload]));
    } catch (error) {
      presentError(error);
    }
  }

  async function forceSync() {
    if (syncing) {
      return;
    }

    setSyncing(true);
    try {
      const payload = await parseJson<WorkspacePayload>(await fetch("/api/sync", { method: "POST" }));
      applyWorkspacePayload(payload);
      setNotice(`Synced ${payload.cache.cachedThreads} cached threads and ${payload.events.length} events.`);
    } catch (error) {
      presentError(error);
    } finally {
      setSyncing(false);
    }
  }

  const contentGridClassName = cn(
    "grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(300px,360px)_1fr]",
    agendaCollapsed
      ? "xl:grid-cols-[minmax(300px,360px)_1fr_64px]"
      : agendaExpanded
        ? "xl:grid-cols-[minmax(300px,360px)_1fr_minmax(800px,950px)]"
        : "xl:grid-cols-[minmax(300px,360px)_1fr_minmax(420px,500px)]",
  );

  return (
    <>
      <main className="flex h-dvh overflow-hidden bg-background text-foreground">
        {/* Indigo command rail */}
        <aside
          className={cn(
            "scroll-area-thin motion-enter-soft hidden shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-sidebar-border/70 bg-sidebar text-sidebar-foreground lg:flex",
            sidebarCollapsed ? "w-[72px] px-3 py-4" : "w-72 gap-6 px-4 py-5",
          )}
        >
          {sidebarCollapsed ? (
            <>
              <div className="flex flex-col items-center gap-3">
                <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-[#08071a] shadow-elevation-1 ring-1 ring-sidebar-border/80">
                  <NovusLogo className="size-9" priority />
                </span>
                <button
                  type="button"
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className={compactRailAction}
                  onClick={() => setSidebarCollapsed(false)}
                >
                  <PanelLeftOpenIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Compose"
                  title="Compose"
                  className="motion-interactive flex size-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground outline-none hover:bg-sidebar-primary/90 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  onClick={() => {
                    setComposeDraft(null);
                    setComposeOpen(true);
                  }}
                >
                  <PenSquareIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Command console"
                  title="Command console"
                  className={compactRailAction}
                  onClick={() => setCommandOpen(true)}
                >
                  <CommandIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Ask agent"
                  title="Ask agent"
                  className={compactRailAction}
                  onClick={() => setAgentOpen(true)}
                >
                  <SparklesIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="New event"
                  title="New event"
                  className={compactRailAction}
                  onClick={() => {
                    setEventDraft(null);
                    setEventPreset(null);
                    setEventOpen(true);
                  }}
                >
                  <CalendarPlusIcon className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={syncing ? "Syncing" : "Sync now"}
                  title={syncing ? "Syncing" : "Sync now"}
                  className={compactRailAction}
                  onClick={() => void forceSync()}
                  disabled={syncing}
                >
                  <RefreshCwIcon className={cn("size-4", syncing && "animate-spin")} />
                </button>
              </div>

              <div className="mt-6 space-y-2 border-t border-sidebar-border/70 pt-4">
                {[
                  { label: "Focus", value: focusCount },
                  { label: "Unread", value: unreadCount },
                  { label: "Today", value: todayCount },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl bg-sidebar-accent/45 px-2.5 py-2 text-center ring-1 ring-sidebar-border/55"
                    title={`${stat.label}: ${stat.value}`}
                  >
                    <p className="text-[0.6rem] uppercase tracking-[0.18em] text-sidebar-foreground/45">
                      {stat.label.slice(0, 1)}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-auto flex flex-col items-center gap-3 pt-4">
                <ThemeToggle compact className="w-full justify-center" />
                <button
                  type="button"
                  aria-label="Keyboard shortcuts"
                  title="Keyboard shortcuts"
                  className={compactRailAction}
                  onClick={() => setShortcutsOpen(true)}
                >
                  <KeyboardIcon className="size-4" />
                </button>
                <form action="/api/logout" method="post" className="w-full">
                  <button
                    type="submit"
                    aria-label="Switch workspace"
                    title="Switch workspace"
                    className={cn(compactRailAction, "w-full")}
                  >
                    <LogOutIcon className="size-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center overflow-hidden rounded-md bg-[#08071a] shadow-elevation-1 ring-1 ring-sidebar-border">
                    <NovusLogo className="size-7" priority />
                  </span>
                  <span className="text-sm font-semibold tracking-tight">NovusMail</span>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggle compact />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    onClick={() => setSidebarCollapsed(true)}
                  >
                    <ChevronsLeftIcon className="size-4" />
                  </Button>
                </div>
              </div>

              <div>
                <h1 className="text-lg font-semibold tracking-tight">{session.displayName}</h1>
                <p className="mt-1 text-xs leading-relaxed text-sidebar-foreground/55">
                  Priority-first inbox with a live agenda runway and one-line workflows.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Focus", value: focusCount, sub: `${replyCount} to reply` },
                  { label: "Unread", value: unreadCount, sub: `${starredCount} pinned` },
                  { label: "Today", value: todayCount, sub: "events" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="motion-state rounded-lg bg-sidebar-accent/50 p-2.5 ring-1 ring-sidebar-border/60 hover:bg-sidebar-accent/70"
                  >
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-sidebar-foreground/50">
                      {stat.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{stat.value}</p>
                    <p className="mt-0.5 truncate text-[0.65rem] text-sidebar-foreground/45">{stat.sub}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  className="motion-interactive flex w-full items-center justify-center gap-2 rounded-md bg-sidebar-primary px-3 py-2 text-sm font-semibold text-sidebar-primary-foreground outline-none hover:bg-sidebar-primary/90 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  onClick={() => {
                    setComposeDraft(null);
                    setComposeOpen(true);
                  }}
                >
                  <PenSquareIcon className="size-4" />
                  Compose
                </button>
                <button type="button" className={railAction} onClick={() => setCommandOpen(true)}>
                  <CommandIcon className="size-4 opacity-70" />
                  Command console
                  <kbd className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 font-mono text-[0.65rem] text-sidebar-foreground/60">
                    Ctrl/Cmd K
                  </kbd>
                </button>
                <button type="button" className={railAction} onClick={() => setAgentOpen(true)}>
                  <SparklesIcon className="size-4 opacity-70" />
                  Ask agent
                  <kbd className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 font-mono text-[0.65rem] text-sidebar-foreground/60">
                    A
                  </kbd>
                </button>
                <button
                  type="button"
                  className={railAction}
                  onClick={() => {
                    setEventDraft(null);
                    setEventPreset(null);
                    setEventOpen(true);
                  }}
                >
                  <CalendarPlusIcon className="size-4 opacity-70" />
                  New event
                </button>
                <button type="button" className={railAction} onClick={() => void forceSync()} disabled={syncing}>
                  <RefreshCwIcon className={cn("size-4 opacity-70", syncing && "animate-spin")} />
                  {syncing ? "Syncing" : "Sync now"}
                </button>
              </div>

              <div className="mt-auto space-y-3">
                <button
                  type="button"
                  onClick={() => setShortcutsOpen(true)}
                  className="motion-interactive flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <KeyboardIcon className="size-3.5" />
                  Keyboard shortcuts
                  <kbd className="ml-auto rounded bg-sidebar-accent px-1.5 py-0.5 font-mono text-[0.65rem]">?</kbd>
                </button>

                <form action="/api/logout" method="post">
                  <button
                    type="submit"
                    className="motion-interactive flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  >
                    <LogOutIcon className="size-3.5" />
                    Switch workspace
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>

        {/* Core */}
        <section className="flex flex-1 flex-col overflow-hidden">
          <header className="motion-enter-soft shrink-0 border-b border-border/80 bg-card/75 px-6 py-4 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-10 pl-9"
                  placeholder="Instant local search — type to filter, or search all mail"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void searchAllMail()}
                disabled={!search.trim()}
              >
                <SearchIcon className="size-4" />
                Search all mail
              </Button>
              <div className="hidden flex-col items-end text-[0.7rem] leading-tight text-muted-foreground xl:flex">
                <span>{formatSyncLabel("Inbox", syncedAt.inbox)}</span>
                <span>{formatSyncLabel("Calendar", syncedAt.calendar)}</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Workspace views">
              <div className="flex flex-wrap gap-2">
                {viewOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    title={option.hint}
                    className={cn(
                      "motion-state flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      view === option.id
                        ? "border-primary/20 bg-secondary text-secondary-foreground"
                        : "border-border/70 bg-background/60 text-muted-foreground hover:bg-card/70 hover:text-foreground",
                    )}
                    onClick={() => setView(option.id)}
                    aria-pressed={view === option.id}
                  >
                    {option.label}
                    <span
                      className={cn(
                        "motion-state rounded-full px-1.5 py-0.5 text-[0.7rem] tabular-nums",
                        view === option.id
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {option.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="ml-auto hidden lg:block">
                <SortDropdown
                  label={`Sort ${currentViewLabel} mail`}
                  value={threadSort}
                  options={THREAD_SORT_OPTIONS}
                  onValueChange={setThreadSort}
                />
              </div>
            </div>

            <p
              className={cn(
                "mt-3 text-xs",
                notice ? "motion-enter-soft font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {notice ||
                `Viewing ${visibleThreads.length} thread${visibleThreads.length === 1 ? "" : "s"} in ${view}.`}
            </p>
            {!search.trim() && (
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Cached {cacheState.cachedThreads} of {cacheState.backgroundSyncTarget} recent threads locally for fast search and AI.
              </p>
            )}
            {connection?.degraded && (
              <p className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-100/50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-200">
                <RefreshCwIcon className="mt-0.5 size-3.5 shrink-0" />
                Gmail or Calendar is connected but responding slowly right now. You can keep
                working while the app retries provider health in the background.
              </p>
            )}
          </header>

          <div className={contentGridClassName}>
            {/* Thread list */}
            <div className="scroll-area-thin overflow-y-auto border-r border-border/80 bg-muted/20">
              <div className="motion-enter-soft sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/80 bg-muted/80 px-4 py-2.5 backdrop-blur lg:hidden">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{currentViewLabel}</p>
                  <p className="text-xs text-muted-foreground">
                    {visibleThreads.length} thread{visibleThreads.length === 1 ? "" : "s"}
                  </p>
                </div>
                <SortDropdown
                  label={`Sort ${currentViewLabel} mail`}
                  value={threadSort}
                  options={THREAD_SORT_OPTIONS}
                  onValueChange={setThreadSort}
                />
              </div>
              {visibleThreads.length > 0 ? (
                <>
                  <ul className="divide-y divide-border/80">
                    {visibleThreads.map((thread, index) => {
                      const active = selectedThreadId === thread.threadId;
                      return (
                        <li
                          key={thread.threadId}
                          className="motion-enter-soft"
                          style={{ animationDelay: `${Math.min(index, 8) * 24}ms` }}
                        >
                          <button
                            type="button"
                            onClick={() => void openThread(thread.threadId)}
                            className={cn(
                              "motion-state relative w-full px-4 py-3 text-left outline-none focus-visible:bg-accent",
                              active
                                ? "bg-card ring-1 ring-inset ring-primary/20"
                                : "hover:bg-card/60",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "size-1.5 shrink-0 rounded-full",
                                  priorityDot[thread.priorityBand] ?? "bg-muted-foreground/40",
                                )}
                                aria-hidden
                              />
                              <span
                                className={cn(
                                  "min-w-0 flex-1 truncate text-sm",
                                  thread.unread ? "font-semibold text-foreground" : "text-foreground/80",
                                )}
                              >
                                {thread.sender || thread.senderEmail || "Unknown sender"}
                              </span>
                              {thread.starred && (
                                <StarIcon className="size-3.5 shrink-0 fill-violet-soft text-violet-soft" />
                              )}
                              <time className="shrink-0 text-[0.7rem] text-muted-foreground">
                                {formatInboxDate(thread.receivedAt)}
                              </time>
                            </div>
                            <p
                              className={cn(
                                "mt-1 truncate text-sm",
                                thread.unread ? "font-medium text-foreground" : "text-foreground/70",
                              )}
                            >
                              {thread.subject}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{thread.snippet}</p>
                            <div className="mt-1.5 flex items-center gap-1.5">
                              {threadNeedsReply(thread, session) && (
                                <Badge className="h-4 px-1.5 text-[0.65rem]">Needs reply</Badge>
                              )}
                              {thread.unread && (
                                <Badge variant="secondary" className="h-4 px-1.5 text-[0.65rem]">
                                  Unread
                                </Badge>
                              )}
                              <span className="ml-auto truncate text-[0.65rem] text-muted-foreground">
                                {thread.priorityReason}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {!search.trim() && threadsPage.hasMore && (
                    <div className="border-t border-border/80 px-4 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => void loadMoreThreads()}
                        disabled={loadingMoreThreads}
                      >
                        {loadingMoreThreads ? "Loading more threads..." : "Load more threads"}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
                  <h2 className="motion-enter-soft text-sm font-semibold">No threads in this view.</h2>
                  <p className="text-xs text-muted-foreground">
                    Try another view, clear the search, or sync the workspace.
                  </p>
                </div>
              )}
            </div>

            {/* Thread detail */}
            <div className="scroll-area-thin hidden overflow-y-auto bg-background lg:block">
              {threadLoading ? (
                <DetailLoadingState />
              ) : selectedThread ? (
                <div className="motion-enter-soft flex h-full flex-col">
                  <header className="sticky top-0 z-10 border-b border-border/80 bg-card/75 px-6 py-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold tracking-tight">
                          {selectedThread.subject}
                        </h2>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {selectedThread.sender} · {selectedThread.senderEmail}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="capitalize">
                            {selectedThread.priorityBand} priority
                          </Badge>
                          <Badge variant="ghost" className="text-muted-foreground">
                            {selectedThread.priorityReason}
                          </Badge>
                          <Badge variant="ghost" className="text-muted-foreground">
                            {selectedThread.messageCount} messages
                          </Badge>
                          {selectedThread.unread && <Badge variant="secondary">Unread</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!sidebarCollapsed && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Collapse sidebar"
                            title="Collapse sidebar"
                            onClick={() => setSidebarCollapsed(true)}
                          >
                            <ArrowLeftFromLineIcon className="size-4" />
                          </Button>
                        )}
                        {!agendaCollapsed && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Collapse agenda"
                            title="Collapse agenda"
                            onClick={() => setAgendaCollapsed(true)}
                          >
                            <ArrowRightFromLineIcon className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={openReply}>
                        <ReplyIcon className="size-4" />
                        Reply
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={openFollowUpEvent}>
                        <CalendarPlusIcon className="size-4" />
                        Schedule
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void runThreadAction(
                            selectedThread.threadId,
                            selectedThread.archived ? "unarchive" : "archive",
                          )
                        }
                      >
                        <ArchiveIcon className="size-4" />
                        {selectedThread.archived ? "Unarchive" : "Archive"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void runThreadAction(selectedThread.threadId, selectedThread.unread ? "read" : "unread")
                        }
                      >
                        <MailOpenIcon className="size-4" />
                        {selectedThread.unread ? "Mark read" : "Mark unread"}
                      </Button>
                    </div>
                  </header>

                  <div className="space-y-3 px-6 py-5">
                    {selectedThread.messages.map((message, index) => (
                      <article
                        key={message.id}
                        className="motion-surface rounded-xl border border-border/70 bg-card p-4 shadow-elevation-1"
                        style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <strong className="truncate text-sm font-semibold">{message.from}</strong>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {message.receivedAt ? format(new Date(message.receivedAt), "MMM d, h:mm a") : ""}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{message.to}</p>
                        <EmailMessageBody message={message} />
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
                  <h2 className="motion-enter-soft text-sm font-semibold">No thread selected.</h2>
                  <p className="text-xs text-muted-foreground">
                    Use J/K to move, or tighten the queue with the view chips.
                  </p>
                </div>
              )}
            </div>

            {/* Agenda rail */}
            {agendaCollapsed ? (
              <aside className="hidden h-full border-l border-border/80 bg-muted/20 xl:flex xl:flex-col xl:items-center xl:px-2 xl:py-4">
                <button
                  type="button"
                  aria-label="Expand agenda"
                  title="Expand agenda"
                  className="motion-interactive flex size-11 items-center justify-center rounded-xl border border-border/80 bg-card text-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setAgendaCollapsed(false)}
                >
                  <PanelRightOpenIcon className="size-4" />
                </button>
                <div className="mt-4 flex h-full flex-col items-center gap-3 rounded-[20px] border border-border/60 bg-card/70 px-2 py-3 text-center">
                  <div className="rounded-xl bg-secondary px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-secondary-foreground">
                    Ag
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Up
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums">{totalAgendaCount}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Create event"
                    title="Create event"
                    className="motion-interactive flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground outline-none hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setEventDraft(null);
                      setEventPreset(null);
                      setEventOpen(true);
                    }}
                  >
                    <CalendarPlusIcon className="size-4" />
                  </button>
                </div>
              </aside>
            ) : (
              <aside className="scroll-area-thin hidden overflow-y-auto border-l border-border/80 bg-muted/15 xl:block">
                <div className="motion-enter-soft sticky top-0 z-10 flex items-center justify-between border-b border-border/80 bg-muted/80 px-4 py-3 backdrop-blur">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Calendar</p>
                    <h2 className="text-sm font-semibold">Visual runway</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <SortDropdown
                      label="Sort agenda"
                      value={agendaSort}
                      options={AGENDA_SORT_OPTIONS}
                      onValueChange={setAgendaSort}
                    />
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={agendaExpanded ? "Collapse calendar width" : "Expand calendar width"}
                      title={agendaExpanded ? "Collapse calendar width" : "Expand calendar width"}
                      onClick={() => setAgendaExpanded(!agendaExpanded)}
                    >
                      {agendaExpanded ? (
                        <Minimize2 className="size-4" />
                      ) : (
                        <Maximize2 className="size-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Collapse agenda"
                      title="Collapse agenda"
                      onClick={() => setAgendaCollapsed(true)}
                    >
                      <ChevronsRightIcon className="size-4" />
                    </Button>
                  </div>
                </div>

                <WorkspaceCalendarPanel
                  events={events}
                  agendaSections={agendaGroups}
                  onCreateEvent={(preset) => {
                    setEventDraft(null);
                    setEventPreset(preset ?? null);
                    setEventOpen(true);
                  }}
                  onSelectEvent={(event) => {
                    setEventPreset(null);
                    setEventDraft(event);
                    setEventOpen(true);
                  }}
                />
              </aside>
            )}
          </div>
        </section>
      </main>

      <ComposeSheet
        open={composeOpen}
        initialDraft={composeDraft}
        onClose={() => setComposeOpen(false)}
        onSend={sendMessage}
        onDraft={saveDraft}
      />
      <EventSheet
        open={eventOpen}
        initialEvent={eventDraft}
        draftPreset={eventPreset}
        onClose={() => setEventOpen(false)}
        onSubmit={submitEvent}
      />
      <CommandPalette open={commandOpen} activeThread={selectedThread} onClose={() => setCommandOpen(false)} onRun={runCommand} />
      <AgentPanel
        open={agentOpen}
        operator={aiOperator}
        onClose={() => setAgentOpen(false)}
        onConfirmEmail={async (input) => {
          await sendMessage(input);
        }}
        onConfirmEvent={async (input) => {
          await submitEvent(input);
        }}
      />

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyboardIcon className="size-4" />
              Keyboard shortcuts
            </DialogTitle>
            <DialogDescription>Move through the workspace without the mouse.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.label}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{shortcut.label}</span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
