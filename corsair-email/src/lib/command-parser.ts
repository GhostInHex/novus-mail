import { parseDate } from "chrono-node";

type ParsedCommand =
  | { kind: "search"; query: string }
  | { kind: "email"; to: string; subject: string; body: string }
  | { kind: "event"; attendee: string; summary: string; start: string; end: string }
  | { kind: "workflow"; attendee: string; summary: string; start: string; end: string; emailSubject: string; emailBody: string };

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const GMAIL_OPERATOR_PATTERN = /\b(from|to|cc|bcc|subject|label|in|has|older_than|newer_than|after|before|is):/i;

function normalizeSpacing(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function extractEmail(raw: string) {
  return raw.match(EMAIL_PATTERN)?.[0] ?? "";
}

function parseSchedule(raw: string) {
  const attendee = extractEmail(raw);
  const parsedDate = parseDate(raw, new Date(), { forwardDate: true });

  if (!attendee || !parsedDate) {
    return null;
  }

  const start = parsedDate.toISOString();
  const end = new Date(parsedDate.getTime() + 30 * 60 * 1000).toISOString();

  return {
    attendee,
    start,
    end,
  };
}

function extractDelimitedTail(raw: string) {
  const [, tail = ""] = raw.split("::");
  const [summary = "", emailBody = ""] = tail.split("||");

  return {
    summary: normalizeSpacing(summary),
    emailBody: normalizeSpacing(emailBody),
  };
}

function extractEventSummary(raw: string) {
  const delimited = extractDelimitedTail(raw);

  if (delimited.summary) {
    return delimited.summary;
  }

  const titleMatch = raw.match(/(?:about|for)\s+(.+?)(?:\s+::|$)/i);
  if (titleMatch?.[1]) {
    return normalizeSpacing(titleMatch[1]);
  }

  return "Follow-up meeting";
}

function extractEmailSubject(raw: string, fallback: string) {
  const subjectMatch = raw.match(/about\s+(.+?)(?:\s+::|$)/i);
  if (subjectMatch?.[1]) {
    return normalizeSpacing(subjectMatch[1]);
  }

  return fallback;
}

function extractEmailBody(raw: string, fallback: string) {
  const delimited = extractDelimitedTail(raw);

  if (delimited.emailBody) {
    return delimited.emailBody;
  }

  const bodyMatch = raw.match(
    /send(?:ing)?(?:\s+an?)?\s+email(?:\s+to\s+[^\s]+)?(?:\s+(?:saying|that says|with message|with note))?\s+(.+)$/i,
  );

  if (bodyMatch?.[1]) {
    return normalizeSpacing(bodyMatch[1]);
  }

  return fallback;
}

function looksLikeSearch(raw: string, lower: string) {
  if (lower.startsWith("search ") || lower.startsWith("find ")) {
    return true;
  }

  return GMAIL_OPERATOR_PATTERN.test(raw) && !lower.includes("schedule") && !lower.includes("meeting") && !lower.includes("send email");
}

function looksLikeWorkflow(lower: string) {
  return (lower.includes("meeting") || lower.includes("schedule")) && lower.includes("email");
}

export function parseCommand(input: string): ParsedCommand | null {
  const raw = input.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return null;
  }

  if (looksLikeSearch(raw, lower)) {
    return {
      kind: "search",
      query: lower.startsWith("search ") ? raw.slice(7).trim() : lower.startsWith("find ") ? raw.slice(5).trim() : raw,
    };
  }

  if (looksLikeWorkflow(lower)) {
    const schedule = parseSchedule(raw);

    if (!schedule) {
      return null;
    }

    const summary = extractEventSummary(raw);

    return {
      kind: "workflow",
      attendee: schedule.attendee,
      summary,
      start: schedule.start,
      end: schedule.end,
      emailSubject: extractEmailSubject(raw, `Follow-up on ${summary}`),
      emailBody: extractEmailBody(raw, `Looking forward to ${summary.toLowerCase()}.`),
    };
  }

  if (lower.startsWith("email ") || lower.startsWith("send email ")) {
    const address = extractEmail(raw);
    if (!address) {
      return null;
    }

    const subject = extractEmailSubject(raw, "Quick note");
    const body = extractEmailBody(raw, "Following up from the command console.");

    return {
      kind: "email",
      to: address,
      subject,
      body,
    };
  }

  if (lower.includes("meeting") || lower.includes("schedule")) {
    const schedule = parseSchedule(raw);

    if (!schedule) {
      return null;
    }

    return {
      kind: "event",
      attendee: schedule.attendee,
      summary: extractEventSummary(raw),
      start: schedule.start,
      end: schedule.end,
    };
  }

  return null;
}
