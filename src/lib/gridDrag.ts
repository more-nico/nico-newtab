/**
 * The grid drag core.
 *
 * Both grids that can be dragged — the desktop page and the sheet that opens
 * a folder — answer a drag the same way: the resting geometry is measured
 * once, every hit test reads those resting boxes, the preview shows the order
 * the drop would commit, and the source node stays where it is. This module
 * holds that arithmetic; `useGridDrag` wires it to the DOM.
 *
 * The desktop grid is the general case: it holds sites and folders, a folder
 * covers a 2×2 block of cells and the centre of a site's glass means "make a
 * folder out of these two". The folder sheet is the plain case: one cell per
 * site, no merging and no folders inside a folder. The differences are
 * capabilities, not a second implementation.
 */

import {
  planDesktopGrid,
  type DesktopDropSide,
  type DesktopGridPlan,
} from "./desktopLayout";
import { reorderItems } from "./reorder";

/** What a tile in a drag grid can be. */
export type GridDragKind = "shortcut" | "folder" | "add";

/** One entry of a drag grid. */
export type GridDragItem = {
  /** A key that is unique within the grid. */
  key: string;
  kind: GridDragKind;
  /** The id the entry is known by in the store. */
  id: string;
};

/**
 * What the grid allows while a tile is dragged over it.
 *
 * The desktop page merges sites into a folder and lets a site join a folder;
 * the sheet that opens a folder does neither — a site only changes places
 * there, and it leaves the folder when it is dropped outside the sheet.
 */
export type GridCapabilities = {
  /** A site dropped on another site's glass centre creates a folder. */
  mergeSites: boolean;
  /** A site dropped on a folder joins it. */
  joinFolders: boolean;
  /** The grid offers an "add" tile that appends the dragged tile. */
  appendTile: boolean;
};

/** The gesture a drop on a tile means. */
export type GridDropIntent = "sort" | "merge" | "join";

/** Where the pointer is, in terms of the grid. */
export type GridHit =
  | { kind: "outside" }
  /** Inside the grid, but not on a tile. */
  | { kind: "gap" }
  /** On the tile that is being dragged. */
  | { kind: "source" }
  | { kind: "add"; key: string }
  | {
      kind: "tile";
      key: string;
      id: string;
      /** The kind of the tile under the pointer. */
      target: "shortcut" | "folder";
      intent: GridDropIntent;
      side: DesktopDropSide;
    };

/**
 * How the grid's tiles are found and measured.
 *
 * The contract is one line: the holder's attribute value is the item's key.
 * The controller looks the holder up by that key, so a holder that carries
 * something else is simply not found — there is no second guess and no
 * fallback that would hide the mismatch.
 */
export type GridMeasureOptions = {
  /** The selector that finds the element holding a tile. */
  holderSelector: string;
  /** The attribute on a holder that carries the tile's key. */
  holderAttribute: string;
  /**
   * The visual tile inside a holder. The holder itself is used when the
   * selector finds nothing — the desktop keeps a folder's holder apart from
   * the folder itself, the sheet does not.
   */
  tileSelector?: string;
};

/** One measured tile, in its resting position. */
export type GridTile = {
  key: string;
  kind: GridDragKind;
  id: string;
  /** The tile's resting box. */
  rect: DOMRect;
  /** The glass inside the tile, when it has one. */
  glassRect: DOMRect | null;
};

/**
 * The grid as it was when the drag began.
 *
 * Hit testing deliberately uses these resting rectangles for the whole
 * gesture: the tiles move under the pointer as the preview is shown, so
 * measuring them again would feed the preview back into itself and make
 * adjacent slots alternate every frame.
 */
export type GridGeometry = {
  element: HTMLElement;
  /** The grid's resting box. */
  gridRect: DOMRect;
  /** The width of one cell. */
  cell: number;
  /** The height of one row. */
  row: number;
  /** The gap between the cells. */
  gapX: number;
  gapY: number;
  /** The number of tracks the grid has. */
  columns: number;
  /** The items in their resting order. */
  items: readonly GridDragItem[];
  /** The measured tiles. */
  tiles: readonly GridTile[];
};

/** The box a drag preview reserves for the tile that is being dragged. */
export type GridPlaceholder = {
  /** The box relative to the grid. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** The tracks the placeholder covers: two for a folder's block. */
  span: number;
};

/** The distance at which a glass surface starts to light up. */
export const DRAG_GLOW_RADIUS = 78;

