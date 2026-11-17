import fs from "node:fs";
import { launchBrowser } from "./browser.mjs";
import { appStyle, frameForTheme } from "./doop-source.mjs";
const rules = [
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-queue-card",
    '[data-node-label="Framed Content"]',
    ["border-radius", "background-color", "border-top-color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-queue-card h1",
    '[data-node-label="Framed Content"] :text-is("Focus queue")',
    ["font-size", "line-height", "letter-spacing", "color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-queue-card li button",
    '[data-node-label="Inbox Message Row"]',
    ["padding-inline", "padding-block"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-mail-meta > span",
    '[data-node-label="Message Sender"]',
    ["font-size", "font-weight", "line-height", "color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-mail-meta time",
    '[data-node-label="Message Time"]',
    ["font-size", "line-height", "color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-mail-subject",
    '[data-node-label="Message Subject"]',
    ["font-size", "line-height", "color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-reader h2",
    '[data-node-label="Text Label"]:text-is("Launch review, a little later?")',
    ["font-size", "line-height", "letter-spacing", "color"],
  ],
  [
    "nwOnX0aVws",
    "inbox",
    ".dashboard-agenda h2",
    ':text-is("Today")',
    ["font-size", "line-height", "letter-spacing", "color"],
  ],
  [
    "r5LPleAiTI",
    "connect",
    ".doop-connect-status",
    '[data-node-label="Framed Content"]',
    ["border-radius", "background-color", "border-top-color"],
  ],
  [
    "X7gRb7Zpcd",
    "event",
    '.doop-event-modal [data-slot="dialog-title"]',
    '[data-node-label="Modal Backdrop"] :text-is("New event")',
    ["font-size", "font-weight", "line-height", "letter-spacing", "color"],
  ],
  [
    "OwcxrkwgPj",
    "shortcuts",
    ".doop-shortcuts-modal .doop-shortcut-row",
    '[data-node-label="Shortcut Row"]',
    ["padding-block", "border-bottom-color"],
  ],
  [
    "OwcxrkwgPj",
    "shortcuts",
    ".doop-shortcuts-modal kbd",
    '[data-node-label="Keyboard Key"]',
    ["font-size", "border-radius", "background-color", "color"],
  ],
];
const browser = await launchBrowser();
const page = await browser.newPage();
const checks = [];
let css =
  "/* Generated from both themes by scripts/import-doop-workspace.mjs. */\n";
try {
  for (const theme of ["light", "dark"]) {
    for (const [lightFrame, scenario, target, selector, properties] of rules) {
      const frame = frameForTheme(lightFrame, theme);
      await page.setContent(
        fs.readFileSync(`design/doop/screens/${frame.id}.html`, "utf8"),
      );
      const node = page.locator(selector).first();
      const raw = await node.getAttribute("style");
      if (!raw) throw Error(`${frame.id}: ${selector}`);
      const declarations = await node.evaluate(
        (el, props) =>
          props
            .map((property) => [property, el.style.getPropertyValue(property)])
            .filter(([, value]) => value),
        properties,
      );
      css += `/* ${frame.id}: ${selector} */\n:where(html.${theme}) ${target} { ${declarations.map(([p, v]) => `${p}:${appStyle(v)}`).join(";")} }\n`;
      const expected = await node.evaluate(
        (el, props) =>
          Object.fromEntries(
            props
              .filter((p) => el.style.getPropertyValue(p))
              .map((p) => [p, getComputedStyle(el).getPropertyValue(p)]),
          ),
        properties,
      );
      checks.push({
        frame: frame.id,
        theme,
        scenario,
        target,
        selector,
        expected,
      });
    }
  }
  fs.writeFileSync("src/app/doop-source.css", css);
  fs.writeFileSync(
    "design/doop/style-checks.json",
    JSON.stringify(checks, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
