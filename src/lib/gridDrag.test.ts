import { describe, expect, it } from "vitest";
import { planDesktopGrid } from "./desktopLayout";
import {
  appendedOrder,
  hitTestGrid,
  previewOrderFor,
  type GridCapabilities,
  type GridDragItem,
  type GridGeometry,
} from "./gridDrag";

const site = (id: string): GridDragItem => ({
  key: `shortcut:${id}`,
  kind: "shortcut",
  id,
});
const folder: GridDragItem = { key: "folder:f", kind: "folder", id: "f" };
const add: GridDragItem = { key: "add", kind: "add", id: "__add" };
const desktop: GridCapabilities = {
  mergeSites: true,
  joinFolders: true,
  appendTile: true,
};
const insideFolder: GridCapabilities = {
  mergeSites: false,
  joinFolders: false,
  appendTile: false,
};

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  } as DOMRect;
}

function geometry(items: GridDragItem[]): GridGeometry {
  const columns = 4,
    cell = 80,
    row = 88,
    gap = 14;
  const bounds = rect(0, 0, columns * (cell + gap) - gap, 400);
  const plan = planDesktopGrid(
    items.map((item) => ({
      type: item.kind === "folder" ? "folder" : "shortcut",
    })),
    columns,
  );
  return {
    element: { getBoundingClientRect: () => bounds } as HTMLElement,
    gridRect: bounds,
    columns,
    cell,
    row,
    gapX: gap,
    gapY: gap,
    items,
    tiles: items.map((item, index) => {
      const { col, row: line, span } = plan.placements[index];
      const left = col * (cell + gap),
        top = line * (row + gap);
      return {
        ...item,
        rect: rect(
          left,
          top,
          cell * span + gap * (span - 1),
          row * span + gap * (span - 1),
        ),
        glassRect: rect(left + 9, top, 62, 62),
      };
    }),
  };
}

describe("drag intent", () => {
  it("merges at the centre and reorders at the edge; folders disable merging", () => {
    const items = [site("a"), site("b")];
    const grid = geometry(items);
    const hit = (x: number, capabilities = desktop, source = items[0]) =>
      hitTestGrid(grid, source, x, 31, capabilities, null);
    expect(hit(134)).toMatchObject({ kind: "tile", intent: "merge" });
    expect(hit(160)).toMatchObject({
      kind: "tile",
      intent: "sort",
      side: "after",
    });
    expect(hit(134, insideFolder)).toMatchObject({
      kind: "tile",
      intent: "sort",
    });
    expect(hit(134, desktop, folder)).toMatchObject({
      kind: "tile",
      intent: "sort",
    });
  });

  it("keeps a merge target stable at the boundary until the pointer leaves", () => {
    const items = [site("a"), site("b")],
      grid = geometry(items);
    const previous = hitTestGrid(grid, items[0], 134, 31, desktop, null);
    expect(
      hitTestGrid(grid, items[0], 155, 31, desktop, previous),
    ).toMatchObject({ intent: "merge" });
    expect(hitTestGrid(grid, items[0], 155, 31, desktop, null)).toMatchObject({
      intent: "sort",
    });
  });

  it("joins an existing folder while dragging a folder only reorders it", () => {
    const items = [site("a"), folder],
      grid = geometry(items);
    expect(hitTestGrid(grid, items[0], 120, 31, desktop, null)).toMatchObject({
      intent: "join",
    });
    expect(
      hitTestGrid(grid, { ...folder, id: "other" }, 120, 31, desktop, null),
    ).toMatchObject({ intent: "sort" });
  });

  it.each([
    [86, 31, "gap"],
    [20, 31, "source"],
    [500, 31, "outside"],
  ] as const)("recognizes (%i, %i) as %s", (x, y, kind) => {
    const items = [site("a"), site("b")];
    expect(
      hitTestGrid(geometry(items), items[0], x, y, desktop, null).kind,
    ).toBe(kind);
  });
});

describe("drag preview", () => {
  it("keeps the add tile last and separates folder ids from site ids", () => {
    const sameIdFolder = { ...folder, id: "a", key: "folder:a" };
    const items = [site("a"), sameIdFolder, site("b"), add];
    expect(
      previewOrderFor(items, "folder:a", "shortcut:b", "after")?.map(
        (item) => item.key,
      ),
    ).toEqual(["shortcut:a", "shortcut:b", "folder:a", "add"]);
    expect(appendedOrder(items, "folder:a")?.map((item) => item.key)).toEqual([
      "shortcut:a",
      "shortcut:b",
      "folder:a",
      "add",
    ]);
  });
});
