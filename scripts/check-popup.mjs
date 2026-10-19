import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("test-results", { recursive: true });
const errors = [];
const ctx = await chromium.launchPersistentContext(
  resolve(`.cache/popup-check-${Date.now()}`),
  {
    channel: "chrome",
    headless: true,
    viewport: { width: 1366, height: 768 },
    locale: "zh-CN",
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  },
);
try {
  const cdp = await ctx.browser().newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", {
    path: resolve("dist"),
  });
  console.log("extension id:", id);

  // 1. The built popup loads at all, and reports the fallback state.
  const plain = await ctx.newPage();
  plain.on("pageerror", (e) => errors.push("popup pageerror: " + e.message));
  plain.on("console", (m) => {
    if (m.type() === "error") errors.push("popup console: " + m.text());
  });
  await plain.goto(`chrome-extension://${id}/popup.html`);
  await plain.waitForTimeout(900);
  console.log(
    "fallback state:",
    JSON.stringify(await plain.locator("body").innerText()),
  );
  console.log(
    "panel glass:",
    await plain.evaluate(() => {
      const panel = document.querySelector(".popup-panel");
      if (!panel) return "MISSING";
      return `${panel.getAttribute("data-ngs-quality")} radius=${getComputedStyle(panel).borderRadius} effect=${getComputedStyle(panel.querySelector(".ngs-effect")).backgroundColor}`;
    }),
  );
  await plain.screenshot({ path: "test-results/popup-fallback.png" });

  // 2. Pretend the user clicked the toolbar on a normal page.
  const popup = await ctx.newPage();
  popup.on("pageerror", (e) => errors.push("popup pageerror: " + e.message));
  popup.on("console", (m) => {
    if (m.type() === "error") errors.push("popup console: " + m.text());
  });
  await popup.addInitScript(() => {
    Object.defineProperty(chrome.tabs, "query", {
      configurable: true,
      value: async () => [
        {
          id: 7,
          url: "https://zh.wikipedia.org/wiki/印象派",
          title: "印象派 - 维基百科，自由的百科全书",
        },
      ],
    });
  });
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForTimeout(900);
  console.log(
    "ready state:",
    JSON.stringify(await popup.locator("body").innerText()),
  );
  await popup.screenshot({ path: "test-results/popup-ready.png" });
  console.log(
    "prefilled name:",
    await popup.locator("#popup-name").inputValue(),
  );
  console.log(
    "add enabled:",
    await popup.getByRole("button", { name: "添加" }).isEnabled(),
  );

  // 3. Add it, then confirm the new tab page picked it up.
  await popup.getByRole("button", { name: "添加" }).click();
  await popup.waitForTimeout(700);
  console.log(
    "after add:",
    JSON.stringify(await popup.locator("body").innerText()),
  );
  await popup.screenshot({ path: "test-results/popup-saved.png" });

  const home = await ctx.newPage();
  await home.goto(`chrome-extension://${id}/index.html`);
  await home.waitForTimeout(1200);
  console.log(
    "shortcut visible on the new tab page:",
    await home.locator(".shortcut-name").allInnerTexts(),
  );
  console.log(
    "stored:",
    JSON.stringify(
      await home.evaluate(async () => {
        const key = "nico.newtab.state.v1";
        const data = await chrome.storage.local.get(key);
        return data[key].shortcuts;
      }),
    ),
  );
  // Re-opening the popup for the same page must report the duplicate.
  const again = await ctx.newPage();
  await again.addInitScript(() => {
    Object.defineProperty(chrome.tabs, "query", {
      configurable: true,
      value: async () => [
        {
          id: 7,
          url: "https://zh.wikipedia.org/wiki/印象派",
          title: "印象派 - 维基百科，自由的百科全书",
        },
      ],
    });
  });
  await again.goto(`chrome-extension://${id}/popup.html`);
  await again.waitForTimeout(800);
  console.log(
    "duplicate state:",
    JSON.stringify(await again.locator("body").innerText()),
  );
  console.log(
    "add disabled:",
    await again.getByRole("button", { name: "添加" }).isDisabled(),
  );
} finally {
  await ctx.close();
}
console.log("ERRORS:", errors.length ? errors.join(" | ") : "none");
