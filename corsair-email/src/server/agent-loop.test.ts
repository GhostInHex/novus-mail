import assert from "node:assert/strict";
import test from "node:test";

import { classifyAgentRequest } from "@/lib/agent-suggestions";

test("inbox analysis prompts are marked as requiring tools", () => {
  const request = classifyAgentRequest("What needs a reply today?");
  assert.equal(request.requiresInboxTool, true);
  assert.equal(request.triageMode, "reply_candidates");
});

test("non-inbox prompts do not force inbox tools", () => {
  const request = classifyAgentRequest("Schedule 30 min with teammate@example.com tomorrow 9am.");
  assert.equal(request.requiresInboxTool, false);
  assert.equal(request.triageMode, null);
});
