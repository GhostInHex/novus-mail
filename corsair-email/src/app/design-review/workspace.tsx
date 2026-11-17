"use client";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ComposeSheet } from "@/components/compose-sheet";
import { AgentPanel } from "@/components/agent-panel";
import { EventSheet } from "@/components/event-sheet";
import { CommandPalette } from "@/components/command-palette";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import type { EventInput } from "@/lib/types";
import { toast } from "sonner";
import { notifySuccess } from "@/components/doop/feedback";
import { connection, events, weekEvents, folders, session, threads } from "./fixtures";

const operator = { configured: true, label: "OpenRouter", model: "openrouter/free" };
function ReviewWorkspace({ scenario }: { scenario: string }) {
  const [view, setView] = useState<ComponentProps<typeof DashboardView>["view"]>("focus");
  const [thread, setThread] = useState(threads[0]);
  const [search, setSearch] = useState("");
  const [calendar, setCalendar] = useState(scenario === "week" || scenario === "month" || scenario === "selected-day");
  const [agendaCollapsed, setAgendaCollapsed] = useState(scenario === "collapsed-agenda");
  const [compose, setCompose] = useState(scenario === "compose");
  const [mobileReader, setMobileReader] = useState(false);
  const [assistant, setAssistant] = useState(!["inbox", "week", "month", "selected-day", "collapsed-sidebar", "collapsed-agenda", "compose", "event", "command", "shortcuts", "success"].includes(scenario));
  const [eventOpen, setEventOpen] = useState(scenario === "event");
  const [eventPreset, setEventPreset] = useState<Partial<EventInput>>({ summary: "Launch review", attendees: "ari@northstarhq.com, vinay@example.com", start: "2026-06-18T09:00:00.000Z", end: "2026-06-18T09:30:00.000Z", location: "Google Meet", description: "Review the updated launch deck and agree on next steps." });
  const [command, setCommand] = useState(scenario === "command");
  const [shortcuts, setShortcuts] = useState(scenario === "shortcuts");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (scenario !== "success") return;
    notifySuccess("Reply sent to Ari", { id: "reference-reply", duration: Infinity, description: "Re: launch review for 1:00 PM", action: { label: "View sent mail", onClick: () => setView("sent") } });
    notifySuccess("Event created", { id: "reference-event", duration: Infinity, description: "Launch review · Tomorrow, 9:00–9:30 AM" });
    return () => { toast.dismiss("reference-reply"); toast.dismiss("reference-event"); };
  }, [scenario]);

  const confirmEmail: ComponentProps<typeof AgentPanel>["onConfirmEmail"] = async input => { notifySuccess("Reply sent to Ari", {description: input.subject, action: { label: "View sent mail", onClick: () => setView("sent") }}); };
  const confirmEvent: ComponentProps<typeof AgentPanel>["onConfirmEvent"] = async input => { notifySuccess("Event created", {description: input.summary}); };
  const assistantProps = { operator, onReviewEvent: (input: EventInput) => { setEventPreset(input); setEventOpen(true); }, threadContext: { threadId: threads[0].threadId, sender: "Ari Morgan", subject: scenario === "tool-activity" ? "launch review" : "Launch review" }, contactNames: { "ari@northstarhq.com": "Ari Morgan", "vinay@example.com": "you", "ari@example.com": "Ari Morgan", "nadia@example.com": "Nadia Flores" }, onClose: () => setAssistant(false), onOpenThread: (id: string) => { const match = threads.find(t => t.threadId === id); if (match) setThread(match); setAssistant(false); }, onConfirmEmail: confirmEmail, onConfirmEvent: confirmEvent };
  return <>
    <DashboardView suggestedActionLabel="Prepare a reply and check 3 PM" mobileReaderOpen={mobileReader} onMobileReader={setMobileReader} composerTitle="Review your reply" session={session} threads={threads} thread={thread} folders={folders} view={view} search={search} searchRef={searchRef} onSearch={setSearch} onSearchAll={() => {}} onView={setView} onThread={id => { const match = threads.find(t => t.threadId === id); if (match) setThread(match); }} onBack={() => {}} threadLoading={false} threadError={false} onRetryThread={() => {}} onCompose={() => setCompose(true)} onReply={() => setCompose(true)} onForward={() => setCompose(true)} onDraft={() => setCompose(true)} onThreadAction={() => {}} onCommand={() => setCommand(true)} onAssistant={() => setAssistant(true)} onShortcuts={() => setShortcuts(true)} onSync={() => {}} syncing={false} syncedAt="2026-11-15T14:00:00.000Z" connection={connection} events={scenario === "week" ? weekEvents : events} onEvent={() => setEventOpen(true)} onNewEvent={preset => { if (preset) setEventPreset(preset); setEventOpen(true); }} agendaCollapsed={agendaCollapsed} onAgenda={setAgendaCollapsed} calendarView={calendar} onCalendar={setCalendar} hasMore={false} loadingMore={false} onMoreThreads={() => {}} renderHtml={() => null} composer={compose ? <ComposeSheet open recipientName="Ari" initialDraft={{to:"ari@example.com", subject:"Re: Launch review, a little later?", body:"Hi Ari,\n\n3 PM works for me. I will review the updated deck before we meet.\n\nSee you then,\nVinay", threadId:threads[0].threadId}} onClose={() => setCompose(false)} onSend={confirmEmail} onDraft={async () => {}} /> : undefined} assistant={compose ? <AgentPanel {...assistantProps} open embedded /> : undefined} />
    {!compose && <AgentPanel {...assistantProps} open={assistant} />}
    <EventSheet open={eventOpen} draftPreset={eventPreset} onClose={() => setEventOpen(false)} onSubmit={confirmEvent} />
    <CommandPalette open={command} activeThread={scenario === "command" ? { ...thread, subject: "Launch review", senderEmail: "ari@northstarhq.com" } : thread} onClose={() => setCommand(false)} onRun={async () => {}} />
    <KeyboardShortcuts open={shortcuts} onOpenChange={setShortcuts} />
  </>;
}

export function DoopReviewWorkspace({ scenario }: { scenario: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <ReviewWorkspace scenario={scenario} /> : null;
}
