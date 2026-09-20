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
  });

  it("carries no tint of its own, so every window stays transparent", () => {
    const settings = defaultState().settings;
    const { base, panel } = createGlassMaterial(settings, false);

    for (const material of [base, panel]) {
      // No tint or tintStrength: the kit's neutral pane and its automatic
      // light/dark adaptation stay in charge.
      expect(material.optics).not.toHaveProperty("tint");
      expect(material.optics).not.toHaveProperty("tintStrength");
      expect(material).not.toHaveProperty("overLight");
    }
  });

  it("keeps window shells rigid while everything around them stays elastic", () => {
    const settings = defaultState().settings;
    settings.glass.elasticity = 0.4;
    const { base, panel } = createGlassMaterial(settings, false);

    expect(base.elasticity).toBe(0.4);
    expect(panel.elasticity).toBe(0);
    expect(panel.optics).toEqual(base.optics);
    expect(panel.highlightIntensity).toBe(base.highlightIntensity);
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
