export type SessionUser = {
  tenantId: string;
  email: string;
  displayName: string;
  mode?: "live" | "demo";
};

export type ProviderStatus = {
  authorized: boolean;
  healthy: boolean | null;
  checkedAt: string | null;
  latencyMs: number | null;
  lastError: string | null;
};

export type ConnectionStatus = {
  gmail: ProviderStatus;
  calendar: ProviderStatus;
  readyForWorkspace: boolean;
  degraded: boolean;
  setupLog: string;
};

export type ThreadSummary = {
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  recipients: string[];
  snippet: string;
  bodyExcerpt: string;
  receivedAt: string | null;
  messageCount: number;
  labels: string[];
  unread: boolean;
  starred: boolean;
  archived: boolean;
  priorityBand: "high" | "normal" | "low";
  priorityScore: number;
  priorityReason: string;
};

export type ThreadDetail = ThreadSummary & {
  body: string;
  htmlBody: string | null;
  messages: Array<{
    id: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    body: string;
    htmlBody: string | null;
    receivedAt: string | null;
    labels: string[];
  }>;
};

export type AgendaEvent = {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string | null;
  end: string | null;
  attendees: string[];
  status: "confirmed" | "tentative" | "cancelled";
  htmlLink: string | null;
};

export type WorkspacePayload = {
  threads: ThreadSummary[];
  activeThread: ThreadDetail | null;
  events: AgendaEvent[];
  search: string;
  connection?: ConnectionStatus;
  threadsPage: {
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
  cache: {
    cachedThreads: number;
    backgroundSyncTarget: number;
    backgroundSyncing: boolean;
  };
  syncedAt: {
    inbox: string | null;
    calendar: string | null;
  };
};

export type ComposeInput = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  threadId?: string;
};

export type EventInput = {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  attendees?: string;
};

export const INBOX_TRIAGE_MODES = [
  "summarize_unread",
  "reply_candidates",
  "priority_list",
  "changes_since_checkpoint",
  "summarize_threads",
] as const;

export type InboxTriageMode = (typeof INBOX_TRIAGE_MODES)[number];

export const INBOX_TRIAGE_TIMEFRAMES = ["today", "week", "all"] as const;

export type InboxTriageTimeframe = (typeof INBOX_TRIAGE_TIMEFRAMES)[number];

export type InboxTriageInput = {
  mode: InboxTriageMode;
  timeframe?: InboxTriageTimeframe;
  limit?: number;
  query?: string;
  threadIds?: string[];
  checkpointAt?: string | null;
  now?: string;
};

export type InboxTriageItem = {
  threadId: string;
  subject: string;
  sender: string;
  senderEmail: string;
  snippet: string;
  receivedAt: string | null;
  unread: boolean;
  archived: boolean;
  messageCount: number;
  priorityBand: ThreadSummary["priorityBand"];
  priorityScore: number;
  priorityReason: string;
  summaryReason: string;
};

export type InboxTriageResult = {
  mode: InboxTriageMode;
  timeframe: InboxTriageTimeframe;
  total: number;
  query?: string;
  checkpointAt?: string | null;
  usedFallback: boolean;
  threads: InboxTriageItem[];
};

export const AGENT_SUGGESTION_FAMILIES = ["triage", "draft", "search", "schedule"] as const;

export type AgentSuggestionFamily = (typeof AGENT_SUGGESTION_FAMILIES)[number];

export const AGENT_SUGGESTION_INTENTS = [
  "triage_reply_needed",
  "triage_unread_week",
  "triage_priority_list",
  "triage_changes_since_check",
  "draft_top_two_replies",
  "draft_refine_reply",
  "draft_follow_up_meeting",
  "search_related_sender",
  "search_summarize_matches",
  "schedule_open_time",
  "schedule_short_agenda",
  "schedule_check_agenda",
] as const;

export type AgentSuggestionIntent = (typeof AGENT_SUGGESTION_INTENTS)[number];

export type AgentSuggestion = {
  id: AgentSuggestionIntent;
  label: string;
  family: AgentSuggestionFamily;
};

export type AgentChatContext = {
  suggestionIntent?: AgentSuggestionIntent;
  checkpointAt?: string | null;
};

export type WorkflowResult = {
  event: AgendaEvent;
  email: ThreadDetail | null;
};

export type CommandResult =
  | {
      kind: "search";
      message: string;
      payload: WorkspacePayload;
    }
  | {
      kind: "email";
      message: string;
      payload: ThreadDetail | null;
    }
  | {
      kind: "event";
      message: string;
      payload: AgendaEvent;
    }
  | {
      kind: "workflow";
      message: string;
      payload: WorkflowResult;
    };
