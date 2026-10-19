import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Renders 1280×800 store screenshots from the built extension in all three UI
// languages. Run `npm run build` first. Output: assets/store/screenshots/.
const BASE = resolve("assets/store/screenshots");
const LOCALES = ["zh-CN", "en-US", "ja"];
// The repository's default state, copied here so the store screenshots can be
// seeded without touching user data (the extension exposes no public seeding
// API). Keep in sync with src/data.ts when settings change.
const DEFAULT_STATE = {
  version: 1,
  settings: {
    wallpaper: "water-lilies",
    customWallpaper: null,
    fit: "cover",
    positionX: 50,
    positionY: 50,
    brightness: 85,
    blur: 0,
    glass: {
      blur: 3,
      saturation: 100,
      brightness: 1.1,
      mapScale: 0.2,
      depth: 8,
      curvature: 0.2,
      dispersion: 0.1,
      highlight: 1,
      elasticity: 0.2,
    },
    quality: "high",
    glassMode: "auto",
    clockFormat: "24",
    clockTintStrength: 0.1,
    searchEngine: "default",
    customEngines: [],
  },
  shortcuts: [],
};

// A calm, recognizable default set so the home screenshot shows real tiles.
const SHORTCUTS = [
  ["GitHub", "https://github.com/"],
  ["MDN Web Docs", "https://developer.mozilla.org/"],
  ["Wikipedia", "https://www.wikipedia.org/"],
  ["Figma", "https://www.figma.com/"],
  ["Notion", "https://www.notion.so/"],
  ["YouTube", "https://www.youtube.com/"],
];

async function capture(page, name) {
  const png = await page.screenshot();
  const file = resolve(BASE, `${name}.jpg`);
  await sharp(png)
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toFile(file);
  console.log(`wrote ${file}`);
}

for (const locale of LOCALES) {
  const profile = resolve(`.cache/store-${locale}-${Date.now()}`);
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    viewport: { width: 1280, height: 800 },
    locale,
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  });
  try {
    const cdp = await context.browser().newBrowserCDPSession();
    const { id } = await cdp.send("Extensions.loadUnpacked", {
      path: resolve("dist"),
    });
    await mkdir(resolve(BASE, locale), { recursive: true });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/index.html`);
    await page.evaluate(
      async ({ state, shortcuts }) => {
        await chrome.storage.local.set({
          "nico.newtab.state.v1": {
            ...state,
            shortcuts: shortcuts.map(([name, url], index) => ({
              id: `store-${index}`,
              name,
              url,
            })),
          },
        });
      },
      { state: DEFAULT_STATE, shortcuts: SHORTCUTS },
    );
    await page.reload();
    await page.locator(".wallpaper.is-loaded").waitFor();
    await page.getByRole("button", { name: /设置|Settings|設定/ }).waitFor({
      state: "visible",
    });
    await page.waitForTimeout(900);
    await capture(page, `${locale}/01-new-tab`);
    await page.getByRole("button", { name: /设置|Settings|設定/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(700);
    await capture(page, `${locale}/02-appearance`);
    await page.locator(".settings-tabs .ngs-segment").nth(1).click();
    await page.waitForTimeout(700);
    await capture(page, `${locale}/03-features`);
    await page.locator(".settings-tabs .ngs-segment").nth(2).click();
    await page.waitForTimeout(700);
    await capture(page, `${locale}/04-sync`);
    console.log(locale, "errors:", JSON.stringify(errors));
    if (errors.length) throw new Error(`page errors for ${locale}`);
  } finally {
    await context.close();
    const { rm } = await import("node:fs/promises");
    await rm(profile, { recursive: true, force: true });
  }
}
console.log("Store screenshots: done");
