import { classifyAgentRequest } from "@/lib/agent-suggestions";
import type {
  AgentChatContext,
  AgendaEvent,
  InboxTriageMode,
  SessionUser,
} from "@/lib/types";
import type { AiMessage, AiTool, AiToolCall } from "@/server/ai";
import { aiChat } from "@/server/ai";
import { getThreadDetail, refreshCalendar, searchThreadsLocal, triageInbox } from "@/server/workspace";

/**
 * Conversational agent over the tenant's Corsair-backed Gmail + Calendar.
 *
 * Safe by construction: the agent can only READ (search/read/agenda execute
 * immediately) and PROPOSE (draft_email / propose_event return structured
 * proposals - never executed here). Sends/creates happen only when the user
 * confirms in the UI, which reuses the existing /api/messages/send and
 * /api/events routes.
 */

export type AgentProposal =
  | { kind: "email"; to: string; subject: string; body: string; threadId?: string }
  | {
      kind: "event";
      summary: string;
      start: string;
      end: string;
      attendees?: string;
      description?: string;
      location?: string;
    };

export type AgentEvent =
  | { type: "tool"; label: string }
  | { type: "proposal"; proposal: AgentProposal }
  | { type: "assistant"; content: string };

const MAX_ROUNDS = 6;
const MAX_SEARCH_RESULTS = 12;
const MAX_AGENDA_RESULTS = 10;
const MAX_BODY_CHARS = 2000;
const MAX_TRIAGE_RESULTS = 8;

const TOOLS: AiTool[] = [
  {
    type: "function",
    function: {
      name: "triage_inbox",
      description:
        "Group inbox triage tasks such as unread summaries, reply-needed candidates, priority lists, change summaries since a checkpoint, and compact summaries of matching threads.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: [
              "summarize_unread",
              "reply_candidates",
              "priority_list",
              "changes_since_checkpoint",
              "summarize_threads",
            ],
            description: "The grouped inbox triage mode to run.",
          },
          timeframe: {
            type: "string",
            enum: ["today", "week", "all"],
            description: "Optional timeframe for time-bounded triage.",
          },
          limit: {
            type: "number",
            description: "Maximum number of threads to return. Default 8.",
          },
          query: {
            type: "string",
            description: "Optional search query, especially for summarize_threads.",
          },
          threadIds: {
            type: "array",
            items: { type: "string" },
            description: "Optional explicit thread ids to summarize.",
          },
          checkpointAt: {
            type: "string",
            description: "ISO timestamp used for changes_since_checkpoint.",
          },
        },
        required: ["mode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_inbox",
      description:
        "Search the user's cached inbox for threads. Use Gmail-style queries or plain keywords (sender, subject, topic). Returns matching threads with their threadId.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keywords or a Gmail query like 'from:alice unread'." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_thread",
      description: "Read the full body and messages of one thread by its threadId (get this from search_inbox).",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "The threadId returned by search_inbox." },
        },
        required: ["threadId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_agenda",
      description: "List the user's upcoming calendar events.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_email",
      description:
        "Draft an email for the user to review and send. This does NOT send the email - it creates a proposal the user confirms. Pass threadId to reply within an existing thread.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address(es), comma-separated." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Email body (plain text)." },
          threadId: { type: "string", description: "Optional: the thread to reply within." },
        },
        required: ["to", "subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_event",
      description:
        "Propose a calendar event for the user to review and create. This does NOT create the event - it creates a proposal the user confirms. Provide ISO 8601 start/end datetimes.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title." },
          start: { type: "string", description: "Start datetime, ISO 8601 (e.g. 2026-06-14T09:00:00)." },
          end: { type: "string", description: "End datetime, ISO 8601. Default to 30 minutes after start." },
          attendees: { type: "string", description: "Optional: attendee email address(es), comma-separated." },
          description: { type: "string", description: "Optional: event description." },
          location: { type: "string", description: "Optional: event location." },
        },
        required: ["summary", "start", "end"],
      },
    },
  },
];