/**
 * The central part of a site's glass means "these two belong together". The
 * remaining frame on every side keeps the long-standing reorder gesture:
 * dropping near a side edge moves the dragged tile to that slot. Once the
 * centre zone has been entered it has to be left by a little more than that,
 * so a pointer hovering the boundary cannot make the feedback flip between
 * "merge" and "reorder" every frame.
 */
const MERGE_ZONE = 0.6;
const MERGE_ZONE_EXIT = 0.68;

/** Whether a point is inside a box. */
export function pointInRect(rect: DOMRect, x: number, y: number): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** The track sizes of a computed `grid-template-columns`. */
function trackSizes(value: string): number[] {
  if (!value || value === "none") return [];
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => Number.parseFloat(part) || 0);
}

/**
 * Snapshot the resting grid geometry for one drag.
 *
 * Every tile carries its own measured box, and the grid's cell, row and gap
 * are read from the computed style, so the preview translation follows the
 * same responsive values as the layout itself.
 */
export function captureGridGeometry(
  element: HTMLElement,
  items: readonly GridDragItem[],
  options: GridMeasureOptions,
): GridGeometry | null {
  const gridRect = element.getBoundingClientRect();
  if (gridRect.width <= 0 || gridRect.height <= 0) return null;
  const style = getComputedStyle(element);
  const holders = new Map<string, HTMLElement>();
  for (const node of element.querySelectorAll<HTMLElement>(
    options.holderSelector,
  )) {
    const key = node.getAttribute(options.holderAttribute);
    if (key) holders.set(key, node);
  }
  const tiles: GridTile[] = [];
  for (const item of items) {
    const holder = holders.get(item.key);
    if (!holder) continue;
    const root = options.tileSelector
      ? (holder.querySelector<HTMLElement>(options.tileSelector) ?? holder)
      : holder;
    const rect = root.getBoundingClientRect();
    tiles.push({
      key: item.key,
      kind: item.kind,
      id: item.id,
      rect,
      glassRect:
        root
          .querySelector<HTMLElement>(".shortcut-glass, .folder-glass")
          ?.getBoundingClientRect() ?? null,
    });
  }
  const gapX = Number.parseFloat(style.columnGap) || 0;
  const gapY = Number.parseFloat(style.rowGap) || 0;
  const tracks = trackSizes(style.gridTemplateColumns);
  const cell =
    (tracks[0] ?? 0) ||
    Number.parseFloat(style.getPropertyValue("--desktop-cell")) ||
    tiles[0]?.rect.width ||
    0;
  const row =
    Number.parseFloat(style.getPropertyValue("--desktop-row")) ||
    trackSizes(style.gridAutoRows)[0] ||
    tiles[0]?.rect.height ||
    0;
  const columns =
    tracks.length ||
    (cell > 0
      ? Math.max(1, Math.floor((element.clientWidth + gapX) / (cell + gapX)))
      : 1);
  return {
    element,
    gridRect,
    cell,
    row,
    gapX,
    gapY,
    columns,
    items: items.slice(),
    tiles,
  };
}

/**
 * The tile the pointer is on.
 *
 * A tile is only a target while the pointer is inside it. The space between
 * two tiles is a gap, and a gap keeps the last preview instead of choosing a
 * new target — the same rule on both grids.
 */
function pickTile(
  tiles: readonly GridTile[],
  x: number,
  y: number,
): GridTile | null {
  for (const tile of tiles) if (pointInRect(tile.rect, x, y)) return tile;
  return null;
}

/**
 * Which side of the target the pointer is on.
 *
 * The site's glass is the smaller box inside its cell, so its centre is what
 * decides; a folder has no glass of its own in this sense and its block
 * decides.
 */
function sideOf(tile: GridTile, x: number): DesktopDropSide {
  const box =
    tile.kind === "folder" ? tile.rect : (tile.glassRect ?? tile.rect);
  return x < box.left + box.width / 2 ? "before" : "after";
}

/**
 * Whether the pointer is in the centre of a site's glass.
 *
 * The zone is entered at 60% of the glass and left at 68%, so a pointer that
 * hovers the boundary cannot make the feedback flip between "merge" and
 * "reorder" every frame.
 */
function inMergeZone(
  tile: GridTile,
  x: number,
  y: number,
  previous: GridHit | null,
): boolean {
  const glass = tile.glassRect;
  if (!glass || glass.width <= 0 || glass.height <= 0) return false;
  const stays =
    previous?.kind === "tile" &&
    previous.target === "shortcut" &&
    previous.id === tile.id &&
    previous.intent === "merge";
  const zone = stays ? MERGE_ZONE_EXIT : MERGE_ZONE;
  const halfWidth = (glass.width * zone) / 2;
  const halfHeight = (glass.height * zone) / 2;
  return (
    Math.abs(x - (glass.left + glass.width / 2)) <= halfWidth &&
    Math.abs(y - (glass.top + glass.height / 2)) <= halfHeight
  );
}

