import {
  ARTWORKS,
  DEFAULT_GLASS_SETTINGS,
  MAX_FOLDER_NAME,
  MAX_FOLDERS,
  MAX_PAGE_ITEMS,
  MAX_PAGE_NAME,
  MAX_PAGES,
  createDefaultPage,
} from "../data";
import {
  DEFAULT_ENGINE_ID,
  MAX_CUSTOM_ENGINES,
  MAX_ENGINE_NAME,
  SEARCH_PLACEHOLDER,
  isBuiltInEngineId,
} from "./engines";
import type {
  AppState,
  BackupV1,
  CustomEngine,
  DesktopFolder,
  DesktopItem,
  DesktopPage,
  GlassMode,
  Shortcut,
} from "../types";
import { parsePageIcon } from "./pageIcon";
import { t } from "./i18n";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;
/** Source image for a shortcut icon; the stored icon itself is 128px WebP. */
export const MAX_ICON_BYTES = 5 * 1024 * 1024;
/** Upper bound for the stored icon data URL (~150 KB), well above the encoder's output. */
const MAX_ICON_DATA_URL = 200_000;
const fail = (): never => {
  throw new Error(t().lib.validation.invalidFile);
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
    throw new Error(t().lib.validation.urlInvalid);
  // Explicit unsupported schemes must not become an HTTPS hostname.
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^https?:\/\//i.test(value) &&
    !/^[\w.-]+:\d+(?:\/|$)/.test(value)
  ) {
    throw new Error(t().lib.validation.urlScheme);
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error(t().lib.validation.urlFormat);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error(t().lib.validation.urlCredentials);
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
    throw new Error(t().lib.validation.searchUrlRequired);
  const hasPercent = countToken(value, SEARCH_PLACEHOLDER) > 0;
  const hasAlias = countToken(value, QUERY_ALIAS) > 0;
  const token = hasPercent ? SEARCH_PLACEHOLDER : QUERY_ALIAS;
  if (hasPercent === hasAlias || countToken(value, token) !== 1)
    throw new Error(t().lib.validation.searchUrlPlaceholder);
  const probe = value.replace(token, QUERY_PROBE);
  const normalized = normalizeUrl(probe);
  if (countToken(normalized, QUERY_PROBE) !== 1)
    throw new Error(t().lib.validation.searchUrlPlaceholder);
  return normalized.replace(QUERY_PROBE, SEARCH_PLACEHOLDER);
}

/**
 * Validates folder records and marks their members as placed, so a site can
 * never sit both in a folder and at the top level of a page. Folder ids are
 * checked here; pages then ensure each folder appears on at most one page.
 */
function parseFolders(
  value: unknown,
  shortcuts: ReadonlyMap<string, Shortcut>,
  placedShortcuts: Set<string>,
): DesktopFolder[] {
  if (!Array.isArray(value) || value.length > MAX_FOLDERS) return fail();
  // Ids only need to be unique within their own collection: `DesktopItem.type`
  // already disambiguates shortcut references from folder references.
  const ids = new Set<string>();
  return value.map((item) => {
    if (
      !record(item) ||
      !boundedString(item.id, 100) ||
      !boundedString(item.name, MAX_FOLDER_NAME) ||
      !Array.isArray(item.shortcutIds) ||
      ids.has(item.id)
    )
      return fail();
    ids.add(item.id);
    const shortcutIds: string[] = [];
    for (const id of item.shortcutIds) {
      if (
        !boundedString(id, 100) ||
        !shortcuts.has(id) ||
        placedShortcuts.has(id)
      )
        return fail();
      placedShortcuts.add(id);
      shortcutIds.push(id);
    }
    return { id: item.id, name: item.name.trim(), shortcutIds };
  });
}

/**
 * Validates pages and every top-level reference. Placements are global: a
 * shortcut may appear once across all pages/folders, and a folder may appear
 * on only one page. Unplaced shortcuts/folders stay in the directory for
 * compatibility with callers that still edit `state.shortcuts` directly.
 *
 * A page icon arrived after the pages themselves, so it migrates leniently: a
 * page without one (or with an unusable one) simply falls back to the first
 * letter of its name.
 */
function parsePages(
  value: unknown,
  shortcuts: ReadonlyMap<string, Shortcut>,
  folderIds: ReadonlySet<string>,
  placedShortcuts: Set<string>,
): DesktopPage[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_PAGES)
    return fail();
  const pageIds = new Set<string>();
  const placedFolders = new Set<string>();
  return value.map((page) => {
    if (
      !record(page) ||
      !boundedString(page.id, 100) ||
      !boundedString(page.name, MAX_PAGE_NAME) ||
      !Array.isArray(page.items) ||
      page.items.length > MAX_PAGE_ITEMS ||
      pageIds.has(page.id)
    )
      return fail();
    pageIds.add(page.id);
    const items: DesktopItem[] = [];
    for (const item of page.items) {
      if (
        !record(item) ||
        !boundedString(item.id, 100) ||
        (item.type !== "shortcut" && item.type !== "folder")
      )
        return fail();
      if (item.type === "shortcut") {
        if (!shortcuts.has(item.id) || placedShortcuts.has(item.id))
          return fail();
        placedShortcuts.add(item.id);
      } else {
        if (!folderIds.has(item.id) || placedFolders.has(item.id))
          return fail();
        placedFolders.add(item.id);
      }
      items.push({ type: item.type, id: item.id });
    }
    const icon = parsePageIcon(page.icon);
    return {
      id: page.id,
      name: page.name.trim(),
      items,
      ...(icon ? { icon } : {}),
    };
  });
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
  const shortcutsById = new Map(shortcuts.map((item) => [item.id, item]));
  const placedShortcuts = new Set<string>();
  const rawPages = value.pages;
  const rawFolders = value.folders;
  let pages: DesktopPage[];
  let folders: DesktopFolder[];
  if (rawPages === undefined) {
    // States written before the desktop layout existed only have `shortcuts`:
    // migrate every site onto the default first page in its stored order.
    // Folders never existed in that schema, so a non-empty list without pages
    // is corrupt rather than legacy.
    if (
      rawFolders !== undefined &&
      !(Array.isArray(rawFolders) && rawFolders.length === 0)
    )
      return fail();
    folders = [];
    const page = createDefaultPage();
    page.items = shortcuts.map((item) => ({ type: "shortcut", id: item.id }));
    pages = [page];
  } else {
    // `folders` was added together with `pages`; when only the latter exists
    // the folder list defaults to empty and folder items then fail as dangling.
    folders = parseFolders(
      rawFolders === undefined ? [] : rawFolders,
      shortcutsById,
      placedShortcuts,
    );
    const folderIds = new Set(folders.map((folder) => folder.id));
    pages = parsePages(rawPages, shortcutsById, folderIds, placedShortcuts);
  }
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
    pages,
    folders,
  };
}

export function parseBackup(text: string): BackupV1 {
  if (new Blob([text]).size > MAX_BACKUP_BYTES)
    throw new Error(t().lib.validation.backupTooLarge);
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
