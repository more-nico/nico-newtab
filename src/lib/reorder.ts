/**
 * The one reorder algorithm.
 *
 * A drag moves a tile next to another one: the dragged tile is taken out of
 * the list and inserted next to its target, either before or after it. The
 * desktop page, the sheet that opens a folder and the order that is written
 * back all use this definition, so the preview can never disagree with what
 * is stored.
 */

/** The side of the target the dragged tile is dropped on. */
export type ReorderSide = "before" | "after";

/**
 * Moves the source next to the target.
 *
 * The source is taken out first and inserted into the list that is left, so
 * the target keeps its own neighbours and the dragged tile lands exactly
 * before or after it.
 *
 * Returns null when the source is the target itself or when either id is not
 * in the list — there is no order to commit in that case.
 */
export function reorderItems<T extends { id: string }>(
  items: readonly T[],
  sourceId: string,
  targetId: string,
  side: ReorderSide,
): T[] | null {
  if (sourceId === targetId) return null;
  const source = items.find((item) => item.id === sourceId);
  const target = items.find((item) => item.id === targetId);
  if (!source || !target) return null;
  const withoutSource = items.filter((item) => item.id !== sourceId);
  const targetIndex = withoutSource.indexOf(target);
  if (targetIndex < 0) return null;
  const insertAt = side === "before" ? targetIndex : targetIndex + 1;
  const next = withoutSource.slice();
  next.splice(insertAt, 0, source);
  return next;
}

/**
 * The same move, on a plain list of ids. It is the folder's own list, where
 * only the order is stored.
 */
export function reorderIds(
  ids: readonly string[],
  sourceId: string,
  targetId: string,
  side: ReorderSide,
): string[] | null {
  const items = ids.map((id) => ({ id }));
  const next = reorderItems(items, sourceId, targetId, side);
  return next ? next.map((item) => item.id) : null;
}

/** Whether two lists hold the same ids in the same order. */
export function sameOrder(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((id, index) => id === right[index])
  );
}

/**
 * The order that may be written, checked against the list that is there now.
 *
 * A preview is made for the list the user could see. If the list changed in
 * the meantime — a member added or removed in another tab — the preview no
 * longer describes it, and writing it would throw that change away. The
 * order is then refused and the list is left alone.
 *
 * The order has to be a permutation of the list: every member exactly once.
 * An order that repeats a member would drop another one, so it is refused
 * as well.
 *
 * Returns null when the two lists do not hold the same members or when the
 * order would not change anything.
 */
export function commitOrder(
  current: readonly string[],
  order: readonly string[],
): string[] | null {
  if (current.length !== order.length) return null;
  const members = new Set(current);
  const written = new Set<string>();
  for (const id of order) {
    // Every member appears exactly once: a repeated id would drop another.
    if (!members.has(id) || written.has(id)) return null;
    written.add(id);
  }
  if (written.size !== members.size) return null;
  if (sameOrder(current, order)) return null;
  return order.slice();
}
