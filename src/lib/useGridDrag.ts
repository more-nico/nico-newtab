import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type RefObject,
} from "react";
import { buildDragGhost } from "./dragGhost";
import {
  appendedOrder,
  captureGridGeometry,
  clearDragGlow,
  gridOffsets,
  gridPlaceholder,
  hitTestGrid,
  lightNearbyGlass,
  planGrid,
  pointInRect,
  previewOrderFor,
  type GridCapabilities,
  type GridDragItem,
  type GridGeometry,
  type GridHit,
  type GridMeasureOptions,
  type GridPlaceholder,
} from "./gridDrag";

/** What a drop commits. */
export type GridDropResult = {
  /** The tile that was dragged. */
  source: GridDragItem;
  /** Where the pointer was when the drop happened. */
  hit: GridHit | null;
  /**
   * The order the drop commits, when the gesture is a reorder. It is the
   * order that was on screen, so the drop cannot commit something the user
   * never saw.
   */
  order: readonly GridDragItem[] | null;
};

export type UseGridDragOptions = {
  /** The element that holds the tiles; it is what the hit test measures. */
  gridRef: RefObject<HTMLElement | null>;
  /** The tiles, in their resting order. */
  items: readonly GridDragItem[];
  /** How the tiles are found and measured. */
  measure: GridMeasureOptions;
  /** What the grid allows while a tile is dragged over it. */
  capabilities: GridCapabilities;
  /** The CSS variables the preview offset is written to. */
  offsetVars?: { x: string; y: string };
  /** The glass surfaces that light up near the pointer. */
  glow?: { selector: string; radius?: number } | null;
  /** The corner radius of the dragged tile's ghost. */
  ghostRadius?: (item: GridDragItem) => number;
  /** Called when a drag starts. */
  onBegin?: (item: GridDragItem) => void;
  /** Called when the drag ends, however it ends. */
  onEnd?: () => void;
  /**
   * Called when a tile is dropped. A promise keeps the preview on screen
   * until the order has been written, so the tiles do not jump back before
   * the new order arrives.
   */
  onDrop: (result: GridDropResult) => void | Promise<void>;
};

/** Whether two hits mean the same thing. */
function sameHit(left: GridHit | null, right: GridHit | null): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "tile" && right.kind === "tile")
    return (
      left.key === right.key &&
      left.id === right.id &&
      left.target === right.target &&
      left.intent === right.intent &&
      left.side === right.side
    );
  if (left.kind === "add" && right.kind === "add")
    return left.key === right.key;
  return true;
}

/** Whether two lists hold the same tiles, whatever their order. */
function sameMembers(
  left: readonly GridDragItem[],
  right: readonly GridDragItem[],
): boolean {
  if (left.length !== right.length) return false;
  const keys = new Set(left.map((item) => item.key));
  if (keys.size !== left.length) return false;
  return right.every((item) => keys.has(item.key));
}

/** Whether two orders hold the same tiles. */
function sameOrder(
  left: readonly GridDragItem[] | null,
  right: readonly GridDragItem[] | null,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.length === right.length &&
    left.every((item, index) => item.key === right[index]!.key)
  );
}

/**
 * The drag controller both grids share.
 *
 * It owns the resting geometry, the hit test, the previewed order, the
 * offsets the tiles are moved by, the placeholder and the proximity glow.
 * The grid is the only stable drop target: the tiles move under the pointer,
 * so Chromium would otherwise change the drop target as they animate and
 * cancel the drop. The source node therefore stays in its resting cell and
 * is made transparent instead.
 */
