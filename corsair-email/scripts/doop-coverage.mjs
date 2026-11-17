import fs from "node:fs";
import { canvas } from "./doop-source.mjs";
const scenarios = {
  "Sign In Glaze": [
    "sign-in",
    "src/components/auth-landing.tsx",
    ".doop-access",
  ],
  "Connect Glaze": [
    "connect",
    "src/components/connect-state.tsx",
    ".doop-connect-panel",
  ],
  "Inbox Glaze": [
    "inbox",
    "src/components/dashboard/dashboard-view.tsx",
    ".dashboard-reader",
  ],
  "Calendar Glaze": [
    "week",
    "src/components/workspace-week-view.tsx",
    ".dashboard-week-view",
  ],
  "Compose Glaze": [
    "compose",
    "src/components/compose-sheet.tsx",
    ".dashboard-composer",
  ],
  "Privacy Glaze": ["privacy", "src/app/privacy/page.tsx", ".doop-legal"],
  "Terms Glaze": ["terms", "src/app/terms/page.tsx", ".doop-legal"],
  "AI Welcome": [
    "assistant-welcome",
    "src/components/doop/ai-welcome.tsx",
    ".doop-source-welcome",
  ],
  "Inbox Triage": [
    "triage",
    "src/components/agent-triage-card.tsx",
    ".doop-agent-triage",
  ],
  "Agent Tool Activity": [
    "tool-activity",
    "src/components/doop/ai-tool-activity.tsx",
    ":is(.doop-tool-activity, .doop-source-tool)",
  ],
  "AI Reply Drafts": [
    "draft",
    "src/components/doop/ai-artifact.tsx",
    ".doop-source-artifact",
  ],
  "AI Draft Editing": [
    "draft-edit",
    "src/components/doop/ai-artifact.tsx",
    ".doop-proposal-body input",
  ],
  "AI Meeting Proposal": [
    "event-proposal",
    "src/components/doop/ai-artifact.tsx",
    ".doop-source-artifact",
  ],
  "AI Event Editing": [
    "event-edit",
    "src/components/doop/ai-artifact.tsx",
    ".doop-proposal-body input",
  ],
  "AI Chat History": [
    "history",
    "src/components/doop/ai-history.tsx",
    ".doop-source-history",
  ],
  "Auto Approval Confirmation": [
    "approval",
    "src/components/doop/ai-approval.tsx",
    ".doop-source-approval",
  ],
  "AI Retry State": [
    "retry",
    "src/components/agent-panel.tsx",
    ".doop-agent-retry",
  ],
  "Collapsed Workspace Sidebar": [
    "collapsed-sidebar",
    "src/components/dashboard/dashboard-view.tsx",
    ".dashboard-sidebar",
  ],
  "Collapsed Agenda Panel": [
    "collapsed-agenda",
    "src/components/dashboard/dashboard-view.tsx",
    ".dashboard-expand-agenda",
  ],
  "Expanded Month Calendar": [
    "month",
    "src/components/workspace-week-view.tsx",
    ".dashboard-calendar-dates",
  ],
  "Selected Day Agenda": [
    "selected-day",
    "src/components/workspace-week-view.tsx",
    ".dashboard-selected-day",
  ],
  "New Event Form": [
    "event",
    "src/components/event-sheet.tsx",
    ".doop-event-modal",
  ],
  "Command Console": [
    "command",
    "src/components/command-palette.tsx",
    ".doop-command-modal",
  ],
  "Keyboard Shortcuts": [
    "shortcuts",
    "src/components/keyboard-shortcuts.tsx",
    ".doop-shortcuts-modal",
  ],
  "Action Success Feedback": [
    "success",
    "src/components/theme-provider.tsx",
    "[data-sonner-toast]",
  ],
};
const components = {
  1: ["inbox", ".dashboard-reader-topline button"],
  2: ["inbox", ".dashboard-toolbar"],
  3: ["inbox", ".dashboard-toolbar"],
  4: ["inbox", ".dashboard-toolbar"],
  5: ["inbox", ".dashboard-sidebar nav"],
  6: ["inbox", ".dashboard-sidebar nav"],
  7: ["inbox", ".dashboard-body"],
  8: ["inbox", ".dashboard-body"],
  9: ["inbox", ".dashboard-queue-card"],
  10: ["inbox", ".dashboard-queue-card"],
  11: ["inbox", ".dashboard-reader"],
  12: ["inbox", ".dashboard-reader"],
  13: ["inbox", ".dashboard-agenda-list"],
  14: ["inbox", ".dashboard-agenda-list"],
  15: ["inbox", ".dashboard-reader"],
  16: ["inbox", ".dashboard-reader"],
  17: ["inbox", ".dashboard-queue-card > header"],
  18: ["inbox", ".dashboard-queue-card > header"],
  19: ["inbox", ".dashboard-queue"],
  20: ["inbox", ".dashboard-queue"],
  21: ["selected-day", ".dashboard-selected-day"],
  22: ["selected-day", ".dashboard-selected-day"],
  23: ["selected-day", ".dashboard-selected-events"],
  24: ["selected-day", ".dashboard-selected-events"],
  25: ["inbox", ".dashboard-next-event"],
  26: ["inbox", ".dashboard-next-event"],
  27: ["inbox", ".dashboard-calendar-panel"],
  28: ["inbox", ".dashboard-calendar-panel"],
  29: ["inbox", ".dashboard-agenda"],
  30: ["inbox", ".dashboard-agenda"],
  31: ["inbox", ".dashboard-sidebar"],
  32: ["inbox", ".dashboard-sidebar"],
  33: ["inbox", ".dashboard-sidebar"],
  34: ["inbox", ".dashboard-sidebar"],
  35: ["inbox", ".dashboard"],
  36: ["inbox", ".dashboard"],
};
export const coverage = canvas.frames.map((frame) => {
  const theme = /Dark|\/ dark \//.test(frame.name) ? "dark" : "light";
  let mapping,
    adaptation =
      "Live data, semantic controls, and responsive layout replace static sample content.";
  if (frame.pageId === "page-mwie8yc9") {
    const number = Number(frame.name.match(/(\d+)$/)[1]);
    mapping = [
      components[number][0],
      "src/components/dashboard/dashboard-view.tsx",
      components[number][1],
    ];
    adaptation =
      "Legacy component reference implemented through shared workspace components; newer Glaze workspace chrome is used consistently.";
    return {
      frame: frame.id,
      name: frame.name,
      theme: number > 3 && number % 2 === 0 ? "dark" : "light",
      kind: "component",
      scenario: mapping[0],
      implementation: mapping[1],
      selector: mapping[2],
      adaptation,
    };
  }
  if (frame.name.includes("ASCII source"))
    mapping = [
      "landing",
      "src/components/landing/landing-page.tsx",
      ".landing-page",
    ];
  else mapping = scenarios[frame.name.replace(/ (Light|Dark)$/, "")];
  if (!mapping) throw Error(`Unmapped frame: ${frame.name}`);
  return {
    frame: frame.id,
    name: frame.name,
    theme,
    kind: "screen",
    scenario: mapping[0],
    implementation: mapping[1],
    selector: mapping[2],
    adaptation,
  };
});

