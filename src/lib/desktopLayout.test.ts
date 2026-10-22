import { describe, expect, it } from "vitest";
import {
  chooseDesktopColumns,
  planDesktopGrid,
  type DesktopGridItem,
} from "./desktopLayout";

const sites = (count: number): DesktopGridItem[] =>
  Array.from({ length: count }, () => ({ type: "shortcut" }));

describe("desktop layout", () => {
  it.each([
    [13, 7, 7],
    [13, 4, 4],
    [8, 7, 4],
  ])(
    "lays out %i sites within %i available tracks using %i columns",
    (count, available, expected) => {
      expect(chooseDesktopColumns(sites(count), available)).toBe(expected);
    },
  );

  it("wraps a folder as one 2×2 block without overlapping adjacent sites", () => {
    const plan = planDesktopGrid(
      [
        { type: "shortcut" },
        { type: "shortcut" },
        { type: "folder" },
        { type: "shortcut" },
      ],
      3,
    );
    expect(plan.placements).toEqual([
      { row: 0, col: 0, span: 1 },
      { row: 0, col: 1, span: 1 },
      { row: 1, col: 0, span: 2 },
      { row: 1, col: 2, span: 1 },
    ]);
    expect(plan.shape.rows).toBe(3);
  });

  it("keeps an empty page usable and reserves two tracks for folders", () => {
    expect(chooseDesktopColumns([], 7)).toBe(1);
    expect(chooseDesktopColumns([{ type: "folder" }], 1)).toBe(2);
  });
});
