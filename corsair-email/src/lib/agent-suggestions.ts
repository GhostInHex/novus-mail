import type {
  AgentSuggestion,
  AgentSuggestionIntent,
  InboxTriageMode,
} from "@/lib/types";

type SuggestionContext = {
  latestUserContent?: string;
  latestAssistantContent?: string;
  toolLabels?: string[];
  proposals?: Array<{ kind: "email" | "event" }>;
};

type AgentRequestClassification = {
  requiresInboxTool: boolean;
  triageMode: InboxTriageMode | null;
  shouldAdvanceCheckpoint: boolean;
};

const SUGGESTION_REGISTRY: Record<AgentSuggestionIntent, AgentSuggestion> = {
  triage_reply_needed: {
    id: "triage_reply_needed",
    label: "Show only the messages that need my response",
    family: "triage",
  },
  triage_unread_week: {
    id: "triage_unread_week",
    label: "Summarize unread mail from this week.",
    family: "triage",
  },
  triage_priority_list: {
    id: "triage_priority_list",
    label: "Turn this into a priority list",
    family: "triage",
  },
  triage_changes_since_check: {
    id: "triage_changes_since_check",
    label: "What changed since my last check?",
    family: "triage",
  },
  draft_top_two_replies: {
    id: "draft_top_two_replies",
    label: "Draft replies for the top two threads",
    family: "draft",
  },
  draft_refine_reply: {
    id: "draft_refine_reply",
    label: "Make the draft shorter and warmer",
    family: "draft",
  },
  draft_follow_up_meeting: {
    id: "draft_follow_up_meeting",
    label: "Draft a follow-up email for this meeting",
    family: "draft",
  },
  search_related_sender: {
    id: "search_related_sender",
    label: "Find related emails from this sender",
    family: "search",
  },
  search_summarize_matches: {
    id: "search_summarize_matches",
    label: "Summarize the matching threads",
    family: "search",
  },
  schedule_open_time: {
    id: "schedule_open_time",
    label: "Find open time tomorrow morning",
    family: "schedule",
  },
  schedule_short_agenda: {
    id: "schedule_short_agenda",
    label: "Email the attendees a short agenda",
    family: "schedule",
  },
  schedule_check_agenda: {
    id: "schedule_check_agenda",
    label: "Check my agenda around this time",
    family: "schedule",
  },
};

const INTENT_TO_TRIAGE_MODE: Partial<Record<AgentSuggestionIntent, InboxTriageMode>> = {
  triage_reply_needed: "reply_candidates",
  triage_unread_week: "summarize_unread",
  triage_priority_list: "priority_list",
  triage_changes_since_check: "changes_since_checkpoint",
  draft_top_two_replies: "reply_candidates",
  search_summarize_matches: "summarize_threads",
};

const INBOX_ANALYSIS_PATTERNS: Array<{ pattern: RegExp; mode: InboxTriageMode }> = [
  { pattern: /\bwhat needs a reply today\b/i, mode: "reply_candidates" },
  { pattern: /\bneed(s)? my response\b/i, mode: "reply_candidates" },
  { pattern: /\bdraft repl(y|ies) for the top\b/i, mode: "reply_candidates" },
  { pattern: /\bsummarize unread mail\b/i, mode: "summarize_unread" },
  { pattern: /\bpriority list\b/i, mode: "priority_list" },
  { pattern: /\bwhat should i handle first\b/i, mode: "priority_list" },
  { pattern: /\bwhat needs attention next\b/i, mode: "priority_list" },
  { pattern: /\bwhat changed since my last check\b/i, mode: "changes_since_checkpoint" },
  { pattern: /\bsummarize the matching threads\b/i, mode: "summarize_threads" },
];

function appendUniqueSuggestion(suggestions: AgentSuggestion[], suggestion: AgentSuggestion) {
  if (!suggestions.some((item) => item.id === suggestion.id)) {
    suggestions.push(suggestion);
  }
}

