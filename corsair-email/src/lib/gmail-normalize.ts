import type { ThreadDetail, ThreadSummary } from "@/lib/types";
import { firstEmail, stripHtml } from "@/lib/utils";

function getHeader(message: any, name: string) {
  return (
    message?.payload?.headers?.find?.((header: any) => header?.name?.toLowerCase?.() === name.toLowerCase())
      ?.value ?? ""
  );
}

function decodeBodyPart(part: any): { text: string; html: string | null } {
  let text = "";
  let html: string | null = null;

  const data = part?.body?.data;
  const mimeType = part?.mimeType ?? "";

  if (data) {
    try {
      const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = Buffer.from(normalized, "base64").toString("utf8");
      if (mimeType === "text/html") {
        html = decoded;
      } else if (mimeType === "text/plain") {
        text = decoded;
      }
    } catch {
      // Ignore malformed MIME chunks.
    }
  }

  for (const child of part?.parts ?? []) {
    const childResult = decodeBodyPart(child);
    if (!text && childResult.text) {
      text = childResult.text;
    }
    if (!html && childResult.html) {
      html = childResult.html;
    }
  }

  return { text, html };
}

function summarizeAddress(value: string) {
  const email = firstEmail(value);
  const sender = value.replace(/<[^>]+>/g, "").replace(/"/g, "").trim() || email;

  return {
    sender,
    email,
  };
}

function messageToDetail(message: any): ThreadDetail["messages"][number] {
  const { text, html } = decodeBodyPart(message?.payload);

  return {
    id: message?.id ?? crypto.randomUUID(),
    from: getHeader(message, "From"),
    to: getHeader(message, "To"),
    subject: getHeader(message, "Subject") || "(No subject)",
    snippet: message?.snippet ?? "",
    body: text || stripHtml(html ?? ""),
    htmlBody: html,
    receivedAt: message?.internalDate ? new Date(Number(message.internalDate)).toISOString() : null,
    labels: message?.labelIds ?? [],
  };
}

export function normalizeThread(thread: any): ThreadDetail {
  const messages = (thread?.messages ?? []).map(messageToDetail);
  const latestMessage = messages.at(-1) ?? null;
  const sourceLabels: string[] =
    thread?.messages?.flatMap?.((message: any) => (message?.labelIds ?? []) as string[]) ?? [];
  const uniqueLabels: string[] = Array.from(new Set(sourceLabels));
  const address = summarizeAddress(latestMessage?.from ?? "");

  const baseSummary: ThreadSummary = {
    threadId: thread?.id ?? crypto.randomUUID(),
    subject: latestMessage?.subject ?? "(No subject)",
    sender: address.sender,
    senderEmail: address.email,
    recipients: (latestMessage?.to ?? "")
      .split(",")
      .map((value: string) => firstEmail(value))
      .filter((value: string): value is string => Boolean(value)),
    snippet: thread?.snippet ?? latestMessage?.snippet ?? "",
    bodyExcerpt: latestMessage?.body.slice(0, 500) ?? "",
    receivedAt: latestMessage?.receivedAt ?? null,
    messageCount: messages.length,
    labels: uniqueLabels,
    unread: uniqueLabels.includes("UNREAD"),
    starred: uniqueLabels.includes("STARRED"),
    archived: !uniqueLabels.includes("INBOX"),
    priorityBand: "normal",
    priorityScore: 0,
    priorityReason: "",
  };

  return {
    ...baseSummary,
    body: messages.map((message: ThreadDetail["messages"][number]) => message.body || message.snippet).filter(Boolean).join("\n\n"),
    htmlBody: latestMessage?.htmlBody ?? null,
    messages,
  };
}
