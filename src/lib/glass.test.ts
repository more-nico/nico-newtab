import { expect, it } from "vitest";
import { defaultState } from "../data";
import { createGlassMaterial } from "./glass";

it("disables elastic motion without losing the configured optics", () => {
  const settings = defaultState().settings;
  const normal = createGlassMaterial(settings, false);
  const reduced = createGlassMaterial(settings, true);
  expect(reduced.base.elasticity).toBe(0);
  expect(reduced.panel.elasticity).toBe(0);
  expect(reduced.base.optics).toEqual(normal.base.optics);
});
