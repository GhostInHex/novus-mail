"use client";
import { ArrowUpRight, MessageSquare } from "lucide-react";
import { format } from "date-fns";
type Chat = { id: string; title: string; updatedAt: string; turns: unknown[] };
export function DoopAIHistory({ groups, activeId, onSelect, onNew, onClose }: {
  groups: { label: string; chats: Chat[] }[]; activeId: string | null;
  onSelect: (id: string) => void; onNew: () => void; onClose: () => void;
}) {
  return <section className="doop-source-history">
    <header><h3>Your chats</h3><div><button type="button" onClick={onNew}>New chat</button><button type="button" onClick={onClose}>Close</button></div></header>
    {groups.every(group => group.chats.length === 0) && <p>Chats you start will be saved here on this device.</p>}
    {groups.filter(group => group.chats.length > 0).map(group => <section key={group.label}>
      <h4>{group.label}</h4><div className="doop-source-results">{group.chats.map(chat => <button type="button" key={chat.id} aria-current={chat.id === activeId ? "true" : undefined} onClick={() => onSelect(chat.id)}>
        <MessageSquare size={16} /><span className="doop-source-result-details"><strong>{chat.title}</strong><small>{format(new Date(chat.updatedAt), "h:mm a")} · {chat.turns.length} messages</small></span><ArrowUpRight size={15} />
      </button>)}</div>
    </section>)}
  </section>;
}
