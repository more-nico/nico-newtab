import type { AppState, Artwork, DesktopPage, GlassSettings } from "./types";
import { t } from "./lib/i18n";

/** Stable id for the page that legacy states migrate onto. */
export const DEFAULT_PAGE_ID = "page-default";
/**
 * The name of the first page, in the user's language. A fresh installation
 * starts on it, and a state written before pages existed migrates onto it.
 */
export function defaultPageName(): string {
  return t().app.desktop.homePage;
}
/** Layout limits shared by validation and the UI. */
export const MAX_PAGES = 20;
export const MAX_PAGE_NAME = 24;
export const MAX_FOLDERS = 100;
export const MAX_FOLDER_NAME = 24;
export const MAX_PAGE_ITEMS = 500;

/** Fresh default page; callers may mutate the returned arrays. */
export function createDefaultPage(): DesktopPage {
  return { id: DEFAULT_PAGE_ID, name: defaultPageName(), items: [] };
}

/** Mirrors nico-glass-kit's playground DEFAULT_PARAMS exactly. */
export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
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

export const ARTWORKS: Artwork[] = [
  {
    id: "water-lilies",
    originalTitle: "Water Lilies",
    year: "1906",
    source: "https://www.artic.edu/artworks/16568/water-lilies",
    image: "wallpapers/water-lilies.webp",
    thumbnail: "wallpapers/water-lilies-thumb.webp",
  },
  {
    id: "cliff-walk",
    originalTitle: "Cliff Walk at Pourville",
    year: "1882",
    source: "https://www.artic.edu/artworks/14620/cliff-walk-at-pourville",
    image: "wallpapers/cliff-walk.webp",
    thumbnail: "wallpapers/cliff-walk-thumb.webp",
  },
  {
    id: "rainy-paris",
    originalTitle: "Paris Street; Rainy Day",
    year: "1877",
    source: "https://www.artic.edu/artworks/20684/paris-street-rainy-day",
    image: "wallpapers/rainy-paris.webp",
    thumbnail: "wallpapers/rainy-paris-thumb.webp",
  },
];

export function defaultState(): AppState {
  return {
    version: 1,
    settings: {
      wallpaper: "water-lilies",
      customWallpaper: null,
      fit: "cover",
      positionX: 50,
      positionY: 50,
      brightness: 85,
      blur: 0,
      glass: { ...DEFAULT_GLASS_SETTINGS },
      quality: "high",
      glassMode: "auto",
      clockFormat: "24",
      clockTintStrength: 0.1,
      searchEngine: "default",
      customEngines: [],
    },
    shortcuts: [],
    pages: [createDefaultPage()],
    folders: [],
  };
}
