import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

await mkdir("test-results", { recursive: true });
const errors = [];
const ctx = await chromium.launchPersistentContext(
  resolve(`.cache/popup-corners-${Date.now()}`),
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
  await popup.waitForTimeout(1000);

  console.log(
    "window shape:",
    await popup.evaluate(() => {
      const el = document.querySelector(".popup");
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const panel = document.querySelector(".popup-panel");
      const pcs = getComputedStyle(panel);
      const effect = panel.querySelector(".ngs-effect");
      return JSON.stringify({
        page: [rect.width, rect.height],
        radius: cs.borderRadius,
        overflow: cs.overflow,
        htmlBg: getComputedStyle(document.documentElement).backgroundColor,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        panelRadius: pcs.borderRadius,
        panelZ: pcs.zIndex,
        effectBg: getComputedStyle(effect).backgroundColor,
        backdrop: getComputedStyle(effect).backdropFilter,
      });
    }),
  );

  const shot = await popup.screenshot({ omitBackground: true });
  const sample = await popup.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const at = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
    return {
      size: [img.width, img.height],
      topLeft1: at(1, 1),
      topLeft6: at(6, 6),
      topLeft14: at(14, 14),
      topRight: at(img.width - 2, 1),
      bottomLeft: at(1, img.height - 2),
      bottomRight: at(img.width - 2, img.height - 2),
      insideArt: at(20, Math.round(img.height / 2)),
      panelEdge: at(14, Math.round(img.height / 2)),
      panelCentre: at(Math.round(img.width / 2), Math.round(img.height / 2)),
    };
  }, shot.toString("base64"));
  console.log("alpha probes:", JSON.stringify(sample, null, 1));
  await popup.screenshot({ path: "test-results/popup-corners.png" });
} finally {
  await ctx.close();
}
console.log("ERRORS:", errors.length ? errors.join(" | ") : "none");
