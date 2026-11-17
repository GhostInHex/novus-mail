import { launchBrowser } from './browser.mjs';
const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("../artifacts", { recursive: true });
const log = (s) => console.log("PASS", s);
try {
  await page.goto(BASE_URL + "/start");
  await page
    .getByRole("button", { name: "Open demo workspace", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await page
    .getByRole("heading", { name: "Focus queue", exact: true })
    .waitFor();
  await page.locator(".dashboard-queue li button").first().click();
  await expect(page.locator(".dashboard-reader h2").first()).toBeVisible();
  log("demo inbox and thread reading");
  await expect(
    page.getByRole("button", { name: "Collapse sidebar", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open month calendar", exact: true })
    .click();
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  log("folder navigation and animated full calendar tabs");

  await page.getByRole("button", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Calendar week" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Next week", exact: true }).click();
  await page
    .getByRole("button", { name: "Previous week", exact: true })
    .click();
  await page.screenshot({
    path: "../artifacts/calendar-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Focus queue", exact: true })
    .click();
  log("calendar navigation");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  let dialog = page.getByRole("region", {
    name: "New message composer",
    exact: true,
  });
  await dialog.getByLabel("To", { exact: true }).fill("ari@example.com");
  await dialog
    .getByLabel("Subject", { exact: true })
    .fill("Doop implementation check");
  await dialog
    .getByLabel("Body", { exact: true })
    .fill("A message retained after a simulated failure.");
  let sends = 0,
    releaseSend;
  const sendGate = new Promise((resolve) => (releaseSend = resolve));
  await page.route("**/api/messages/send", async (route) => {
    sends++;
    await sendGate;
    await route.fulfill({
      status: 503,
      json: { error: "Simulated send failure" },
    });
  });
  await dialog
    .getByRole("button", { name: "Send", exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await expect(dialog.getByRole("button", { name: /^Saving/ })).toBeDisabled();
  releaseSend();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated send failure",
  );
  await expect(dialog.getByLabel("Body", { exact: true })).toHaveValue(
    "A message retained after a simulated failure.",
  );
  expect(sends).toBe(1);
  await page.unroute("**/api/messages/send");
  await page.route("**/api/messages/send", (route) =>
    route.fulfill({ json: null }),
  );
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  log(
    "failed send retains content, prevents duplicates, and handles a mocked successful retry",
  );
  await page
    .getByRole("button", { name: "Workspace menu", exact: true })
    .click();
  await page.getByRole("menuitem", { name: "New event", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: true }).fill("Doop review");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-11-18T15:00");
  await dialog.getByLabel("End", { exact: true }).fill("2026-11-18T14:00");
  await expect(
    dialog.getByRole("button", { name: "Create event", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("End", { exact: true }).fill("2026-11-18T15:30");
  let events = 0,
    releaseEvent;
  const eventGate = new Promise((resolve) => (releaseEvent = resolve));
  await page.route("**/api/events", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    events++;
    await eventGate;
    await route.fulfill({
      status: 503,
      json: { error: "Simulated event failure" },
    });
  });
  await dialog
    .getByRole("button", { name: "Create event", exact: true })
    .evaluate((el) => {
      el.click();
      el.click();
    });
  await expect(
    dialog.getByRole("button", { name: "Create event", exact: true }),
  ).toBeDisabled();
  releaseEvent();
  await expect(dialog.getByRole("alert")).toContainText(
    "Simulated event failure",
  );
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue(
    "Doop review",
  );
  expect(events).toBe(1);
  await page.unroute("**/api/events");
  await page.route("**/api/events", (route) =>
    route.fulfill({
      json: {
        id: "verification-event",
        ...route.request().postDataJSON(),
        attendees: [],
        status: "confirmed",
        htmlLink: null,
      },
    }),
  );
  await dialog
    .getByRole("button", { name: "Create event", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  log(
    "event validation, retained content, duplicate protection, mocked successful creation",
  );
  await page
    .getByRole("button", { name: "Open command console", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").fill("from:ari@example.com");
  await dialog
    .getByRole("button", { name: "Run command", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  log("command console search");
  await page
    .getByRole("textbox", { name: "Search mail", exact: true })
    .fill("");
  await page
    .getByRole("button", { name: "Workspace menu", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Ask assistant", exact: true })
    .click();
  dialog = page.getByRole("dialog").first();
  await expect(dialog.getByLabel("Message your assistant")).toBeEnabled();
  await expect(dialog).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: "../artifacts/assistant-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await dialog.getByRole("switch", { name: "Auto-approve actions" }).click();
  await page
    .getByRole("button", { name: "Keep asking me", exact: true })
    .click();
  await expect(
    dialog.getByRole("switch", { name: "Auto-approve actions" }),
  ).not.toBeChecked();
  log("auto-approval requires confirmation");
  await page.route("**/api/agent", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: [
        { type: "tool", label: "Read thread" },
        { type: "token", text: "I prepared a reply for your review." },
        {
          type: "proposal",
          proposal: {
            kind: "email",
            to: "ari@example.com",
            subject: "Review proposal",
            body: "Your draft is ready.",
          },
        },
      ]
        .map((x) => "data: " + JSON.stringify(x) + "\n\n")
        .join(""),
    }),
  );
  await dialog.getByLabel("Message your assistant").fill("Draft a reply");
  await dialog.getByLabel("Message your assistant").press("Enter");
  await expect(
    dialog.getByText("I prepared a reply for your review.", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText("Your draft is ready.", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog.getByLabel("Subject", { exact: true }).fill("Edited proposal");
  await dialog
    .getByRole("button", { name: "Done editing", exact: true })
    .click();
  await expect(
    dialog.getByText("Edited proposal", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../artifacts/assistant-draft-dark.png",
    fullPage: true,
  });
  log("Doop messages, tools, artifacts, and editable draft proposals");
  await dialog.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(dialog.getByText("Sent", { exact: true })).toBeVisible();
  log("explicit proposal approval handles a mocked successful send");
  await page.unroute("**/api/agent");
  await page.route("**/api/agent", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Simulated assistant failure" },
    }),
  );
  await dialog
    .getByLabel("Message your assistant")
    .fill("Check retry behavior");
  await dialog.getByLabel("Message your assistant").press("Enter");
  await expect(
    dialog.getByRole("button", { name: "Retry response", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/agent");
  await page.route("**/api/agent", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: 'data: {"type":"token","text":"Retried successfully"}\n\n',
    }),
  );
  await dialog
    .getByRole("button", { name: "Retry response", exact: true })
    .click();
  await expect(
    dialog.getByText("Retried successfully", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/agent");
  let releaseStream;
  const streamGate = new Promise((resolve) => (releaseStream = resolve));
  await page.route("**/api/agent", async (route) => {
    await streamGate;
    await route
      .fulfill({ contentType: "text/event-stream", body: "" })
      .catch(() => {});
  });
  await dialog
    .getByLabel("Message your assistant")
    .fill("Check stopping behavior");
  await dialog.getByLabel("Message your assistant").press("Enter");
  await dialog
    .getByRole("button", { name: "Stop generating", exact: true })
    .click();
  await expect(
    dialog.getByText("Response stopped. You can retry when ready.", {
      exact: true,
    }),
  ).toBeVisible();
  releaseStream();
  log("assistant failure, retry, and stop controls");

  await dialog
    .getByRole("button", { name: "Chat history", exact: true })
    .click();
  await expect(dialog.getByText("Your chats", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close", exact: true })
    .last()
    .click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Workspace menu", exact: true })
    .click();
  const lightMode = page.getByRole("menuitem", {
    name: "Switch to light mode",
    exact: true,
  });
  if (await lightMode.count()) await lightMode.click();
  else await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.screenshot({
    path: "../artifacts/workspace-light.png",
    fullPage: true,
  });
  await page
    .getByRole("textbox", { name: "Search mail", exact: true })
    .fill("");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../artifacts/workspace-mobile.png",
    fullPage: true,
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  log("light theme and mobile layout");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Open folders", exact: true }).click();
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "New message composer" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "New message composer" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  log("reduced-motion composer");
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("ALL WORKSPACE CHECKS PASSED");
} catch (error) {
  await page.screenshot({
    path: "../artifacts/workspace-failure.png",
    fullPage: true,
  });
  console.log("BROWSER ERRORS", errors);
  console.log("OVERFLOW", await page.locator("body *").evaluateAll(elements => elements.filter(el => { const r=el.getBoundingClientRect(); return r.width>0 && r.left>=0 && r.right>innerWidth+1 && getComputedStyle(el).visibility!=="hidden"; }).slice(0,12).map(el=>({tag:el.tagName,class:el.className,text:el.textContent?.slice(0,80),right:el.getBoundingClientRect().right}))));
  if (await page.locator("[role=dialog]").count()) console.log((await page.locator("[role=dialog]").first().innerText()).slice(-2200));
  throw error;
} finally {
  await browser.close();
}
