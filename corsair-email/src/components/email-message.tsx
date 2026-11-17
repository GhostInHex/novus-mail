import type { ReactNode } from "react";
import type { ThreadDetail } from "@/lib/types";

export function EmailMessage({
  message,
  renderHtml,
}: {
  message: ThreadDetail["messages"][number];
  renderHtml: (message: ThreadDetail["messages"][number]) => ReactNode;
}) {
  return !message.htmlBody?.trim() && message.body?.trim() ? (
    <div className="dashboard-message-body">
      {message.body.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </div>
  ) : (
    <div className="dashboard-message-html">{renderHtml(message)}</div>
  );
}
