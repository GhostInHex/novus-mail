import { launchBrowser } from './browser.mjs';
import { expect } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:3100";
const browser = await launchBrowser();
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.on("pageerror", error => console.error("BROWSER ERROR", error.message));
    await page.goto(baseURL + "/start");
    await page.getByRole("button", { name: "Open demo workspace", exact: true }).click();
    await page.waitForURL("**/dashboard");
    const search = page.getByRole("textbox", { name: "Search mail", exact: true });
    await expect(search).toHaveAttribute("placeholder", "Search mail, people, or commands");
    expect(await search.evaluate(el => getComputedStyle(el, "::placeholder").color)).not.toBe("rgba(0, 0, 0, 0)");
    if (width < 768) await page.getByRole("button", { name: "Open folders", exact: true }).click();
    const compose = page.getByRole("button", { name: "Compose", exact: true });
    await compose.click();
    const form = page.getByRole("region", { name: "New message composer", exact: true });
    await expect(form.getByLabel("To", { exact: true })).toBeFocused();
    await form.getByLabel("To", { exact: true }).fill("ari@example.com");
    await form.getByLabel("Subject", { exact: true }).fill("Unsaved subject");
    await form.getByLabel("Body", { exact: true }).fill("Unsaved body");
    await form.getByRole("button", { name: "Close", exact: true }).click();
    let confirmation = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(form.getByLabel("Subject", { exact: true })).toHaveValue("Unsaved subject");
    await expect(form.getByLabel("Body", { exact: true })).toHaveValue("Unsaved body");
    await form.getByLabel("Body", { exact: true }).press("Escape");
    await confirmation.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(form).not.toBeVisible();
    await expect(width < 768 ? page.getByRole("button", { name: "Open folders", exact: true }) : compose).toBeFocused();

    await page.getByRole("button", { name: "Workspace menu", exact: true }).click();
    await page.getByRole("menuitem", { name: "New event", exact: true }).click();
    const event = page.getByRole("dialog", { name: "New event", exact: true });
    await event.getByLabel("Title", { exact: true }).fill("Unsaved event");
    await event.getByLabel("Location", { exact: true }).fill("Meeting room");
    await event.getByLabel("Title", { exact: true }).press("Escape");
    confirmation = page.getByRole("dialog", { name: "Discard unsaved changes?" });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Keep editing", exact: true }).click();
    await expect(event.getByLabel("Title", { exact: true })).toHaveValue("Unsaved event");
    await expect(event.getByLabel("Location", { exact: true })).toHaveValue("Meeting room");
    await event.getByRole("button", { name: "Cancel", exact: true }).click();
    await confirmation.getByRole("button", { name: "Discard changes", exact: true }).click();
    await expect(event).not.toBeVisible();

    let requestedURL;
    await page.route("**/api/threads/*", route => {
      requestedURL = route.request().url();
      return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    });
    await page.locator(".dashboard-queue li button").first().click();
    const reader = page.locator(".dashboard-reader");
    await expect(reader.getByRole("alert")).toContainText("Couldn’t load this conversation");
    const failedURL = requestedURL;
    await page.unroute("**/api/threads/*");
    const response = page.waitForResponse(response => response.url() === failedURL && response.ok());
    await reader.getByRole("button", { name: "Retry", exact: true }).click();
    await response;
    await expect(reader.getByRole("alert")).toHaveCount(0);
    await expect(reader.locator("h2").first()).toBeVisible();
    console.log(`PASS ${width}px: unsaved fields, Compose focus and restoration, reader Retry, search cue`);
    await page.close();
  }
} finally {
  await browser.close();
}
