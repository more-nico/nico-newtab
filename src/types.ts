export type Quality = "low" | "high";
/**
 * How the glass picks its light/dark tokens. `auto` samples the backdrop under
 * each surface (the kit's `overLight="auto"`); the other two force it, which is
 * also the escape hatch when the sampling cannot see the wallpaper.
 */
export type GlassMode = "auto" | "light" | "dark";
export interface CustomWallpaper {
  assetId: string;
  name: string;
  mime: "image/webp";
}
export interface GlassSettings {
  blur: number;
  saturation: number;
  brightness: number;
  mapScale: number;
  depth: number;
  curvature: number;
  dispersion: number;
  highlight: number;
  elasticity: number;
}
/** Built-in engine ids. "default" keeps using the browser's own search engine. */
export type BuiltInEngineId =
  | "default"
  | "google"
  | "bing"
  | "baidu"
  | "duckduckgo";
export interface CustomEngine {
  id: string;
  name: string;
  /** HTTP(S) address template holding exactly one `%s` placeholder. */
  urlTemplate: string;
}
export interface AppSettings {
  wallpaper: string;
  customWallpaper: CustomWallpaper | null;
  fit: "cover" | "contain";
  positionX: number;
  positionY: number;
  brightness: number;
  blur: number;
  glass: GlassSettings;
  quality: Quality;
  /** Light/dark behaviour of the glass. */
  glassMode: GlassMode;
  clockFormat: "12" | "24";
  /** White tint strength applied to the clock's glass glyphs (0–1). */
  clockTintStrength: number;
  /** Selected engine: a built-in id or a customEngines[].id. */
  searchEngine: string;
  /** User-defined engines. Custom engines never offer suggestions. */
  customEngines: CustomEngine[];
}
export type AppSettingsPatch = Omit<Partial<AppSettings>, "glass"> & {
  glass?: Partial<GlassSettings>;
};
export interface Shortcut {
  id: string;
  name: string;
  url: string;
  /**
   * Uploaded icon as a small `data:image/webp` URL. Kept in state rather than
   * the asset store so it travels with the shortcut through backup/restore;
   * it is downscaled to 128px, so a full list stays well inside the storage
   * quota. Absent means "use the site's own favicon".
   */
  iconDataUrl?: string;
}
/** One top-level tile on a desktop page: a site or a folder. */
export interface DesktopItem {
  type: "shortcut" | "folder";
  id: string;
}
/**
 * The abbreviated icon a page shows in the dock. It is either a single emoji
 * or an uploaded image; the full page name stays available as text (the dock
 * label on hover), so the icon never has to carry the name on its own.
 */
export type PageIcon =
  | { kind: "emoji"; value: string }
  | { kind: "image"; dataUrl: string };
/** A single mobile-desktop page. Pages only contain top-level items. */
export interface DesktopPage {
  id: string;
  name: string;
  items: DesktopItem[];
  /** Custom dock icon; absent means "use the page name's first letter". */
  icon?: PageIcon;
}
/**
 * A folder shown as one tile on exactly one page. Membership lives here rather
 * than in `DesktopItem`, so a folder's contents never become nested pages.
 */
export interface DesktopFolder {
  id: string;
  name: string;
  shortcutIds: string[];
}
export interface AppState {
  version: 1;
  settings: AppSettings;
  /**
   * Canonical directory of every site, independent of where it is displayed.
   * `pages`/`folders` refer to entries by id.
   */
  shortcuts: Shortcut[];
  /** Mobile-desktop layout. Always contains at least one page. */
  pages: DesktopPage[];
  folders: DesktopFolder[];
}
export interface Artwork {
  id: string;
  /** English catalogue title, kept for the third-party notices and metadata. */
  originalTitle: string;
  year: string;
  source: string;
  image: string;
  thumbnail: string;
}
export interface BackupV1 {
  format: "nico-newtab";
  version: 1;
  exportedAt: string;
  state: AppState;
  wallpaper: { name: string; dataUrl: string } | null;
}
