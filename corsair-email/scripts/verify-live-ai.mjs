import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://localhost:3101";
const login = await fetch(base + "/api/demo-login", {
  method: "POST",
  redirect: "manual",
});
const cookie = login.headers
  .getSetCookie()
  .map((s) => s.split(";")[0])
  .join("; ");
assert(cookie);
const headers = { "Content-Type": "application/json", Cookie: cookie };
const before = await (await fetch(base + "/api/workspace", { headers })).json();
assert(before.threads.length > 0);
const results = [];
async function ask(name, prompt, context) {
  const started = Date.now();
  const r = await fetch(base + "/api/agent", {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      context,
    }),
    signal: AbortSignal.timeout(110000),
  });
  const body = await r.text();
  assert.equal(r.status, 200, body.slice(0, 200));
  const events = body
    .split("\n\n")
    .filter((x) => x.startsWith("data: "))
    .map((x) => JSON.parse(x.slice(6)));
  const errors = events.filter((e) => e.type === "error");
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const proposals = events
    .filter((e) => e.type === "proposal")
    .map((e) => e.proposal);
  const text = events
    .filter((e) => e.type === "token")
    .map((e) => e.text)
    .join("");
  const result = {
    name,
    seconds: Math.round((Date.now() - started) / 1000),
    tools: events.filter((e) => e.type === "tool").map((e) => e.label),
    text,
    proposals,
    triage: events.find((e) => e.type === "triage")?.result,
  };
  results.push(result);
  console.log(
    JSON.stringify({
      name,
      seconds: result.seconds,
      tools: result.tools,
      text: text.slice(0, 350),
      proposalKinds: proposals.map((p) => p.kind),
      triageCount: result.triage?.total,
    }),
  );
  return result;
}
try {
  const hello = await ask(
    "conversation",
    "Say hello in one short sentence. Do not use tools for this greeting.",
  );
  assert(hello.text.length > 0);
  const triage = await ask(
    "inbox-triage",
    "Show the messages in my demo inbox that need my response. Use inbox triage and give a short summary.",
    { suggestionIntent: "triage_reply_needed" },
  );
  assert(triage.tools.length > 0);
  assert(triage.triage?.threads.length > 0);
  const draft = await ask(
    "reply-draft",
    "Read the top launch review thread in my inbox and draft a short reply confirming I will review the updated deck before our meeting. Do not send it.",
    { suggestionIntent: "draft_top_two_replies" },
  );
  assert(draft.proposals.some((p) => p.kind === "email" && p.to && p.body));
  const event = await ask(
    "meeting-proposal",
    "Check my calendar and propose a 30-minute Launch review tomorrow at 9am with ari@northstarhq.com. Use the propose_event tool so I can review it; do not create it yet.",
  );
  assert(event.proposals.some((p) => p.kind === "event" && p.start && p.end));
  const after = await (
    await fetch(base + "/api/workspace", { headers })
  ).json();
  assert.equal(after.events.length, before.events.length);
  console.log(
    "PASS real provider conversation, triage, reply and event proposals; no event created before approval",
  );
  await writeFile(
    "../artifacts/live-ai-validation.json",
    JSON.stringify(
      { model: "nvidia/nemotron-3.5-lightning:free", results },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
  await writeFile(
    "../artifacts/live-ai-validation.json",
    JSON.stringify({ results, error: e.message }, null, 2),
  );
}
