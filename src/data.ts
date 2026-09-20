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
    title: "睡莲",
    shortTitle: "睡莲",
    originalTitle: "Water Lilies",
    artist: "克劳德 · 莫奈",
    year: "1906",
    source: "https://www.artic.edu/artworks/16568/water-lilies",
    museum: "芝加哥艺术博物馆",
    license: "公有领域 · PD-Art",
    image: "wallpapers/water-lilies.webp",
    thumbnail: "wallpapers/water-lilies-thumb.webp",
  },
  {
    id: "cliff-walk",
    title: "普尔维尔的悬崖漫步",
    shortTitle: "悬崖漫步",
    originalTitle: "Cliff Walk at Pourville",
    artist: "克劳德 · 莫奈",
    year: "1882",
    source: "https://www.artic.edu/artworks/14620/cliff-walk-at-pourville",
    museum: "芝加哥艺术博物馆",
    license: "公有领域 · PD-Art",
    image: "wallpapers/cliff-walk.webp",
    thumbnail: "wallpapers/cliff-walk-thumb.webp",
  },
  {
    id: "rainy-paris",
    title: "巴黎街道，雨天",
    shortTitle: "巴黎街道",
    originalTitle: "Paris Street; Rainy Day",
    artist: "古斯塔夫 · 卡耶博特",
    year: "1877",
    source: "https://www.artic.edu/artworks/20684/paris-street-rainy-day",
    museum: "芝加哥艺术博物馆",
    license: "公有领域 · PD-Art",
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
      clockFormat: "24",
    },
    shortcuts: [],
  };
}
