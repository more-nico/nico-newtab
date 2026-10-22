/**
 * The desktop grid's layout arithmetic, kept apart from the view so the rules
 * can be reasoned about — and tested — on their own.
 *
 * The grid is a plain CSS grid: the tiles are auto-placed in document order, a
 * folder covers a 2×2 block of cells, and the number of tracks is capped by
 * the width the section can actually hold. The only thing decided here is the
 * track count, and it is decided by simulating that auto-placement for every
 * candidate width.
 *
 * The order a drag produces is not decided here: it is the one shared
 * definition in `lib/reorder`, which the folder sheet uses as well.
 */

import { reorderItems } from "./reorder";

/** A tile in the desktop grid: a site, or a folder that covers 2×2 cells. */
export type DesktopGridItem = {
  readonly type: "shortcut" | "folder";
};

/** The shape a candidate track count produces. */
export type DesktopGridShape = {
  /** Track count. */
  cols: number;
  /** Rows the tiles reach. */
  rows: number;
  /** Cells the tiles leave empty inside the used rectangle. */
  holes: number;
};

/** Where one tile lands in the auto-placed grid. */
export type DesktopGridPlacement = {
  /** First row of the tile (zero-based). */
  row: number;
  /** First track of the tile (zero-based). */
  col: number;
  /** Tracks and rows the tile covers: 1 for a site, 2 for a folder. */
  span: number;
};

/** The placements, plus the shape they produce. */
export type DesktopGridPlan = {
  readonly shape: DesktopGridShape;
  readonly placements: readonly DesktopGridPlacement[];
};

/** A folder covers two tracks and two rows; a site covers one of each. */
function spanOf(item: DesktopGridItem): number {
  return item.type === "folder" ? 2 : 1;
}

/**
 * Mirrors the browser's sparse, row-flow auto-placement for the tiles: the
 * cursor walks the grid from left to right, a tile that does not fit moves on
 * to the next free spot, and a folder covers a 2×2 block. The result is what
 * the browser will actually paint, so the track count can be judged against
 * the real thing instead of against an arithmetic guess.
 *
 * A folder needs two tracks, so `cols` must be at least two whenever the items
 * include one; `chooseDesktopColumns` guarantees that.
 *
 * Exposing every placement, not just the final shape, is what lets the drag
 * preview put each tile where the committed order will actually place it —
 * including a folder's 2×2 block and rows that wrap.
 */
export function planDesktopGrid(
  items: readonly DesktopGridItem[],
  cols: number,
): DesktopGridPlan {
  const occupied: boolean[][] = [];
  const placements: DesktopGridPlacement[] = [];
  const free = (row: number, col: number, span: number) => {
    for (let y = 0; y < span; y++)
      for (let x = 0; x < span; x++)
        if (occupied[row + y]?.[col + x]) return false;
    return true;
  };
  let row = 0;
  let col = 0;
  let lastRow = 0;
  let cells = 0;
  for (const item of items) {
    const span = spanOf(item);
    // The tile no longer fits in what is left of this row: the cursor wraps.
    if (col + span > cols) {
      row += 1;
      col = 0;
    }
    // Otherwise the cursor walks on until the tile finds a free block.
    while (!free(row, col, span)) {
      col += 1;
      if (col + span > cols) {
        row += 1;
        col = 0;
      }
    }
    for (let y = 0; y < span; y++) {
      if (!occupied[row + y]) occupied[row + y] = [];
      for (let x = 0; x < span; x++) occupied[row + y][col + x] = true;
    }
    placements.push({ row, col, span });
    cells += span * span;
    lastRow = Math.max(lastRow, row + span - 1);
    col += span;
  }
  const rows = items.length === 0 ? 0 : lastRow + 1;
  return {
    shape: { cols, rows, holes: rows * cols - cells },
    placements,
  };
}

/** Convenience wrapper for callers that only need the shape. */
export function simulateDesktopGrid(
  items: readonly DesktopGridItem[],
  cols: number,
): DesktopGridShape {
  return planDesktopGrid(items, cols).shape;
}

/**
 * Picks the track count for the desktop grid.
 *
 * The rows are what make the page tall, so the layout with the fewest rows
 * wins: a screen wide enough for several tracks is expected to use them
 * instead of stacking the tiles in one long column. Ties go to the fewest
 * holes and then to the narrowest grid, so a page with a handful of tiles
 * stays a compact, centred cluster rather than a wide band with a ragged last
 * row. (The holes and the width move together: the tiles occupy a fixed
 * number of cells, so at a fixed row count the narrower grid is the one with
 * fewer holes.)
 *
 * `maxCols` is the number of tracks the measured width can hold. The caller
 * measures it rather than guessing it from a breakpoint, which is what keeps a
 * phone down to the tracks it can fit.
 */
export function chooseDesktopColumns(
  items: readonly DesktopGridItem[],
  maxCols: number,
): number {
  if (items.length === 0) return 1;
  const limit = Math.max(1, Math.floor(maxCols));
  // A folder covers two tracks, so a page holding one needs two of them even
  // when the width would only fit a single track.
  const min = items.some((item) => item.type === "folder") ? 2 : 1;
  let best = min;
  let bestShape = simulateDesktopGrid(items, min);
  for (let cols = min + 1; cols <= Math.max(min, limit); cols++) {
    const shape = simulateDesktopGrid(items, cols);
    // Fewer rows first, then fewer holes, then the narrower grid — the
    // candidates are walked upwards, so a full tie keeps the narrower one.
    if (
      shape.rows < bestShape.rows ||
      (shape.rows === bestShape.rows && shape.holes < bestShape.holes)
    ) {
      best = cols;
      bestShape = shape;
    }
  }
  return best;
}

/** A page item that the desktop can reorder: a site or a folder. */
export type DesktopReorderItem = DesktopGridItem & { readonly id: string };

/** The side of the target the dragged tile is dropped on. */
export type DesktopDropSide = "before" | "after";

/**
 * The committed order for a page item dropped on one side of another page item.
 *
 * The dragged tile is taken out first, then inserted next to the target in the
 * resulting list. That definition lives in `lib/reorder`, where the folder
 * sheet keeps its own order in step with it, so the layout cannot preview one
 * order and persist another.
 *
 * Folders take part like any other tile: the folder is moved as one entry, so
 * it keeps its 2×2 block in the grid, and nothing inside it is touched. The
 * page only ever holds the folder's id, so reordering cannot reach into the
 * folder's members.
 *
 * Returns null when either id is not on the page, or when the drag started on
 * the target itself.
 */
export function reorderDesktopItems<T extends DesktopReorderItem>(
  items: readonly T[],
  sourceId: string,
  targetId: string,
  side: DesktopDropSide,
): T[] | null {
  return reorderItems(items, sourceId, targetId, side);
}
