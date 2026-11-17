"use client";

import {
  AgentTriageCard,
  parseTriageSnapshot,
  type TriageSnapshot,
} from "@/components/agent-triage-card";
import { DoopBotIcon, DoopNewChatIcon, DoopHistoryIcon, DoopCalendarIcon as CalendarIcon, DoopClockIcon as ClockIcon, DoopUsersIcon as UsersIcon, DoopMapPinIcon as MapPinIcon, DoopWarningIcon as AlertTriangleIcon, DoopMailIcon as MailIcon } from "@/components/doop/source-icons";
import { DoopAIWelcome } from "@/components/doop/ai-welcome";
import AIApproval from "@/components/doop/ai-approval";
import AIArtifact from "@/components/doop/ai-artifact";
import AIConversation from "@/components/doop/ai-conversation";
import { DoopAIHistory } from "@/components/doop/ai-history";
import "@/components/doop/ai-chat.css";
import "@/components/doop/assistant-fidelity.css";
import "@/components/doop/ai-confirmation-fidelity.css";
import AIMessage from "@/components/doop/ai-message";
import AIPromptInput from "@/components/doop/ai-prompt-input";
import { DoopAIWelcomeSuggestions } from "@/components/doop/ai-suggestions";
import AIToolCall from "@/components/doop/ai-tool-call";
import { DoopAIToolActivity } from "@/components/doop/ai-tool-activity";
import { Collapsible } from "@animate-ui/react/primitives/radix-ui";
import { format, isToday, isTomorrow } from "date-fns";
import {
  ArrowUpRightIcon,
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DoopDateTimeInput } from "@/components/doop/date-time-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  buildContextualSuggestions,
  getDefaultAgentSuggestions,
} from "@/lib/agent-suggestions";
import type { AgentChatContext, ComposeInput, EventInput } from "@/lib/types";
import { cn } from "@/lib/utils";

const agentErrorSchema = z.object({ error: z.string().min(1) });

type EmailProposal = {
  kind: "email";
  to: string;
  subject: string;
  body: string;
  threadId?: string;
};
type EventProposal = {
  kind: "event";
  summary: string;
  start: string;
  end: string;
  attendees?: string;
  description?: string;
  location?: string;
};
type Proposal = EmailProposal | EventProposal;

type ProposalItem = {
  id: string;
  proposal: Proposal;
  status: "pending" | "confirming" | "done" | "cancelled";
  editing?: boolean;
  error?: string;
};

type Turn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  tools: string[];
  proposals: ProposalItem[];
  createdAt: string;
  triage?: TriageSnapshot;
};

type SavedChat = {
  id: string;
  title: string;
  updatedAt: string;
  lastInboxCheckpointAt: string | null;
  turns: Turn[];
};

type AgentRequestMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentOperator = {
  configured: boolean;
  label: string;
  model: string;
};

type AgentPanelProps = {
  embedded?: boolean;
  open: boolean;
  operator: AgentOperator;
  onClose: () => void;
  onOpenThread?: (id: string) => void;
  threadContext?: { threadId: string; sender: string; subject: string };
  contactNames?: Record<string, string>;
  onConfirmEmail: (input: ComposeInput) => Promise<void>;
  onConfirmEvent: (input: EventInput) => Promise<void>;
  onReviewEvent?: (input: EventInput) => void;
};


const CHAT_HISTORY_STORAGE_KEY = "corsair-mail-agent-chats:v2";
const LEGACY_CHAT_HISTORY_STORAGE_KEY = "corsair-mail-agent-chats:v1";
const MAX_SAVED_CHATS = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function uid() {
  return crypto.randomUUID();
}

function buildChatTitle(turns: Turn[]) {
  return (
    turns
      .find((turn) => turn.role === "user" && turn.content.trim())
      ?.content.trim()
      .slice(0, 72) || "New chat"
  );
}

function normalizeTurn(value: unknown): Turn | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<Turn>;
  if (
    typeof candidate.id !== "string" ||
    (candidate.role !== "user" && candidate.role !== "assistant") ||
    typeof candidate.content !== "string" ||
    !Array.isArray(candidate.tools) ||
    !Array.isArray(candidate.proposals)
  ) {
    return null;
  }

  return {
    id: candidate.id,
    role: candidate.role,
    content: candidate.content,
    tools: candidate.tools.filter(
      (item): item is string => typeof item === "string",
    ),
    proposals: candidate.proposals as ProposalItem[],
    triage: parseTriageSnapshot(candidate.triage),
    createdAt:
      typeof candidate.createdAt === "string"
        ? candidate.createdAt
        : new Date().toISOString(),
  };
}

