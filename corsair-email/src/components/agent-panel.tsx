"use client";

import { format } from "date-fns";
import { useEffect, useRef, useState } from "react";
import {
  CalendarIcon,
  CheckCircle2Icon,
  Clock3Icon,
  Loader2Icon,
  MailIcon,
  MessageSquarePlusIcon,
  PencilIcon,
  SendIcon,
  SparklesIcon,
} from "lucide-react";

import {
  buildContextualSuggestions,
  getDefaultAgentSuggestions,
} from "@/lib/agent-suggestions";
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
import { cn } from "@/lib/utils";
import type {
  AgentChatContext,
  AgentSuggestion,
  ComposeInput,
  EventInput,
} from "@/lib/types";

type EmailProposal = { kind: "email"; to: string; subject: string; body: string; threadId?: string };
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

export type AgentOperator = { configured: boolean; label: string; model: string };

type AgentPanelProps = {
  open: boolean;
  operator: AgentOperator;
  onClose: () => void;
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
  return turns.find((turn) => turn.role === "user" && turn.content.trim())?.content.trim().slice(0, 72) || "New chat";
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
    tools: candidate.tools.filter((item): item is string => typeof item === "string"),
    proposals: candidate.proposals as ProposalItem[],
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
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

      const turns = candidate.turns.map(normalizeTurn).filter((turn): turn is Turn => Boolean(turn));
      return [
        {
          id: candidate.id,
          title: candidate.title,
          updatedAt: candidate.updatedAt,
          lastInboxCheckpointAt:
            typeof candidate.lastInboxCheckpointAt === "string" || candidate.lastInboxCheckpointAt === null
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
    const next = normalizeSavedChats(JSON.parse(window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY) || "[]"));
    if (next.length > 0) {
      return next;
    }

    return normalizeSavedChats(JSON.parse(window.localStorage.getItem(LEGACY_CHAT_HISTORY_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function writeSavedChats(chats: SavedChat[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_SAVED_CHATS)));
}

function getGroupedChats(chats: SavedChat[]) {
  const now = Date.now();
  const today = new Date();
  const todayKey = today.toDateString();

  return {
    today: chats.filter((chat) => new Date(chat.updatedAt).toDateString() === todayKey),
    last7Days: chats.filter((chat) => {
      const updatedAt = new Date(chat.updatedAt).getTime();
      return Number.isFinite(updatedAt) && now - updatedAt <= 7 * ONE_DAY_MS && new Date(chat.updatedAt).toDateString() !== todayKey;
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
    return Boolean(proposal.to.trim() && proposal.subject.trim() && proposal.body.trim());
  }

  return Boolean(proposal.summary.trim() && proposal.start && proposal.end);
}

function extractLatestCheckpoint(turns: Turn[]) {
  const userTurn = [...turns].reverse().find((turn) => turn.role === "user");
  return userTurn?.createdAt ?? new Date().toISOString();
}

function toProposalKinds(items: ProposalItem[]) {
  return items.map((item) => ({ kind: item.proposal.kind }));
}

export function AgentPanel({ open, operator, onClose, onConfirmEmail, onConfirmEvent }: AgentPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeChatId, setActiveChatId] = useState(() => uid());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [lastInboxCheckpointAt, setLastInboxCheckpointAt] = useState<string | null>(null);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const autoApproveRef = useRef(autoApprove);
  const skipNextSaveRef = useRef(false);
  autoApproveRef.current = autoApprove;

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    setSavedChats(readSavedChats());
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [turns]);

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
      const next = [savedChat, ...current.filter((chat) => chat.id !== activeChatId)].slice(0, MAX_SAVED_CHATS);
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

  async function confirmProposal(turnId: string, proposalId: string) {
    let target: ProposalItem | undefined;
    setTurns((current) =>
      current.map((turn) => {
        if (turn.id !== turnId) {
          return turn;
        }
        return {
          ...turn,
          proposals: turn.proposals.map((item) => {
            if (item.id !== proposalId) {
              return item;
            }
            target = item;
            return { ...item, status: "confirming", error: undefined };
          }),
        };
      }),
    );

    if (!target) {
      return;
    }

    try {
      if (target.proposal.kind === "email") {
        const { to, subject, body, threadId } = target.proposal;
        await onConfirmEmail({ to, subject, body, threadId });
      } else {
        const { summary, start, end, attendees, description, location } = target.proposal;
        await onConfirmEvent({ summary, start, end, attendees, description, location });
      }
      setProposalStatus(turnId, proposalId, "done");
    } catch (confirmError) {
      const message = confirmError instanceof Error ? confirmError.message : "Action failed";
      setProposalStatus(turnId, proposalId, "pending", message);
    }
  }

  function setProposalStatus(turnId: string, proposalId: string, status: ProposalItem["status"], proposalError?: string) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId ? { ...item, status, error: proposalError } : item,
              ),
            }
          : turn,
      ),
    );
  }

  function setProposalEditing(turnId: string, proposalId: string, editing: boolean) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId ? { ...item, editing, error: editing ? undefined : item.error } : item,
              ),
            }
          : turn,
      ),
    );
  }

  function updateProposal(turnId: string, proposalId: string, mutate: (proposal: Proposal) => Proposal) {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              proposals: turn.proposals.map((item) =>
                item.id === proposalId ? { ...item, proposal: mutate(item.proposal), error: undefined } : item,
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
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  function openSavedChat(chat: SavedChat) {
    skipNextSaveRef.current = true;
    setActiveChatId(chat.id);
    setTurns(chat.turns);
    setInput("");
    setError("");
    setHistoryOpen(false);
    setLastInboxCheckpointAt(chat.lastInboxCheckpointAt);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function send(text: string, context?: AgentChatContext) {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }

    setError("");
    setInput("");
    setHistoryOpen(false);

    const history: AgentRequestMessage[] = turns
      .filter((turn) => turn.content.trim())
      .map((turn) => ({ role: turn.role, content: turn.content }));
    const payloadMessages = [...history, { role: "user" as const, content: trimmed }];

    const now = new Date().toISOString();
    const assistantId = uid();
    setTurns((current) => [
      ...current,
      { id: uid(), role: "user", content: trimmed, tools: [], proposals: [], createdAt: now },
      { id: assistantId, role: "assistant", content: "", tools: [], proposals: [], createdAt: new Date().toISOString() },
    ]);
    setBusy(true);

    try {
      const response = await fetch("/api/agent", {
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
          updateLastAssistant((turn) => ({ ...turn, content: turn.content + textPart }));
        } else if (event.type === "tool" && typeof event.label === "string") {
          const label = event.label;
          updateLastAssistant((turn) => ({ ...turn, tools: [...turn.tools, label] }));
        } else if (event.type === "proposal" && event.proposal) {
          const item: ProposalItem = { id: uid(), proposal: event.proposal as Proposal, status: "pending" };
          updateLastAssistant((turn) => ({ ...turn, proposals: [...turn.proposals, item] }));
          if (autoApproveRef.current) {
            void confirmProposal(assistantId, item.id);
          }
        } else if (event.type === "error" && typeof event.message === "string") {
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
          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"));
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
        setLastInboxCheckpointAt(extractLatestCheckpoint([...turns, { id: "checkpoint", role: "user", content: trimmed, tools: [], proposals: [], createdAt: now }]));
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Agent error");
    } finally {
      setBusy(false);
    }
  }

  const lastTurn = turns.at(-1);
  const showFollowUps = operator.configured && !busy && turns.length > 0 && lastTurn?.role === "assistant";
  const groupedChats = getGroupedChats(savedChats);
  const latestAssistant = [...turns].reverse().find((turn) => turn.role === "assistant");
  const latestUser = [...turns].reverse().find((turn) => turn.role === "user");
  const contextualSuggestions = buildContextualSuggestions({
    latestUserContent: latestUser?.content,
    latestAssistantContent: latestAssistant?.content,
    toolLabels: latestAssistant?.tools,
    proposals: toProposalKinds(latestAssistant?.proposals ?? []),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="flex h-[min(80dvh,680px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="flex-row items-start justify-between gap-4 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 space-y-1">
            <DialogTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              Ask your inbox
            </DialogTitle>
            <DialogDescription className="truncate">
              {operator.label}
              {operator.model ? ` · ${operator.model}` : ""} — you confirm every action.
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pr-8">
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label="New chat"
              title="New chat"
              disabled={busy && turns.length === 0}
              onClick={startNewChat}
            >
              <MessageSquarePlusIcon className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant={historyOpen ? "secondary" : "ghost"}
              aria-label="Chat history"
              title="Chat history"
              aria-pressed={historyOpen}
              onClick={() => setHistoryOpen((value) => !value)}
            >
              <Clock3Icon className="size-4" />
            </Button>
            <Label className="ml-2 flex cursor-pointer items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} size="sm" />
              Auto-approve
            </Label>
          </div>
        </DialogHeader>

        <div ref={transcriptRef} className="scroll-area-thin flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {historyOpen && (
            <div className="motion-enter rounded-lg border border-border bg-card p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3Icon className="size-4 text-primary" />
                  Your chats
                </div>
                <Button type="button" size="xs" variant="ghost" onClick={() => setHistoryOpen(false)}>
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
                        <h3 className="px-2 text-xs font-medium text-muted-foreground">{label as string}</h3>
                        {(chats as SavedChat[]).map((chat) => (
                          <button
                            key={chat.id}
                            type="button"
                            className={cn(
                              "motion-state flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                              chat.id === activeChatId && "bg-accent text-accent-foreground",
                            )}
                            onClick={() => openSavedChat(chat)}
                          >
                            <MailIcon className="size-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate">{chat.title}</span>
                          </button>
                        ))}
                      </section>
                    ) : null,
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chats you start will be saved here on this device.</p>
              )}
            </div>
          )}

          {turns.length === 0 ? (
            operator.configured ? (
              <div className="motion-enter-soft space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Try one of these
                </p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    className="motion-state w-full rounded-md border border-border bg-card px-3 py-2 text-left text-sm outline-none hover:border-primary/30 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() =>
                      void send(suggestion.label, {
                        suggestionIntent: suggestion.id,
                        checkpointAt: suggestion.id === "triage_changes_since_check" ? lastInboxCheckpointAt : undefined,
                      })
                    }
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="motion-enter-soft rounded-lg border border-border bg-muted/50 p-4">
                <p className="text-sm font-medium">Agent Chat isn&apos;t configured yet.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Set <code className="font-mono">AI_BASE_URL</code>,{" "}
                  <code className="font-mono">AI_API_KEY</code>, and{" "}
                  <code className="font-mono">AI_MODEL</code> in{" "}
                  <code className="font-mono">corsair-email/.env.local</code> (any OpenAI-compatible
                  provider) and restart.
                </p>
              </div>
            )
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={cn("motion-enter-soft flex flex-col gap-2", turn.role === "user" ? "items-end" : "items-start")}
              >
                {turn.content.trim() && (
                  <div
                    className={cn(
                      "motion-state max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                      turn.role === "user"
                        ? "rounded-br-sm bg-primary text-primary-foreground"
                        : "rounded-bl-sm bg-muted text-foreground",
                    )}
                  >
                    {turn.content}
                  </div>
                )}

                {turn.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {turn.tools.map((tool, index) => (
                      <Badge key={`${turn.id}-tool-${index}`} variant="secondary" className="font-normal">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                )}

                {turn.proposals.map((item) => (
                  <div
                    key={item.id}
                    className="motion-enter w-full max-w-[85%] space-y-2 rounded-lg border border-border bg-card p-3.5 shadow-elevation-1"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      {item.proposal.kind === "email" ? (
                        <MailIcon className="size-3.5" />
                      ) : (
                        <CalendarIcon className="size-3.5" />
                      )}
                      {item.proposal.kind === "email" ? "Draft email" : "Proposed event"}
                    </div>

                    {item.proposal.kind === "email" ? (
                      item.editing ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-to-${item.id}`}>
                              To
                            </Label>
                            <Input
                              id={`proposal-to-${item.id}`}
                              value={item.proposal.to}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "email" ? { ...proposal, to: event.target.value } : proposal,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-subject-${item.id}`}>
                              Subject
                            </Label>
                            <Input
                              id={`proposal-subject-${item.id}`}
                              value={item.proposal.subject}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "email"
                                    ? { ...proposal, subject: event.target.value }
                                    : proposal,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-body-${item.id}`}>
                              Body
                            </Label>
                            <Textarea
                              id={`proposal-body-${item.id}`}
                              rows={8}
                              value={item.proposal.body}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "email" ? { ...proposal, body: event.target.value } : proposal,
                                )
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <strong className="block text-sm">{item.proposal.subject || "(no subject)"}</strong>
                          <p className="text-xs text-muted-foreground">To {item.proposal.to}</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                            {item.proposal.body}
                          </p>
                        </>
                      )
                    ) : (
                      item.editing ? (
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-summary-${item.id}`}>
                              Title
                            </Label>
                            <Input
                              id={`proposal-summary-${item.id}`}
                              value={item.proposal.summary}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "event"
                                    ? { ...proposal, summary: event.target.value }
                                    : proposal,
                                )
                              }
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground" htmlFor={`proposal-start-${item.id}`}>
                                Start
                              </Label>
                              <Input
                                id={`proposal-start-${item.id}`}
                                type="datetime-local"
                                value={toEditableDateTime(item.proposal.start)}
                                onChange={(event) =>
                                  updateProposal(turn.id, item.id, (proposal) =>
                                    proposal.kind === "event"
                                      ? { ...proposal, start: fromEditableDateTime(event.target.value) }
                                      : proposal,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground" htmlFor={`proposal-end-${item.id}`}>
                                End
                              </Label>
                              <Input
                                id={`proposal-end-${item.id}`}
                                type="datetime-local"
                                value={toEditableDateTime(item.proposal.end)}
                                onChange={(event) =>
                                  updateProposal(turn.id, item.id, (proposal) =>
                                    proposal.kind === "event"
                                      ? { ...proposal, end: fromEditableDateTime(event.target.value) }
                                      : proposal,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-attendees-${item.id}`}>
                              Attendees
                            </Label>
                            <Input
                              id={`proposal-attendees-${item.id}`}
                              value={item.proposal.attendees ?? ""}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "event"
                                    ? { ...proposal, attendees: event.target.value }
                                    : proposal,
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground" htmlFor={`proposal-location-${item.id}`}>
                              Location
                            </Label>
                            <Input
                              id={`proposal-location-${item.id}`}
                              value={item.proposal.location ?? ""}
                              onChange={(event) =>
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "event"
                                    ? { ...proposal, location: event.target.value }
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
                                updateProposal(turn.id, item.id, (proposal) =>
                                  proposal.kind === "event"
                                    ? { ...proposal, description: event.target.value }
                                    : proposal,
                                )
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <strong className="block text-sm">{item.proposal.summary}</strong>
                          <p className="text-xs text-primary">
                            {formatRange(item.proposal.start, item.proposal.end)}
                          </p>
                          {item.proposal.attendees && (
                            <p className="text-xs text-muted-foreground">With {item.proposal.attendees}</p>
                          )}
                        </>
                      )
                    )}

                    {item.error && <p className="text-xs text-destructive">{item.error}</p>}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {item.status === "done" ? (
                        <Badge className="motion-enter-soft gap-1 border-success/30 bg-success/10 text-success">
                          <CheckCircle2Icon className="size-3" />
                          {item.proposal.kind === "email" ? "Sent" : "Created"}
                        </Badge>
                      ) : item.status === "cancelled" ? (
                        <Badge variant="outline" className="motion-enter-soft text-muted-foreground">
                          Dismissed
                        </Badge>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            disabled={item.status === "confirming" || !canConfirmProposal(item.proposal)}
                            onClick={() => void confirmProposal(turn.id, item.id)}
                          >
                            {item.status === "confirming" ? (
                              <>
                                <Loader2Icon className="size-4 animate-spin" />
                                Working...
                              </>
                            ) : item.proposal.kind === "email" ? (
                              "Send"
                            ) : (
                              "Create"
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={item.status === "confirming"}
                            onClick={() => setProposalEditing(turn.id, item.id, !item.editing)}
                          >
                            <PencilIcon className="size-4" />
                            {item.editing ? "Done" : "Edit"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={item.status === "confirming"}
                            onClick={() => setProposalStatus(turn.id, item.id, "cancelled")}
                          >
                            Dismiss
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          {showFollowUps && (
            <div className="motion-enter-soft flex flex-wrap gap-2 pt-1">
              {contextualSuggestions.map((suggestion: AgentSuggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="motion-state inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm text-foreground outline-none hover:border-primary/30 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() =>
                    void send(suggestion.label, {
                      suggestionIntent: suggestion.id,
                      checkpointAt: suggestion.id === "triage_changes_since_check" ? lastInboxCheckpointAt : undefined,
                    })
                  }
                >
                  <MailIcon className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{suggestion.label}</span>
                </button>
              ))}
            </div>
          )}

          {busy && (
            <div className="motion-enter-soft flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              Thinking...
            </div>
          )}
          {error && (
            <div className="motion-enter-soft rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-border px-5 py-3">
          <Textarea
            ref={inputRef}
            value={input}
            rows={2}
            className="min-h-0 resize-none"
            placeholder={operator.configured ? "Message the agent..." : "Configure AI_* in .env.local to enable"}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <Button
            type="button"
            size="icon"
            disabled={busy || !input.trim()}
            onClick={() => void send(input)}
            aria-label="Send message"
          >
            <SendIcon className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
