import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GlassSurfaceProps } from "nico-glass-kit";
import type { AppSettings } from "../types";

export type GlassMaterialProps = Pick<
  GlassSurfaceProps,
  "optics" | "elasticity" | "highlightIntensity" | "overLight"
>;

export interface GlassMaterial {
  base: GlassMaterialProps;
  light: GlassMaterialProps;
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
  const base: GlassMaterialProps = {
    optics,
    highlightIntensity: settings.glass.highlight,
    elasticity: reducedMotion ? 0 : settings.glass.elasticity,
  };
  return {
    base,
    light: { ...base, overLight: true },
    panel: {
      ...base,
      overLight: true,
      optics: { ...optics, tintStrength: 0.8 },
    },
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
