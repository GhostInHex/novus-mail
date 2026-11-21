import { checkFrameCoverage } from './doop-coverage.mjs';
import { writeFile } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';
const BASE_URL = process.env.BASE_URL || "http://localhost:3100";
import { mkdir } from "node:fs/promises";
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
const frameResults = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("../artifacts", { recursive: true });
try {
  await page.goto(BASE_URL + "");
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
      await page.getByRole("heading", { level: 1, name: /Less inbox\. More headspace\./ }).waitFor();
      await page.getByRole("region", { name: "Interactive NovusMail demo" }).waitFor();
      if (await page.getByText(/^(Craft · Manage · Automate|Gmail \+ Google Calendar)$/).count())
        throw new Error(`The hero pill returned in ${mode} mode`);
      for (const img of await page.locator("main img").all()) {
        if (await img.isVisible()) await img.scrollIntoViewIfNeeded();
        await img.evaluate((el) => el.decode());
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `../artifacts/landing-${mode}-${width}.png`,
        fullPage: true,
      });
      if (width === 1440) frameResults.push(...await checkFrameCoverage(page, {scenario: 'landing', theme: mode, screenshot: `../landing-${mode}-${width}.png`}));
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
  const demo = page.getByRole("region", { name: "Interactive NovusMail demo" });
  await demo.getByRole("button", { name: /Maya Chen/ }).click();
  await demo.getByRole("heading", { name: "Homepage copy", exact: true }).waitFor();
  await demo.getByRole("button", { name: "Open draft reply" }).click();
  const reply = demo.getByRole("textbox", { name: "Draft reply" });
  await reply.fill("Hi Maya, I’ll send notes on Friday.");
  await demo.getByRole("button", { name: "Review draft" }).click();
  await demo.getByText("Reviewing sample reply").waitFor();
  if (await reply.isEditable()) throw new Error("The draft should be read-only during review");
  await demo.getByRole("button", { name: "Assistant", exact: true }).click();
  await demo.getByRole("button", { name: "Show sample summary" }).click();
  await demo.getByText("Maya needs a headline check by Friday.", { exact: false }).waitFor();
  await demo.getByRole("button", { name: "Calendar", exact: true }).click();
  await demo.getByRole("button", { name: "Review event" }).click();
  await demo.getByText("Awaiting confirmation").waitFor();
  await demo.getByRole("button", { name: "Drafts", exact: true }).click();
  if ((await reply.inputValue()) !== "Hi Maya, I’ll send notes on Friday.") {
    throw new Error("The sample draft edit was lost when switching scenes");
  }
  await page.reload();
  await page.locator(".landing-page[data-theme-mode=light]").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator(".landing-hero-poster").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Get started", exact: true }).click();
  await page.waitForURL("**/start");
  await writeFile("../artifacts/doop-audit/landing-frame-results.json", JSON.stringify(frameResults, null, 2));
  console.log("Sign-in navigation passed");
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await browser.close();
}
