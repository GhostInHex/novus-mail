import { expect } from '@playwright/test';
import { launchBrowser } from './browser.mjs';

const baseUrl = process.env.BASE_URL || 'http://localhost:3103';
const browser = await launchBrowser();
try {
  for (const width of [2000, 390]) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(theme => localStorage.setItem('novusmail-theme', `${theme}-default`), theme);
      await page.goto(`${baseUrl}/?landing=1`);
      const host = page.locator('[data-ascii-mountains]');
      await expect(host).toHaveAttribute('data-renderer', 'worker');
      await expect(page.locator('html')).toHaveClass(/lenis/);
      const canvas = host.locator('canvas');
      const first = await canvas.screenshot();
      await expect.poll(async () => (await canvas.screenshot()).equals(first)).toBe(false);
      await page.mouse.move(width * 0.15, 280);
      const hovered = await canvas.screenshot();
      await expect.poll(async () => (await canvas.screenshot()).equals(hovered)).toBe(false);
      // The profile checks isolation, not a hardware-specific FPS target.
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Profiler.enable');
      await cdp.send('Profiler.start');
      await page.mouse.wheel(0, 500);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
      const { profile } = await cdp.send('Profiler.stop');
      expect(profile.nodes.filter(node => node.hitCount && /createMountainPainter|ridgeLine/.test(node.callFrame.functionName))).toEqual([]);
      await page.mouse.wheel(0, -1000);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(2);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(host).toHaveCSS('opacity', '0');
      expect(errors).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.close();
      console.log(`${width}px ${theme}: worker animation, smooth scrolling, reduced motion and no browser errors passed`);
    }
  }
  const fallback = await browser.newPage();
  await fallback.addInitScript(() => { HTMLCanvasElement.prototype.transferControlToOffscreen = undefined; });
  await fallback.goto(`${baseUrl}/?landing=1`);
  const host = fallback.locator('[data-ascii-mountains]');
  await expect(host).toHaveAttribute('data-renderer', 'main');
  const first = await host.locator('canvas').screenshot();
  await expect.poll(async () => (await host.locator('canvas').screenshot()).equals(first)).toBe(false);
  await fallback.close();
  console.log('Browser without worker canvas: animated fallback passed');
} finally { await browser.close(); }
