import { ARTWORKS, DEFAULT_GLASS_SETTINGS } from "../data";
import {
  DEFAULT_ENGINE_ID,
  MAX_CUSTOM_ENGINES,
  MAX_ENGINE_NAME,
  SEARCH_PLACEHOLDER,
  isBuiltInEngineId,
} from "./engines";
import type { AppState, BackupV1, CustomEngine, GlassMode } from "../types";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
/** Source image for a shortcut icon; the stored icon itself is 128px WebP. */
export const MAX_ICON_BYTES = 5 * 1024 * 1024;
/** Upper bound for the stored icon data URL (~150 KB), well above the encoder's output. */
const MAX_ICON_DATA_URL = 200_000;
const fail = (): never => {
  throw new Error("文件内容不完整或格式不受支持，原有数据未更改。");
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const boundedString = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
const within = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

export function normalizeUrl(input: string): string {
  const value = input.trim();
  if (!value || value.length > 2048 || /\s/.test(value))
    throw new Error("请输入有效的网址，例如 example.com。");
  // Explicit unsupported schemes must not become an HTTPS hostname.
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^https?:\/\//i.test(value) &&
    !/^[\w.-]+:\d+(?:\/|$)/.test(value)
  ) {
    throw new Error("网站地址仅支持 HTTP 和 HTTPS。");
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("网址格式不正确，请检查后重试。");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error("请输入不含用户名和密码的 HTTP / HTTPS 地址。");
  }
  return url.href;
}

const QUERY_ALIAS = "{query}";
// A placeholder-free probe: URL parsing rewrites `{`/`}` but leaves this alone,
// so the template can be validated by normalizeUrl and restored afterwards.
const QUERY_PROBE = "nico-query-token";
const countToken = (text: string, token: string) =>
  text.split(token).length - 1;

/**
 * Validates and normalizes a custom engine's search address. The template must
 * carry exactly one placeholder — `%s` (preferred) or `{query}` — which is
 * always normalized to `%s`.
 */
export function normalizeSearchTemplate(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value || value.length > 2048)
    throw new Error("请输入搜索地址，例如 https://example.com/search?q=%s。");
  const hasPercent = countToken(value, SEARCH_PLACEHOLDER) > 0;
  const hasAlias = countToken(value, QUERY_ALIAS) > 0;
  const token = hasPercent ? SEARCH_PLACEHOLDER : QUERY_ALIAS;
  if (hasPercent === hasAlias || countToken(value, token) !== 1)
    throw new Error("搜索地址需要且只能包含一个 %s 占位符。");
  const probe = value.replace(token, QUERY_PROBE);
  const normalized = normalizeUrl(probe);
  if (countToken(normalized, QUERY_PROBE) !== 1)
    throw new Error("搜索地址需要且只能包含一个 %s 占位符。");
  return normalized.replace(QUERY_PROBE, SEARCH_PLACEHOLDER);
}

