import type { AppState, Artwork, GlassSettings } from "./types";

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
  };
}