function normalizeSavedChats(value: unknown): SavedChat[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((chat) => {
      if (!chat || typeof chat !== "object") {
        return [];
      }
      const candidate = chat as Partial<SavedChat>;
      if (
        typeof candidate.id !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.updatedAt !== "string" ||
        !Array.isArray(candidate.turns)
      ) {
        return [];
      }

      const turns = candidate.turns
        .map(normalizeTurn)
        .filter((turn): turn is Turn => Boolean(turn));
      return [
        {
          id: candidate.id,
          title: candidate.title,
          updatedAt: candidate.updatedAt,
          lastInboxCheckpointAt:
            typeof candidate.lastInboxCheckpointAt === "string" ||
            candidate.lastInboxCheckpointAt === null
              ? candidate.lastInboxCheckpointAt
              : null,
          turns,
        },
      ];
    })
    .slice(0, MAX_SAVED_CHATS);
}

function readSavedChats() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const next = normalizeSavedChats(
      JSON.parse(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || "[]"),
    );
    if (next.length > 0) {
      return next;
    }

    return normalizeSavedChats(
      JSON.parse(
        window.localStorage.getItem(LEGACY_CHAT_HISTORY_STORAGE_KEY) || "[]",
      ),
    );
  } catch {
    return [];
  }
}

function writeSavedChats(chats: SavedChat[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    CHAT_HISTORY_STORAGE_KEY,
    JSON.stringify(chats.slice(0, MAX_SAVED_CHATS)),
  );
}

function getGroupedChats(chats: SavedChat[]) {
  const now = Date.now();
  const today = new Date();
  const todayKey = today.toDateString();

  return {
    today: chats.filter(
      (chat) => new Date(chat.updatedAt).toDateString() === todayKey,
    ),
    last7Days: chats.filter((chat) => {
      const updatedAt = new Date(chat.updatedAt).getTime();
      return (
        Number.isFinite(updatedAt) &&
        now - updatedAt <= 7 * ONE_DAY_MS &&
        new Date(chat.updatedAt).toDateString() !== todayKey
      );
    }),
    older: chats.filter((chat) => {
      const updatedAt = new Date(chat.updatedAt).getTime();
      return !Number.isFinite(updatedAt) || now - updatedAt > 7 * ONE_DAY_MS;
    }),
  };
}

function formatRange(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const valid = !Number.isNaN(startDate.getTime());
  if (!valid) {
    return `${start} - ${end}`;
  }
  const endValid = !Number.isNaN(endDate.getTime());
  return `${isToday(startDate) ? "Today" : isTomorrow(startDate) ? "Tomorrow" : format(startDate, "EEE, MMM d")} · ${format(startDate, "h:mm")}${endValid ? `–${format(endDate, "h:mm a")}` : format(startDate, " a")}`;
}

function toEditableDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromEditableDateTime(value: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toISOString();
}

function canConfirmProposal(proposal: Proposal) {
  if (proposal.kind === "email") {
    return Boolean(
      proposal.to.trim() && proposal.subject.trim() && proposal.body.trim(),
    );
  }

  return Boolean(
    proposal.summary.trim() &&
    proposal.start &&
    proposal.end &&
    new Date(proposal.end) > new Date(proposal.start),
  );
}

function extractLatestCheckpoint(turns: Turn[]) {
  const userTurn = [...turns].reverse().find((turn) => turn.role === "user");
  return userTurn?.createdAt ?? new Date().toISOString();
}

function toProposalKinds(items: ProposalItem[]) {
  return items.map((item) => ({ kind: item.proposal.kind }));
}

