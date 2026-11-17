"use client";
import { AgentPanel, type AgentOperator } from "@/components/agent-panel";
import { CommandPalette } from "@/components/command-palette";
import { ComposeSheet } from "@/components/compose-sheet";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { EventSheet } from "@/components/event-sheet";
import { useTheme } from "@/components/theme-provider";

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
import { firstEmail } from "@/lib/utils";
import { addHours, addMinutes, startOfHour } from "date-fns";
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
import { toast } from "sonner";
import { notifySuccess } from "@/components/doop/feedback";
type WorkspaceShellProps = {
  session: SessionUser;
  initialWorkspace: WorkspacePayload;
  aiOperator: AgentOperator;
};
type WorkspaceView =
  "focus" | "unread" | "starred" | "drafts" | "sent" | "later" | "all";
type ThreadSortMode =
  "priority" | "newest" | "oldest" | "unread" | "starred" | "sender";
type AgendaSortMode = "soonest" | "latest" | "title" | "status";
// Polling fallback cadence for live updates when SSE can't reach this instance.
const POLL_INTERVAL_MS = 25_000;
const PANEL_STATE_KEY = "novus.dashboard.panels.v2";
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
function buildEmailDocument(
  message: ThreadDetail["messages"][number],
  dark: boolean,
) {
  const background = "transparent";
  const foreground = dark ? "#ededee" : "#252422";
  const muted = dark ? "#b2b3b7" : "#5e5c57";
  const link = dark ? "#a1c4b3" : "#237454";
  const body = message.htmlBody
    ? message.htmlBody
    : `<pre class="plain-text">${escapeHtml(message.body || message.snippet)}</pre>`;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="color-scheme" content="${dark ? "dark" : "light"}">
    <base target="_blank">
    <style>
      :root { color-scheme: ${dark ? "dark" : "light"}; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${background};
        color: ${foreground};
        font-family: system-ui, sans-serif;
        font-size: 16px;
        line-height: 1.5;
      }
      body { padding: 0; overflow-wrap: anywhere; }
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
function EmailMessageBody({
  message,
}: {
  message: ThreadDetail["messages"][number];
}) {
  const { resolvedTheme } = useTheme();
  const srcDoc = useMemo(
    () => buildEmailDocument(message, resolvedTheme === "dark"),
    [message, resolvedTheme],
  );
  return (
    <div>
      <iframe
        title={`Message from ${message.from || "sender"}`}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        className="min-h-[420px] w-full"
      />
    </div>
  );
}
async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
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
  return (
    !["input", "textarea", "select"].includes(tag) && !target.isContentEditable
  );
}
function threadNeedsReply(thread: ThreadSummary, session: SessionUser) {
  return (
    thread.unread && !thread.archived && thread.senderEmail !== session.email
  );
}
function matchesView(
  thread: ThreadSummary,
  view: WorkspaceView,
  session: SessionUser,
) {
  switch (view) {
    case "focus":
      return (
        thread.priorityBand === "high" ||
        thread.starred ||
        threadNeedsReply(thread, session)
      );
    case "unread":
      return thread.unread;
    case "starred":
      return thread.starred;
    case "drafts":
      return thread.labels.includes("DRAFT");
    case "sent":
      return thread.labels.includes("SENT");
    case "later":
      return (
        (thread.archived || thread.priorityBand === "low") &&
        !thread.labels.includes("SENT")
      );
    case "all":
    default:
      return true;
  }
}
function timestamp(value: string | null) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}
function compareTimestamp(
  leftValue: string | null,
  rightValue: string | null,
  direction: "asc" | "desc",
) {
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
function sortThreadsForView(
  threads: ThreadSummary[],
  sortMode: ThreadSortMode,
) {
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
        result =
          Number(right.unread) - Number(left.unread) ||
          compareNewestThreads(left, right);
        break;
      case "starred":
        result =
          Number(right.starred) - Number(left.starred) ||
          compareNewestThreads(left, right);
        break;
      case "sender":
        result =
          compareText(
            left.sender || left.senderEmail || "Unknown sender",
            right.sender || right.senderEmail || "Unknown sender",
          ) || compareNewestThreads(left, right);
        break;
      case "priority":
      default:
        result =
          right.priorityScore - left.priorityScore ||
          compareNewestThreads(left, right);
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
        result = compareText(
          left.summary || "Untitled event",
          right.summary || "Untitled event",
        );
        break;
      case "status":
        result = eventStatusRank[left.status] - eventStatusRank[right.status];
        break;
      case "soonest":
      default:
        result = compareTimestamp(left.start, right.start, "asc");
    }
    return (
      result ||
      compareTimestamp(left.start, right.start, "asc") ||
      left.id.localeCompare(right.id)
    );
  });
}
function sortEvents(events: AgendaEvent[]) {
  return sortAgendaEvents(events, "soonest");
}
function buildReplyDraft(thread: ThreadDetail): Partial<ComposeInput> {
  return {
    to: thread.senderEmail || firstEmail(thread.messages.at(-1)?.from ?? ""),
    subject: /^re:/i.test(thread.subject)
      ? thread.subject
      : `Re: ${thread.subject}`,
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
    attendees:
      thread.senderEmail || firstEmail(thread.messages.at(-1)?.from ?? ""),
    start: start.toISOString(),
    end: addMinutes(start, 30).toISOString(),
    description: `Continue the conversation with ${thread.sender || thread.senderEmail}.`,
  };
}
export function WorkspaceShell({
  session,
  initialWorkspace,
  aiOperator,
}: WorkspaceShellProps) {
  const [threads, setThreads] = useState<ThreadSummary[]>(
    initialWorkspace.threads,
  );
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(
    initialWorkspace.activeThread,
  );
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(
    initialWorkspace.activeThread?.threadId ?? null,
  );
  const [threadsPage, setThreadsPage] = useState(initialWorkspace.threadsPage);
  const [cacheState, setCacheState] = useState(initialWorkspace.cache);
  const [events, setEvents] = useState<AgendaEvent[]>(
    sortEvents(initialWorkspace.events),
  );
  const [search, setSearch] = useState(initialWorkspace.search);
  const [view, setView] = useState<WorkspaceView>("focus");
  const threadSort: ThreadSortMode = "newest";

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] =
    useState<Partial<ComposeInput> | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [eventDraft, setEventDraft] = useState<AgendaEvent | null>(null);
  const [eventPreset, setEventPreset] = useState<Partial<EventInput> | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const [syncedAt, setSyncedAt] = useState(initialWorkspace.syncedAt);
  const [connection, setConnection] = useState<ConnectionStatus | null>(
    initialWorkspace.connection ?? null,
  );
  const [syncing, setSyncing] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [calendarView, setCalendarView] = useState(false);
  const [mobileReaderOpen, setMobileReaderOpen] = useState(false);
  const [agendaCollapsed, setAgendaCollapsed] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [loadingMoreThreads, setLoadingMoreThreads] = useState(false);
  const [panelPrefsReady, setPanelPrefsReady] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const searchRef = useRef<HTMLInputElement>(null);
  const liveRefreshRef = useRef<() => void>(() => {});
  const selectedThreadIdRef = useRef(selectedThreadId);
  const openRequestIdRef = useRef(0);
  const initialSelectionRef = useRef(false);
  const lastSyncRef = useRef<string>(
    `${initialWorkspace.syncedAt.inbox ?? ""}|${initialWorkspace.syncedAt.calendar ?? ""}`,
  );
  const visibleThreads = useMemo(
    () =>
      sortThreadsForView(
        threads.filter((thread) => matchesView(thread, view, session)),
        threadSort,
      ),
    [threads, view, session, threadSort],
  );
  const currentIndex = visibleThreads.findIndex(
    (thread) => thread.threadId === selectedThreadId,
  );
  const selectedThread =
    activeThread?.threadId === selectedThreadId ? activeThread : null;
  const focusCount = threads.filter((thread) =>
    matchesView(thread, "focus", session),
  ).length;
  const unreadCount = threads.filter((thread) =>
    matchesView(thread, "unread", session),
  ).length;
  const starredCount = threads.filter((thread) =>
    matchesView(thread, "starred", session),
  ).length;
  const sentCount = threads.filter((thread) =>
    matchesView(thread, "sent", session),
  ).length;
  const laterCount = threads.filter((thread) =>
    matchesView(thread, "later", session),
  ).length;
  const viewOptions: Array<{
    id: WorkspaceView;
    label: string;
    count: number;
    hint: string;
  }> = [
    {
      id: "focus",
      label: "Focus",
      count: focusCount,
      hint: "High priority and response-needed",
    },
    { id: "unread", label: "Unread", count: unreadCount, hint: "Open loops" },
    {
      id: "starred",
      label: "Starred",
      count: starredCount,
      hint: "Pinned by you",
    },
    {
      id: "drafts",
      label: "Drafts",
      count: threads.filter((thread) => thread.labels.includes("DRAFT")).length,
      hint: "Draft messages",
    },
    { id: "sent", label: "Sent", count: sentCount, hint: "Sent messages" },
    {
      id: "later",
      label: "Later",
      count: laterCount,
      hint: "Low urgency and archived",
    },
    { id: "all", label: "All mail", count: threads.length, hint: "Full queue" },
  ];
  const presentError = useCallback((error: unknown) => {
    setNotice(error instanceof Error ? error.message : "Something went wrong.");
  }, []);
  const selectNoThread = useCallback(() => {
    setThreadError(false);
    openRequestIdRef.current += 1;
    selectedThreadIdRef.current = null;
    setThreadLoading(false);
    setSelectedThreadId(null);
    setActiveThread(null);
  }, []);
  const selectThreadDetail = useCallback((thread: ThreadDetail | null) => {
    setThreadError(false);
    openRequestIdRef.current += 1;
    selectedThreadIdRef.current = thread?.threadId ?? null;
    setThreadLoading(false);
    setSelectedThreadId(thread?.threadId ?? null);
    setActiveThread(thread);
  }, []);
  const openThread = useCallback(
    async (threadId: string) => {
      const requestId = openRequestIdRef.current + 1;
      openRequestIdRef.current = requestId;
      selectedThreadIdRef.current = threadId;
      setThreadError(false);
      setThreadLoading(true);
      setSelectedThreadId(threadId);
      try {
        const payload = await parseJson<ThreadDetail>(
          await fetch(`/api/threads/${threadId}`, {
            cache: "no-store",
          }),
        );
        if (
          requestId !== openRequestIdRef.current ||
          selectedThreadIdRef.current !== threadId
        ) {
          return;
        }
        setActiveThread(payload);
        setThreadLoading(false);
      } catch {
        if (
          requestId === openRequestIdRef.current &&
          selectedThreadIdRef.current === threadId
        ) {
          setThreadLoading(false);
          setThreadError(true);
        }
      }
    },
    [],
  );
  function applyWorkspacePayload(
    payload: WorkspacePayload,
    options: { selectDefault?: boolean; appendThreads?: boolean } = {},
  ) {
    setThreads((current) => {
      if (!options.appendThreads) {
        return payload.threads;
      }
      const seen = new Set(current.map((thread) => thread.threadId));
      const appended = payload.threads.filter(
        (thread) => !seen.has(thread.threadId),
      );
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
  useEffect(() => {
    if (
      initialSelectionRef.current ||
      !visibleThreads.length ||
      selectedThreadId
    )
      return;
    initialSelectionRef.current = true;
    if (window.matchMedia("(min-width: 768px)").matches)
      void openThread(visibleThreads[0].threadId);
  }, [visibleThreads, selectedThreadId, openThread]);
  async function refreshWorkspace(
    query = search.trim(),
    options: { limit?: number; offset?: number; appendThreads?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    if (query) {
      params.set("search", query);
    }
    if (!query || typeof options.limit === "number") {
      params.set("limit", String(options.limit ?? Math.max(threads.length, initialWorkspace.threadsPage.limit)));
    }
    if (typeof options.offset === "number") {
      params.set("offset", String(options.offset));
    }
    const payload = await parseJson<WorkspacePayload>(
      await fetch(
        `/api/workspace${params.size ? `?${params.toString()}` : ""}`,
        {
          cache: "no-store",
        },
      ),
    );
    applyWorkspacePayload(payload, { appendThreads: options.appendThreads });
  }
  // Keep a stable handle to the latest refresh so the live SSE listener (bound
  // once) always reloads with the current search term.
  liveRefreshRef.current = () => {
    void refreshWorkspace(search.trim(), {
      limit: search.trim()
        ? undefined
        : Math.max(threads.length, initialWorkspace.threadsPage.limit),
    });
  };
  async function searchAllMail() {
    const query = search.trim();
    if (!query) {
      return;
    }
    try {
      const payload = await parseJson<WorkspacePayload>(
        await fetch(
          `/api/workspace?search=${encodeURIComponent(query)}&remote=1`,
          { cache: "no-store" },
        ),
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
      await fetch(
        `/api/inbox/cache?target=${cacheState.backgroundSyncTarget}`,
        {
          method: "POST",
        },
      );
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
          agendaCollapsed?: boolean;
        };
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
        agendaCollapsed,
      }),
    );
  }, [agendaCollapsed, panelPrefsReady]);
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
        const payload = await parseJson<ConnectionStatus>(
          await fetch("/api/connection/health", { cache: "no-store" }),
        );
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
        const payload = await parseJson<ConnectionStatus>(
          await fetch("/api/connection/health", { cache: "no-store" }),
        );
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
        const status = (await response.json()) as {
          inbox: string | null;
          calendar: string | null;
        };
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
    if (
      !selectedThreadId ||
      !visibleThreads.some((thread) => thread.threadId === selectedThreadId)
    ) {
      void openThread(visibleThreads[0].threadId);
    }
  }, [
    activeThread,
    openThread,
    selectNoThread,
    selectedThreadId,
    visibleThreads,
  ]);
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
      void runThreadAction(
        selectedThread.threadId,
        selectedThread.unread ? "read" : "unread",
      );
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
      if (
        !canHandleGlobalShortcut(event.target) ||
        currentIndex >= visibleThreads.length - 1
      ) {
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
      void runThreadAction(
        selectedThread.threadId,
        selectedThread.archived ? "unarchive" : "archive",
      );
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
      void runThreadAction(
        selectedThread.threadId,
        selectedThread.starred ? "unstar" : "star",
      );
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
      notifySuccess(
        input.threadId
          ? `Reply sent to ${input.to}`
          : `Email sent to ${input.to}`,
        {
          description: input.subject,
          action: {
            label: "View sent mail",
            onClick: () => {
              setView("sent");
              setCalendarView(false);
              setAgentOpen(false);
              setComposeOpen(false);
            },
          },
        },
      );
      startTransition(() => {
        void refreshWorkspace(search.trim());
      });
    } catch (error) {
      presentError(error);
      throw error;
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
      throw error;
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
      notifySuccess(input.id ? "Event updated" : "Event created", {
        description: input.summary,
      });
      setEventPreset(null);
      setEventDraft(null);
      setEvents((current) => {
        const others = current.filter((event) => event.id !== payload.id);
        return sortEvents([...others, payload]);
      });
    } catch (error) {
      presentError(error);
      throw error;
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
      throw error;
    }
  }
  async function forceSync() {
    if (syncing) {
      return;
    }
    setSyncing(true);
    try {
      const payload = await parseJson<WorkspacePayload>(
        await fetch("/api/sync", { method: "POST" }),
      );
      applyWorkspacePayload(payload);
      setNotice(
        `Synced ${payload.cache.cachedThreads} cached threads and ${payload.events.length} events.`,
      );
    } catch (error) {
      presentError(error);
    } finally {
      setSyncing(false);
    }
  }
  useEffect(() => {
    if (notice) toast(notice);
  }, [notice]);
  return (
    <>
      <DashboardView
        composerTitle={
          composeDraft?.threadId ? "Review your reply" : "Review your message"
        }
        mobileReaderOpen={mobileReaderOpen}
        onMobileReader={setMobileReaderOpen}
        session={session}
        threads={visibleThreads}
        thread={selectedThread}
        folders={viewOptions}
        view={view}
        search={search}
        searchRef={searchRef}
        onSearch={setSearch}
        onSearchAll={() => void searchAllMail()}
        onView={setView}
        onThread={(id) => void openThread(id)}
        onBack={selectNoThread}
        threadLoading={threadLoading}
        threadError={threadError}
        onRetryThread={() => {
          if (selectedThreadId) void openThread(selectedThreadId);
        }}
        onCompose={() => {
          setComposeDraft(null);
          setComposeOpen(true);
        }}
        onReply={() => {
          if (selectedThread) {
            setComposeDraft(buildReplyDraft(selectedThread));
            setComposeOpen(true);
          }
        }}
        onForward={() => {
          if (selectedThread) {
            setComposeDraft({
              to: "",
              subject: `Fwd: ${selectedThread.subject}`,
              body: `\n\n${selectedThread.body}`,
            });
            setComposeOpen(true);
          }
        }}
        onDraft={(thread) => {
          setComposeDraft({
            to: thread.recipients
              .filter((email) => email !== session.email)
              .join(", "),
            subject: thread.subject,
            body: thread.messages.at(-1)?.body ?? thread.body,
            threadId: thread.threadId,
          });
          setComposeOpen(true);
        }}
        onThreadAction={(action) => {
          if (selectedThread)
            void runThreadAction(selectedThread.threadId, action);
        }}
        onCommand={() => setCommandOpen(true)}
        onAssistant={() => setAgentOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        onSync={() => void forceSync()}
        syncing={syncing}
        syncedAt={syncedAt.inbox}
        connection={connection}
        events={events}
        onEvent={(event) => {
          setEventPreset(null);
          setEventDraft(event);
          setEventOpen(true);
        }}
        onNewEvent={(preset) => {
          if (!preset && selectedThread) {
            openFollowUpEvent();
            return;
          }
          setEventDraft(null);
          setEventPreset(preset ?? null);
          setEventOpen(true);
        }}
        agendaCollapsed={agendaCollapsed}
        onAgenda={setAgendaCollapsed}
        calendarView={calendarView}
        onCalendar={setCalendarView}
        hasMore={threadsPage.hasMore}
        loadingMore={loadingMoreThreads}
        onMoreThreads={() => void loadMoreThreads()}
        composer={
          composeOpen ? (
            <ComposeSheet
              recipientName={selectedThread?.sender.split(/\s+/)[0]}
              open={composeOpen}
              initialDraft={composeDraft}
              onClose={() => setComposeOpen(false)}
              onSend={sendMessage}
              onDraft={saveDraft}
            />
          ) : undefined
        }
        assistant={
          composeOpen ? (
            <AgentPanel
              threadContext={selectedThread ? { threadId: selectedThread.threadId, sender: selectedThread.sender, subject: selectedThread.subject } : undefined}
              contactNames={Object.fromEntries([...threads.map(item => [item.senderEmail, item.sender]), [session.email, "you"]])}
              embedded
              onReviewEvent={(input) => { setEventDraft(null); setEventPreset(input); setEventOpen(true); }}
              onOpenThread={(id) => {
                setComposeOpen(false);
                setMobileReaderOpen(true);
                void openThread(id);
              }}
              open={composeOpen}
              operator={aiOperator}
              onClose={() => setComposeOpen(false)}
              onConfirmEmail={sendMessage}
              onConfirmEvent={submitEvent}
            />
          ) : undefined
        }
        renderHtml={(message) => <EmailMessageBody message={message} />}
      />
      <EventSheet
        open={eventOpen}
        initialEvent={eventDraft}
        draftPreset={eventPreset}
        onClose={() => setEventOpen(false)}
        onSubmit={submitEvent}
      />
      <CommandPalette
        open={commandOpen}
        activeThread={selectedThread}
        onClose={() => setCommandOpen(false)}
        onRun={runCommand}
      />
      <AgentPanel
        threadContext={selectedThread ? { threadId: selectedThread.threadId, sender: selectedThread.sender, subject: selectedThread.subject } : undefined}
        contactNames={Object.fromEntries([...threads.map(item => [item.senderEmail, item.sender]), [session.email, "you"]])}
        open={agentOpen}
        onOpenThread={(id) => {
          setAgentOpen(false);
          setMobileReaderOpen(true);
          void openThread(id);
        }}
        operator={aiOperator}
        onClose={() => setAgentOpen(false)}
        onConfirmEmail={async (input) => {
          await sendMessage(input);
        }}
        onConfirmEvent={async (input) => {
          await submitEvent(input);
        }}
      />
      <KeyboardShortcuts open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
