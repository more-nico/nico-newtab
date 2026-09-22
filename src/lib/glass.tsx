import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GlassSurfaceProps, OverLight } from "nico-glass-kit";
import type { AppSettings } from "../types";

export type GlassMaterialProps = Pick<
  GlassSurfaceProps,
  "optics" | "elasticity" | "highlightIntensity"
>;

export interface GlassMaterial {
  /**
   * Everything the pointer can touch or hover: buttons, sliders, inputs, the
   * home tiles — and the containers that group them (cards, notes, segmented
   * tracks, the wallpaper picker, the toast and the alert). Containers follow
   * the pointer too, because a glass UI where only atoms react reads as flat.
   */
  base: GlassMaterialProps;
  /**
   * The dialog's own sheet — the pane the window is made of (设置 / 网站编辑).
   * Rigid on purpose: the window frame must not chase the pointer while
   * everything inside it still reacts. That is the only surface that opts out,
   * so keep this list at "the window itself" and nothing else.
   */
  panel: GlassMaterialProps;
}

const GlassMaterialContext = createContext<GlassMaterial | null>(null);

export function createGlassMaterial(
  settings: AppSettings,
  reducedMotion: boolean,
): GlassMaterial {
  const optics = {
    blur: settings.glass.blur,
    saturation: settings.glass.saturation,
    brightness: settings.glass.brightness,
    depth: settings.glass.depth,
    curvature: settings.glass.curvature,
    dispersion: settings.glass.dispersion,
  };
  const highlightIntensity = settings.glass.highlight;
  return {
    base: {
      optics,
      highlightIntensity,
      elasticity: reducedMotion ? 0 : settings.glass.elasticity,
    },
    panel: { optics, highlightIntensity, elasticity: 0 },
  };
}

export function useGlassMaterialValue(
  settings: AppSettings,
  reducedMotion: boolean,
): GlassMaterial {
  return useMemo(
    () => createGlassMaterial(settings, reducedMotion),
    [settings.glass, reducedMotion],
  );
}

/** Maps the app's glass mode onto the kit's `overLight` prop. */
export function glassOverLight(mode: AppSettings["glassMode"]): OverLight {
  return mode === "auto" ? "auto" : mode === "light";
}

export function GlassMaterialProvider({
  value,
  children,
}: {
  value: GlassMaterial;
  children: ReactNode;
}) {
  return (
    <GlassMaterialContext.Provider value={value}>
      {children}
    </GlassMaterialContext.Provider>
  );
}

export function useGlassMaterial(): GlassMaterial {
  const value = useContext(GlassMaterialContext);
  if (!value)
    throw new Error(
      "useGlassMaterial must be used inside GlassMaterialProvider",
    );
  return value;
}
