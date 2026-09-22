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
    // Trailing controls must sit flush with their row's content edge. When a
    // bare `> div { flex: 1 }` rule also matches a .button-pair, the buttons get
    // a stretched box and strand themselves mid-row — the trap that hid in both
    // the shortcut editor's icon row and the engine cards.
    const rightEdgeProblems = (target, checks) =>
      target.evaluate((checks) => {
        const problems = [];
        for (const check of checks) {
          const control = document.querySelector(check.control);
          const reference = document.querySelector(check.reference);
          if (!control || !reference) {
            problems.push("missing node for " + check.label);
            continue;
          }
          const inset = check.paddingInset
            ? parseFloat(getComputedStyle(reference).paddingRight)
            : 0;
          const expected = reference.getBoundingClientRect().right - inset;
          const actual = control.getBoundingClientRect().right;
          if (Math.abs(expected - actual) > 1)
            problems.push(
              `${check.label}: ends at ${actual.toFixed(1)}, row ends at ${expected.toFixed(1)}`,
            );
        }
        return problems;
      }, checks);
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
    // The clock is GlassText: one glass tile per character, and none of them
    // may carry a frame — a shadow on the moving layer would draw the tile's
    // rectangle around every digit.
    await expect(page.locator(".clock .ngs-text-tile").first()).toBeAttached();
    const clock = await page.evaluate(() => {
      const tiles = [...document.querySelectorAll(".clock .ngs-text-tile")];
      return {
        count: tiles.length,
        framed: tiles.filter(
          (tile) =>
            getComputedStyle(tile.querySelector(":scope > .ngs-motion"))
              .boxShadow !== "none",
        ).length,
        glyphs: document.querySelector(".clock")?.textContent ?? "",
      };
    });
    expect(clock.count).toBe(5);
    expect(clock.framed).toBe(0);
    expect(clock.glyphs).toMatch(/^\d{2}:\d{2}$/);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `test-results/${channel}-home-1366.png` });

    stage = "shortcuts create and edit";
    console.log(channel, stage);
    async function add(name, url) {
      await page.getByRole("button", { name: "添加常用网站" }).click();
      await expect(page.getByLabel("网站名称", { exact: true })).toBeFocused();
      await expect(page.locator(".shortcut-form .ngs-input")).toHaveCount(2);
      for (const input of await page.locator(".shortcut-form .ngs-input").all())
        await expect(input).toHaveAttribute("data-ngs-quality", "high");
      // Refraction under the MV3 CSP lives on the dialog pane: the surfaces
      // nested inside it intentionally drop their own backdrop-filter, because
      // that filter only ever sampled the pane's empty backdrop root.
      await expect(
        page.locator(".dialog-body > .ngs-motion > .ngs-effect"),
      ).toHaveCSS("backdrop-filter", /url/);
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
    // A shortcut opens beside the new tab page, never on top of it — the page
    // must survive the click so the user still has their tiles. The route has to
    // live on the context: the click creates a *new* page, and a route
    // registered on `page` never sees it.
    const githubRoute = (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<h1>GitHub</h1>",
      });
    await context.route("https://github.com/**", githubRoute);
    try {
      const origin = page.url();
      const opened = context.waitForEvent("page");
      await page.getByRole("link", { name: "GitHub", exact: true }).click();
      const tab = await opened;
      await tab.waitForLoadState("domcontentloaded");
      expect(tab.url()).toBe("https://github.com/");
      expect(page.url()).toBe(origin);
      await tab.close();
      await page.bringToFront();
    } finally {
      await context.unroute("https://github.com/**", githubRoute);
    }
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
    // The icon and order rows end on the same edge as the fields above them.
    expect(
      await rightEdgeProblems(page, [
        {
          label: "icon row upload button",
          control: ".editor-icon .button-pair .ngs-btn:last-child",
          reference: ".dialog-body .ngs-input",
        },
        {
          label: "order row move button",
          control: ".editor-order .button-pair .ngs-btn:last-child",
          reference: ".dialog-body .ngs-input",
        },
      ]),
    ).toEqual([]);
    await page.getByRole("button", { name: "保存网站", exact: true }).click();
    await expect(other.locator(".shortcut-name")).toContainText([
      "GitHub",
      "阅读",
      "MDN",
      "添加网站",
    ]);
    // Chrome cannot rasterise the tile's backdrop-filter into a drag image, so
    // the default ghost is an opaque black box carrying a second copy of the
    // name. Ours must be the flat stand-in, and it must carry the icon only.
    await page.evaluate(() => {
      window.__dragImages = [];
      const original = DataTransfer.prototype.setDragImage;
      DataTransfer.prototype.setDragImage = function (element, x, y) {
        window.__dragImages.push({
          className: element?.className ?? null,
          text: element?.textContent ?? null,
          children: element?.children.length ?? -1,
        });
        return original.call(this, element, x, y);
      };
    });
    await page
      .locator(".shortcut-item")
      .nth(2)
      .dragTo(page.locator(".shortcut-item").nth(0));
    const ghosts = await page.evaluate(() => window.__dragImages);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0].className).toBe("drag-ghost");
    // Icon only — the label must not ride along as a second copy.
    expect(ghosts[0].children).toBe(1);
    expect(ghosts[0].text).not.toContain("MDN");
    // The hover lift is a 轻盈-only affordance: at 细腻 the glass already answers
    // the pointer with dispersion and elasticity, and the 3px hop in front of it
    // reads as a stutter. 细腻 is the default, so this needs no setup — and it
    // must not be faked by poking data-quality, because the clock re-renders
    // every second and React would put the attribute straight back.
    await expect(page.locator(".app")).toHaveAttribute("data-quality", "high");
    {
      const tile = page.locator(".shortcut-item").first();
      const box = await tile.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(
          () =>
            getComputedStyle(
              document.querySelector(".shortcut-item .shortcut-glass"),
            ).transform,
        ),
      ).toBe("none");
      await page.mouse.move(20, 20);
      await page.waitForTimeout(300);
    }
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
      // The picker follows the pointer, and the kit's spring keeps a couple of
      // pixels of creep going the whole time it is hovered, so Playwright never
      // sees a "stable" box. Click where it is right now instead — the slot is
      // 200px wide, the creep is under 3px.
      await page
        .getByRole("radio", { name: label, exact: true })
        .click({ force: true });
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
    await expect(page.locator(".app")).toHaveAttribute("data-quality", "low");
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
    await expect(page.locator(".app")).toHaveAttribute("data-quality", "high");
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
    // Results open in a new tab, leaving the new tab page where it was. The
    // route lives on the context so it also covers the tab that gets created.
    await context.route(/^https?:\/\//, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<h1>Search destination reached</h1>",
      }),
    );
    await searchInput.fill("nico impressionist test");
    const openedTab = context.waitForEvent("page");
    await searchInput.press("Enter");
    const resultTab = await openedTab;
    await resultTab.waitForLoadState("domcontentloaded");
    expect(decodeURIComponent(resultTab.url()).replaceAll("+", " ")).toContain(
      "nico impressionist test",
    );
    expect(searchPage.url()).toContain(browser.id);
    await resultTab.close();
    await searchInput.fill("");
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

    stage = "search engine switching";
    console.log(channel, stage);
    const engineUrl = `chrome-extension://${browser.id}/index.html`;
    const storedEngine = (target) =>
      target.evaluate(async () => {
        const value = (await chrome.storage.local.get("nico.newtab.state.v1"))[
          "nico.newtab.state.v1"
        ];
        return value.settings.searchEngine;
      });
    // A search must open a new tab and leave the new tab page untouched.
    const searchFrom = async (origin, text) => {
      const input = origin.locator(".search-input input");
      await input.fill(text);
      const opened = context.waitForEvent("page");
      await input.press("Enter");
      const tab = await opened;
      await tab.waitForLoadState("domcontentloaded");
      expect(origin.url()).toBe(engineUrl);
      return tab;
    };
    // Every glass frame must be painted by the layer that moves — never left on
    // the container, and never dropped.
    const frameProblems = (target) =>
      target.evaluate(() => {
        const problems = [];
        for (const container of document.querySelectorAll(".ngs-surface")) {
          const motion = container.querySelector(":scope > .ngs-motion");
          const name = container.className;
          if (!motion) {
            problems.push("no motion layer: " + name);
            continue;
          }
          if (getComputedStyle(container).boxShadow !== "none")
            problems.push("frame left on container: " + name);
          if (
            getComputedStyle(motion).boxShadow === "none" &&
            !container.matches(
              '.add-glass, .ngs-slider, [data-ngs-shape="glyph"]',
            )
          )
            problems.push("frame lost: " + name);
        }
        return problems;
      });
    const enginePage = await context.newPage();
    await enginePage.goto(engineUrl);
    await expect(
      enginePage.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    const enginePill = enginePage.getByRole("combobox", {
      name: "选择搜索引擎",
    });
    expect(await frameProblems(enginePage)).toEqual([]);
    await expect(enginePill).toContainText("默认");
    await enginePill.click();
    await expect(enginePage.locator(".ngs-select-option")).toContainText([
      "默认",
      "Google",
      "Bing",
      "百度",
      "DuckDuckGo",
    ]);
    // Every row carries a brand mark next to its label — and the trigger shows
    // it exactly once, since the label already includes the icon.
    await expect(
      enginePage.locator(".ngs-select-option .ngs-select-option-label svg"),
    ).toHaveCount(5);
    await expect(enginePill.locator(".engine-option svg")).toHaveCount(1);
    // A floating list must not ride the elastic transform of its own glass.
    await enginePage.locator(".ngs-select-option", { hasText: "Bing" }).click();
    await expect(enginePill).toContainText("Bing");
    await expect.poll(() => storedEngine(enginePage)).toBe("bing");
    await enginePage.mouse.move(20, 20);
    await enginePill.click();
    const enginePopup = enginePage.locator(".ngs-select-popup");
    await expect(enginePopup).toBeVisible();
    const enginePopupBox = await enginePopup.boundingBox();
    // The kit animates the inner .ngs-motion, so the frame must live on that
    // layer — otherwise the container's shadow stays put while the glass and
    // rows slide away. (Elasticity itself depends on the quality tier an
    // earlier stage left behind, so it is asserted in styles.test.ts instead.)
    await enginePage.mouse.move(
      enginePopupBox.x + 40,
      enginePopupBox.y + enginePopupBox.height - 4,
    );
    await enginePage.waitForTimeout(300);
    await expect(enginePopup.locator("> .ngs-motion")).toHaveCSS(
      "box-shadow",
      /rgba\(0, 0, 0, 0\.28\)/,
    );
    await expect(enginePopup).toHaveCSS("box-shadow", "none");
    await enginePage.keyboard.press("Escape");
    await expect(enginePopup).toHaveCount(0);

    await enginePage.route("https://api.bing.com/osjson.aspx*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: '["nico",["suggestion one","suggestion two"]]',
      }),
    );
    const engineInput = enginePage.locator(".search-input input");
    await engineInput.fill("nico");
    await expect(enginePage.locator(".search-suggestions")).toBeVisible();
    await expect(enginePage.locator(".search-suggestion")).toHaveText([
      "suggestion one",
      "suggestion two",
    ]);
    await engineInput.press("ArrowDown");
    await engineInput.press("ArrowDown");
    await expect(enginePage.locator(".search-suggestion.is-active")).toHaveText(
      "suggestion two",
    );
    await engineInput.press("Escape");
    await expect(enginePage.locator(".search-suggestions")).toHaveCount(0);
    // A single character is below the suggestion threshold.
    await engineInput.fill("n");
    await enginePage.waitForTimeout(600);
    await expect(enginePage.locator(".search-suggestions")).toHaveCount(0);
    await enginePage.close();

    const bingPage = await context.newPage();
    await bingPage.goto(engineUrl);
    await expect(
      bingPage.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    await bingPage.getByRole("combobox", { name: "选择搜索引擎" }).click();
    await bingPage.locator(".ngs-select-option", { hasText: "Bing" }).click();
    const bingTab = await searchFrom(bingPage, "nico engine test");
    expect(bingTab.url()).toBe(
      "https://www.bing.com/search?q=nico%20engine%20test",
    );
    await bingTab.close();
    await bingPage.close();

    const suggestionPage = await context.newPage();
    await suggestionPage.route("https://api.bing.com/osjson.aspx*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: '["nico",["suggestion one","suggestion two"]]',
      }),
    );
    await suggestionPage.goto(engineUrl);
    await expect(
      suggestionPage.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    await suggestionPage
      .getByRole("combobox", { name: "选择搜索引擎" })
      .click();
    await suggestionPage
      .locator(".ngs-select-option", { hasText: "Bing" })
      .click();
    const suggestionInput = suggestionPage.locator(".search-input input");
    await suggestionInput.fill("nico");
    await expect(suggestionPage.locator(".search-suggestions")).toBeVisible();
    await suggestionInput.press("ArrowDown");
    await suggestionInput.press("ArrowDown");
    // Enter on a highlighted row searches the suggestion, not the raw query.
    const suggestionTab = context.waitForEvent("page");
    await suggestionInput.press("Enter");
    const suggestionResult = await suggestionTab;
    await suggestionResult.waitForLoadState("domcontentloaded");
    expect(suggestionResult.url()).toBe(
      "https://www.bing.com/search?q=suggestion%20two",
    );
    expect(suggestionPage.url()).toBe(engineUrl);
    await suggestionResult.close();
    await suggestionPage.close();

    stage = "custom search engines";
    console.log(channel, stage);
    await page.getByRole("button", { name: /个性化/ }).click();
    await page.getByRole("dialog").waitFor();
    await page
      .locator(".settings-tabs .ngs-segment", { hasText: "外观" })
      .click();
    await expect(page.locator(".engine-empty")).toHaveText(
      "还没有自定义搜索引擎。",
    );
    // The dialog's own surfaces must obey the same frame rule.
    expect(await frameProblems(page)).toEqual([]);
    await page.getByRole("button", { name: "添加搜索引擎" }).click();
    await page.locator("#engine-name").fill("知乎");
    await page.locator("#engine-url").fill("https://www.zhihu.com/search?q=%s");
    await page.getByRole("button", { name: "保存引擎" }).click();
    await expect(page.locator(".engine-card")).toHaveCount(1);
    await expect(page.locator(".engine-card")).toContainText("知乎");
    await expect(page.locator(".engine-card")).toContainText("www.zhihu.com");
    // The card's actions end flush with its own padding edge, not mid-card.
    expect(
      await rightEdgeProblems(page, [
        {
          label: "engine card buttons",
          control: ".engine-card .button-pair .ngs-btn:last-child",
          reference: ".engine-card .ngs-content",
          paddingInset: true,
        },
      ]),
    ).toEqual([]);

    // An address without a placeholder is rejected inline and changes nothing.
    await page.getByRole("button", { name: "添加搜索引擎" }).click();
    await page.locator("#engine-name").fill("坏引擎");
    await page.locator("#engine-url").fill("https://example.com/");
    await page.getByRole("button", { name: "保存引擎" }).click();
    await expect(page.locator(".engine-editor .ngs-alert")).toContainText(
      "%s 占位符",
    );
    await page
      .locator(".engine-editor")
      .getByRole("button", { name: "取消" })
      .click();
    await expect(page.locator(".engine-card")).toHaveCount(1);

    // A second engine exercises the removal path without touching the
    // selection, then the list is left with the engine in use.
    await page.getByRole("button", { name: "添加搜索引擎" }).click();
    await page.locator("#engine-name").fill("示例");
    await page.locator("#engine-url").fill("example.com/s?q={query}");
    await page.getByRole("button", { name: "保存引擎" }).click();
    await expect(page.locator(".engine-card")).toHaveCount(2);
    // The {query} alias is normalized to %s on save.
    await expect(
      page.locator(".engine-card", { hasText: "示例" }),
    ).toContainText("example.com");
    const spareCard = page.locator(".engine-card", { hasText: "示例" });
    await spareCard.getByRole("button", { name: "移除" }).click();
    await expect(page.locator(".engine-confirm")).toContainText(
      "确定移除“示例”",
    );
    // The confirm button replaces 移除 under the cursor, and the elastic glass
    // surface keeps chasing a resting pointer, so park the mouse first.
    await page.mouse.move(20, 20);
    await spareCard.getByRole("button", { name: "确认移除" }).click();
    await expect(page.locator(".engine-card")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // The custom engine joins the picker, searches its own address, and never
    // requests suggestions.
    const customPill = page.getByRole("combobox", { name: "选择搜索引擎" });
    await customPill.click();
    await expect(page.locator(".ngs-select-option")).toHaveCount(6);
    await page.locator(".ngs-select-option", { hasText: "知乎" }).click();
    await expect(customPill).toContainText("知乎");
    const builtInEngines = ["default", "google", "bing", "baidu", "duckduckgo"];
    await expect
      .poll(async () => builtInEngines.includes(await storedEngine(page)))
      .toBe(false);
    const typedRequests = [];
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) typedRequests.push(request.url());
    });
    await page.locator(".search-input input").fill("zhihu");
    await page.waitForTimeout(700);
    expect(typedRequests).toEqual([]);
    await expect(page.locator(".search-suggestions")).toHaveCount(0);
    await page.locator(".search-input input").fill("");

    const customPage = await context.newPage();
    await customPage.goto(engineUrl);
    await expect(
      customPage.getByRole("button", { name: "添加常用网站" }),
    ).toBeEnabled();
    await expect(customPage.locator(".search-engine")).toContainText("知乎");
    const customTab = await searchFrom(customPage, "如何学习");
    expect(customTab.url()).toBe(
      "https://www.zhihu.com/search?q=%E5%A6%82%E4%BD%95%E5%AD%A6%E4%B9%A0",
    );
    await customTab.close();
    await customPage.close();

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
    // The custom engine survived the restart and is still the active one.
    await expect(reopened.locator(".search-engine")).toContainText("知乎");
    expect(
      await reopened.evaluate(async () => {
        const value = (await chrome.storage.local.get("nico.newtab.state.v1"))[
          "nico.newtab.state.v1"
        ];
        return value.settings.customEngines.map((engine) => engine.name);
      }),
    ).toEqual(["知乎"]);

    stage = "removing the engine in use";
    console.log(channel, stage);
    await reopened.getByRole("button", { name: /个性化/ }).click();
    await reopened.getByRole("dialog").waitFor();
    await reopened
      .locator(".settings-tabs .ngs-segment", { hasText: "外观" })
      .click();
    const inUseCard = reopened.locator(".engine-card", { hasText: "知乎" });
    await inUseCard.getByRole("button", { name: "移除" }).click();
    await expect(reopened.locator(".engine-confirm")).toContainText(
      "回到浏览器默认引擎",
    );
    await reopened.mouse.move(20, 20);
    await inUseCard.getByRole("button", { name: "确认移除" }).click();
    await expect(reopened.locator(".engine-card")).toHaveCount(0);
    await expect(reopened.locator(".engine-empty")).toBeVisible();
    await reopened.keyboard.press("Escape");
    await expect(reopened.getByRole("dialog")).toHaveCount(0);
    // Deleting the selected engine falls back to the browser default in the
    // same write, so the picker never dangles.
    await expect(reopened.locator(".search-engine")).toContainText("默认");
    expect(
      await reopened.evaluate(async () => {
        const value = (await chrome.storage.local.get("nico.newtab.state.v1"))[
          "nico.newtab.state.v1"
        ];
        return value.settings.searchEngine;
      }),
    ).toBe("default");

    stage = "toolbar popup adds the current page";
    console.log(channel, stage);
    const popupOnly = await context.newPage();
    await popupOnly.goto(`chrome-extension://${browser.id}/popup.html`);
    await expect(popupOnly.locator(".popup-panel")).toHaveAttribute(
      "data-ngs-quality",
      "high",
    );
    // Opened as a tab the active tab is the popup itself, so there is no
    // addable address — the same guard that covers chrome:// and file://.
    await expect(popupOnly.getByText("这个页面不能添加")).toBeVisible();
    await popupOnly.close();
    const stubPopup = async () => {
      const page = await context.newPage();
      // Stand in for the activeTab grant a toolbar click would hand over.
      await page.addInitScript(() => {
        Object.defineProperty(chrome.tabs, "query", {
          configurable: true,
          value: async () => [
            {
              id: 7,
              url: "https://developer.mozilla.org/en-US/",
              title: "MDN Web Docs",
            },
          ],
        });
      });
      await page.goto(`chrome-extension://${browser.id}/popup.html`);
      return page;
    };
    const popup = await stubPopup();
    await expect(popup.getByLabel("网站名称")).toHaveValue("MDN Web Docs");
    await popup.getByRole("button", { name: "添加", exact: true }).click();
    await expect(popup.getByText("已添加到常用网站")).toBeVisible();
    await expect(reopened.locator(".shortcut-name")).toContainText([
      "MDN",
      "GitHub",
      "MDN Web Docs",
      "添加网站",
    ]);
    await popup.close();
    const duplicate = await stubPopup();
    await expect(
      duplicate.getByText("这个网站已经在常用网站里了。"),
    ).toBeVisible();
    await expect(
      duplicate.getByRole("button", { name: "添加", exact: true }),
    ).toBeDisabled();
    await duplicate.close();

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
        "toolbar popup add flow",
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
