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
export interface AppState {
  version: 1;
  settings: AppSettings;
  shortcuts: Shortcut[];
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
