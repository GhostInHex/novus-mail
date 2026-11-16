const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/start`);
  await page.getByRole("button", { name: "Open demo workspace", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.getByRole("button", { name: "Compose", exact: true }).click();
  const composer = page.getByRole("region", { name: "New message composer", exact: true });
  for (const name of ["Cc", "Bcc"]) {
    const toggle = composer.getByRole("button", { name, exact: true });
    await toggle.focus();
    await toggle.press("Enter");
    await expect(composer.getByLabel(name, { exact: true })).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(toggle).toHaveAttribute("aria-controls", `compose-${name.toLowerCase()}`);
  }
  const body = composer.getByLabel("Body", { exact: true });
  await body.focus();
  await expect(body).toHaveCSS("outline-style", "solid");
  await expect(body).toHaveCSS("outline-offset", "-4px");
  console.log("PASS recipient focus, disclosure state, and visible body focus");
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const landing = await touch.newPage();
  await landing.goto(BASE_URL);
  for (const control of await landing.locator('.nm-control, .nm-glaze').all()) {
    expect(await control.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }
  const title = landing.locator('.landing-proposal-title');
  const action = landing.locator('.landing-proposal-action');
  const before = await title.boundingBox();
  const buttonBefore = await action.evaluate(el => el.offsetTop);
  await action.click();
  const after = await title.boundingBox();
  const buttonAfter = await action.evaluate(el => el.offsetTop);
  expect(after.height).toBe(before.height);
  expect(buttonAfter).toBe(buttonBefore);
  await expect(title.locator('[aria-hidden="false"]')).toHaveText("Proposal ready for review");
  console.log("PASS 44px touch targets and stable confirmation layout");
} finally { await browser.close(); }
