import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContextualSuggestions,
  classifyAgentRequest,
  getDefaultAgentSuggestions,
} from "@/lib/agent-suggestions";

test("default suggestions are grouped and stable", () => {
  const suggestions = getDefaultAgentSuggestions();
  assert.equal(suggestions.length, 4);
  assert.deepEqual(
    suggestions.map((item) => item.family),
    ["triage", "draft", "schedule", "triage"],
  );
});

test("contextual suggestions prefer grouped triage and draft intents", () => {
  const suggestions = buildContextualSuggestions({
    latestUserContent: "Summarize unread mail from this week.",
    latestAssistantContent: "Here is a summary of unread mail.",
    toolLabels: ["Triaged inbox - summarize unread"],
    proposals: [{ kind: "email" }],
  });

  assert.equal(suggestions.length, 3);
  assert.ok(suggestions.some((item) => item.id === "triage_reply_needed"));
  assert.ok(suggestions.some((item) => item.id === "draft_refine_reply"));
  assert.ok(suggestions.some((item) => item.family === "triage"));
});

test("request classification maps inbox prompts to grouped triage tools", () => {
  const replyRequest = classifyAgentRequest("What needs a reply today?");
  assert.equal(replyRequest.requiresInboxTool, true);
  assert.equal(replyRequest.triageMode, "reply_candidates");

  const changeRequest = classifyAgentRequest("What changed since my last check?");
  assert.equal(changeRequest.requiresInboxTool, true);
  assert.equal(changeRequest.triageMode, "changes_since_checkpoint");
});
