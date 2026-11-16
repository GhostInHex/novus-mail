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
  const message = dialog.locator('.ai-message-root').first();
  await expect(message.locator('..')).toHaveCSS("animation-name", "none");
  const copy = message.getByRole("button", { name: "Copy", exact: true });
  await copy.focus();
  await expect(copy).toHaveCSS("opacity", "1");
  await expect(copy).toHaveCSS("transition-duration", "0s");
  await expect(copy).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(copy).toHaveCSS("transition-duration", "0s");
  console.log("PASS immediate keyboard message and focus feedback, including reduced motion");
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
