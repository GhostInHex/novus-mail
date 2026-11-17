/**
 * Audits every rendered button across the design-review scenarios, in both
 * themes, and verifies the Doop glaze treatment is intact on every control
 * that should carry it.
 *
 * Two passes per scenario:
 *   1. with app-controls.css as shipped
 *   2. with its rules deleted from the CSSOM
 * Any paint difference (gradient, sheen layer, shadow, radius, ink) between the
 * passes means app-controls.css is still stripping glaze. Layout differences are
 * expected: that file only owns sizing now.
 *
 * Interaction states (account menu, thread menu, assistant history, approval
 * prompt) are opened and audited too.
 *
 * Usage: node scripts/audit-glaze-buttons.mjs [baseUrl] [--inventory]
 */
import { launchBrowser } from "./browser.mjs";

const args = process.argv.slice(2);
const INVENTORY = args.includes("--inventory");
const BASE = args.find((arg) => arg.startsWith("http")) || "http://localhost:3101";
const THEMES = ["light", "dark"];
const DASHBOARD_SCENARIOS = [
  "inbox",
  "compose",
  "email-proposal",
  "event",
  "command",
  "shortcuts",
  "success",
  "week",
  "month",
  "selected-day",
  "collapsed-sidebar",
  "collapsed-agenda",
  "tool-activity",
];
const ALL_SCENARIOS = [...DASHBOARD_SCENARIOS, "sign-in", "connect", "landing", "privacy", "terms"];
const only = args.find((arg) => arg.startsWith("--scenarios="));
const SCENARIOS = only
  ? only.replace("--scenarios=", "").split(",").map((value) => value.trim())
  : ALL_SCENARIOS;

const DEVICES = [
  { name: "desktop", width: 1440, height: 900, scenarios: SCENARIOS },
  { name: "mobile", width: 390, height: 844, scenarios: ["inbox", "compose", "event", "email-proposal"] },
];

/**
 * Differences app-controls.css is allowed to introduce: layout and type sizing
 * only. Its glaze paint layer must be identical with and without the file.
 */
const LAYOUT_PROPS = new Set([
  "display",
  "alignItems",
  "justifyContent",
  "gap",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "height",
  "minHeight",
  "minWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "whiteSpace",
  "position",
  "isolation",
  "clientHeight",
  "scrollHeight",
  // The sheen layer is sized from the button box, so it follows layout.
  "beforeHeight",
]);

const CAPTURE = () => {
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
  };
  const nodes = [
    ...document.querySelectorAll(
      'button, [data-slot="button"], [role="button"], [role="menuitem"], [role="option"], a[data-slot="button"]',
    ),
  ];
  return nodes.map((el, index) => {
    const style = getComputedStyle(el);
    const before = getComputedStyle(el, "::before");
    const path = [];
    for (let node = el; node && node !== document.body && path.length < 4; node = node.parentElement) {
      const label =
        node.dataset?.slot ||
        node.dataset?.nodeLabel ||
        node.className?.toString?.().split(/\s+/)[0] ||
        node.tagName.toLowerCase();
      path.unshift(label);
    }
    return {
      index,
      tag: el.tagName.toLowerCase(),
      text: (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 48),
      path: path.join(" > "),
      className: typeof el.className === "string" ? el.className.slice(0, 160) : "",
      slot: el.dataset?.slot ?? null,
      variant: el.dataset?.variant ?? null,
      size: el.dataset?.size ?? null,
      visible: visible(el),
      glaze: el.matches(
        '.doop-glaze, .nm-glaze, [data-slot="button"][data-variant="default"]',
      ),
      radius: style.borderTopLeftRadius,
      backgroundImage: style.backgroundImage,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      color: style.color,
      borderColor: style.borderTopColor,
      textShadow: style.textShadow,
      overflow: style.overflow,
      filter: style.filter,
      beforeContent: before.content,
      beforeHeight: before.height,
      beforeRadius: before.borderTopLeftRadius,
      clientHeight: el.clientHeight,
      scrollHeight: el.scrollHeight,
      display: style.display,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent,
      gap: style.gap,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      minHeight: style.minHeight,
      minWidth: style.minWidth,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      whiteSpace: style.whiteSpace,
      position: style.position,
      isolation: style.isolation,
    };
  });
};

const removeAppControlRules = () => {
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = [...sheet.cssRules];
    } catch {
      continue;
    }
    const indices = [];
    rules.forEach((rule, index) => {
      if (rule.cssText?.includes("html body :is(.dashboard.dashboard")) indices.push(index);
    });
    for (const index of indices.reverse()) sheet.deleteRule(index);
  }
};

