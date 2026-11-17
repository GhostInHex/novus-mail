import { launchBrowser } from './browser.mjs';
const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
import { expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("../artifacts", { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.addInitScript(() =>
    localStorage.setItem("novusmail-theme", "light-default"),
  );
  await page.goto(BASE_URL + "/start");
  await page
    .getByRole("button", { name: "Open demo workspace", exact: true })
    .click();
  await page.waitForURL("**/dashboard");
  await expect(page.locator(".dashboard-reader h2")).toBeVisible();
  await expect(page.locator(".dashboard-queue")).not.toContainText(
    "Mentions scheduling",
  );
  await expect(page.locator(".dashboard-queue")).not.toContainText("Priority");
  await expect(page.locator(".dashboard-reader")).not.toContainText(
    "High priority",
  );
  await expect(page.locator(".dashboard-reader iframe")).toHaveCount(0);
  await expect(page.locator(".dashboard-sidebar")).toHaveCSS(
    "background-color",
    "rgb(242, 241, 237)",
  );
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: "../artifacts/dashboard-new-light.png",
    fullPage: true,
  });
  console.log(
    "PASS new light layout and no legacy badges, previews, or white email frame",
  );
  await expect(
    page.getByRole("button", { name: "Collapse sidebar", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".dashboard-sidebar")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await expect(page.locator(".dashboard-sidebar")).toHaveCSS("width", "200px");
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await expect(page.locator('.dashboard-sidebar')).toHaveCSS('width', '88px');
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await expect(page.locator('.dashboard-sidebar')).toHaveCSS('width', '200px');
  console.log("PASS expanded and collapsed folder navigation");
  await page
    .getByRole("button", { name: "Open month calendar", exact: true })
    .click();
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.getByRole("tab", { name: "Month", exact: true }).click();
  expect(
    await page.locator(".dashboard-calendar-dates button").count(),
  ).toBeGreaterThanOrEqual(35);
  const selectedDay = page.locator(".dashboard-calendar-dates button").nth(12);
  const selectedLabel = await selectedDay.getAttribute("aria-label");
  await selectedDay.click();
  await expect(
    page.locator(".dashboard-selected-day .dashboard-agenda-date"),
  ).toHaveText(selectedLabel);
  await expect(page.getByRole("tabpanel")).toHaveCSS("filter", "none");
  await page.screenshot({
    path: "../artifacts/dashboard-calendar-light.png",
    fullPage: true,
  });
  console.log("PASS new month calendar and day selection");
  await page
    .getByRole("button", { name: "Workspace menu", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Switch to dark mode", exact: true })
    .click();
  await expect(page.locator(".dashboard")).toHaveAttribute(
    "data-theme-mode",
    "dark",
  );
  await page.screenshot({
    path: "../artifacts/dashboard-new-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Focus queue", exact: true })
    .click();
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Reply composer", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-embedded-assistant")).toBeVisible();
  await page.screenshot({
    path: "../artifacts/dashboard-compose-dark.png",
    fullPage: true,
  });
  console.log("PASS inline compose and assistant layout");
  await page
    .getByRole("region", { name: "Reply composer" })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Calendar", exact: true })
    .click();
  await page.getByRole("tab", { name: "Week", exact: true }).click();
  await page.locator(".dashboard-week-empty").first().click();
  await expect(
    page.getByRole("dialog").getByLabel("Start", { exact: true }),
  ).toHaveValue(/T09:00$/);
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "../artifacts/dashboard-week-dark.png",
    fullPage: true,
  });
  console.log("PASS week grid time slot presets");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open folders" }).click();
  await page
    .getByRole("navigation", { name: "Workspace", exact: true })
    .getByRole("button", { name: "Focus queue", exact: true })
    .click();
  await page.locator(".dashboard-queue li button").first().click();
  await expect(
    page.getByRole("button", { name: "Back to inbox" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({
    path: "../artifacts/dashboard-new-mobile.png",
    fullPage: true,
  });
  console.log("PASS mobile queue and reader");
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
