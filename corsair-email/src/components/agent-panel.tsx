"use client";

import {
  AgentTriageCard,
  parseTriageSnapshot,
  type TriageSnapshot,
} from "@/components/agent-triage-card";
import { DoopAIWelcome } from "@/components/doop/ai-welcome";
import AIApproval from "@/components/smoothui/ai-approval";
import AIArtifact from "@/components/smoothui/ai-artifact";
import AIConversation from "@/components/smoothui/ai-conversation";
import AILoader from "@/components/smoothui/ai-loader";
import AIMessage from "@/components/smoothui/ai-message";
import AIPromptInput from "@/components/smoothui/ai-prompt-input";
import AISuggestions from "@/components/smoothui/ai-suggestions";
import AIToolCall from "@/components/smoothui/ai-tool-call";
import { Collapsible } from "@animate-ui/react/primitives/radix-ui";
import { format } from "date-fns";
import {
  BotIcon,
  CalendarIcon,
  Clock3Icon,
  Loader2Icon,
  MailIcon,
  MessageSquarePlusIcon,
  PencilIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  buildContextualSuggestions,
  getDefaultAgentSuggestions,
} from "@/lib/agent-suggestions";
import type { AgentChatContext, ComposeInput, EventInput } from "@/lib/types";
import { cn } from "@/lib/utils";

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
  onConfirmEmail: (input: ComposeInput) => Promise<void>;
  onConfirmEvent: (input: EventInput) => Promise<void>;
};