const browser = await launchBrowser();
const violations = [];
const layoutOverrides = new Map();
const summary = [];

const checkGlaze = (items, context, theme, scenario) => {
  for (const item of items) {
    if (!item.visible || !item.glaze) continue;
    const radius = Number.parseFloat(item.radius);
    const issues = [];
    if (!item.backgroundImage.includes("linear-gradient")) issues.push("missing glaze gradient");
    if (item.beforeContent === "none" || item.beforeContent === "normal") issues.push("missing glaze sheen layer");
    if (item.boxShadow === "none") issues.push("missing glaze shadow");
    if (item.overflow !== "hidden" && item.overflow !== "clip") issues.push(`overflow ${item.overflow}`);
    if (radius <= 12) issues.push(`flattened radius ${item.radius}`);
    if (item.scrollHeight > item.clientHeight + 1)
      issues.push(`clipped label (${item.scrollHeight}px in ${item.clientHeight}px)`);
    if (issues.length) violations.push({ scenario, theme, context, problem: issues.join(", "), ...item });
  }
};

const checkPaintStability = (before, after, scenario, theme, context) => {
  for (const [index, current] of before.entries()) {
    const baseline = after[index];
    if (!baseline) continue;
    for (const [prop, value] of Object.entries(current)) {
      if (!(prop in baseline) || baseline[prop] === value) continue;
      if (LAYOUT_PROPS.has(prop)) {
        if (!layoutOverrides.has(prop)) layoutOverrides.set(prop, new Set());
        layoutOverrides.get(prop).add(`${scenario}/${theme}: ${current.text || current.tag}`);
        continue;
      }
      violations.push({
        scenario,
        theme,
        context,
        problem: `app-controls.css still overrides glaze property ${prop}: ${baseline[prop]} -> ${value}`,
        ...current,
      });
    }
  }
};

const GLAZE_SELECTOR =
  '.doop-glaze, .nm-glaze, [data-slot="button"][data-variant="default"]';

/** Hovering may brighten a glaze button; it must never replace its paint. */
const checkHover = async (page, { scenario, theme, context }) => {
  const hoverable = page.locator(
    '.doop-glaze:visible, .nm-glaze:visible, [data-slot="button"][data-variant="default"]:visible',
  );
  const count = await hoverable.count();
  for (let index = 0; index < count; index += 1) {
    const handle = await hoverable.nth(index).elementHandle();
    if (!handle) continue;
    await handle.hover({ timeout: 2000 }).catch(() => {});
    const hovered = await handle
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          glaze: el.matches(
            '.doop-glaze, .nm-glaze, [data-slot="button"][data-variant="default"]',
          ),
          text: (el.getAttribute("aria-label") || el.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 48),
          path: el.dataset?.slot || el.className?.toString().slice(0, 60),
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
        };
      })
      .catch(() => null);
    await handle.dispose();
    if (!hovered || !hovered.glaze) continue;
    if (!hovered.backgroundImage.includes("linear-gradient")) {
      violations.push({ scenario, theme, context, problem: "hover lost glaze gradient", ...hovered });
    }
    if (hovered.boxShadow === "none") {
      violations.push({ scenario, theme, context, problem: "hover lost glaze shadow", ...hovered });
    }
  }
  await page.mouse.move(0, 0);
};

const capture = (page) => page.evaluate(CAPTURE);

const auditState = async (page, { scenario, theme, context, compare }) => {
  const before = await capture(page);
  checkGlaze(before, context, theme, scenario);
  if (compare) {
    await page.evaluate(removeAppControlRules);
    await page.waitForTimeout(50);
    const after = await capture(page);
    checkPaintStability(before, after, scenario, theme, context);
  }
  if (INVENTORY && context === "default") {
    for (const item of before.filter((row) => row.visible)) {
      console.log(
        JSON.stringify({
          scenario,
          theme,
          text: item.text,
          tag: item.tag,
          variant: item.variant,
          size: item.size,
          glaze: item.glaze,
          radius: item.radius,
          gradient: item.backgroundImage.includes("linear-gradient"),
          sheen: item.beforeContent !== "none",
          shadow: item.boxShadow !== "none",
        }),
      );
    }
  }
  return before;
};

