import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto("http://localhost:3100/start");
  await page.getByRole("button", { name: "Open demo workspace", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("heading", { name: "Focus queue", exact: true }).waitFor();
  await page.getByRole("button", { name: "Workspace menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Ask assistant", exact: true }).click();
  const dialog = page.getByRole("dialog").first();
  const input = dialog.getByLabel("Message your assistant");
  await expect(input).toBeEnabled();
  await page.route("**/api/agent", route => route.fulfill({
    contentType: "text/event-stream",
    body: 'data: {"type":"token","text":"Motion verification response."}\n\n',
  }));
  await input.fill("Motion verification prompt");
  await input.press("Enter");
  await expect(dialog.getByText("Motion verification response.", { exact: true })).toBeVisible();
  const message = dialog.locator('.doop-source-message').first();
  await expect(message).toHaveCSS("animation-name", "none");
  await expect(message.locator('..')).toHaveCSS("animation-name", "none");
  await input.fill("Next prompt");
  const send = dialog.getByRole("button", { name: "Send message", exact: true });
  await send.focus();
  await expect(send).toBeFocused();
  await expect(send).toHaveCSS("transition-duration", "0s");
  await expect(send).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(send).toHaveCSS("transform", "none");
  console.log("PASS immediate Doop keyboard message and send feedback, including reduced motion");
  const landing = await browser.newPage();
  await landing.emulateMedia({ reducedMotion: "reduce" });
  await landing.goto("http://localhost:3100");
  const cta = landing.locator('.nm-glaze').first();
  await cta.hover();
  await expect(cta).toHaveCSS("transform", "none");
  await expect(cta).toHaveCSS("transition-property", "opacity, color, background-color, border-color");
  await cta.focus();
  await landing.keyboard.down("Space");
  await expect(cta).toHaveCSS("transform", "none");
  await landing.keyboard.up("Space");
  console.log("PASS reduced-motion CTA has no positional or scale movement");
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const touchPage = await touch.newPage();
  await touchPage.goto("http://localhost:3100");
  const touchCta = touchPage.locator('.nm-glaze').first();
  await touchCta.hover();
  await expect(touchCta).toHaveCSS("transform", "none");
  console.log("PASS touch pointer does not trigger hover movement");
} finally {
  await browser.close();
}
