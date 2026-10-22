import { chromium, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkDesktopDrag } from "./desktop-drag.mjs";

const KEY = "nico.newtab.state.v1";
const results = [];
const channels = process.argv.slice(2).length
  ? process.argv.slice(2)
  : process.env.BROWSER_EXECUTABLE
    ? ["custom"]
    : ["chrome", "msedge"];
await mkdir("test-results", { recursive: true });

for (const channel of channels) {
  const profile = await mkdtemp(join(tmpdir(), "nico-smoke-"));
  const errors = [];
  let context,
    page,
    stage = "launch";
  async function launch() {
    context = await chromium.launchPersistentContext(profile, {
      ...(process.env.BROWSER_EXECUTABLE
        ? { executablePath: process.env.BROWSER_EXECUTABLE }
        : { channel }),
      headless: true,
      viewport: { width: 1366, height: 768 },
      locale: "zh-CN",
      args: ["--enable-unsafe-extension-debugging"],
      ignoreDefaultArgs: ["--disable-extensions"],
    });
    context.setDefaultTimeout(10000);
    context.on("page", (tab) =>
      tab.on("pageerror", (error) => {
        if (tab.url().startsWith("chrome-extension://"))
          errors.push(error.message);
      }),
    );
    // Search and shortcut destinations are external; only their navigation matters.
    await context.route(/^https?:\/\//, (route) => {
      const request = route.request();
      return request.isNavigationRequest()
        ? route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<title>Destination</title>",
          })
        : route.continue();
    });
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", {
      path: resolve("dist"),
    });
    const { product } = await cdp.send("Browser.getVersion");
    return { id, product, url: `chrome-extension://${id}/index.html` };
  }
  try {
    let browser = await launch();
    page = await context.newPage();
    stage = "new tab loading and MV3 CSP";
    await page.goto(
      browser.product.startsWith("Edg/") ? "edge://newtab" : "chrome://newtab",
    );
    await expect(
      page.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    expect(page.url()).toBe(browser.url);
    await expect(page.locator(".wallpaper")).toHaveClass(/is-loaded/);
    await expect(page.locator(".search-input .ngs-effect")).toHaveCSS(
      "backdrop-filter",
      /url/,
    );

    stage = "shortcut editing, opening and cross-tab storage";
    await page.getByRole("button", { name: "添加常用网站" }).click();
    await page.getByLabel("网站名称", { exact: true }).fill("书房");
    await page.getByLabel("网站地址", { exact: true }).fill("example.com");
    await page.getByRole("button", { name: "保存网站", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const other = await context.newPage();
    await other.goto(browser.url);
    await expect(
      other.getByRole("link", { name: "书房", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "书房", exact: true })
      .click({ button: "right" });
    await page.getByLabel("网站名称", { exact: true }).fill("阅读");
    await page.getByRole("button", { name: "保存网站", exact: true }).click();
    await expect(
      other.getByRole("link", { name: "阅读", exact: true }),
    ).toBeVisible();
    const destination = page.waitForEvent("popup");
    await page.getByRole("link", { name: "阅读", exact: true }).click();
    const tab = await destination;
    await tab.waitForLoadState("domcontentloaded");
    expect(tab.url()).toBe("https://example.com/");
    expect(page.url()).toBe(browser.url);
    await tab.close();

    stage = "wallpaper backup restore and failed import";
    await page.locator(".settings-button").click();
    await page
      .getByLabel("上传壁纸文件", { exact: true })
      .setInputFiles("public/wallpapers/cliff-walk.webp");
    await expect(other.locator(".wallpaper")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    await page.getByRole("radio", { name: "关于", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const exported = JSON.parse(
      await readFile(await (await download).path(), "utf8"),
    );
    expect(exported.wallpaper.dataUrl).toMatch(/^data:image\/webp;base64,/);
    async function restore(value) {
      await page.getByLabel("导入备份文件", { exact: true }).setInputFiles({
        name: "backup.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(value)),
      });
      await page.getByRole("button", { name: "确认替换并恢复" }).click();
    }
    const empty = structuredClone(exported);
    empty.state.shortcuts = [];
    empty.state.pages = empty.state.pages.map((page) => ({
      ...page,
      items: [],
    }));
    empty.state.folders = [];
    empty.state.settings.wallpaper = "rainy-paris";
    empty.state.settings.customWallpaper = null;
    empty.wallpaper = null;
    await restore(empty);
    await expect(other.locator(".shortcut-name")).toHaveCount(1);
    await restore(exported);
    await expect(
      other.getByRole("link", { name: "阅读", exact: true }),
    ).toBeVisible();
    await expect(other.locator(".wallpaper")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    const saved = await page.evaluate(
      (key) => chrome.storage.local.get(key),
      KEY,
    );
    await page.getByLabel("导入备份文件", { exact: true }).setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"foreign"}'),
    });
    await expect(page.getByRole("alert")).toContainText("格式不受支持");
    expect(
      await page.evaluate((key) => chrome.storage.local.get(key), KEY),
    ).toEqual(saved);
    await page.locator(".dialog-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    stage = "IME and browser search";
    const input = page.locator(".search-input input");
    await input.fill("印象派");
    await input.dispatchEvent("compositionstart");
    const count = context.pages().length;
    await input.press("Enter");
    expect(context.pages()).toHaveLength(count);
    await input.dispatchEvent("compositionend");
    await input.fill("nico search regression");
    const opened = context.waitForEvent("page");
    await input.press("Enter");
    const search = await opened;
    await search.waitForLoadState("domcontentloaded");
    expect(decodeURIComponent(search.url()).replaceAll("+", " ")).toContain(
      "nico search regression",
    );
    expect(page.url()).toBe(browser.url);
    await search.close();

    stage = "folder drag and persistence";
    await checkDesktopDrag(page);
    await other.close();

    stage = "browser restart persistence and toolbar add";
    await context.close();
    browser = await launch();
    page = await context.newPage();
    await page.goto(browser.url);
    await expect(
      page.getByRole("link", { name: "阅读", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".wallpaper")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    async function toolbar() {
      const popup = await context.newPage();
      // The toolbar grants activeTab; a headless popup opened as a tab does not.
      await popup.addInitScript(() =>
        Object.defineProperty(chrome.tabs, "query", {
          configurable: true,
          value: async () => [
            { id: 7, url: "https://example.org/popup", title: "工具栏页面" },
          ],
        }),
      );
      await popup.goto(`chrome-extension://${browser.id}/popup.html`);
      return popup;
    }
    const popup = await toolbar();
    await popup.getByRole("button", { name: "添加", exact: true }).click();
    await expect(
      page.getByRole("link", { name: "工具栏页面", exact: true }),
    ).toBeVisible();
    await popup.close();
    const duplicate = await toolbar();
    await expect(
      duplicate.getByRole("button", { name: "添加", exact: true }),
    ).toBeDisabled();
    await duplicate.close();
    expect(errors).toEqual([]);
    results.push({ channel, browser: browser.product, status: "passed" });
    console.log(
      `${channel}: PASS (loading, shortcuts, backup, search, folders, restart, popup)`,
    );
  } catch (error) {
    process.exitCode = 1;
    results.push({ channel, status: "failed", stage, error: error.message });
    console.error(`${channel}: FAIL at ${stage}: ${error.message}`);
    await page
      ?.screenshot({ path: `test-results/${channel}-failure.png` })
      .catch(() => {});
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
await writeFile(
  "test-results/smoke-results.json",
  JSON.stringify(results, null, 2),
);
