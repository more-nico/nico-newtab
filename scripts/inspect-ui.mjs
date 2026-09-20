import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("test-results", { recursive: true });
const browser = await chromium.launchPersistentContext("", {
  channel: "chromium",
  headless: true,
  viewport: { width: 1440, height: 960 },
  args: [
    `--disable-extensions-except=${resolve("dist")}`,
    `--load-extension=${resolve("dist")}`,
  ],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.log("PAGE ERROR:", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("CONSOLE:", message.text());
  });
  await page.goto("chrome://newtab");
  await page.getByRole("button", { name: "添加常用网站" }).waitFor();
  await page.locator(".wallpaper.is-loaded").waitFor();
  await page.waitForTimeout(1200);
  console.log("LOCATION", await page.evaluate(() => location.href));
  console.log("BODY", await page.locator("body").innerText());
  console.log(
    "QUALITY",
    await page.locator(".search-input").getAttribute("data-ngs-quality"),
  );
  await page.screenshot({ path: "test-results/home.png" });
  await page.getByRole("button", { name: /画作集/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/settings.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/settings-narrow.png" });
} finally {
  await browser.close();
}