export function AgentPanel({
  embedded = false,
  open,
  operator,
  onClose,
  onOpenThread,
  threadContext,
  contactNames = {},
  onConfirmEmail,
  onConfirmEvent,
  onReviewEvent,
}: AgentPanelProps) {
  const SUGGESTIONS = getDefaultAgentSuggestions({ contactName: threadContext?.sender.split(/\s+/)[0] });
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeChatId, setActiveChatId] = useState(() => uid());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const confirmingRef = useRef(new Set<string>());
  const sendingRef = useRef(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [lastInboxCheckpointAt, setLastInboxCheckpointAt] = useState<
    string | null
  >(null);

  const composerRef = useRef<HTMLDivElement>(null);
  const autoApproveRef = useRef(autoApprove);
  const skipNextSaveRef = useRef(false);
  autoApproveRef.current = autoApprove;

  useEffect(() => {
    if (open && !embedded) {
      composerRef.current?.querySelector("textarea")?.focus();
    }
  }, [open, embedded]);

  useEffect(() => {
    setSavedChats(readSavedChats());
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (turns.length === 0) {
      return;
    }

    const savedChat: SavedChat = {
      id: activeChatId,
      title: buildChatTitle(turns),
      updatedAt: new Date().toISOString(),
      lastInboxCheckpointAt,
      turns,
    };

    setSavedChats((current) => {
      const next = [
        savedChat,
        ...current.filter((chat) => chat.id !== activeChatId),
      ].slice(0, MAX_SAVED_CHATS);
      writeSavedChats(next);
      return next;
    });
  }, [activeChatId, lastInboxCheckpointAt, turns]);

  function updateLastAssistant(mutate: (turn: Turn) => Turn) {
    setTurns((current) => {
      const next = [...current];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role === "assistant") {
          next[i] = mutate(next[i]);
          break;
        }
      }
      return next;
    });
  }

  async function confirmProposal(
    turnId: string,
    proposalId: string,
    incoming?: ProposalItem,
  ) {
    const target =
      incoming ??
      turns
        .find((turn) => turn.id === turnId)
        ?.proposals.find((item) => item.id === proposalId);
    if (
      !target ||
      target.status !== "pending" ||
      confirmingRef.current.has(proposalId)
    )
      return;
    confirmingRef.current.add(proposalId);
    setProposalStatus(turnId, proposalId, "confirming");

    try {
      if (target.proposal.kind === "email") {
        const { to, subject, body, threadId } = target.proposal;
        await onConfirmEmail({ to, subject, body, threadId });
      } else {
        const { summary, start, end, attendees, description, location } =
          target.proposal;
        await onConfirmEvent({
          summary,
          start,
          end,
          attendees,
          description,
          location,
        });
      }
      setProposalStatus(turnId, proposalId, "done");
    } catch (confirmError) {
      const message =
        confirmError instanceof Error ? confirmError.message : "Action failed";
      setProposalStatus(turnId, proposalId, "pending", message);
    } finally {
      confirmingRef.current.delete(proposalId);
    }
  }

  function setProposalStatus(
    turnId: string,
    proposalId: string,
    status: ProposalItem["status"],
    proposalError?: string,
  ) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId
                  ? { ...item, status, error: proposalError }
                  : item,
              ),
            }
          : turn,
      ),
    );
  }

  function setProposalEditing(
    turnId: string,
    proposalId: string,
    editing: boolean,
  ) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId
                  ? {
                      ...item,
                      editing,
                      error: editing ? undefined : item.error,
                    }
                  : item,
              ),
            }
          : turn,
      ),
    );
  }

  function updateProposal(
    turnId: string,
    proposalId: string,
    mutate: (proposal: Proposal) => Proposal,
  ) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId
                  ? {
                      ...item,
                      proposal: mutate(item.proposal),
                      error: undefined,
                    }
                  : item,
              ),
            }
          : turn,
      ),
    );
  }

  function startNewChat() {
    setActiveChatId(uid());
    setTurns([]);
    setInput("");
    setError("");
    setHistoryOpen(false);
    setLastInboxCheckpointAt(null);
    window.setTimeout(
      () => composerRef.current?.querySelector("textarea")?.focus(),
      0,
    );
  }

  function openSavedChat(chat: SavedChat) {
    skipNextSaveRef.current = true;
    setActiveChatId(chat.id);
    setTurns(chat.turns);
    setInput("");
    setError("");
    setHistoryOpen(false);
    setLastInboxCheckpointAt(chat.lastInboxCheckpointAt);
    window.setTimeout(
      () => composerRef.current?.querySelector("textarea")?.focus(),
      0,
    );
  }

  async function send(text: string, context?: AgentChatContext) {
    const trimmed = text.trim();
    if (!trimmed || busy || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setError("");
    setInput("");
    setHistoryOpen(false);

    const history: AgentRequestMessage[] = turns
      .filter((turn) => turn.content.trim())
      .map((turn) => ({ role: turn.role, content: turn.content }));
    const payloadMessages = [
      ...history,
      { role: "user" as const, content: trimmed },
    ];

    const now = new Date().toISOString();
    const assistantId = uid();
    setTurns((current) => [
      ...current,
      {
        id: uid(),
        role: "user",
        content: trimmed,
        tools: [],
        proposals: [],
        createdAt: now,
      },
      {
        id: assistantId,
        role: "assistant",
        content: "",
        tools: [],
        proposals: [],
        createdAt: new Date().toISOString(),
      },
    ]);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/agent", {
        signal: controller.signal,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payloadMessages, context }),
      });

      if (!response.ok || !response.body) {
        const payload: unknown = await response.json().catch(() => null);
        const detail = agentErrorSchema.safeParse(payload);
        throw new Error(
          detail.success
            ? detail.data.error
            : "The assistant is unavailable. Please try again.",
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handle = (event: Record<string, unknown>) => {
        if (event.type === "token" && typeof event.text === "string") {
          const textPart = event.text;
          updateLastAssistant((turn) => ({
            ...turn,
            content: turn.content + textPart,
          }));
        } else if (event.type === "tool" && typeof event.label === "string") {
          const label = event.label;
          updateLastAssistant((turn) => ({
            ...turn,
            tools: [...turn.tools, label],
          }));
        } else if (event.type === "triage") {
          const triage = parseTriageSnapshot(event.result);
          if (triage) updateLastAssistant((turn) => ({ ...turn, triage }));
        } else if (event.type === "proposal" && event.proposal) {
          const item: ProposalItem = {
            id: uid(),
            proposal: event.proposal as Proposal,
            status: "pending",
          };
          updateLastAssistant((turn) => ({
            ...turn,
            proposals: [...turn.proposals, item],
          }));
          if (autoApproveRef.current) {
            void confirmProposal(assistantId, item.id, item);
          }
        } else if (
          event.type === "error" &&
          typeof event.message === "string"
        ) {
          setError(event.message);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const dataLine = rawEvent
            .split("\n")
            .find((line) => line.startsWith("data:"));
          if (dataLine) {
            const json = dataLine.slice(5).trim();
            if (json) {
              try {
                handle(JSON.parse(json));
              } catch {
                // ignore malformed frame
              }
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }

      if (context?.suggestionIntent?.startsWith("triage_")) {
        setLastInboxCheckpointAt(
          extractLatestCheckpoint([
            ...turns,
            {
              id: "checkpoint",
              role: "user",
              content: trimmed,
              tools: [],
              proposals: [],
              createdAt: now,
            },
          ]),
        );
      }
    } catch (sendError) {
      setError(
        controller.signal.aborted
          ? "Response stopped. You can retry when ready."
          : sendError instanceof Error
            ? sendError.message
            : "Agent error",
      );
    } finally {
      setBusy(false);
      sendingRef.current = false;
    }
  }

  const editingProposal = turns.some(turn => turn.proposals.some(item => item.editing));
  const editingEvent = turns.some(turn => turn.proposals.some(item => item.editing && item.proposal.kind === "event"));
  const ownEmail = Object.entries(contactNames).find(([,name]) => name === "you")?.[0];
  const lastTurn = turns.at(-1);
  const workingToolTurn = busy && lastTurn?.tools.length && !lastTurn.proposals.length && !lastTurn.triage ? lastTurn : null;
  const showFollowUps =
    operator.configured &&
    !busy &&
    !error &&
    !lastTurn?.proposals.length &&
    turns.length > 0 &&
    lastTurn?.role === "assistant";
  const groupedChats = getGroupedChats(savedChats);
  const latestAssistant = [...turns]
    .reverse()
    .find((turn) => turn.role === "assistant");
  const latestUser = [...turns].reverse().find((turn) => turn.role === "user");
  const contextualSuggestions: ReturnType<typeof buildContextualSuggestions> = latestAssistant?.triage ? [
    { id: "draft_top_two_replies", label: "Draft the top two replies", family: "draft" },
    { id: "schedule_open_time", label: "Find open time", family: "schedule" },
  ] : buildContextualSuggestions({
    latestUserContent: latestUser?.content,
    latestAssistantContent: latestAssistant?.content,
    toolLabels: latestAssistant?.tools,
    proposals: toProposalKinds(latestAssistant?.proposals ?? []),
  });

  const PanelHeader = embedded ? "header" : DialogHeader;
  const PanelTitle = embedded ? "h2" : DialogTitle;
  const PanelDescription = embedded ? "p" : DialogDescription;
  const content = (
    <>
      <PanelHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4 text-left">
        <div className="min-w-0 space-y-1">
          <PanelTitle className="flex items-center gap-2">
            {!embedded && <DoopBotIcon size={21} />}
            {embedded ? "Assistant" : "Ask your inbox"}
          </PanelTitle>
          {!embedded && (
            <PanelDescription className="truncate">
              {operator.label}
              {operator.model ? ` · ${operator.model}` : ""}
            </PanelDescription>
          )}
        </div>
        {!embedded && (
          <div className="flex shrink-0 items-center gap-1.5 pr-8">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="New chat"
              title="New chat"
              disabled={busy}
              onClick={startNewChat}
            >
              <DoopNewChatIcon />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="Chat history"
              disabled={busy}
              title="Chat history"
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <DoopHistoryIcon />
            </Button>
            <DialogClose asChild><Button type="button" size="icon-sm" variant="ghost" aria-label="Close"><XIcon size={16} /></Button></DialogClose>
          </div>
        )}
        {embedded && (
          <button type="button" disabled={busy} onClick={startNewChat}>
            New conversation
          </button>
        )}
      </PanelHeader>
      {!embedded && (
        <div className="doop-agent-permission">
          <Switch
            checked={autoApprove}
            onCheckedChange={(checked) =>
              checked ? setApprovalOpen(true) : setAutoApprove(false)
            }
            size="sm"
            aria-label="Auto-approve actions"
          />
          <span>Send emails and create events without asking</span>
          <span>{autoApprove ? "On" : "Off"}</span>
        </div>
      )}

      <AIConversation
        className="doop-chat-scroll min-h-0 flex-1"
        followKey={turns.filter((turn) => turn.role === "user").length}
        contentKey={
          turns
            .map(
              (turn) =>
                turn.content.length +
                turn.tools.length +
                turn.proposals.length +
                (turn.triage?.threads.length ?? 0),
            )
            .join(":") + `:${busy}:${error}`
        }
      >
        {approvalOpen ? (
          <div className="doop-approval-content">
            <AIApproval
              key={String(approvalOpen)}
              className="doop-approval-warning"
              question="Action proposals without confirmation?"
              options={[
                { id: "enable", label: "Turn on auto-approve" },
                { id: "review", label: "Keep asking me" },
              ]}
              onDecide={(option) => {
                setAutoApprove(option.id === "enable");
                setApprovalOpen(false);
              }}
            >
              <p>
                Drafted emails will be sent and proposed events will be created
                the moment the agent finishes writing them. You will not be
                asked first, and a sent email cannot be unsent.
              </p>
              <p>Turn this on only for work you would send unattended.</p>
            </AIApproval>
            <p className="doop-approval-setting">
              Current setting <span>Ask before every action</span>
            </p>
            <p>This confirmation appears before the switch is enabled.</p>
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5 doop-agent-conversation-content">
            {historyOpen && (
              <DoopAIHistory
                groups={[
                  { label: "Today", chats: groupedChats.today },
                  { label: "Last 7 days", chats: groupedChats.last7Days },
                  { label: "Older", chats: groupedChats.older },
                ]}
                activeId={activeChatId}
                onSelect={(id) => {
                  const chat = savedChats.find((chat) => chat.id === id);
                  if (chat) openSavedChat(chat);
                }}
                onNew={startNewChat}
                onClose={() => setHistoryOpen(false)}
              />
            )}

            {!historyOpen &&
              (turns.length === 0 ? (
                <DoopAIWelcome
                  disabled={!operator.configured}
                  suggestions={SUGGESTIONS}
                  onSelect={(suggestion) =>
                    void send(suggestion.label, {
                      suggestionIntent: [
                        ...SUGGESTIONS,
                        ...contextualSuggestions,
                      ].find((item) => item.id === suggestion.id)?.id,
                      checkpointAt:
                        suggestion.id === "triage_changes_since_check"
                          ? lastInboxCheckpointAt
                          : undefined,
                    })
                  }
                />
              ) : (
                turns.filter(turn => turn.content.trim() || turn.tools.length || turn.proposals.length || turn.triage).filter(turn => !editingEvent || turn.proposals.some(item => item.editing && item.proposal.kind === "event")).map((turn) => (
                  <div
                    key={turn.id}
                    className={cn(
                      "flex flex-col gap-2",
                      turn.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {turn.content.trim() && !editingEvent && (!embedded || turn.role === "user") && turn !== workingToolTurn && (
                      <AIMessage from={turn.role} className={turn.triage ? "max-w-full doop-triage-intro" : "max-w-full"}>
                        {turn.triage && <DoopBotIcon size={16} />}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {turn.content}
                        </p>
                      </AIMessage>
                    )}

                    {turn === workingToolTurn && <DoopAIToolActivity
                      heading={turn.content.trim() || "Preparing your next steps"}
                      tools={turn.tools}
                      progressLabel={/draft|repl/i.test(latestUser?.content ?? "") ? /\b(two|2)\b/i.test(latestUser?.content ?? "") ? "Writing two reply drafts…" : "Writing your reply draft…" : "Preparing your response…"}
                      threadContext={threadContext}
                    />}
                    {turn.tools.length > 0 && !editingProposal && !turn.triage && turn !== workingToolTurn && (
                      <div className="w-full space-y-2">
                        {embedded ? <p className="doop-embedded-tools">{turn.tools.map((tool, index) => <span key={`${index}-${tool}`}>{tool}</span>)}</p> : <AIToolCall name={turn.tools.join(" · ")} status="success" />}
                      </div>
                    )}

                    {embedded && turn.role === "assistant" && turn.content.trim() && !editingEvent && <AIMessage from="assistant"><p>{turn.content}</p></AIMessage>}

                    {turn.triage && (
                      <AgentTriageCard
                        result={turn.triage}
                        onOpenThread={onOpenThread}
                      />
                    )}
                    {turn.triage && turn.tools.length > 0 && <AIToolCall name={turn.tools.at(-1) ?? ""} />}
                    {turn.proposals.filter(item => !editingEvent || item.editing).map((item, proposalIndex) => (
                      <Collapsible.Root
                        key={item.id}
                        defaultOpen={proposalIndex === 0}
                        className="w-full"
                      >
                        {proposalIndex > 0 && (
                          <Collapsible.Trigger className="doop-next-proposal">
                            <span className="doop-next-proposal-heading"><span>{item.proposal.kind === "email" ? <MailIcon size={16} /> : <CalendarIcon size={16} />}<strong>{item.proposal.kind === "email" ? "Second draft ready" : "Another event ready"}</strong></span><ChevronRightIcon size={16} /></span>
                            <span><br />{item.proposal.kind === "email" ? `${contactNames[item.proposal.to.toLowerCase()] ?? item.proposal.to} · ${item.proposal.subject}` : item.proposal.summary}</span>
                          </Collapsible.Trigger>
                        )}
                        <Collapsible.Content className="doop-proposal-collapse">
                          {embedded && item.proposal.kind === "event" && !item.editing ? (
                            <section className="doop-embedded-event" aria-label="Meeting proposal"><div>
                              <p>Meeting proposal</p>
                              <h3>{item.proposal.summary}</h3>
                              <p>{formatRange(item.proposal.start, item.proposal.end)}<br />{(item.proposal.attendees ?? "").split(",").map(email => contactNames[email.trim().toLowerCase()] ?? email.trim()).filter(name => name && name !== "you").join(", ")}</p>
                              <Button type="button" onClick={() => { if (item.proposal.kind === "event") { if (onReviewEvent) onReviewEvent(item.proposal); else setProposalEditing(turn.id, item.id, true); } }}><span>Review event</span></Button>
                            </div></section>
                          ) : <AIArtifact
                            title={
                              item.proposal.kind === "email"
                                ? "Reply draft"
                                : "Meeting proposal"
                            }
                            showHeader={false}
                            className="doop-agent-proposal w-full bg-card"
                            preview={
                              <div
                                className="doop-proposal-body"
                                data-proposal-kind={item.proposal.kind}
                                onMouseDownCapture={(event) => {
                                  const button =
                                    event.target instanceof Element
                                      ? event.target.closest("button")
                                      : null;
                                  if (button) {
                                    event.preventDefault();
                                    button.focus({ preventScroll: true });
                                  }
                                }}
                              >
                                <div className="doop-proposal-heading">
                                  {item.proposal.kind === "email" ? (
                                    <MailIcon className="size-4" />
                                  ) : (
                                    <CalendarIcon className="size-4" />
                                  )}
                                  {item.proposal.kind === "email"
                                    ? item.editing ? "Edit draft" : "Draft email"
                                    : "Proposed event"}
                                  <span>
                                    {item.status === "done"
                                      ? item.proposal.kind === "email"
                                        ? "Sent"
                                        : "Created"
                                      : item.status === "cancelled"
                                        ? "Dismissed"
                                        : item.proposal.kind === "email"
                                          ? "Not sent"
                                          : "Awaiting review"}
                                  </span>
                                </div>

                                {item.proposal.kind === "email" ? (
                                  item.editing ? (
                                    <div className="space-y-3">
                                      <div className="space-y-1.5">
                                        <Label
                                          className="text-xs text-muted-foreground"
                                          htmlFor={`proposal-to-${item.id}`}
                                        >
                                          To
                                        </Label>
                                        <Input
                                          id={`proposal-to-${item.id}`}
                                          value={item.proposal.to}
                                          onChange={(event) =>
                                            updateProposal(
                                              turn.id,
                                              item.id,
                                              (proposal) =>
                                                proposal.kind === "email"
                                                  ? {
                                                      ...proposal,
                                                      to: event.target.value,
                                                    }
                                                  : proposal,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label
                                          className="text-xs text-muted-foreground"
                                          htmlFor={`proposal-subject-${item.id}`}
                                        >
                                          Subject
                                        </Label>
                                        <Input
                                          id={`proposal-subject-${item.id}`}
                                          value={item.proposal.subject}
                                          onChange={(event) =>
                                            updateProposal(
                                              turn.id,
                                              item.id,
                                              (proposal) =>
                                                proposal.kind === "email"
                                                  ? {
                                                      ...proposal,
                                                      subject:
                                                        event.target.value,
                                                    }
                                                  : proposal,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label
                                          className="text-xs text-muted-foreground"
                                          htmlFor={`proposal-body-${item.id}`}
                                        >
                                          Body
                                        </Label>
                                        <Textarea
                                          id={`proposal-body-${item.id}`}
                                          rows={6}
                                          value={item.proposal.body}
                                          onChange={(event) =>
                                            updateProposal(
                                              turn.id,
                                              item.id,
                                              (proposal) =>
                                                proposal.kind === "email"
                                                  ? {
                                                      ...proposal,
                                                      body: event.target.value,
                                                    }
                                                  : proposal,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <strong className="block text-sm">
                                        {item.proposal.subject ||
                                          "(no subject)"}
                                      </strong>
                                      <p className="text-xs text-muted-foreground">
                                        To {item.proposal.to}
                                      </p>
                                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                                        {item.proposal.body}
                                      </p>
                                    </>
                                  )
                                ) : item.editing ? (
                                  <div className="space-y-3">
                                    <div className="space-y-1.5">
                                      <Label
                                        className="text-xs text-muted-foreground"
                                        htmlFor={`proposal-summary-${item.id}`}
                                      >
                                        Title
                                      </Label>
                                      <Input
                                        id={`proposal-summary-${item.id}`}
                                        value={item.proposal.summary}
                                        onChange={(event) =>
                                          updateProposal(
                                            turn.id,
                                            item.id,
                                            (proposal) =>
                                              proposal.kind === "event"
                                                ? {
                                                    ...proposal,
                                                    summary: event.target.value,
                                                  }
                                                : proposal,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                      <div className="space-y-1.5">
                                        <Label
                                          className="text-xs text-muted-foreground"
                                          htmlFor={`proposal-start-${item.id}`}
                                        >
                                          Start
                                        </Label>
                                        <DoopDateTimeInput
                                          id={`proposal-start-${item.id}`}

                                          value={toEditableDateTime(
                                            item.proposal.start,
                                          )}
                                          onChange={(event) =>
                                            updateProposal(
                                              turn.id,
                                              item.id,
                                              (proposal) =>
                                                proposal.kind === "event"
                                                  ? {
                                                      ...proposal,
                                                      start:
                                                        fromEditableDateTime(
                                                          event.target.value,
                                                        ),
                                                    }
                                                  : proposal,
                                            )
                                          }
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label
                                          className="text-xs text-muted-foreground"
                                          htmlFor={`proposal-end-${item.id}`}
                                        >
                                          End
                                        </Label>
                                        <DoopDateTimeInput
                                          id={`proposal-end-${item.id}`}

                                          value={toEditableDateTime(
                                            item.proposal.end,
                                          )}
                                          onChange={(event) =>
                                            updateProposal(
                                              turn.id,
                                              item.id,
                                              (proposal) =>
                                                proposal.kind === "event"
                                                  ? {
                                                      ...proposal,
                                                      end: fromEditableDateTime(
                                                        event.target.value,
                                                      ),
                                                    }
                                                  : proposal,
                                            )
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label
                                        className="text-xs text-muted-foreground"
                                        htmlFor={`proposal-attendees-${item.id}`}
                                      >
                                        Attendees
                                      </Label>
                                      <Input
                                        id={`proposal-attendees-${item.id}`}
                                        value={(item.proposal.attendees ?? "").split(",").map(value => value.trim().toLowerCase() === ownEmail ? "you" : value.trim()).join(", ")}
                                        onChange={(event) =>
                                          updateProposal(
                                            turn.id,
                                            item.id,
                                            (proposal) =>
                                              proposal.kind === "event"
                                                ? {
                                                    ...proposal,
                                                    attendees:
                                                      event.target.value.split(",").map(value => value.trim().toLowerCase() === "you" && ownEmail ? ownEmail : value.trim()).join(", "),
                                                  }
                                                : proposal,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label
                                        className="text-xs text-muted-foreground"
                                        htmlFor={`proposal-location-${item.id}`}
                                      >
                                        Location
                                      </Label>
                                      <Input
                                        id={`proposal-location-${item.id}`}
                                        value={item.proposal.location ?? ""}
                                        onChange={(event) =>
                                          updateProposal(
                                            turn.id,
                                            item.id,
                                            (proposal) =>
                                              proposal.kind === "event"
                                                ? {
                                                    ...proposal,
                                                    location:
                                                      event.target.value,
                                                  }
                                                : proposal,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label
                                        className="text-xs text-muted-foreground"
                                        htmlFor={`proposal-description-${item.id}`}
                                      >
                                        Description
                                      </Label>
                                      <Textarea
                                        id={`proposal-description-${item.id}`}
                                        rows={4}
                                        value={item.proposal.description ?? ""}
                                        onChange={(event) =>
                                          updateProposal(
                                            turn.id,
                                            item.id,
                                            (proposal) =>
                                              proposal.kind === "event"
                                                ? {
                                                    ...proposal,
                                                    description:
                                                      event.target.value,
                                                  }
                                                : proposal,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <strong className="block text-sm">
                                      {item.proposal.summary}
                                    </strong>
                                    <p className="doop-event-detail text-xs text-primary"><ClockIcon size={16} />
                                      {formatRange(
                                        item.proposal.start,
                                        item.proposal.end,
                                      )}
                                    </p>
                                    {item.proposal.attendees && (
                                      <p className="doop-event-detail text-xs text-muted-foreground"><UsersIcon size={16} />
                                        {item.proposal.attendees.split(",").map(value => contactNames[value.trim().toLowerCase()] ?? value.trim()).join(" and ")}
                                      </p>
                                    )}
                                    {item.proposal.location && (
                                      <p className="doop-event-detail"><MapPinIcon size={16} />{item.proposal.location}</p>
                                    )}
                                    {item.proposal.description && (
                                      <p className="text-muted-foreground">
                                        {item.proposal.description}
                                      </p>
                                    )}
                                  </>
                                )}

                                {item.error && (
                                  <p className="text-xs text-destructive">
                                    {item.error}
                                  </p>
                                )}

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {item.status === "done" ? (
                                    <p
                                      role="status"
                                      className="text-sm text-muted-foreground"
                                    >
                                      {item.proposal.kind === "email"
                                        ? "Email sent."
                                        : "Event created."}
                                    </p>
                                  ) : item.status === "cancelled" ? (
                                    <Badge
                                      variant="outline"
                                      className="motion-enter-soft text-muted-foreground"
                                    >
                                      Dismissed
                                    </Badge>
                                  ) : (
                                    <>
                                      <Button
                                        type="button"
                                        size="sm"
                                        disabled={
                                          item.status === "confirming" ||
                                          !canConfirmProposal(item.proposal)
                                        }
                                        onClick={() =>
                                          void confirmProposal(turn.id, item.id)
                                        }
                                      >
                                        <span className="doop-accent-label">{item.status === "confirming" ? (
                                          <>
                                            <Loader2Icon className="size-4 animate-spin" />
                                            Working...
                                          </>
                                        ) : item.proposal.kind === "email" ? (
                                          "Send reply"
                                        ) : (
                                          "Create event"
                                        )}</span>
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={item.status === "confirming"}
                                        onClick={() =>
                                          setProposalEditing(
                                            turn.id,
                                            item.id,
                                            !item.editing,
                                          )
                                        }
                                      >
                                        <PencilIcon className="size-4" />
                                        {item.editing ? "Done editing" : "Edit"}
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={item.status === "confirming"}
                                        onClick={() =>
                                          setProposalStatus(
                                            turn.id,
                                            item.id,
                                            "cancelled",
                                          )
                                        }
                                      >
                                        <XIcon className="size-4" />
                                        Dismiss
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            }
                          />}
                        </Collapsible.Content>
                      </Collapsible.Root>
                    ))}
                    {!busy && turn.proposals.length > 0 && !turn.proposals.some(item => item.editing) && (
                      <p className="doop-proposal-note">{turn.proposals.some(item => item.status === "done") ? "" : embedded ? "Nothing has been sent or created." : turn.proposals[0].proposal.kind === "email" ? "Review each draft before sending." : "No event has been created yet."}</p>
                    )}
                  </div>
                ))
              ))}

            {showFollowUps && !historyOpen && (
              <DoopAIWelcomeSuggestions
                className={latestAssistant?.triage ? "doop-triage-suggestions" : undefined}
                suggestions={contextualSuggestions}
                onSelect={(suggestion) =>
                  void send(suggestion.label, {
                    suggestionIntent: [
                      ...SUGGESTIONS,
                      ...contextualSuggestions,
                    ].find((item) => item.id === suggestion.id)?.id,
                    checkpointAt:
                      suggestion.id === "triage_changes_since_check"
                        ? lastInboxCheckpointAt
                        : undefined,
                  })
                }
              />
            )}

            {busy && !workingToolTurn && (
              <div className="motion-enter-soft flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                />
                Thinking...
              </div>
            )}
            {error && (
              <section className="doop-agent-retry" role="alert"><div className="doop-retry-content">
                <h3><AlertTriangleIcon size={16} />The assistant could not finish</h3>
                <p>{error}</p>
                <div>
                  <Button
                    aria-label="Retry response"
                    disabled={busy}
                    onClick={() => {
                      const previous = [...turns]
                        .reverse()
                        .find((turn) => turn.role === "user");
                      if (previous) void send(previous.content);
                    }}
                  >
                    <span className="doop-accent-label">Try again</span>
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      const previous = [...turns]
                        .reverse()
                        .find((turn) => turn.role === "user");
                      setInput(previous?.content ?? "");
                      composerRef.current?.querySelector("textarea")?.focus();
                    }}
                  >
                    <PencilIcon size={16} />Edit message
                  </Button>
                </div>
                <p>No email was sent and no calendar event was created.</p>
              </div></section>
            )}
            {error && threadContext && <button type="button" className="doop-retry-context" onClick={() => onOpenThread?.(threadContext.threadId)}>
              <MailIcon size={16} aria-hidden="true" /><span className="doop-source-result-details"><strong>{threadContext.sender}</strong><small>{threadContext.subject} · context preserved</small></span><ArrowUpRightIcon size={15} />
            </button>}
          </div>
        )}
      </AIConversation>
      <div ref={composerRef} className="doop-agent-composer">
        <AIPromptInput
          aria-label="Message your assistant"
          value={input}
          onValueChange={setInput}
          state={busy ? "streaming" : "idle"}
          disabled={!operator.configured}
          placeholder={
            operator.configured
              ? embedded ? "Ask about your inbox or calendar…" : "Message the agent…"
              : "Your assistant is not available yet"
          }
          onSubmit={(value) => void send(value)}
          onStop={() => abortRef.current?.abort()}
        />
      </div>
    </>
  );
  if (embedded)
    return (
      <aside className="dashboard-embedded-assistant" aria-label="Assistant">
        {content}
      </aside>
    );
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent showCloseButton={false} className="doop-modal doop-ai-panel">
        {content}
      </DialogContent>
    </Dialog>
  );
}
