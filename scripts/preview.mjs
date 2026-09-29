import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on("pageerror", (e) => console.error(e));
const catalog = JSON.parse(
  await fs.readFile("public/catalog.local.json", "utf8"),
);
await fs.mkdir("public/previews", { recursive: true });
for (const c of catalog.cases.filter((c) => c.variants[0].SR === 1)) {
  await page.goto(`http://127.0.0.1:4173/?case=${c.id}`);
  await page.locator("canvas").waitFor({ timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.locator("canvas").screenshot({ path: `public${c.thumbnail}` });
  console.log("preview", c.id);
}
await page.goto("http://127.0.0.1:4173/");
await page.locator("canvas").waitFor();
await page.waitForTimeout(1000);
await page.screenshot({ path: ".local/home-desktop.png", fullPage: true });
await browser.close();
