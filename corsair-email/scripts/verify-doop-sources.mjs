import fs from "node:fs/promises";
import crypto from "node:crypto";
import { launchBrowser } from "./browser.mjs";
import { canvas } from "./doop-source.mjs";
const root = "../artifacts/doop-audit";
await fs.mkdir(`${root}/sources`, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ reducedMotion: "reduce" });
const results = [];
try {
  for (const frame of canvas.frames) {
    const html = await fs.readFile(
      `design/doop/screens/${frame.id}.html`,
      "utf8",
    );
    if (!html.includes("<html") || html.includes("<doop-use"))
      throw Error(`${frame.id}: incomplete expanded source`);
    await page.setViewportSize({ width: frame.width, height: frame.height });
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(
        [...document.images].map(async (img) => {
          img.loading = "eager";
          await img.decode();
        }),
      );
    });
    const metrics = await page.locator("body").evaluate((el) => ({
      text: el.textContent.trim().length,
      elements: el.querySelectorAll("*").length,
      width: el.scrollWidth,
      height: el.scrollHeight,
      images: [...el.querySelectorAll("img")].map((img) => ({
        src: img.src,
        loaded: img.complete && img.naturalWidth > 0,
      })),
    }));
    if (!metrics.elements) throw Error(`${frame.id}: empty render`);
    const screenshot = `sources/${frame.id}.png`;
    await page.screenshot({
      path: `${root}/${screenshot}`,
      animations: "disabled",
    });
    results.push({
      frame: frame.id,
      name: frame.name,
      status: "passed",
      sha256: crypto.createHash("sha256").update(html).digest("hex"),
      screenshot,
      metrics,
    });
    if (results.length % 15 === 0)
      console.log(
        `Rendered ${results.length}/${canvas.frames.length} source frames`,
      );
  }
  await fs.writeFile(
    `${root}/source-results.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(`PASS ${results.length} individual source renders`);
} finally {
  await browser.close();
}
