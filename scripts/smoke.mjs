import { chromium, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("test-results", { recursive: true });
const KEY = "nico.newtab.state.v1";
const PLAYGROUND_DEFAULTS = {
  blur: 3,
  saturation: 100,
  brightness: 1.1,
  mapScale: 0.2,
  depth: 8,
  curvature: 0.2,
  dispersion: 0.1,
  highlight: 1,
  elasticity: 0.2,
};
const GLASS_SLIDERS = [
  ["模糊 Blur", "3"],
  ["饱和度 Saturation", "100"],
  ["亮度 Brightness", "1.1"],
  ["贴图精度 Map scale", "0.2"],
  ["折射带 Depth", "8"],
  ["曲率 Curvature", "0.2"],
  ["色散 Dispersion", "0.1"],
  ["高光 Highlight", "1"],
  ["弹性 Elasticity", "0.2"],
];
const results = [];
const channels = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["chrome", "msedge"];
for (const channel of channels) {
  const profile = resolve(`.cache/smoke-${channel}-${Date.now()}`);
  let context;
  const errors = [];
  const badRequests = [];
  let stage = "launch";
  try {
    async function launch() {
      const ctx = await chromium.launchPersistentContext(profile, {
        channel,
        headless: true,
        viewport: { width: 1366, height: 768 },
        args: ["--enable-unsafe-extension-debugging"],
        ignoreDefaultArgs: ["--disable-extensions"],
      });
      const cdp = await ctx.browser().newBrowserCDPSession();
      ctx.setDefaultTimeout(10000);
      ctx.setDefaultNavigationTimeout(15000);
      const { id } = await cdp.send("Extensions.loadUnpacked", {
        path: resolve("dist"),
      });
      return {
        ctx,
        id,
        version: (await cdp.send("Browser.getVersion")).product,
      };
    }
    let browser = await launch();
    context = browser.ctx;
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      if (
        request.url().startsWith("chrome-extension:") &&
        !request.url().includes("_favicon")
      )
        badRequests.push(request.url());
    });
    stage = "new tab override";
    await page.goto(channel === "msedge" ? "edge://newtab" : "chrome://newtab");
    await expect(
      page.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    expect(await page.evaluate(() => location.protocol)).toBe(
      "chrome-extension:",
    );
    await expect(page.locator(".wallpaper")).toHaveClass(/is-loaded/);
    await expect(page.locator(".search-input")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    await expect(page.locator(".search-input .ngs-effect")).toHaveCSS(
      "backdrop-filter",
      /url/,
    );
    const initialRequests = [];
    page.on("request", (request) => initialRequests.push(request.url()));
    await page.reload();
    await expect(page.locator(".wallpaper")).toHaveClass(/is-loaded/);
    expect(
      new Set(
        initialRequests.filter((url) => /\/wallpapers\/.*\.webp/.test(url)),
      ).size,
    ).toBe(1);
    expect(initialRequests.some((url) => /^https?:/.test(url))).toBe(false);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/${channel}-home-1366.png` });

    stage = "shortcuts create and edit";
    console.log(channel, stage);
    async function add(name, url) {
      await page.getByRole("button", { name: "添加常用网站" }).click();
      await expect(page.getByLabel("网站名称", { exact: true })).toBeFocused();
      await expect(page.locator(".shortcut-form .ngs-input")).toHaveCount(2);
      for (const input of await page
        .locator(".shortcut-form .ngs-input")
        .all()) {
        await expect(input).toHaveAttribute("data-ngs-quality", "high");
        await expect(input.locator(".ngs-effect")).toHaveCSS(
          "backdrop-filter",
          /url/,
        );
      }
      await page.getByLabel("网站名称", { exact: true }).fill(name);
      await page.getByLabel("网站地址", { exact: true }).fill(url);
      await expect(page.getByLabel("网站名称", { exact: true })).toHaveValue(
        name,
      );
      await page.getByRole("button", { name: "保存网站", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }
    await add("GitHub", "github.com");
    await add("MDN", "developer.mozilla.org");
    await add("我的书房", "example.com");
    await expect(
      page.getByRole("link", { name: "GitHub", exact: true }),
    ).toHaveAttribute("href", "https://github.com/");
    const other = await context.newPage();
    await other.goto(`chrome-extension://${browser.id}/index.html`);
    await expect(other.locator(".shortcut-name")).toContainText([
      "GitHub",
      "MDN",
      "我的书房",
      "添加网站",
    ]);
    await page
      .getByRole("button", { name: "编辑 我的书房", exact: true })
      .click();
    await page.getByLabel("网站名称", { exact: true }).fill("阅读");
    await page.getByRole("button", { name: "向前移动" }).click();
    await expect(page.locator(".editor-order")).toContainText("2 / 3");
    await page.getByRole("button", { name: "保存网站", exact: true }).click();
    await expect(other.locator(".shortcut-name")).toContainText([
      "GitHub",
      "阅读",
      "MDN",
      "添加网站",
    ]);
    await page
      .locator(".shortcut-item")
      .nth(2)
      .dragTo(page.locator(".shortcut-item").nth(0));
    await expect(other.locator(".shortcut-name")).toContainText([
      "MDN",
      "GitHub",
      "阅读",
      "添加网站",
    ]);
    await page.getByRole("button", { name: "编辑 阅读", exact: true }).click();
    await page.getByRole("button", { name: "移除", exact: true }).click();
    await page.getByRole("button", { name: "确认移除", exact: true }).click();
    await expect(other.locator(".shortcut-name")).toContainText([
      "MDN",
      "GitHub",
      "添加网站",
    ]);

    stage = "offline artworks and settings";
    console.log(channel, stage);
    await context.setOffline(true);
    await page.getByRole("button", { name: /画作集/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(page.locator(".dialog-body")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    await expect(page.locator(".settings-tabs")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    await expect(page.locator(".wallpaper-picker")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    expect(await dialog.locator('[data-ngs-quality="low"]').count()).toBe(0);
    for (const [label, title] of [
      ["悬崖漫步", "普尔维尔的悬崖漫步"],
      ["巴黎街道", "巴黎街道，雨天"],
      ["睡莲", "睡莲"],
    ]) {
      await page.getByRole("radio", { name: label, exact: true }).click();
      await expect(page.locator(".wallpaper")).toHaveClass(/is-loaded/);
      await expect(other.locator(".art-credit")).toContainText(title);
    }
    await page.getByText("完整", { exact: true }).click({ force: true });
    await expect(page.locator(".wallpaper")).toHaveCSS(
      "background-size",
      "contain",
    );
    await page.getByText("铺满", { exact: true }).click({ force: true });
    await page.getByRole("slider", { name: "水平位置" }).fill("70");
    await expect(other.locator(".wallpaper")).toHaveCSS(
      "background-position",
      "70% 50%",
    );
    await page.getByRole("slider", { name: "水平位置" }).fill("50");
    await page.getByRole("radio", { name: "外观", exact: true }).click();
    await expect(
      page.locator(".range-setting .ngs-slider").first(),
    ).toHaveAttribute("data-ngs-quality", "high");
    await page.getByRole("slider", { name: "壁纸亮度" }).fill("90");
    await page.getByRole("slider", { name: "壁纸模糊" }).fill("3");
    await expect(other.locator(".wallpaper")).toHaveCSS(
      "filter",
      "brightness(0.9) blur(3px)",
    );
    for (const [label, value] of GLASS_SLIDERS)
      await expect(page.getByRole("slider", { name: label })).toHaveValue(
        value,
      );
    const customizedGlass = {
      blur: 7,
      saturation: 135,
      brightness: 0.9,
      mapScale: 0.3,
      depth: 12,
      curvature: 0.5,
      dispersion: 0.2,
      highlight: 1.25,
      elasticity: 0.3,
    };
    for (const [label, key] of [
      ["模糊 Blur", "blur"],
      ["饱和度 Saturation", "saturation"],
      ["亮度 Brightness", "brightness"],
      ["贴图精度 Map scale", "mapScale"],
      ["折射带 Depth", "depth"],
      ["曲率 Curvature", "curvature"],
      ["色散 Dispersion", "dispersion"],
      ["高光 Highlight", "highlight"],
      ["弹性 Elasticity", "elasticity"],
    ])
      await page
        .getByRole("slider", { name: label })
        .fill(String(customizedGlass[key]));
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            chrome.storage.local
              .get(key)
              .then((data) => data[key].settings.glass),
          KEY,
        ),
      )
      .toEqual(customizedGlass);
    await other.getByRole("button", { name: /个性化/ }).click();
    for (const [label, key] of [
      ["模糊 Blur", "blur"],
      ["饱和度 Saturation", "saturation"],
      ["亮度 Brightness", "brightness"],
      ["贴图精度 Map scale", "mapScale"],
      ["折射带 Depth", "depth"],
      ["曲率 Curvature", "curvature"],
      ["色散 Dispersion", "dispersion"],
      ["高光 Highlight", "highlight"],
      ["弹性 Elasticity", "elasticity"],
    ])
      await expect(other.getByRole("slider", { name: label })).toHaveValue(
        String(customizedGlass[key]),
      );
    await other.keyboard.press("Escape");
    await page.getByText("轻盈", { exact: true }).click({ force: true });
    await expect(page.locator(".dialog-body")).toHaveAttribute(
      "data-ngs-quality",
      "low",
    );
    await expect
      .poll(() =>
        page
          .locator(".dialog-body > .ngs-motion > .ngs-effect")
          .evaluate((element) => getComputedStyle(element).backdropFilter),
      )
      .toMatch(/blur\(7px\).*saturate\((135%|1\.35)\).*brightness\(0\.9\)/);
    await expect(other.locator(".search-input")).toHaveAttribute(
      "data-ngs-quality",
      "low",
    );
    await expect
      .poll(() =>
        other
          .locator(".search-input .ngs-effect")
          .evaluate((element) => getComputedStyle(element).backdropFilter),
      )
      .toMatch(/blur\(7px\).*saturate\((135%|1\.35)\).*brightness\(0\.9\)/);
    await page.getByRole("button", { name: "恢复 Playground 默认值" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          (key) =>
            chrome.storage.local
              .get(key)
              .then((data) => data[key].settings.glass),
          KEY,
        ),
      )
      .toEqual(PLAYGROUND_DEFAULTS);
    await page.getByText("12 小时", { exact: true }).click({ force: true });
    await expect(other.locator(".day-period")).toBeVisible();
    await page.getByText("细腻", { exact: true }).click({ force: true });
    await expect(page.locator(".dialog-body")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    expect(await dialog.locator('[data-ngs-quality="low"]').count()).toBe(0);
    await expect(other.locator(".search-input")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    await page.getByRole("slider", { name: "壁纸模糊" }).fill("0");
    await page.getByRole("slider", { name: "壁纸亮度" }).fill("85");
    await page.getByText("24 小时", { exact: true }).click({ force: true });
    // Only two tiers remain: the retired "均衡" must not be offered.
    await expect(page.getByText("均衡", { exact: true })).toHaveCount(0);
    await page.getByText("细腻", { exact: true }).click({ force: true });
    await expect(page.locator(".dialog-body")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    await page.screenshot({
      path: `test-results/${channel}-appearance-1366.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${channel}-appearance-390.png`,
    });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.getByRole("radio", { name: "壁纸", exact: true }).click();
    await page.screenshot({
      path: `test-results/${channel}-settings-1366.png`,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/${channel}-settings-390.png` });
    // Focus must stay in the modal and return to the opening button.
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(() =>
        Boolean(document.activeElement?.closest('[role="dialog"]')),
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /画作集/ })).toBeFocused();
    await page.screenshot({ path: `test-results/${channel}-home-390.png` });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: `test-results/${channel}-home-1920.png` });
    await context.setOffline(false);

    stage = "upload and full backup restore";
    console.log(channel, stage);
    await page.getByRole("button", { name: /画作集/ }).click();
    await page
      .getByLabel("上传壁纸文件", { exact: true })
      .setInputFiles("public/wallpapers/cliff-walk.webp");
    await expect(page.getByText("图片已保存到本地。")).toBeVisible();
    await expect(other.locator(".art-credit")).toContainText("我的风景");
    await expect(other.locator(".wallpaper")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    await page.getByLabel("上传壁纸文件", { exact: true }).setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByRole("alert")).toContainText("无法解码");
    await expect(other.locator(".art-credit")).toContainText("我的风景");
    await page.getByRole("radio", { name: "备份", exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出", exact: true }).click();
    const backupPath = `test-results/${channel}-backup.json`;
    await (await download).saveAs(backupPath);
    const exported = JSON.parse(await readFile(backupPath, "utf8"));
    expect(exported.state.shortcuts).toHaveLength(2);
    expect(exported.wallpaper.dataUrl).toMatch(/^data:image\/webp;base64,/);
    // A complete replacement may contain no custom wallpaper.
    const builtIn = structuredClone(exported);
    builtIn.state.settings.customWallpaper = null;
    builtIn.state.settings.wallpaper = "rainy-paris";
    builtIn.state.shortcuts = [];
    builtIn.wallpaper = null;
    await page.getByLabel("导入备份文件", { exact: true }).setInputFiles({
      name: "built-in.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(builtIn)),
    });
    await page.getByRole("button", { name: "确认替换并恢复" }).click();
    await expect(other.locator(".art-credit")).toContainText("巴黎街道，雨天");
    await expect(other.locator(".shortcut-name")).toHaveCount(1);
    await page
      .getByLabel("导入备份文件", { exact: true })
      .setInputFiles(backupPath);
    await page.getByRole("button", { name: "确认替换并恢复" }).click();
    await expect(other.locator(".art-credit")).toContainText("我的风景");
    await expect(other.locator(".shortcut-name")).toHaveCount(3);
    const savedBeforeBadImport = await page.evaluate(
      (key) => chrome.storage.local.get(key),
      KEY,
    );
    await page.getByLabel("导入备份文件", { exact: true }).setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"format":"other"}'),
    });
    await expect(page.getByRole("alert")).toContainText("格式不受支持");
    expect(
      await page.evaluate((key) => chrome.storage.local.get(key), KEY),
    ).toEqual(savedBeforeBadImport);
    await page.keyboard.press("Escape");

    stage = "search, IME and reduced motion";
    console.log(channel, stage);
    const searchPage = await context.newPage();
    await searchPage.goto(`chrome-extension://${browser.id}/index.html`);
    await expect(
      searchPage.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    // Composition Enter must not call the real browser search API.
    const searchInput = searchPage
      .getByRole("searchbox", { name: "搜索" })
      .or(searchPage.getByRole("textbox", { name: "搜索", exact: true }));
    await searchInput.fill("印象派");
    await searchInput.dispatchEvent("compositionstart");
    await searchInput.press("Enter");
    expect(searchPage.url()).toContain(browser.id);
    await searchInput.dispatchEvent("compositionend");
    // Intercept navigation only, leaving chrome.search itself real.
    await searchPage.route(/^https?:\/\//, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<h1>Search destination reached</h1>",
      }),
    );
    await searchInput.fill("nico impressionist test");
    await searchInput.press("Enter");
    await searchPage.waitForURL(/^https?:\/\//);
    expect(decodeURIComponent(searchPage.url()).replaceAll("+", " ")).toContain(
      "nico impressionist test",
    );
    await searchPage.close();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".search-input")).toHaveAttribute(
      "data-ngs-quality",
      "low",
    );
    await page.getByRole("button", { name: /个性化/ }).click();
    await expect(page.locator(".dialog-body")).toHaveAttribute(
      "data-ngs-quality",
      "low",
    );
    await expect(
      page.locator(".range-setting .ngs-slider").first(),
    ).toHaveAttribute("data-ngs-quality", "low");
    await page.keyboard.press("Escape");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(page.locator(".search-input")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );

    stage = "persistence after browser restart";
    await context.close();
    context = undefined;
    browser = await launch();
    context = browser.ctx;
    const reopened = await context.newPage();
    await reopened.goto(`chrome-extension://${browser.id}/index.html`);
    await expect(reopened.locator(".shortcut-name")).toContainText([
      "MDN",
      "GitHub",
      "添加网站",
    ]);
    await expect(reopened.locator(".art-credit")).toContainText("我的风景");
    await expect(reopened.locator(".wallpaper")).toHaveCSS(
      "background-image",
      /blob:/,
    );
    expect(errors).toEqual([]);
    expect(badRequests).toEqual([]);
    results.push({
      channel,
      version: browser.version,
      status: "passed",
      scenarios: [
        "newtab override",
        "MV3 CSP and refraction",
        "single local wallpaper on startup",
        "shortcut CRUD and keyboard/drag sorting",
        "cross-tab storage updates",
        "offline artwork switching",
        "fit and positioning",
        "brightness and blur",
        "playground glass defaults and live optics",
        "glass settings cross-tab sync and reset",
        "global glass material on dialogs and controls",
        "playground input focus and typing behavior",
        "12/24 hour clock",
        "glass quality",
        "modal keyboard focus",
        "1366/1920/390 layouts",
        "wallpaper upload and corrupt image",
        "full backup restore",
        "invalid backup retains data",
        "real default search API",
        "IME",
        "reduced motion",
        "browser restart persistence",
      ],
    });
    console.log(`${channel}: PASS (${browser.version})`);
  } catch (error) {
    results.push({
      channel,
      status: "failed",
      stage,
      error: error.message,
      errors,
      badRequests,
    });
    console.error(`${channel}: FAIL at ${stage}: ${error.message}`);
    for (const page of context?.pages() ?? [])
      if (page.url().includes("chrome-extension:")) {
        await page
          .screenshot({ path: `test-results/${channel}-failure.png` })
          .catch(() => {});
        break;
      }
    process.exitCode = 1;
  } finally {
    await context?.close();
  }
}
await writeFile(
  "test-results/smoke-results.json",
  JSON.stringify(results, null, 2),
);
