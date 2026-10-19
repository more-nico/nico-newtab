#!/usr/bin/env node
/**
 * Render the self-contained Nico logo SVGs to the PNG set used by the
 * extension (store listing + toolbar action icons).
 *
 *   node scripts/render-logo.mjs
 *
 * Source of truth: assets/logo/nico-logo.svg (wordmark) and
 * assets/logo/nico-mark.svg (small-size "N" monogram). Both embed the
 * Great Vibes TTF as a base64 data URI, so Chromium needs no installed font
 * and the script is deterministic on any machine.
 *
 * Pipeline: Playwright Chromium (channel "chromium") paints the SVG on a
 * transparent page at 3x device scale, then sharp downsamples with a
 * Lanczos kernel (plus a light unsharp mask on the 16/32 px toolbar icons).
 */
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const logoDir = path.join(root, "assets/logo");
const iconDir = path.join(root, "public/icons");

/** Render one SVG at 300 CSS px with a transparent background. */
async function captureSvg(page, svgFile) {
  const url = pathToFileURL(path.join(logoDir, svgFile)).href;
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  await page.setViewportSize({ width: 300, height: 300 });
  const png = await page.screenshot({ omitBackground: true });
  const meta = await sharp(png).metadata();
  if (meta.width !== 900 || meta.height !== 900)
    throw new Error(
      `${svgFile}: expected 900x900 capture, got ${meta.width}x${meta.height}`,
    );
  return png;
}

/** Downsample a capture to an exact size and write it as PNG. */
async function writePng(buffer, size, target, { sharpen = false } = {}) {
  let pipeline = sharp(buffer).resize(size, size, {
    fit: "fill",
    kernel: "lanczos3",
  });
  if (sharpen) pipeline = pipeline.sharpen({ sigma: 0.7, m1: 0.6, m2: 0.35 });
  const file = path.join(root, target);
  const { width, height } = await pipeline
    .png({ compressionLevel: 9 })
    .toFile(file);
  const bytes = (await stat(file)).size;
  console.log(`  ${target}  ${width}x${height}  ${bytes.toLocaleString()} B`);
  return file;
}

await mkdir(logoDir, { recursive: true });
await mkdir(iconDir, { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({
    viewport: { width: 300, height: 300 },
    deviceScaleFactor: 3,
  });

  console.log("Rendering assets/logo/nico-logo.svg");
  const wordmark = await captureSvg(page, "nico-logo.svg");
  await writePng(wordmark, 300, "assets/logo/logo-300.png");
  await writePng(wordmark, 128, "assets/logo/icon-128.png");
  await writePng(wordmark, 128, "public/icons/icon-128.png");

  console.log("Rendering assets/logo/nico-mark.svg");
  const mark = await captureSvg(page, "nico-mark.svg");
  for (const size of [48, 32, 16]) {
    await writePng(mark, size, `assets/logo/icon-${size}.png`, {
      sharpen: size <= 32,
    });
    await writePng(mark, size, `public/icons/icon-${size}.png`, {
      sharpen: size <= 32,
    });
  }
} finally {
  await browser.close();
}

console.log(
  "Done: logo-300, icon-{128,48,32,16} in assets/logo + public/icons.",
);
