import { checkFrameCoverage } from './doop-coverage.mjs';
import { launchBrowser } from './browser.mjs';
const BASE_URL=process.env.BASE_URL||"http://localhost:3100";
﻿import { expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConnectState } from "../src/components/connect-state.tsx";
const root = "../artifacts/doop-audit";
await mkdir(root, { recursive: true });
const browser = await launchBrowser();
const results = [];
const frameResults = [];
const errors = [];
const fixtureStatus = {
  gmail: { authorized: false, healthy: null },
  calendar: { authorized: false, healthy: null },
  readyForWorkspace: false,
  degraded: false,
};
try {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(
      (mode) => localStorage.setItem("novusmail-theme", mode + "-default"),
      theme,
    );
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    async function capture(name, frame, selector) {
      await page.evaluate(() => document.fonts.ready);
      if (name === 'inbox') {
        await Promise.all([
          page.waitForResponse(r => r.url().includes('/api/threads/') && r.status() === 200),
          page.locator('.dashboard-queue li button').first().click(),
        ]);
        await expect(page.locator('.dashboard-reader-loading')).toHaveCount(0);
        await expect(page.locator('.dashboard-reader h2')).toBeVisible();
      }
      if (selector === '[role=dialog]') {
        await expect(page.locator('[data-slot=dropdown-menu-content]')).toHaveCount(0);
        await expect.poll(() => page.getByRole('dialog').evaluate(el => {
          const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          return Math.abs(matrix.m11 - 1) < 0.001 && Math.abs(matrix.m22 - 1) < 0.001 && Math.abs(matrix.m41) < 0.01 && Math.abs(matrix.m42) < 0.01;
        })).toBe(true);
      }
      const locator = selector ? page.locator(selector) : page.locator("main");
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(1440);
      const screenshot = `${theme}-${name}.png`;
      await page.screenshot({
        path: `${root}/${screenshot}`,
        fullPage: true,
        animations: "disabled",
      });
      frameResults.push(...await checkFrameCoverage(page, { scenario: name, theme, screenshot }));
      results.push({
        theme,
        name,
        frame,
        box,
        screenshot,
        viewport: page.viewportSize(),
      });
    }
    async function menu(name) {
      await page
        .getByRole("button", { name: "Workspace menu", exact: true })
        .click();
      await page.getByRole("menuitem", { name, exact: true }).click();
    }
    async function close() {
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Close", exact: true })
        .last()
        .click();
      await expect(page.locator("[data-slot=dialog-content]")).toHaveCount(0);
    }
    await page.goto(BASE_URL + "/start");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await capture(
      "sign-in",
      theme === "dark" ? "zR46pVQtqo" : "T-RWCDO3pN",
      ".doop-access",
    );
    const css = await page
      .locator("link[rel=stylesheet], style")
      .evaluateAll((els) => els.map((el) => el.outerHTML).join(""));
    const bodyClass = await page.locator("body").getAttribute("class");
    for (const path of ["privacy", "terms"]) {
      await page.goto(BASE_URL + "/" + path);
      await expect(page.locator(".doop-legal h1")).toHaveCSS(
        "font-size",
        "40px",
      );
      await expect(page.locator(".doop-legal")).toHaveCSS("max-width", "760px");
      await capture(
        path,
        path === "privacy"
          ? theme === "dark"
            ? "0SudpaDmVv"
            : "eCb9kLXTFL"
          : theme === "dark"
            ? "jX9CyhpLJ6"
            : "fCM2-TkoZ0",
        ".doop-legal",
      );
    }
    const markup = renderToStaticMarkup(
      createElement(ConnectState, {
        session: {
          tenantId: "fixture",
          email: "fixture@example.com",
          displayName: "Fixture",
        },
        status: fixtureStatus,
      }),
    );
    await page.route("**/audit-fixture/connect", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html class="${theme}"><head>${css}</head><body class="${bodyClass}">${markup}</body></html>`,
      }),
    );
    await page.goto(BASE_URL + "/audit-fixture/connect");
    await expect(
      page.getByRole("link", { name: "Connect Google account", exact: true }),
    ).toHaveAttribute("href", "/api/auth/corsair/start/gmail");
    await expect(page.locator(".doop-connect-panel")).toHaveCSS(
      "width",
      "480px",
    );
    await capture(
      "connect",
      theme === "dark" ? "lyGlR1B5Jp" : "r5LPleAiTI",
      ".doop-connect-panel",
    );
    await page.goto(BASE_URL + "/start");
    await page
      .getByRole("button", { name: "Open demo workspace", exact: true })
      .click();
    await page.waitForURL("**/dashboard");
    await expect(page.locator(".dashboard-reader h2")).toBeVisible();
    await capture("inbox", theme === "dark" ? "LwTPn9MJXU" : "nwOnX0aVws");
    await page.getByRole('button', {name: 'Collapse sidebar', exact: true}).click();
    await expect(page.locator('.dashboard-sidebar')).toHaveCSS('width', '88px');
    await capture('collapsed-sidebar', theme === 'dark' ? 'GcrkggAb2V' : '-Kq47IpKPV');
    await page.getByRole('navigation', {name: 'Workspace', exact: true}).getByRole('button', {name: 'Starred', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Starred', exact: true})).toBeVisible();
    await page.getByRole('navigation', {name: 'Workspace', exact: true}).getByRole('button', {name: 'Focus queue', exact: true}).click();
    await page.getByRole('button', {name: 'Expand sidebar', exact: true}).click();
    await expect(page.locator('.dashboard-sidebar')).toHaveCSS('width', '200px');
    await page
      .getByRole("button", { name: "Collapse agenda", exact: true })
      .click();
    await expect(page.locator(".dashboard-agenda")).toHaveCSS("width", "64px");
    await capture(
      "collapsed-agenda",
      theme === "dark" ? "8bFi-1WqDJ" : "rhPj4u5YGM",
    );
    await page
      .getByRole("button", { name: "Expand agenda", exact: true })
      .click();
    const nav = page.getByRole("navigation", {
      name: "Workspace",
      exact: true,
    });
    await nav.getByRole("button", { name: "Calendar", exact: true }).click();
    await capture("week", theme === "dark" ? "TvnvIbjgPo" : "0t83YzC7LR");
    await page.getByRole("tab", { name: "Month", exact: true }).click();
    await capture("month", theme === "dark" ? "qWTFqZ5lwm" : "CvD8KzS38m");
    await page.locator(".dashboard-calendar-dates button").nth(10).click();
    await expect(page.locator(".dashboard-selected-day>p").first()).toHaveText(
      "Selected day",
    );
    await capture(
      "selected-day",
      theme === "dark" ? "8KlwJCCU9M" : "wqqrTTPdTo",
    );
    await nav.getByRole("button", { name: "Focus queue", exact: true }).click();
    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await capture("compose", theme === "dark" ? "LBIBo1A_05" : "pFxVhCB3hp");
    await page
      .getByRole("region", { name: "Reply composer" })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    for (const [name, title, width, frame] of [
      [
        "event",
        "New event",
        760,
        theme === "dark" ? "F5ItS-WXTF" : "X7gRb7Zpcd",
      ],
      [
        "command",
        "Command console",
        760,
        theme === "dark" ? "L5Eac6sbE4" : "fB_ybTJvyK",
      ],
      [
        "shortcuts",
        "Keyboard shortcuts",
        740,
        theme === "dark" ? "GYUpO9Oksq" : "OwcxrkwgPj",
      ],
    ]) {
      await menu(title);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toHaveCSS("opacity", "1");
      const box = await dialog.boundingBox();
      expect(Math.round(box.width)).toBe(width);
      expect(Math.round(box.y)).toBe(104);
      await capture(name, frame, "[role=dialog]");
      await close();
    }
    await menu("Ask assistant");
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("What needs your attention?", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.locator(".doop-source-welcome button").first(),
    ).toHaveCSS("border-radius", "10px");
    await capture(
      "assistant-welcome",
      theme === "dark" ? "0XY1pUt-1N" : "sa5ThibhQK",
      "[role=dialog]",
    );
    await dialog.getByRole("switch", { name: "Auto-approve actions" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await capture(
      "approval",
      theme === "dark" ? "2q7WkAoRlR" : "vRcbwVedSZ",
      "[role=dialog]",
    );
    await dialog
      .getByRole("button", { name: "Keep asking me", exact: true })
      .click();
    let response = [];
    await page.route("**/api/agent", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body: response
          .map((x) => "data: " + JSON.stringify(x) + "\n\n")
          .join(""),
      }),
    );
    async function send(text) {
      await dialog.getByLabel("Message your assistant").fill(text);
      await dialog.getByLabel("Message your assistant").press("Enter");
    }
    const workspace = await (
      await page.request.get(BASE_URL + "/api/workspace")
    ).json();
    const candidate = workspace.threads[0];
    response = [
      { type: "tool", label: "Triaged inbox" },
      {
        type: "triage",
        result: {
          total: 1,
          threads: [
            {
              threadId: candidate.threadId,
              sender: candidate.sender,
              subject: candidate.subject,
              priorityBand: "high",
              summaryReason: "Confirm the meeting time adjustment",
            },
          ],
        },
      },
    ];
    await send("Show messages that need my response");
    await expect(dialog.locator(".doop-agent-triage h3")).toHaveText(
      "1 thread",
    );
    await expect(dialog.locator('.doop-agent-triage .doop-source-results button').first()).toHaveCSS('flex-direction', 'row');
    await capture(
      "triage",
      theme === "dark" ? "FTTOWatj_1" : "7UrvprmbYh",
      "[role=dialog]",
    );
    await dialog.locator(".doop-agent-triage button").first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(".dashboard-reader h2")).toHaveText(
      candidate.subject,
    );
    await menu("Ask assistant");
    await dialog.getByRole("button", { name: "New chat", exact: true }).click();
    response = [
      { type: "tool", label: "Read thread" },
      { type: "token", text: "I prepared a reply for review." },
      {
        type: "proposal",
        proposal: {
          kind: "email",
          to: "ari@example.com",
          subject: "Launch review",
          body: "Hi Ari,\n\n3 PM works for me. I will review the updated deck before we meet.\n\nSee you then.",
        },
      },
    ];
    await send("Draft a reply");
    await expect(
      dialog.getByRole("button", { name: "Send reply", exact: true }),
    ).toBeVisible();
    await capture('tool-activity', theme === 'dark' ? 'ym378pucpg' : 'cjGprHE6RY', '[role=dialog]');
    await capture(
      "draft",
      theme === "dark" ? "VpyKBw3wII" : "ZSbzsMIJ4h",
      "[role=dialog]",
    );
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(dialog.getByLabel("Subject", { exact: true })).toBeVisible();
    await capture(
      "draft-edit",
      theme === "dark" ? "4v_Ti7qdBW" : "SzcEnf0kqE",
      "[role=dialog]",
    );
    await dialog
      .getByRole("button", { name: "Done editing", exact: true })
      .click();
    await page.route("**/api/messages/send", (r) => r.fulfill({ json: null }));
    await dialog
      .getByRole("button", { name: "Send reply", exact: true })
      .click();
    await expect(dialog.getByText("Sent", { exact: true })).toBeVisible();
    await expect(
      page.getByText("View sent mail", { exact: true }),
    ).toBeVisible();
    await capture("success", theme === "dark" ? "fHmzhyiS-n" : "hamBycIX0J");
    await dialog.getByRole("button", { name: "New chat", exact: true }).click();
    response = [
      { type: "tool", label: "Checked Google Calendar" },
      {
        type: "proposal",
        proposal: {
          kind: "event",
          summary: "Launch review",
          start: "2026-11-18T09:00:00+05:30",
          end: "2026-11-18T09:30:00+05:30",
          attendees: "ari@example.com",
          location: "Google Meet",
          description: "Review the updated deck and agree on next steps.",
        },
      },
    ];
    await send("Schedule a review");
    await expect(
      dialog.getByRole("button", { name: "Create event", exact: true }),
    ).toBeVisible();
    await capture(
      "event-proposal",
      theme === "dark" ? "GIruPrcKHT" : "LUWKnWZ_6a",
      "[role=dialog]",
    );
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(dialog.getByLabel("Title", { exact: true })).toBeVisible();
    await capture(
      "event-edit",
      theme === "dark" ? "PnZr5lx_Eb" : "4fMsvY3d68",
      "[role=dialog]",
    );
    await dialog
      .getByRole("button", { name: "Done editing", exact: true })
      .click();
    await dialog
      .getByRole("button", { name: "Chat history", exact: true })
      .click();
    await expect(dialog.getByText("Your chats", { exact: true })).toBeVisible();
    await capture(
      "history",
      theme === "dark" ? "-mFeSQC-5B" : "X2_Tw5d1xp",
      "[role=dialog]",
    );
    await dialog.getByRole("button", { name: "Chat history", exact: true }).click();
    await page.unroute("**/api/agent");
    await page.route("**/api/agent", (r) =>
      r.fulfill({
        status: 503,
        json: {
          error: "The connection was interrupted. Your message is saved.",
        },
      }),
    );
    await send("Check my inbox");
    await expect(
      dialog.getByRole("button", { name: "Retry response" }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Retry response' })).toBeInViewport();
    await expect(dialog.locator('.doop-agent-retry p').first()).toHaveText('The connection was interrupted. Your message is saved.');
    await capture(
      "retry",
      theme === "dark" ? "oMakIN6tI8" : "hyytQwDO0u",
      "[role=dialog]",
    );
    await close();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const title of [
      "New event",
      "Command console",
      "Keyboard shortcuts",
      "Ask assistant",
    ]) {
      await menu(title);
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      const box = await modal.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
      await page.screenshot({
        path:
          root + "/" + theme + "-mobile-" + title.replaceAll(" ", "-") + ".png",
      });
      await close();
    }
    await menu("Ask assistant");
    await dialog.getByRole("button", { name: "New chat", exact: true }).click();
    await page.unroute("**/api/agent");
    await page.route("**/api/agent", (r) =>
      r.fulfill({
        contentType: "text/event-stream",
        body:
          "data: " +
          JSON.stringify({
            type: "triage",
            result: {
              total: 1,
              threads: [
                {
                  threadId: candidate.threadId,
                  sender: candidate.sender,
                  subject: candidate.subject,
                  priorityBand: "high",
                  summaryReason: "Review this conversation",
                },
              ],
            },
          }) +
          "\n\n",
      }),
    );
    await send("Show reply candidates");
    await dialog.locator(".doop-agent-triage button").first().click();
    await expect(
      page.getByRole("button", { name: "Back to inbox", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".dashboard-reader h2")).toHaveText(
      candidate.subject,
    );
    console.log(
      "PASS",
      theme,
      "public screens, connection fixture, navigation, calendars, compose, overlays, assistant states",
    );
    await context.close();
  }
  if (errors.length) throw Error(errors.join("\n"));
  await writeFile(`${root}/frame-results.json`, JSON.stringify(frameResults, null, 2));
  await writeFile(`${root}/results.json`, JSON.stringify(results, null, 2));
  console.log(
    "PASS",
    results.length,
    "panel captures; widths, placement, themes, date selection, editing, and no page overflow",
  );
} finally {
  await browser.close();
}
