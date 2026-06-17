export type SessionUser = {
  tenantId: string;
  email: string;
  displayName: string;
};

export type ConnectionStatus = {
  gmail: boolean;
  calendar: boolean;
  ready: boolean;
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