/**
 * Resolve the gesture from the pointer and the resting boxes.
 *
 * Using the pointer rather than the event's target is what keeps the answer
 * stable while the target itself slides out from under the cursor.
 *
 * A folder is a drag source of its own, and it never merges: dropped on a
 * site's centre it reorders next to that site instead of swallowing it, and
 * dropped on another folder it only ever moves to one of its sides. Folders
 * are containers, so the two gestures that change what a tile *contains* stay
 * reserved for sites.
 */
export function hitTestGrid(
  geometry: GridGeometry,
  source: GridDragItem,
  x: number,
  y: number,
  capabilities: GridCapabilities,
  previous: GridHit | null,
): GridHit {
  // The grid itself can grow taller when the preview wants an extra row, so
  // the live box is the one that decides whether the pointer is still inside.
  if (!pointInRect(geometry.element.getBoundingClientRect(), x, y))
    return { kind: "outside" };
  const tile = pickTile(geometry.tiles, x, y);
  if (!tile) return { kind: "gap" };
  // The source answers for itself, whatever kind of tile it is.
  if (tile.kind === source.kind && tile.id === source.id)
    return { kind: "source" };
  if (tile.kind === "add")
    return capabilities.appendTile
      ? { kind: "add", key: tile.key }
      : { kind: "gap" };
  if (tile.kind === "folder") {
    // A site joins the folder it is dropped on; a folder never joins
    // another folder, it only moves to one of its sides.
    if (source.kind === "shortcut" && capabilities.joinFolders)
      return {
        kind: "tile",
        key: tile.key,
        id: tile.id,
        target: "folder",
        intent: "join",
        side: "after",
      };
    return {
      kind: "tile",
      key: tile.key,
      id: tile.id,
      target: "folder",
      intent: "sort",
      side: sideOf(tile, x),
    };
  }
  // Only a site can be merged into a new folder. A folder dragged over a
  // site reorders next to it instead.
  if (
    source.kind === "shortcut" &&
    capabilities.mergeSites &&
    inMergeZone(tile, x, y, previous)
  )
    return {
      kind: "tile",
      key: tile.key,
      id: tile.id,
      target: "shortcut",
      intent: "merge",
      side: "after",
    };
  return {
    kind: "tile",
    key: tile.key,
    id: tile.id,
    target: "shortcut",
    intent: "sort",
    side: sideOf(tile, x),
  };
}

/** Whether two lists hold the same items in the same order. */
function sameItems(
  left: readonly GridDragItem[],
  right: readonly GridDragItem[],
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item.key === right[index]!.key)
  );
}

/**
 * The order a drop next to the target would commit.
 *
 * The tiles that cannot be dragged — the desktop's "add" tile — keep their
 * place at the end of the list, so the preview and the committed order agree
 * on what the grid holds.
 */
export function previewOrderFor(
  items: readonly GridDragItem[],
  sourceKey: string,
  targetKey: string,
  side: DesktopDropSide,
): readonly GridDragItem[] | null {
  const draggable = items.filter((item) => item.kind !== "add");
  const trailing = items.filter((item) => item.kind === "add");
  // Collection ids may overlap: only the typed key identifies a grid tile.
  const next = reorderItems(
    draggable.map((item) => ({ id: item.key, item })),
    sourceKey,
    targetKey,
    side,
  )?.map(({ item }) => item);
  if (!next) return null;
  const order = [...next, ...trailing];
  return sameItems(order, items) ? null : order;
}

/**
 * The order a drop on the "add" tile would commit: the dragged tile goes to
 * the end of the page.
 */
export function appendedOrder(
  items: readonly GridDragItem[],
  sourceKey: string,
): readonly GridDragItem[] | null {
  const draggable = items.filter((item) => item.kind !== "add");
  const trailing = items.filter((item) => item.kind === "add");
  const source = draggable.find((item) => item.key === sourceKey);
  if (!source) return null;
  const order = [
    ...draggable.filter((item) => item.key !== sourceKey),
    source,
    ...trailing,
  ];
  return sameItems(order, items) ? null : order;
}