function getSuggestion(intent: AgentSuggestionIntent) {
  return SUGGESTION_REGISTRY[intent];
}

function findExplicitMode(text: string) {
  return INBOX_ANALYSIS_PATTERNS.find((item) => item.pattern.test(text))?.mode ?? null;
}

export function getDefaultAgentSuggestions(): AgentSuggestion[] {
  return [
    getSuggestion("triage_reply_needed"),
    {
      id: "draft_top_two_replies",
      label: "Draft a reply to the top thread saying I'll review by Friday.",
      family: "draft",
    },
    {
      id: "schedule_open_time",
      label: "Schedule 30 min with teammate@example.com tomorrow 9am about the roadmap.",
      family: "schedule",
    },
    getSuggestion("triage_unread_week"),
  ];
}

export function getSuggestionByIntent(intent: AgentSuggestionIntent) {
  return getSuggestion(intent);
}

export function buildContextualSuggestions(context: SuggestionContext): AgentSuggestion[] {
  const latestUser = context.latestUserContent ?? "";
  const latestAssistant = context.latestAssistantContent ?? "";
  const toolLabels = context.toolLabels ?? [];
  const proposals = context.proposals ?? [];
  const haystack = `${latestUser} ${latestAssistant} ${toolLabels.join(" ")}`.toLowerCase();
  const suggestions: AgentSuggestion[] = [];

  if (proposals.some((item) => item.kind === "email")) {
    appendUniqueSuggestion(suggestions, getSuggestion("draft_refine_reply"));
  }

  if (proposals.some((item) => item.kind === "event")) {
    appendUniqueSuggestion(suggestions, getSuggestion("draft_follow_up_meeting"));
    appendUniqueSuggestion(suggestions, getSuggestion("schedule_check_agenda"));
  }

  if (haystack.includes("unread") || haystack.includes("reply")) {
    appendUniqueSuggestion(suggestions, getSuggestion("triage_reply_needed"));
    appendUniqueSuggestion(suggestions, getSuggestion("draft_top_two_replies"));
  }

  if (haystack.includes("summary") || haystack.includes("summarize")) {
    appendUniqueSuggestion(suggestions, getSuggestion("triage_priority_list"));
  }

  if (haystack.includes("schedule") || haystack.includes("meeting") || haystack.includes("calendar")) {
    appendUniqueSuggestion(suggestions, getSuggestion("schedule_open_time"));
    appendUniqueSuggestion(suggestions, getSuggestion("schedule_short_agenda"));
  }

  if (haystack.includes("search") || haystack.includes("from:") || haystack.includes("find")) {
    appendUniqueSuggestion(suggestions, getSuggestion("search_related_sender"));
    appendUniqueSuggestion(suggestions, getSuggestion("search_summarize_matches"));
  }

  appendUniqueSuggestion(suggestions, getSuggestion("triage_changes_since_check"));
  appendUniqueSuggestion(suggestions, getSuggestion("triage_priority_list"));

  return suggestions.slice(0, 3);
}

export function classifyAgentRequest(
  text: string,
  suggestionIntent?: AgentSuggestionIntent,
): AgentRequestClassification {
  const explicitMode = findExplicitMode(text);
  const triageMode = (suggestionIntent && INTENT_TO_TRIAGE_MODE[suggestionIntent]) ?? explicitMode ?? null;
  const requiresInboxTool =
    triageMode !== null ||
    /\b(unread|reply|priority|inbox|thread|mail|messages?|changed since)\b/i.test(text);

  return {
    requiresInboxTool,
    triageMode,
    shouldAdvanceCheckpoint:
      triageMode !== null &&
      (triageMode === "summarize_unread" ||
        triageMode === "reply_candidates" ||
        triageMode === "priority_list" ||
        triageMode === "summarize_threads" ||
        triageMode === "changes_since_checkpoint"),
  };
}
