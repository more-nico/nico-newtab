import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const BASE = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173";
const outputDir = resolve("assets");
const videoDir = await mkdtemp(resolve(tmpdir(), "nico-newtab-demos-"));

const glass = {
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
const defaultState = {
  version: 1,
  settings: {
    wallpaper: "water-lilies",
    customWallpaper: null,
    fit: "cover",
    positionX: 50,
    positionY: 50,
    brightness: 85,
    blur: 0,
    glass,
    quality: "high",
    glassMode: "auto",
    clockFormat: "24",
    searchEngine: "default",
    customEngines: [],
  },
  shortcuts: [],
};

async function waitForHome(page) {
  await page.goto(BASE);
  await page.locator(".wallpaper.is-loaded").waitFor();
  await page.waitForTimeout(900);
}

async function setShortcuts(page, count = 4) {
  const state = structuredClone(defaultState);
  state.shortcuts = Array.from({ length: count }, (_, index) => ({
    id: `demo-${index}`,
    name: ["GitHub", "MDN", "阅读", "设计"][index] ?? `网站 ${index + 1}`,
    url: `https://example.com/${index}`,
  }));
  await page.evaluate((value) => {
    localStorage.setItem("preview.nico.newtab.state.v1", JSON.stringify(value));
  }, state);
  await page.reload();
  await page.locator(".wallpaper.is-loaded").waitFor();
  await page.locator(".shortcut-item").nth(count).waitFor();
}

async function convertToGif(videoPath, name, width = 640) {
  const output = resolve(outputDir, `${name}.gif`);
  const filter =
    `fps=8,scale=${width}:-1:flags=lanczos,split[s0][s1];` +
    `[s0]palettegen=max_colors=128:reserve_transparent=0[p];` +
    `[s1][p]paletteuse=dither=bayer:bayer_scale=3`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    videoPath,
    "-vf",
    filter,
    "-loop",
    "0",
    output,
  ]);
  console.log(`recorded assets/${name}.gif`);
}

async function record(name, viewport, play) {
  const context = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    viewport,
    locale: "zh-CN",
    recordVideo: { dir: videoDir, size: viewport },
  });
  try {
    const page = await context.newPage();
    await play(page);
    await page.waitForTimeout(500);
    const video = page.video();
    await context.close();
    await convertToGif(await video.path(), name);
  } catch (error) {
    await context.close();
    throw error;
  }
}

await mkdir(outputDir, { recursive: true });
try {
  await record("hero", { width: 1200, height: 760 }, async (page) => {
    await waitForHome(page);
    for (const point of [
      [600, 360],
      [780, 360],
      [850, 500],
      [640, 550],
      [420, 500],
      [600, 360],
    ]) {
      await page.mouse.move(point[0], point[1], { steps: 12 });
      await page.waitForTimeout(450);
    }
  });

  await record("settings", { width: 1200, height: 760 }, async (page) => {
    await waitForHome(page);
    await page.getByRole("button", { name: /设置/ }).click();
    await page.getByRole("dialog").waitFor();
    await page.waitForTimeout(500);
    for (const tab of ["功能", "关于", "外观"]) {
      await page.getByRole("radio", { name: tab, exact: true }).click();
      await page.waitForTimeout(500);
    }
    await page.keyboard.press("Escape");
  });

  await record("shortcuts", { width: 1200, height: 760 }, async (page) => {
    await waitForHome(page);
    await setShortcuts(page);
    for (const selector of [
      '.shortcut-link[aria-label="GitHub"]',
      '.shortcut-link[aria-label="MDN"]',
      '.shortcut-link[aria-label="阅读"]',
      '.shortcut-link[aria-label="设计"]',
    ]) {
      await page.locator(selector).hover();
      await page.waitForTimeout(350);
    }
  });
} finally {
  await rm(videoDir, { recursive: true, force: true });
}
