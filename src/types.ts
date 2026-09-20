export type Quality = "low" | "medium" | "high";
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
  clockFormat: "12" | "24";
}
export type AppSettingsPatch = Omit<Partial<AppSettings>, "glass"> & {
  glass?: Partial<GlassSettings>;
};
export interface Shortcut {
  id: string;
  name: string;
  url: string;
}
export interface AppState {
  version: 1;
  settings: AppSettings;
  shortcuts: Shortcut[];
}
export interface Artwork {
  id: string;
  title: string;
  originalTitle: string;
  artist: string;
  year: string;
  source: string;
  museum: string;
  license: string;
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
