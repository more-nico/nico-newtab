import { chromium } from "@playwright/test";
import { resolve } from "node:path";

const ctx = await chromium.launchPersistentContext(
  resolve(`.cache/popup-ab-${Date.now()}`),
  {
    channel: "chrome",
    headless: true,
    viewport: { width: 1366, height: 768 },
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  },
);
try {
  const cdp = await ctx.browser().newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", {
    path: resolve("dist"),
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
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
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForTimeout(1000);

  const box = await page.locator(".popup").boundingBox();
  const points = [
    ["page-row", box.x + 40, box.y + 30],
    ["input", box.x + 40, box.y + 111],
    ["hint", box.x + 40, box.y + 160],
    ["buttons", box.x + 100, box.y + 200],
    ["art-margin", box.x + 6, box.y + Math.round(box.height / 2)],
    ["corner-14", box.x + 14, box.y + 14],
  ];
  const sample = async (label) => {
    const shot = await page.screenshot({ omitBackground: true });
    const out = await page.evaluate(
      async ({ b64, points: pts }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        return pts.map(([name, x, y]) =>
          [name, ...Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data)].join(":"),
        );
      },
      { b64: shot.toString("base64"), points },
    );
    console.log("-- " + label + "\n   " + out.join("\n   "));
    return out;
  };

  const clipped = await sample("with rounded window clip");
  await page.addStyleTag({
    content: ".popup { overflow: visible !important; border-radius: 0 !important }",
  });
  await page.waitForTimeout(300);
  const plain = await sample("clip removed");
  console.log(
    "\nidentical:",
    JSON.stringify(clipped) === JSON.stringify(plain) ? "yes" : "no",
  );
} finally {
  await ctx.close();
}