export function parseState(value: unknown): AppState {
  if (
    !record(value) ||
    value.version !== 1 ||
    !record(value.settings) ||
    !Array.isArray(value.shortcuts) ||
    value.shortcuts.length > 200
  )
    return fail();
  const s = value.settings;
  // State written before glass controls existed remains valid and migrates to
  // the exact playground defaults on the next successful save. The retired
  // "medium" tier is folded into "high" so older saves keep their material.
  const glass = s.glass === undefined ? DEFAULT_GLASS_SETTINGS : s.glass;
  const clockTintStrength =
    s.clockTintStrength === undefined ? 0.1 : s.clockTintStrength;
  const quality: AppState["settings"]["quality"] =
    s.quality === "low" ? "low" : "high";
  if (
    !(s.fit === "cover" || s.fit === "contain") ||
    !(s.clockFormat === "12" || s.clockFormat === "24") ||
    !within(clockTintStrength, 0, 1) ||
    typeof s.quality !== "string" ||
    !["low", "medium", "high"].includes(s.quality) ||
    !within(s.brightness, 35, 120) ||
    !within(s.blur, 0, 20) ||
    !within(s.positionX, 0, 100) ||
    !within(s.positionY, 0, 100) ||
    typeof s.wallpaper !== "string" ||
    !(s.wallpaper === "custom" || ARTWORKS.some((a) => a.id === s.wallpaper))
  )
    return fail();
  if (
    !record(glass) ||
    !within(glass.blur, 0, 64) ||
    !within(glass.saturation, 0, 300) ||
    !within(glass.brightness, 0, 2) ||
    !within(glass.mapScale, 0.1, 0.5) ||
    !within(glass.depth, 0, 40) ||
    !within(glass.curvature, 0, 1) ||
    !within(glass.dispersion, 0, 1) ||
    !within(glass.highlight, 0, 2) ||
    !within(glass.elasticity, 0, 0.5)
  )
    return fail();
  let customWallpaper: AppState["settings"]["customWallpaper"] = null;
  if (s.customWallpaper !== null) {
    const c = s.customWallpaper;
    if (
      !record(c) ||
      !boundedString(c.assetId, 100) ||
      !boundedString(c.name, 200) ||
      c.mime !== "image/webp"
    )
      return fail();
    customWallpaper = { assetId: c.assetId, name: c.name, mime: "image/webp" };
  }
  if (s.wallpaper === "custom" && !customWallpaper) return fail();
  // Custom engines arrived after the first release: a missing field migrates to
  // an empty list, while malformed entries invalidate the whole payload the same
  // way shortcuts do.
  const rawEngines = s.customEngines === undefined ? [] : s.customEngines;
  if (!Array.isArray(rawEngines) || rawEngines.length > MAX_CUSTOM_ENGINES)
    return fail();
  const engineIds = new Set<string>();
  const customEngines: CustomEngine[] = [];
  for (const item of rawEngines) {
    if (
      !record(item) ||
      !boundedString(item.id, 100) ||
      !boundedString(item.name, MAX_ENGINE_NAME) ||
      engineIds.has(item.id) ||
      isBuiltInEngineId(item.id)
    )
      return fail();
    let urlTemplate: string;
    try {
      urlTemplate = normalizeSearchTemplate(item.urlTemplate);
    } catch {
      return fail();
    }
    engineIds.add(item.id);
    customEngines.push({ id: item.id, name: item.name.trim(), urlTemplate });
  }
  // The selection is lenient on purpose: a missing, mistyped or dangling engine
  // silently falls back to the browser default instead of rejecting the state.
  const searchEngine: string =
    typeof s.searchEngine === "string" &&
    (isBuiltInEngineId(s.searchEngine) || engineIds.has(s.searchEngine))
      ? s.searchEngine
      : DEFAULT_ENGINE_ID;
  // Added later, so migrate leniently: anything unrecognised means "auto".
  const glassMode: GlassMode =
    s.glassMode === "light" || s.glassMode === "dark" ? s.glassMode : "auto";
  const ids = new Set<string>();
  const shortcuts = value.shortcuts.map((item) => {
    if (
      !record(item) ||
      !boundedString(item.id, 100) ||
      !boundedString(item.name, 40) ||
      typeof item.url !== "string" ||
      ids.has(item.id)
    )
      return fail();
    ids.add(item.id);
    // Added later, so migrate leniently: a missing or unusable icon just means
    // the tile keeps using the site's own favicon.
    const iconDataUrl =
      typeof item.iconDataUrl === "string" &&
      item.iconDataUrl.length <= MAX_ICON_DATA_URL &&
      item.iconDataUrl.startsWith("data:image/")
        ? item.iconDataUrl
        : undefined;
    return {
      id: item.id,
      name: item.name.trim(),
      url: normalizeUrl(item.url),
      ...(iconDataUrl ? { iconDataUrl } : {}),
    };
  });
  // Reconstruct allowed fields; never merge arbitrary imported keys into state.
  return {
    version: 1,
    settings: {
      wallpaper: s.wallpaper,
      customWallpaper,
      fit: s.fit,
      positionX: s.positionX,
      positionY: s.positionY,
      brightness: s.brightness,
      blur: s.blur,
      glass: {
        blur: glass.blur,
        saturation: glass.saturation,
        brightness: glass.brightness,
        mapScale: glass.mapScale,
        depth: glass.depth,
        curvature: glass.curvature,
        dispersion: glass.dispersion,
        highlight: glass.highlight,
        elasticity: glass.elasticity,
      },
      quality,
      glassMode,
      clockFormat: s.clockFormat,
      clockTintStrength,
      searchEngine,
      customEngines,
    },
    shortcuts,
  };
}

export function parseBackup(text: string): BackupV1 {
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error("备份文件过大，最大支持 32 MB。");
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return fail();
  }
  if (
    !record(input) ||
    input.format !== "nico-newtab" ||
    input.version !== 1 ||
    typeof input.exportedAt !== "string" ||
    !Number.isFinite(Date.parse(input.exportedAt))
  )
    return fail();
  const state = parseState(input.state);
  let wallpaper: BackupV1["wallpaper"] = null;
  if (input.wallpaper !== null) {
    const w = input.wallpaper;
    if (
      !record(w) ||
      !boundedString(w.name, 200) ||
      typeof w.dataUrl !== "string" ||
      !/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(w.dataUrl)
    )
      return fail();
    const encoded = w.dataUrl.split(",")[1];
    if (
      encoded.length % 4 !== 0 ||
      encoded.length > Math.ceil(MAX_UPLOAD_BYTES / 3) * 4
    )
      return fail();
    let bytes: string;
    try {
      bytes = atob(encoded);
    } catch {
      return fail();
    }
    if (bytes.slice(0, 4) !== "RIFF" || bytes.slice(8, 12) !== "WEBP")
      return fail();
    wallpaper = { name: w.name, dataUrl: w.dataUrl };
  }
  if (Boolean(state.settings.customWallpaper) !== Boolean(wallpaper))
    return fail();
  return {
    format: "nico-newtab",
    version: 1,
    exportedAt: input.exportedAt,
    state,
    wallpaper,
  };
}
