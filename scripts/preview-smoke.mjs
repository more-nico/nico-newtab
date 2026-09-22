import { chromium, expect } from "@playwright/test";

// Overridable because 5173 is Vite's default and is easily taken by
// another checkout's dev server — the check would then quietly test that app.
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE);
  await expect(page.getByText("网页预览", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "添加常用网站" }).click();
  await expect(page.getByLabel("网站名称", { exact: true })).toBeFocused();
  await page.getByLabel("网站名称", { exact: true }).fill("Preview");
  await page.getByLabel("网站地址", { exact: true }).fill("example.com");
  await page.getByRole("button", { name: "保存网站", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Preview", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    "preview.nico.newtab.state.v1",
  ]);
  // The picker works in preview too, and a failing suggestion request degrades
  // silently — no list, no error surfaced to the user.
  await page.route("**/complete/search*", (route) => route.abort("failed"));
  await page.getByRole("combobox", { name: "选择搜索引擎" }).click();
  await expect(page.locator(".ngs-select-option")).toHaveCount(5);
  await page.locator(".ngs-select-option", { hasText: "Google" }).click();
  await expect(page.locator(".search-engine")).toContainText("Google");
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("test");
  await page.waitForTimeout(800);
  await expect(page.locator(".search-suggestions")).toHaveCount(0);
  await page.getByRole("button", { name: "开始搜索" }).click();
  await expect(page.getByRole("status")).toContainText("这是网页预览");
  expect(page.url()).toBe(BASE + "/");
  expect(errors).toEqual([]);
  console.log(
    "Preview: PASS (isolated local storage, reload persistence, guarded search, engine picker, quiet suggestion failure)",
  );
} finally {
  await browser.close();
}