function buildSystemPrompt(profile: SessionUser, now: Date): string {
  return [
    "You are NovusMail's assistant - a fast, keyboard-first email and calendar copilot.",
    `You are helping ${profile.displayName} <${profile.email}>.`,
    `The current date and time is ${now.toString()} (ISO: ${now.toISOString()}).`,
    "",
    "Tools:",
    "- triage_inbox: grouped inbox workflows for unread summaries, reply-needed candidates, priority lists, changes since a checkpoint, and concise thread summaries.",
    "- search_inbox / read_thread: gather context from the inbox before acting.",
    "- list_agenda: check the calendar.",
    "- draft_email / propose_event: these create PROPOSALS the user reviews and confirms. They do NOT send or create anything themselves.",
    "",
    "Guidelines:",
    "- For inbox-analysis questions (unread, reply-needed, priority, what changed, summarize threads), you MUST use tools before answering.",
    "- Never claim you sent an email or created an event. Say you've drafted/proposed it for the user to confirm.",
    "- When scheduling, resolve relative times ('tomorrow 9am') to ISO 8601 using the current date above; default events to 30 minutes.",
    "- Prefer replying within an existing thread (pass its threadId) when the user refers to a conversation.",
    "- Be concise. After proposing an action, briefly tell the user what to confirm.",
  ].join("\n");
}

function safeParseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => asString(item)).filter(Boolean) : [];
}

function buildToolAwareHint(mode: InboxTriageMode | null, checkpointAt?: string | null) {
  if (mode === "reply_candidates") {
    return "Use triage_inbox with mode reply_candidates first, then read_thread for the top thread(s) before drafting.";
  }
  if (mode === "summarize_unread") {
    return "Use triage_inbox with mode summarize_unread first and choose a sensible timeframe.";
  }
  if (mode === "priority_list") {
    return "Use triage_inbox with mode priority_list first.";
  }
  if (mode === "changes_since_checkpoint") {
    return checkpointAt
      ? `Use triage_inbox with mode changes_since_checkpoint and checkpointAt ${checkpointAt}.`
      : "Use triage_inbox with mode changes_since_checkpoint even if you must report that there is no prior checkpoint.";
  }
  if (mode === "summarize_threads") {
    return "Use triage_inbox with mode summarize_threads first, passing the relevant query if needed.";
  }
  return "Use triage_inbox, search_inbox, or read_thread before answering.";
}

type ToolOutcome = { label: string; content: string; proposal?: AgentProposal };

