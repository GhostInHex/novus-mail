import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

export function launchBrowser(options = {}) {
  const executablePath =
    process.env.CHROME_PATH ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  return chromium.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" }),
    headless: true,
    ...options,
  });
}
