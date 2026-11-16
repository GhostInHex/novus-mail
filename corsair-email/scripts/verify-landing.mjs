import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("../artifacts", { recursive: true });
try {
  await page.goto("http://localhost:3100");
  await page.locator(".landing-page").waitFor();
  await page.evaluate(() => document.fonts.ready);
  for (const mode of ["dark", "light"]) {
    if (
      (await page.locator(".landing-page").getAttribute("data-theme-mode")) !==
      mode
    )
      await page
        .getByRole("button", { name: `Switch to ${mode} mode` })
        .click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const img of await page.locator("main img").all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate((el) => el.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `../artifacts/landing-${mode}-${width}.png`,
        fullPage: true,
      });
      const metrics = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        secondary: getComputedStyle(document.querySelector("main p")).color,
        bg: getComputedStyle(document.querySelector(".landing-page"))
          .backgroundColor,
        images: [...document.images].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      }));
      if (metrics.scroll > width || !metrics.images)
        throw new Error(JSON.stringify(metrics));
      console.log(mode, width, metrics);
    }
  }
  await page.getByRole("button", { name: "Drafts", exact: true }).click();
  await page
    .getByRole("button", { name: "Draft summary", exact: true })
    .click();
  await page.getByRole("status").waitFor();
  await page.reload();
  await page.locator(".landing-page[data-theme-mode=light]").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator("canvas").first().waitFor();
  await page.getByRole("link", { name: "Get started", exact: true }).click();
  await page.waitForURL("**/start");
  console.log("Sign-in navigation passed");
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