async function executeTool(
  ctx: { tenantId: string; context?: AgentChatContext; now: Date },
  call: AiToolCall,
): Promise<ToolOutcome> {
  const name = call.function.name;
  const args = safeParseArgs(call.function.arguments);

  if (name === "triage_inbox") {
    const result = await triageInbox(ctx.tenantId, {
      mode: asString(args.mode) as InboxTriageMode,
      timeframe: (asString(args.timeframe) || undefined) as "today" | "week" | "all" | undefined,
      limit: asNumber(args.limit, MAX_TRIAGE_RESULTS),
      query: asString(args.query) || undefined,
      threadIds: asStringArray(args.threadIds),
      checkpointAt: asString(args.checkpointAt) || ctx.context?.checkpointAt || null,
      now: ctx.now.toISOString(),
    });

    return {
      label: `Triaged inbox - ${result.mode.replaceAll("_", " ")}`,
      content: JSON.stringify(result),
    };
  }

  if (name === "search_inbox") {
    const query = asString(args.query);
    const threads = await searchThreadsLocal(ctx.tenantId, query);
    const compact = threads.slice(0, MAX_SEARCH_RESULTS).map((thread) => ({
      threadId: thread.threadId,
      subject: thread.subject,
      sender: thread.sender,
      senderEmail: thread.senderEmail,
      snippet: thread.snippet.slice(0, 200),
      receivedAt: thread.receivedAt,
      unread: thread.unread,
      priority: thread.priorityBand,
    }));
    return {
      label: query ? `Searched inbox - ${query}` : "Listed inbox",
      content: JSON.stringify({ count: threads.length, threads: compact }),
    };
  }

  if (name === "read_thread") {
    const threadId = asString(args.threadId);
    if (!threadId) {
      return { label: "Read thread", content: JSON.stringify({ error: "threadId is required" }) };
    }
    const detail = await getThreadDetail(ctx.tenantId, threadId);
    return {
      label: `Read - ${detail.subject}`,
      content: JSON.stringify({
        threadId: detail.threadId,
        subject: detail.subject,
        sender: detail.sender,
        senderEmail: detail.senderEmail,
        receivedAt: detail.receivedAt,
        messageCount: detail.messageCount,
        body: (detail.body || detail.snippet || "").slice(0, MAX_BODY_CHARS),
      }),
    };
  }

  if (name === "list_agenda") {
    const events: AgendaEvent[] = await refreshCalendar(ctx.tenantId);
    const compact = events.slice(0, MAX_AGENDA_RESULTS).map((event) => ({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
      location: event.location,
    }));
    return {
      label: "Checked agenda",
      content: JSON.stringify({ count: events.length, events: compact }),
    };
  }

  if (name === "draft_email") {
    const proposal: AgentProposal = {
      kind: "email",
      to: asString(args.to),
      subject: asString(args.subject),
      body: asString(args.body),
      threadId: args.threadId ? asString(args.threadId) : undefined,
    };
    return {
      label: `Drafted email - ${proposal.to}`,
      content: "Email drafted and shown to the user for review. The user will confirm before it is sent.",
      proposal,
    };
  }

  if (name === "propose_event") {
    const proposal: AgentProposal = {
      kind: "event",
      summary: asString(args.summary),
      start: asString(args.start),
      end: asString(args.end),
      attendees: args.attendees ? asString(args.attendees) : undefined,
      description: args.description ? asString(args.description) : undefined,
      location: args.location ? asString(args.location) : undefined,
    };
    return {
      label: `Proposed event - ${proposal.summary}`,
      content: "Event proposed and shown to the user for review. The user will confirm before it is created.",
      proposal,
    };
  }

  return { label: `Unknown tool: ${name}`, content: JSON.stringify({ error: `Unknown tool ${name}` }) };
}

export async function* runAgent(params: {
  tenantId: string;
  profile: SessionUser;
  messages: AiMessage[];
  context?: AgentChatContext;
  now: Date;
  signal?: AbortSignal;
}): AsyncGenerator<AgentEvent> {
  const latestUserMessage = [...params.messages].reverse().find((message) => message.role === "user");
  const request = classifyAgentRequest(latestUserMessage?.content ?? "", params.context?.suggestionIntent);
  const conversation: AiMessage[] = [
    { role: "system", content: buildSystemPrompt(params.profile, params.now) },
    ...params.messages,
  ];
  let usedTool = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const assistant = await aiChat({
      messages: conversation,
      tools: TOOLS,
      toolChoice: request.requiresInboxTool && !usedTool ? "required" : "auto",
      signal: params.signal,
    });

    if (!assistant.tool_calls || assistant.tool_calls.length === 0) {
      if (request.requiresInboxTool && !usedTool) {
        conversation.push({
          role: "system",
          content: `You attempted to answer an inbox-analysis request without using tools. ${buildToolAwareHint(
            request.triageMode,
            params.context?.checkpointAt,
          )}`,
        });
        continue;
      }

      if (assistant.content.trim()) {
        yield { type: "assistant", content: assistant.content };
      }
      return;
    }

    conversation.push({
      role: "assistant",
      content: assistant.content ?? "",
      tool_calls: assistant.tool_calls,
    });

    if (assistant.content && assistant.content.trim()) {
      yield { type: "assistant", content: assistant.content };
    }

    for (const call of assistant.tool_calls) {
      usedTool = true;
      const outcome = await executeTool(params, call);
      yield { type: "tool", label: outcome.label };
      if (outcome.proposal) {
        yield { type: "proposal", proposal: outcome.proposal };
      }
      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: outcome.content,
      });
    }
  }

  yield {
    type: "assistant",
    content: "I've reached the step limit for this turn. Let me know how you'd like to continue.",
  };
}
