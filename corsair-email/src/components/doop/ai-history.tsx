"use client";
import { ArrowUpRight } from "lucide-react";
import "./ai-history-fidelity.css";
import { format } from "date-fns";
import { Fragment } from "react";
type Chat = { id: string; title: string; updatedAt: string; turns: unknown[] };
export function DoopAIHistory({ groups, activeId, onSelect, onNew }: {
  groups: { label: string; chats: Chat[] }[]; activeId: string | null;
  onSelect: (id: string) => void; onNew: () => void; onClose: () => void;
}) {
  return <section className="doop-source-history">
    <header><h3>Your chats</h3><div><button type="button" className="doop-glaze" onClick={onNew}><span className="doop-accent-label">New chat</span></button></div></header><p className="doop-history-caption">Saved on this device</p>
    {groups.every(group => group.chats.length === 0) && <p>Chats you start will be saved here on this device.</p>}
    {groups.filter(group => group.chats.length > 0).map(group => <Fragment key={group.label}>
      <h4><span>{group.label}</span></h4><div className="doop-source-results">{group.chats.map(chat => <button type="button" key={chat.id} aria-current={chat.id === activeId ? "true" : undefined} onClick={() => onSelect(chat.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg><span className="doop-source-result-details"><strong>{chat.title}</strong><small>{`${format(new Date(chat.updatedAt), group.label === "Today" ? "h:mm a" : "MMM d")} · ${chat.turns.length} messages`}</small></span><ArrowUpRight size={15} />
      </button>)}</div>
    </Fragment>)}
  </section>;
}
