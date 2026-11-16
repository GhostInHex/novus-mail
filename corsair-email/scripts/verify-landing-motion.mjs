import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("http://localhost:3100");
  const preview = page.locator(".landing-preview-reveal");
  const trigger = page.locator('[aria-controls="landing-reply-preview"]');
  const proposal = page.locator(".landing-proposal-action");
  const check = proposal.locator(".landing-proposal-check");
  await expect(preview).toHaveCSS("height", "0px");
  await trigger.click();
  await expect(preview).toHaveCSS("opacity", "1");
  await expect(preview).toHaveAttribute("aria-hidden", "false");
  await expect.poll(() => preview.evaluate(el => el.clientHeight)).toBeGreaterThan(0);
  await expect(preview).toHaveCSS("transition-duration", "0.24s, 0.18s");
  for (let i = 0; i < 4; i++) await trigger.click({ delay: 0 });
  await trigger.click();
  await expect(preview).toHaveCSS("height", "0px");
  await trigger.focus();
  await trigger.press("Enter");
  await expect(preview).toHaveCSS("transition-duration", "0s");
  await expect(preview).toHaveCSS("opacity", "1");
  await proposal.click();
  await expect(check).toHaveCSS("opacity", "1");
  await expect(check).toHaveCSS("transition-duration", "0.18s, 0.18s");
  await proposal.focus();
  await proposal.press("Enter");
  await expect(check).toHaveCSS("opacity", "0");
  await expect(check).toHaveCSS("transition-duration", "0s");
  console.log("PASS pointer transitions, rapid preview reversal, immediate keyboard changes");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await proposal.click();
  await expect(check).toHaveCSS("transform", "none");
  await expect(check).toHaveCSS("transition-property", "opacity, color, background-color, border-color");
  await trigger.click();
  await trigger.click();
  await expect(preview).toHaveCSS("transition-duration", "0.2s");
  await expect(preview).toHaveCSS("transition-property", "opacity, color, background-color, border-color");
  await expect(preview).toHaveCSS("opacity", "1");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => preview.evaluate(el => Math.abs(el.clientHeight - el.firstElementChild.getBoundingClientRect().height))).toBeLessThan(2);
  expect(errors).toEqual([]);
  console.log("PASS reduced-motion fades and responsive measured preview height; no runtime errors");
} finally {
  await browser.close();
}
