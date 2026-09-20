import { describe, expect, it } from "vitest";
import { defaultState } from "../data";
import { createGlassMaterial } from "./glass";

describe("global glass material", () => {
  it("maps every persisted playground control to shared component props", () => {
    const settings = defaultState().settings;
    const material = createGlassMaterial(settings, false);

    expect(material.base).toEqual({
      optics: {
        blur: 3,
        saturation: 100,
        brightness: 1.1,
        depth: 8,
        curvature: 0.2,
        dispersion: 0.1,
      },
      highlightIntensity: 1,
      elasticity: 0.2,
    });
    expect(material.light.overLight).toBe(true);
    expect(material.panel.optics).toEqual({
      ...material.base.optics,
      tintStrength: 0.8,
    });
  });

  it("keeps optics but disables elasticity for reduced motion", () => {
    const settings = defaultState().settings;
    settings.glass.elasticity = 0.4;
    const material = createGlassMaterial(settings, true);

    expect(material.base.optics).toBeDefined();
    expect(material.base.elasticity).toBe(0);
    expect(material.panel.elasticity).toBe(0);
  });
});
