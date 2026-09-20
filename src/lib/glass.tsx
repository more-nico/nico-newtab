import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { GlassSurfaceProps } from "nico-glass-kit";
import type { AppSettings } from "../types";

export type GlassMaterialProps = Pick<
  GlassSurfaceProps,
  "optics" | "elasticity" | "highlightIntensity"
>;

export interface GlassMaterial {
  /**
   * The one transparent pane every component shares. Tint and tint strength
   * stay at the kit defaults (a neutral light/dark pane), and `overLight` is
   * left unset so each surface reads its own backdrop — this is the material
   * the glass-kit playground drives its panels with.
   */
  base: GlassMaterialProps;
  /**
   * Window shells (设置 / 网站编辑). Same pane, but rigid: the dialog frame must
   * not chase the pointer while everything inside it still reacts.
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