export async function checkFrameCoverage(
  page,
  { scenario, theme, screenshot },
) {
  const results = [];
  for (const entry of coverage.filter(
    (f) => f.scenario === scenario && f.theme === theme,
  )) {
    if (!fs.existsSync(entry.implementation))
      throw Error(`${entry.frame}: missing ${entry.implementation}`);
    const element = page.locator(`${entry.selector}:visible`).first();
    await element.waitFor({ state: "visible" });
    const box = await element.boundingBox();
    if (!box || box.width <= 0 || box.height <= 0)
      throw Error(`${entry.frame}: empty implementation`);
    const appearance = await element.evaluate((el) => {
      const style = getComputedStyle(el);
      return {
        foreground: style.color,
        background: style.backgroundColor,
        fontSize: style.fontSize,
      };
    });
    results.push({ ...entry, status: "passed", box, appearance, screenshot });
  }
  const styles = JSON.parse(
    fs.readFileSync("design/doop/style-checks.json", "utf8"),
  );
  for (const check of styles.filter(
    (c) => c.scenario === scenario && c.theme === theme,
  )) {
    const actual = await page
      .locator(check.target)
      .first()
      .evaluate(
        (el, properties) =>
          Object.fromEntries(
            properties.map((p) => [
              p,
              getComputedStyle(el).getPropertyValue(p),
            ]),
          ),
        Object.keys(check.expected),
      );
    for (const [property, expected] of Object.entries(check.expected)) {
      if (actual[property] !== expected)
        throw Error(
          `${check.frame}: ${check.target} ${property}: expected ${expected}, got ${actual[property]}`,
        );
    }
  }
  return results;
}
