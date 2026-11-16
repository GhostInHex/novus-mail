import fs from "node:fs";
import assert from "node:assert/strict";
const data = JSON.parse(
  fs.readFileSync("../artifacts/live-ai-validation.json"),
);
const base = process.env.BASE_URL || "http://localhost:3101";
const login = await fetch(base + "/api/demo-login", {
  method: "POST",
  redirect: "manual",
});
const headers = {
  "Content-Type": "application/json",
  Cookie: login.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; "),
};
const email = data.results
  .flatMap((r) => r.proposals)
  .find((p) => p.kind === "email");
const event = data.results
  .flatMap((r) => r.proposals)
  .find((p) => p.kind === "event");
const before = await (await fetch(base + "/api/workspace", { headers })).json();
for (const [kind, path, proposal] of [
  ["email", "/api/messages/send", email],
  ["event", "/api/events", event],
]) {
  const r = await fetch(base + path, {
    method: "POST",
    headers,
    body: JSON.stringify(proposal),
  });
  const payload = await r.json();
  assert.equal(r.status, 200, JSON.stringify(payload));
  if (kind === "event") {
    const after = await (
      await fetch(base + "/api/workspace", { headers })
    ).json();
    assert(after.events.some((e) => e.id === payload.id));
  } else {
    assert(payload.messages.at(-1).body === email.body);
  }
  console.log(
    "PASS approved demo " +
      kind +
      " action succeeded and its result is readable",
  );
}
console.log(
  "PASS no live Gmail delivery or Google Calendar writes; actions used the demo tenant",
);