export function useGridDrag(options: UseGridDragOptions) {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [order, setOrder] = useState<readonly GridDragItem[] | null>(null);
  const [hit, setHit] = useState<GridHit | null>(null);
  /** The geometry captured at drag start; the hit test reads it. */
  const geometry = useRef<GridGeometry | null>(null);
  /** The tile that is being dragged. */
  const source = useRef<GridDragItem | null>(null);
  /** The tiles as they are right now. */
  const items = useRef(options.items);
  items.current = options.items;
  const orderRef = useRef<readonly GridDragItem[] | null>(null);
  const hitRef = useRef<GridHit | null>(null);
  const glowFrame = useRef<number | null>(null);
  const glowPoint = useRef<{ x: number; y: number } | null>(null);
  const glowLit = useRef<Set<HTMLElement>>(new Set());
  /** True while a drop is still being written. */
  const committing = useRef(false);
  /** The options as they are right now, so the handlers never go stale. */
  const settings = useRef(options);
  settings.current = options;

  const updateHit = useCallback((next: GridHit | null) => {
    if (sameHit(hitRef.current, next)) return;
    hitRef.current = next;
    setHit(next);
  }, []);

  const updateOrder = useCallback((next: readonly GridDragItem[] | null) => {
    if (sameOrder(orderRef.current, next)) return;
    orderRef.current = next;
    setOrder(next);
  }, []);

  const clearGlow = useCallback(() => {
    if (glowFrame.current !== null) {
      cancelAnimationFrame(glowFrame.current);
      glowFrame.current = null;
    }
    glowPoint.current = null;
    clearDragGlow(glowLit.current);
    glowLit.current.clear();
  }, []);

  const updateGlow = useCallback((x: number, y: number) => {
    const glow = settings.current.glow;
    if (!glow) return;
    glowPoint.current = { x, y };
    if (glowFrame.current !== null) return;
    glowFrame.current = requestAnimationFrame(() => {
      glowFrame.current = null;
      const point = glowPoint.current;
      const surface = settings.current.gridRef.current;
      if (!point || !surface) return;
      const lit = lightNearbyGlass(surface, point, glow);
      for (const glass of glowLit.current) {
        if (lit.has(glass)) continue;
        clearDragGlow([glass]);
      }
      glowLit.current = lit;
    });
  }, []);

  const reset = useCallback(() => {
    clearGlow();
    geometry.current = null;
    source.current = null;
    updateOrder(null);
    updateHit(null);
    setDraggingKey(null);
    settings.current.onEnd?.();
  }, [clearGlow, updateHit, updateOrder]);

  /**
   * Start a drag. The geometry is measured once, here, and every hit test
   * for the rest of the gesture reads those resting boxes.
   */
  const beginDrag = useCallback(
    (event: DragEvent<HTMLElement>, item: GridDragItem) => {
      const grid = settings.current.gridRef.current;
      geometry.current = grid
        ? captureGridGeometry(grid, items.current, settings.current.measure)
        : null;
      source.current = item;
      updateOrder(null);
      updateHit(null);
      setDraggingKey(item.key);
      settings.current.onBegin?.(item);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.id);
      const radius = settings.current.ghostRadius?.(item);
      if (radius !== undefined) {
        const ghost = buildDragGhost(
          event.currentTarget,
          event.clientX,
          event.clientY,
          radius,
        );
        if (ghost)
          event.dataTransfer.setDragImage(
            ghost.ghost,
            ghost.width / 2,
            ghost.height / 2,
          );
      }
    },
    [updateHit, updateOrder],
  );

  /** Turn one hit into the feedback the user sees. */
  const applyHit = useCallback(
    (next: GridHit) => {
      const dragged = source.current;
      if (!dragged) return;
      if (next.kind === "tile") {
        if (next.intent === "sort") {
          updateOrder(
            previewOrderFor(items.current, dragged.key, next.key, next.side),
          );
        } else {
          // A merge target removes the reorder preview: the enlarged glass
          // is the feedback.
          updateOrder(null);
        }
      } else if (next.kind === "add") {
        updateOrder(appendedOrder(items.current, dragged.key));
      } else if (next.kind === "gap") {
        // The pointer crossed the space between two tiles. The last preview
        // stays, so the target cannot bounce between cells.
      } else {
        updateOrder(null);
      }
      updateHit(next);
    },
    [updateHit, updateOrder],
  );

  /**
   * Drops the feedback without ending the drag.
   *
   * A surface that takes the drag over — the dock, which moves a tile to
   * another page — abandons the reorder preview: the drop there means
   * something else.
   */
  const clearFeedback = useCallback(() => {
    updateOrder(null);
    updateHit(null);
  }, [updateHit, updateOrder]);

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      // Chromium only fires a drop when the drag has been accepted, and it
      // only accepts it when the event is cancelled.
      event.preventDefault();
      const dragged = source.current;
      const measured = geometry.current;
      if (!dragged || !measured) return;
      applyHit(
        hitTestGrid(
          measured,
          dragged,
          event.clientX,
          event.clientY,
          settings.current.capabilities,
          hitRef.current,
        ),
      );
    },
    [applyHit],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const dragged = source.current;
      const measured = geometry.current;
      if (!dragged || !measured) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      applyHit(
        hitTestGrid(
          measured,
          dragged,
          event.clientX,
          event.clientY,
          settings.current.capabilities,
          hitRef.current,
        ),
      );
      updateGlow(event.clientX, event.clientY);
    },
    [applyHit, updateGlow],
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const related = event.relatedTarget;
      if (related instanceof Node && event.currentTarget.contains(related))
        return;
      if (
        pointInRect(
          event.currentTarget.getBoundingClientRect(),
          event.clientX,
          event.clientY,
        )
      )
        return;
      // Out of the grid means nobody is previewing a reorder any more. The
      // drag itself may still end somewhere else, which owns its own drop.
      updateOrder(null);
      updateHit(null);
      clearGlow();
    },
    [clearGlow, updateHit, updateOrder],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      // The drop belongs to the page, never to the browser: a file dropped on
      // the grid must not navigate away from it.
      event.preventDefault();
      const dragged = source.current;
      if (!dragged) return;
      const measured = geometry.current;
      const dropHit = measured
        ? hitTestGrid(
            measured,
            dragged,
            event.clientX,
            event.clientY,
            settings.current.capabilities,
            hitRef.current,
          )
        : null;
      // The preview is the source of truth for a reorder: the drop commits
      // the order that was on screen, not an order inferred from the moved
      // tiles. Only when no preview was ever shown (a very fast drag) the
      // order is computed from the final pointer position.
      let committed = orderRef.current;
      if (!committed && dropHit?.kind === "tile" && dropHit.intent === "sort")
        committed = previewOrderFor(
          items.current,
          dragged.key,
          dropHit.key,
          dropHit.side,
        );
      if (!committed && dropHit?.kind === "add")
        committed = appendedOrder(items.current, dragged.key);
      const pending = settings.current.onDrop({
        source: dragged,
        hit: dropHit,
        order: committed,
      });
      if (pending && typeof pending.then === "function") {
        // The order is being written: keep the preview on screen until the
        // new order has arrived.
        committing.current = true;
        void pending.then(
          () => {
            committing.current = false;
            reset();
          },
          () => {
            committing.current = false;
            reset();
          },
        );
        return;
      }
      reset();
    },
    [reset],
  );

  const handleDragEnd = useCallback(() => {
    // A drop that is still being written keeps the preview; the write
    // clears it when it lands.
    if (committing.current) return;
    reset();
  }, [reset]);

  // Escape cancels the drag. It is caught on the document in the capture
  // phase, so a drag inside a dialog is cancelled before the dialog can
  // close itself.
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !source.current) return;
      event.preventDefault();
      event.stopPropagation();
      reset();
    };
    document.addEventListener("keydown", cancel, true);
    return () => document.removeEventListener("keydown", cancel, true);
  }, [reset]);

  useEffect(
    () => () => {
      if (glowFrame.current !== null) cancelAnimationFrame(glowFrame.current);
      clearDragGlow(glowLit.current);
      glowLit.current.clear();
    },
    [],
  );

  const measured = geometry.current;
  // A preview describes the tiles it was made for. When the page changed
  // underneath it — the order was just written, or another tab edited the
  // page — the preview no longer describes what is on screen, and the tiles
  // are left where the new order puts them.
  const preview = order && sameMembers(order, items.current) ? order : null;
  const offsets = measured
    ? gridOffsets(measured, items.current, preview)
    : null;
  const placeholder: GridPlaceholder | null =
    measured && draggingKey
      ? gridPlaceholder(measured, draggingKey, items.current, preview)
      : null;
  // The rows the previewed order needs; a reorder can push a tile into a
  // row the resting grid did not have.
  const previewRows =
    measured && preview ? planGrid(preview, measured.columns).shape.rows : 0;
  const variables = settings.current.offsetVars ?? {
    x: "--drag-x",
    y: "--drag-y",
  };

  /** How far the tile has to move to show the previewed order. */
  const offsetStyle = (key: string): CSSProperties | undefined => {
    // The source node stays in its resting cell and is made transparent;
    // moving it under the pointer would make Chromium treat the drag source
    // as the current drop target and suppress the drop entirely.
    if (!offsets || key === draggingKey) return undefined;
    const offset = offsets.get(key);
    if (!offset) return undefined;
    return {
      [variables.x]: `${offset.x}px`,
      [variables.y]: `${offset.y}px`,
    } as CSSProperties;
  };

  return {
    /** The key of the tile that is being dragged. */
    draggingKey,
    /** The previewed order, or null when the grid is at rest. */
    order: preview,
    /** The gesture the pointer is currently over. */
    hit,
    /** The box the dragged tile would leave behind. */
    placeholder,
    /** The rows the previewed order needs. */
    previewRows,
    /** How far the tile has to move to show the previewed order. */
    offsetStyle,
    /** Starts a drag on a tile. */
    beginDrag,
    /** The handlers the grid (or the sheet around it) takes. */
    handlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
      onDragEnd: handleDragEnd,
    },
    /** Ends the drag and puts the grid back the way it was. */
    reset,
    /** Drops the feedback without ending the drag. */
    clearFeedback,
  };
}
