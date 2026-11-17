import { frameForTheme, appStyle } from "./doop-source.mjs";
import { launchBrowser } from "./browser.mjs";
import fs from "node:fs";
const browser = await launchBrowser();
const page = await browser.newPage();
page.setDefaultTimeout(3000);
const rules = [
  [
    "ZSbzsMIJ4h",
    '.doop-source-message[data-from="user"]',
    '[data-node-label="User Message"]',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-message p",
    '[data-node-label="User Message"] [data-node-label="Text Label"]',
  ],
  ["ZSbzsMIJ4h", ".doop-source-tool", '[data-node-label="Completed Activity"]'],
  [
    "ZSbzsMIJ4h",
    ".doop-source-tool span",
    '[data-node-label="Completed Activity"] [data-node-label="Text Label"]',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-artifact",
    '[data-node-label="AI Conversation Content"] [data-node-label="Feature Card"]',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-artifact .doop-proposal-heading > span",
    '[data-node-label="AI Conversation Content"] [data-node-label="Status Badge"]',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-artifact .doop-proposal-body > strong",
    '[data-node-label="AI Conversation Content"] :text-is("Re: launch review for 1:00 PM")',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-artifact .doop-proposal-body",
    '[data-node-label="AI Conversation Content"] [data-node-label="Feature Card"] > div',
  ],
  [
    "ZSbzsMIJ4h",
    ".doop-source-artifact .doop-proposal-body button:has(svg)",
    '[data-node-label="AI Conversation Content"] [data-node-label="Secondary Control"]',
  ],
  [
    "X2_Tw5d1xp",
    ".doop-source-history .doop-source-results",
    '[data-node-label="AI Conversation Content"] [data-node-label="Result List"]',
  ],
  [
    "X2_Tw5d1xp",
    ".doop-source-history .doop-source-results button",
    '[data-node-label="AI Conversation Content"] [data-node-label="Result Row"]',
  ],
  [
    "X2_Tw5d1xp",
    ".doop-source-result-details",
    '[data-node-label="AI Conversation Content"] [data-node-label="Result Details"]',
  ],
  [
    "X2_Tw5d1xp",
    ".doop-source-result-details strong",
    '[data-node-label="AI Conversation Content"] [data-node-label="Result Title"]',
  ],
  [
    "X2_Tw5d1xp",
    ".doop-source-result-details small",
    '[data-node-label="AI Conversation Content"] [data-node-label="Result Description"]',
  ],
  [
    "sa5ThibhQK",
    ".doop-agent-composer .doop-source-prompt",
    '[data-node-label="AI Prompt Input"] > div',
  ],
  [
    "sa5ThibhQK",
    ".doop-agent-composer .doop-source-prompt button",
    '[data-node-label="AI Prompt Input"] > div > div:last-child',
  ],
  [
    "sa5ThibhQK",
    ".doop-source-suggestions",
    '[data-node-label="AI Suggestions"]',
  ],
  [
    "sa5ThibhQK",
    ".doop-source-suggestions button",
    '[data-node-label="Suggestion Button"]',
  ],
  [
    "hyytQwDO0u",
    ".doop-agent-retry",
    '[data-node-label="AI Conversation Content"] [data-node-label="Feature Card"]',
  ],
  [
    "SzcEnf0kqE",
    '.doop-source-artifact .doop-proposal-body [data-slot="input"]',
    '[data-node-label="Labeled Field"] [data-node-label="Field Value"]',
  ],
  [
    "vRcbwVedSZ",
    ".doop-source-approval",
    '[data-node-label="AI Conversation Content"] [data-node-label="Feature Card"] > div',
  ],
  [
    "vRcbwVedSZ",
    ".doop-source-approval h3",
    '[data-node-label="AI Conversation Content"] :text-is("Action proposals without confirmation?")',
  ],
];
let css =
  "/* Generated from the saved Doop screen nodes by scripts/import-doop-chat.mjs. */\n";
try {
  for (const theme of ["light", "dark"]) {
    for (const [lightFrame, target, selector] of rules) {
      const frame = frameForTheme(lightFrame, theme).id;
      await page.setContent(
        fs.readFileSync(`design/doop/screens/${frame}.html`, "utf8"),
      );
      let style = await page.locator(selector).first().getAttribute("style");
      if (!style) throw Error(`${frame}: ${selector} has no source styles`);
      style = appStyle(style);
      css += `/* ${frame}: ${selector} */\n${`:where(html.${theme}) `}${target} { ${style} }\n`;
    }
  }
  css += fs.readFileSync("design/doop/chat-adaptations.css", "utf8");
  fs.writeFileSync("src/components/doop/ai-chat.css", css);
} finally {
  await browser.close();
}
