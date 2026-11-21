const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
import { expect } from "@playwright/test";
import { launchBrowser } from "./browser.mjs";

const browser = await launchBrowser();
try {
  const desktop = process.env.DEMO_VIEWPORT === "desktop";
  const page = await browser.newPage({
    viewport: desktop ? { width: 1440, height: 1000 } : { width: 390, height: 844 },
    colorScheme: desktop ? "light" : "dark",
    hasTouch: !desktop,
  });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(BASE_URL);
  const demo = page.getByRole("region", { name: "Interactive NovusMail demo" });
  const stop = demo.getByRole("button", { name: "Stop demo" });
  const replay = demo.getByRole("button", { name: "Replay demo" });
  await demo.scrollIntoViewIfNeeded();
  for (const target of ["thread-0", "open-draft", "review-draft", "assistant", "summary", "calendar", "review-event"]) {
    await page.waitForFunction((name) => {
      const pointer = document.querySelector(".product-demo-pointer[data-pressed=true]");
      const bounds = document.querySelector(`[data-demo-target="${name}"]`)?.getBoundingClientRect();
      if (!pointer || !bounds) return false;
      const { x, y } = pointer.getBoundingClientRect();
      return x > bounds.left && x < bounds.right &&
        y > bounds.top && y < bounds.bottom && y >= 0 && y < innerHeight;
    }, target, { timeout: 7000 }).catch((error) => {
      throw new Error(`Cursor missed ${target} in the ${desktop ? "desktop" : "phone"} viewport`, { cause: error });
    });
  }
  await expect(demo.getByText("Awaiting confirmation")).toBeVisible({ timeout: 8500 });
  await expect(replay).toBeVisible({ timeout: 4500 });
  await replay.click();
  await expect(demo.getByRole("heading", { name: "Focus queue" })).toBeVisible();
  await stop.click();
  await expect(demo.locator(".product-demo-pointer")).not.toHaveAttribute("data-visible", "true");
  const assistant = demo.getByRole("button", { name: "Assistant", exact: true });
  const show = demo.getByRole("button", { name: "Show sample summary" });
  const hide = demo.getByRole("button", { name: "Hide summary" });
  const summary = demo.getByRole("list");
  const proposal = page.locator(".landing-proposal-action");
  const check = proposal.locator(".landing-proposal-check");
  await assistant.press("Enter");
  await show.press("Enter");
  await expect(summary).toHaveCSS("animation-name", "product-demo-enter");
  await expect(hide).toBeFocused();
  await hide.press("Enter");
  await expect(summary).toHaveCount(0);
  await expect(show).toBeFocused();
  await proposal.click();
  await expect(check).toHaveCSS("opacity", "1");
  await expect(check).toHaveCSS("transition-duration", "0.18s, 0.18s");
  await proposal.focus();
  await proposal.press("Enter");
  await expect(check).toHaveCSS("opacity", "0");
  await expect(check).toHaveCSS("transition-duration", "0s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await demo.scrollIntoViewIfNeeded();
  await expect(stop).toBeHidden();
  await expect(demo.getByRole("heading", { name: "Focus queue" })).toBeVisible();
  await expect(demo.locator(".product-demo-pointer")).toBeHidden();
  await assistant.click();
  await proposal.click();
  await expect(check).toHaveCSS("transform", "none");
  await show.click();
  await expect(summary).toHaveCSS("animation-name", "none");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(summary).toBeVisible();
  expect(errors).toEqual([]);
  console.log("PASS autoplay, cursor, replay, keyboard focus, reduced motion, and summary persistence across breakpoints");
} finally {
  await browser.close();
}
