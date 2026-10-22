import { describe, expect, it } from "vitest";
import { commitOrder, reorderItems } from "./reorder";

describe("reordering", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it.each([
    ["a", "b", "after", ["b", "a", "c"]],
    ["c", "b", "before", ["a", "c", "b"]],
  ] as const)(
    "moves %s relative to %s (%s)",
    (source, target, side, expected) => {
      const next = reorderItems(items, source, target, side);
      expect(next?.map((item) => item.id)).toEqual(expected);
      expect(items.map((item) => item.id)).toEqual(["a", "b", "c"]);
    },
  );

  it("ignores self-drops and stale targets", () => {
    expect(reorderItems(items, "a", "a", "after")).toBeNull();
    expect(reorderItems(items, "a", "missing", "after")).toBeNull();
  });

  it("commits a complete permutation", () => {
    expect(commitOrder(["a", "b", "c"], ["c", "a", "b"])).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it.each([
    ["a", "a", "c"], // A repeated member must never replace another.
    ["a", "b"], // A member was added after the preview.
    ["a", "b", "d"], // A member was replaced after the preview.
    ["a", "b", "c"], // Nothing changed.
  ])("refuses an invalid or unchanged preview %j", (...order) => {
    expect(commitOrder(["a", "b", "c"], order)).toBeNull();
  });
});
