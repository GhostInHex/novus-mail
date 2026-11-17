import { test } from "node:test";
import assert from "node:assert/strict";
import { collectGmailThreadIds } from "./gmail-pagination";
import { normalizeThread } from "./gmail-normalize";

test("continues past 100 and 500 threads until Gmail is exhausted", async () => {
  const mailbox = Array.from({ length: 1237 }, (_, i) => ({ id: String(i) }));
  const loaded: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await collectGmailThreadIds({
      limit: 100,
      startPageToken: cursor,
      listPage: async ({ maxResults, pageToken }) => {
        const offset = Number(pageToken ?? 0);
        const end = Math.min(offset + maxResults, mailbox.length);
        return { threads: mailbox.slice(offset, end), nextPageToken: end < mailbox.length ? String(end) : undefined };
      },
    });
    loaded.push(...page.ids);
    cursor = page.nextPageToken ?? undefined;
  } while (cursor);
  assert.deepEqual(loaded, mailbox.map(t => t.id));
});

test("empty Gmail mailbox is exhausted without more requests", async () => {
  assert.deepEqual(await collectGmailThreadIds({ limit: 100, listPage: async () => ({}) }), { ids: [], nextPageToken: null });
});

test("Gmail page failures propagate so the saved cursor can be retried", async () => {
  await assert.rejects(collectGmailThreadIds({ limit: 100, startPageToken: "retry", listPage: async () => { throw new Error("Gmail unavailable"); } }), /Gmail unavailable/);
});

test("normalization uses the most recent message even when Gmail messages arrive unordered", () => {
  const normalized = normalizeThread({ id: "thread", messages: [
    { id: "new", internalDate: "1700000000000", payload: { headers: [{name:"Subject",value:"Newest"}], mimeType: "text/html", body:{data:Buffer.from('<p>HTML message</p>').toString('base64url')} } },
    { id: "old", internalDate: "1600000000000", payload: { headers: [{name:"Subject",value:"Old"}] } },
  ] });
  assert.equal(normalized.subject, "Newest");
  assert.equal(normalized.receivedAt, new Date(1700000000000).toISOString());
  assert.equal(normalized.htmlBody, "<p>HTML message</p>");
  assert.deepEqual(normalized.messages.map(m=>m.id),["old","new"]);
});