const SUGGESTIONS = getDefaultAgentSuggestions();

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
  return `${format(startDate, "EEE MMM d, h:mm a")}${endValid ? ` - ${format(endDate, "h:mm a")}` : ""}`;
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
  onConfirmEmail,
  onConfirmEvent,
}: AgentPanelProps) {
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
    if (open) {
      composerRef.current?.querySelector("textarea")?.focus();
    }
  }, [open]);

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
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Agent request failed (${response.status})`);
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

  const lastTurn = turns.at(-1);
  const showFollowUps =
    operator.configured &&
    !busy &&
    turns.length > 0 &&
    lastTurn?.role === "assistant";
  const groupedChats = getGroupedChats(savedChats);
  const latestAssistant = [...turns]
    .reverse()
    .find((turn) => turn.role === "assistant");
  const latestUser = [...turns].reverse().find((turn) => turn.role === "user");
  const contextualSuggestions = buildContextualSuggestions({
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
            {!embedded && <BotIcon className="size-5" />}
            {embedded ? "Assistant" : "Ask your inbox"}
          </PanelTitle>
          {!embedded && (
            <PanelDescription className="truncate">
              {operator.label}
              {operator.model ? ` Â· ${operator.model}` : ""}
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
              <MessageSquarePlusIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={historyOpen ? "secondary" : "ghost"}
              aria-label="Chat history"
              disabled={busy}
              title="Chat history"
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <Clock3Icon className="size-4" />
            </Button>
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
        className="min-h-0 flex-1"
        contentKey={turns
          .map(
            (turn) =>
              turn.content.length +
              turn.tools.length +
              turn.proposals.length +
              (turn.triage?.threads.length ?? 0),
          )
          .join(":")}
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
              <div className="doop-agent-history motion-enter">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Clock3Icon className="size-4 text-primary" />
                    Your chats
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    onClick={() => setHistoryOpen(false)}
                  >
                    Close
                  </Button>
                </div>
                {savedChats.length > 0 ? (
                  <div className="space-y-4">
                    {[
                      ["Today", groupedChats.today],
                      ["Last 7 days", groupedChats.last7Days],
                      ["Older", groupedChats.older],
                    ].map(([label, chats]) =>
                      (chats as SavedChat[]).length > 0 ? (
                        <section key={label as string} className="space-y-1.5">
                          <h3 className="px-2 text-xs font-medium text-muted-foreground">
                            {label as string}
                          </h3>
                          {(chats as SavedChat[]).map((chat) => (
                            <button
                              key={chat.id}
                              type="button"
                              className={cn(
                                "motion-state flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                                chat.id === activeChatId &&
                                  "bg-accent text-accent-foreground",
                              )}
                              onClick={() => openSavedChat(chat)}
                            >
                              <MailIcon className="size-4 shrink-0 text-primary" />
                              <span className="min-w-0 flex-1 truncate">
                                {chat.title}
                              </span>
                            </button>
                          ))}
                        </section>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Chats you start will be saved here on this device.
                  </p>
                )}
              </div>
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
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={cn(
                      "flex flex-col gap-2",
                      turn.role === "user" ? "items-end" : "items-start",
                    )}
                  >
                    {turn.content.trim() && (
                      <AIMessage
                        from={turn.role}
                        copyText={turn.content}
                        className="max-w-full"
                        bubble={turn.role === "user"}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {turn.content}
                        </p>
                      </AIMessage>
                    )}

                    {turn.tools.length > 0 && (
                      <div className="w-full space-y-2">
                        {turn.tools.map((tool, index) => (
                          <AIToolCall
                            key={`${turn.id}-tool-${index}`}
                            className="doop-agent-tool"
                            name={tool}
                            status={
                              busy &&
                              turn === turns.at(-1) &&
                              index === turn.tools.length - 1
                                ? "running"
                                : "success"
                            }
                          />
                        ))}
                      </div>
                    )}

                    {turn.triage && (
                      <AgentTriageCard
                        result={turn.triage}
                        onOpenThread={onOpenThread}
                      />
                    )}
                    {turn.proposals.map((item, proposalIndex) => (
                      <Collapsible.Root
                        key={item.id}
                        defaultOpen={proposalIndex === 0}
                        className="w-full"
                      >
                        {proposalIndex > 0 && (
                          <Collapsible.Trigger className="mb-2 w-full rounded-lg border border-border px-4 py-3 text-left text-sm">
                            {item.proposal.kind === "email"
                              ? item.proposal.subject || "Another reply draft"
                              : item.proposal.summary ||
                                "Another meeting proposal"}
                          </Collapsible.Trigger>
                        )}
                        <Collapsible.Content>
                          <AIArtifact
                            title={
                              item.proposal.kind === "email"
                                ? "Reply draft"
                                : "Meeting proposal"
                            }
                            showHeader={false}
                            className="doop-agent-proposal w-full bg-card"
                            preview={
                              <div className="doop-proposal-body" onMouseDownCapture={event=>{const button=(event.target as HTMLElement).closest("button");if(button){event.preventDefault();button.focus({preventScroll:true});}}}>
                                <div className="doop-proposal-heading">
                                  {item.proposal.kind === "email" ? (
                                    <MailIcon className="size-3.5" />
                                  ) : (
                                    <CalendarIcon className="size-3.5" />
                                  )}
                                  {item.proposal.kind === "email"
                                    ? "Draft email"
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
                                          rows={8}
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
                                        <Input
                                          id={`proposal-start-${item.id}`}
                                          type="datetime-local"
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
                                        <Input
                                          id={`proposal-end-${item.id}`}
                                          type="datetime-local"
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
                                        value={item.proposal.attendees ?? ""}
                                        onChange={(event) =>
                                          updateProposal(
                                            turn.id,
                                            item.id,
                                            (proposal) =>
                                              proposal.kind === "event"
                                                ? {
                                                    ...proposal,
                                                    attendees:
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
                                        rows={6}
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
                                    <p className="text-xs text-primary">
                                      {formatRange(
                                        item.proposal.start,
                                        item.proposal.end,
                                      )}
                                    </p>
                                    {item.proposal.attendees && (
                                      <p className="text-xs text-muted-foreground">
                                        With {item.proposal.attendees}
                                      </p>
                                    )}
                                    {item.proposal.location && (
                                      <p>{item.proposal.location}</p>
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
                                        {item.status === "confirming" ? (
                                          <>
                                            <Loader2Icon className="size-4 animate-spin" />
                                            Working...
                                          </>
                                        ) : item.proposal.kind === "email" ? (
                                          "Send reply"
                                        ) : (
                                          "Create event"
                                        )}
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
                                        Dismiss
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            }
                          />
                        </Collapsible.Content>
                      </Collapsible.Root>
                    ))}
                  </div>
                ))
              ))}

            {showFollowUps && !historyOpen && (
              <AISuggestions
                className="doop-ai-suggestions"
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

            {busy && (
              <div className="motion-enter-soft flex items-center gap-2 text-sm text-muted-foreground">
                <AILoader variant="dots" />
                Thinking...
              </div>
            )}
            {error && (
              <section className="doop-agent-retry" role="alert">
                <h3>The assistant could not finish</h3>
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
                    Try again
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
                    Edit message
                  </Button>
                </div>
                <p>Your message is saved.</p>
              </section>
            )}
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
              ? "Message the agent..."
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
      <DialogContent className="doop-modal doop-ai-panel">
        {content}
      </DialogContent>
    </Dialog>
  );
}