try {
  for (const device of DEVICES) {
    for (const theme of THEMES) {
      for (const scenario of device.scenarios) {
        const page = await browser.newPage({ viewport: { width: device.width, height: device.height } });
        await page.addInitScript((value) => localStorage.setItem("novusmail-theme", `${value}-default`), theme);
        const response = await page.goto(`${BASE}/design-review?scenario=${scenario}`, {
          waitUntil: "domcontentloaded",
        });
        if (!response || response.status() !== 200) {
          violations.push({ scenario, theme, context: "load", problem: `page status ${response?.status()}` });
          await page.close();
          continue;
        }
        await page.waitForSelector("main");
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(250);

        const main = await auditState(page, { scenario, theme, context: `${device.name}-default`, compare: true });

        await checkHover(page, { scenario, theme, context: `${device.name}-default` });

        // Menu surfaces (account menu, thread actions) live in portals.
        const menuTriggers = page.locator('[aria-haspopup="menu"]:visible');
        const menuCount = await menuTriggers.count();
        for (let index = 0; index < menuCount; index += 1) {
          const trigger = menuTriggers.nth(index);
          await trigger.click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(200);
          const open = await page.locator('[role="menu"]:visible').count();
          if (open) await auditState(page, { scenario, theme, context: `menu-${index}`, compare: false });
          await page.keyboard.press("Escape");
          await page.waitForTimeout(100);
        }

        // Unsaved-changes confirmation, reachable from the composer and the event sheet.
        if (scenario === "compose" || scenario === "event") {
          const field = page.locator(
            scenario === "compose" ? ".dashboard-composer textarea" : "dialog textarea",
          );
          await field.first().click({ timeout: 3000 }).catch(() => {});
          await page.keyboard.press("Escape").catch(() => {});
          await page.waitForTimeout(300);
          if (await page.locator("text=Discard unsaved changes?").count()) {
            await auditState(page, { scenario, theme, context: "discard-dialog", compare: false });
            await checkHover(page, { scenario, theme, context: "discard-dialog" });
            await page.keyboard.press("Escape").catch(() => {});
            await page.waitForTimeout(150);
          }
        }

        // Assistant surfaces: chat history list and the auto-approve prompt.
        const historyButton = page.locator('[aria-label="Chat history"]:visible');
        if (await historyButton.count()) {
          await historyButton.first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(200);
          await auditState(page, { scenario, theme, context: "assistant-history", compare: false });
        await checkHover(page, { scenario, theme, context: "assistant-history" });
          await historyButton.first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(100);
        }
        const approvalSwitch = page.locator('[role="switch"][aria-label="Auto-approve actions"]:visible');
        if (await approvalSwitch.count()) {
          await approvalSwitch.first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(200);
          await auditState(page, { scenario, theme, context: "assistant-approval", compare: false });
        await checkHover(page, { scenario, theme, context: "assistant-approval" });
          await page.locator('button:has-text("Keep asking me"):visible').first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(100);
        }

        summary.push({
          scenario,
          theme,
          device: device.name,
          buttons: main.filter((item) => item.visible).length,
          glaze: main.filter((item) => item.visible && item.glaze).length,
          hidden: main.length - main.filter((item) => item.visible).length,
        });
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

const totals = summary.reduce(
  (acc, row) => ({ buttons: acc.buttons + row.buttons, glaze: acc.glaze + row.glaze }),
  { buttons: 0, glaze: 0 },
);
if (!INVENTORY) {
  for (const row of summary)
    console.log(
      `${row.device.padEnd(7)} ${row.theme.padEnd(5)} ${row.scenario.padEnd(18)} buttons=${String(row.buttons).padStart(3)} glaze=${String(row.glaze).padStart(2)} hidden=${row.hidden}`,
    );
  console.log(`\nTOTAL visible buttons=${totals.buttons} glaze=${totals.glaze} violations=${violations.length}`);

  if (layoutOverrides.size) {
    console.log("\napp-controls.css differences (layout-only, expected):");
    for (const [prop, examples] of layoutOverrides) console.log(`  ${prop}: ${examples.size} element(s)`);
  }
}

if (violations.length) {
  console.log("\nVIOLATIONS");
  for (const violation of violations) {
    console.log(
      JSON.stringify({
        scenario: violation.scenario,
        theme: violation.theme,
        context: violation.context,
        problem: violation.problem,
        text: violation.text,
        path: violation.path,
      }),
    );
  }
  process.exitCode = 1;
} else if (!INVENTORY) {
  console.log("\nNo glaze violations.");
}
