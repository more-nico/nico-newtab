import { chromium, expect } from "@playwright/test";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

// Loads the built extension once per UI language and checks the localized
// manifest strings plus the three main surfaces (new tab, settings, popup).
// Run `npm run build` first; `npm run test:i18n` does both via package.json.
await mkdir("test-results", { recursive: true });

const CASES = [
  {
    lang: "zh-CN",
    htmlLang: "zh-CN",
    name: "Nico · 印象新标签页",
    title: "Nico · 新标签页",
    greeting: /夜深了|早上好|午间好|下午好|晚上好/,
    tabs: ["外观", "功能", "同步", "关于"],
    syncHeading: "把设置带到每台设备",
    popupTitle: "添加到 Nico 新标签页",
  },
  {
    lang: "en-US",
    htmlLang: "en",
    name: "Nico · Impression New Tab",
    title: "Nico · Impression New Tab",
    greeting: /Good (morning|afternoon|evening)|Late night/,
    tabs: ["Appearance", "Features", "Sync", "About"],
    syncHeading: "Take your settings to every device",
    popupTitle: "Add to Nico",
  },
  {
    lang: "ja",
    htmlLang: "ja",
    name: "Nico · 印象派ニュータブ",
    title: "Nico · インプレッション ニュータブ",
    greeting: /おはよう|こんにちは|こんばんは|夜更け/,
    tabs: ["外観", "機能", "同期", "このアプリについて"],
    syncHeading: "設定をどの端末でも共有",
    popupTitle: "Nico に追加",
  },
];

const results = [];
for (const testCase of CASES) {
  const context = await chromium.launchPersistentContext(
    resolve(`.cache/locale-${testCase.lang}-${Date.now()}`),
    {
      channel: "chromium",
      headless: true,
      viewport: { width: 1366, height: 768 },
      // Playwright's locale option changes chrome.i18n.getUILanguage(), which
      // is what the extension detects its UI language from.
      locale: testCase.lang,
      args: ["--enable-unsafe-extension-debugging"],
      ignoreDefaultArgs: ["--disable-extensions"],
    },
  );
  const errors = [];
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", {
      path: resolve("dist"),
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/index.html`);
    await page.waitForTimeout(1500);

    const strings = await page.evaluate(() => ({
      uiLanguage: chrome.i18n.getUILanguage(),
      // The manifest locale follows the browser application locale, which a
      // headless test cannot switch; the catalogs are covered by the unit test
      // in src/lib/i18n.test.ts instead.
      name: chrome.runtime.getManifest().name,
      documentTitle: document.title,
      htmlLang: document.documentElement.lang,
      body: document.body.innerText,
    }));
    expect(strings.uiLanguage.toLowerCase()).toContain(
      testCase.lang.toLowerCase().split("-")[0],
    );
    expect(strings.name).not.toContain("__MSG_");
    expect(strings.documentTitle).toBe(testCase.title);
    expect(strings.htmlLang).toBe(testCase.htmlLang);
    expect(strings.body).not.toMatch(/__MSG_|undefined\b/);
    expect(strings.body).toMatch(testCase.greeting);
    if (testCase.lang === "en-US")
      expect(strings.body).not.toMatch(/[\u4e00-\u9fff]/);

    await page.getByRole("button", { name: /设置|Settings|設定/ }).click();
    await page.getByRole("dialog").waitFor();
    const tabs = await page
      .locator(".settings-tabs .ngs-segment")
      .allInnerTexts();
    expect(tabs.map((label) => label.trim())).toEqual(testCase.tabs);
    await page.locator(".settings-tabs .ngs-segment").nth(2).click();
    await expect(page.getByTestId("nutstore-form")).toBeVisible();
    await expect(page.locator(".section-heading h3").first()).toHaveText(
      testCase.syncHeading,
    );

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForTimeout(800);
    expect(await popup.title()).toBe(testCase.popupTitle);

    expect(errors).toEqual([]);
    results.push(
      `${testCase.lang}: PASS (name, title, lang, tabs, sync panel, popup)`,
    );
  } finally {
    await context.close();
    const { rm } = await import("node:fs/promises");
    for (const directory of [".cache"]) {
      const entries = await import("node:fs/promises").then((fs) =>
        fs.readdir(directory),
      );
      for (const entry of entries.filter((name) =>
        name.startsWith(`locale-${testCase.lang}-`),
      ))
        await rm(resolve(directory, entry), { recursive: true, force: true });
    }
  }
}
console.log(results.join("\n"));
console.log("Locale checks: PASS");