/** Where the grid puts each item, in cells. */
export function planGrid(
  items: readonly GridDragItem[],
  columns: number,
): DesktopGridPlan {
  return planDesktopGrid(
    items.map((item) => ({
      type:
        item.kind === "folder" ? ("folder" as const) : ("shortcut" as const),
    })),
    columns,
  );
}

/**
 * How far each tile has to move to show the previewed order.
 *
 * A folder moves by the same arithmetic as a site, so its 2×2 block stays
 * aligned wherever the order puts it.
 */
export function gridOffsets(
  geometry: GridGeometry,
  resting: readonly GridDragItem[],
  preview: readonly GridDragItem[] | null,
): Map<string, { x: number; y: number }> {
  const offsets = new Map<string, { x: number; y: number }>();
  if (!preview) return offsets;
  const restingPlan = planGrid(resting, geometry.columns);
  const previewPlan = planGrid(preview, geometry.columns);
  const restingIndex = new Map(
    resting.map((item, index) => [item.key, index] as const),
  );
  preview.forEach((item, index) => {
    const from = restingIndex.get(item.key);
    if (from === undefined) return;
    const start = restingPlan.placements[from];
    const end = previewPlan.placements[index];
    if (!start || !end) return;
    const x = (end.col - start.col) * (geometry.cell + geometry.gapX);
    const y = (end.row - start.row) * (geometry.row + geometry.gapY);
    if (x === 0 && y === 0) return;
    offsets.set(item.key, { x, y });
  });
  return offsets;
}

/**
 * The box the dragged tile would leave behind.
 *
 * It shows the glass of a site and the whole block of a folder, moved to the
 * cell the previewed order gives it.
 */
export function gridPlaceholder(
  geometry: GridGeometry,
  sourceKey: string,
  resting: readonly GridDragItem[],
  preview: readonly GridDragItem[] | null,
): GridPlaceholder | null {
  const tile = geometry.tiles.find((item) => item.key === sourceKey);
  if (!tile) return null;
  const offset = gridOffsets(geometry, resting, preview).get(sourceKey) ?? {
    x: 0,
    y: 0,
  };
  if (tile.kind === "folder") {
    // The folder's own box is the 2×2 block: two tracks and two rows, gap
    // included, so the placeholder is the block the folder will occupy.
    return {
      left: tile.rect.left - geometry.gridRect.left + offset.x,
      top: tile.rect.top - geometry.gridRect.top + offset.y,
      width: geometry.cell * 2 + geometry.gapX,
      height: geometry.row * 2 + geometry.gapY,
      span: 2,
    };
  }
  const glass = tile.glassRect;
  return {
    left:
      tile.rect.left -
      geometry.gridRect.left +
      offset.x +
      (glass ? glass.left - tile.rect.left : 0),
    top:
      tile.rect.top -
      geometry.gridRect.top +
      offset.y +
      (glass ? glass.top - tile.rect.top : 0),
    width: glass?.width ?? geometry.cell,
    height: glass?.height ?? geometry.row,
    span: 1,
  };
}

/**
 * Light the glass surfaces that are close to the pointer.
 *
 * The glow follows the pointer across the nearby tiles. It is painted on the
 * glass itself and never changes hit testing.
 */
export function lightNearbyGlass(
  surface: HTMLElement,
  point: { x: number; y: number },
  options: { selector: string; radius?: number },
): Set<HTMLElement> {
  const lit = new Set<HTMLElement>();
  const radius = options.radius ?? DRAG_GLOW_RADIUS;
  for (const glass of surface.querySelectorAll<HTMLElement>(options.selector)) {
    // The tile that is being dragged keeps its own glass dark.
    if (glass.closest(".is-drag-source")) continue;
    const rect = glass.getBoundingClientRect();
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
    const distance = Math.hypot(dx, dy);
    if (distance >= radius) continue;
    const strength = (1 - distance / radius) ** 2;
    glass.style.setProperty("--drag-glow-x", `${point.x - rect.left}px`);
    glass.style.setProperty("--drag-glow-y", `${point.y - rect.top}px`);
    glass.style.setProperty("--drag-glow-strength", strength.toFixed(3));
    glass.classList.add("is-drag-lit");
    lit.add(glass);
  }
  return lit;
}

/** Put the lit glass surfaces back the way they were. */
export function clearDragGlow(lit: Iterable<HTMLElement>): void {
  for (const glass of lit) {
    glass.classList.remove("is-drag-lit");
    glass.style.removeProperty("--drag-glow-x");
    glass.style.removeProperty("--drag-glow-y");
    glass.style.removeProperty("--drag-glow-strength");
  }
}
