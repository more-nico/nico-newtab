import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chromium", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5173");
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
  await page.getByRole("textbox", { name: "搜索", exact: true }).fill("test");
  await page.getByRole("button", { name: "开始搜索" }).click();
  await expect(page.getByRole("status")).toContainText("这是网页预览");
  expect(page.url()).toBe("http://127.0.0.1:5173/");
  expect(errors).toEqual([]);
  console.log(
    "Preview: PASS (isolated local storage, reload persistence, guarded search, modal focus)",
  );
} finally {
  await browser.close();
}
