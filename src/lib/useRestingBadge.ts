import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long the pointer has to rest on a tile before its badge shows up.
 *
 * The badge used to appear the moment the pointer crossed the tile, which
 * made every click on a site flash an icon that had nothing to do with the
 * click. Waiting for the pointer to settle keeps the badge for the gesture
 * it belongs to — a deliberate hover — and out of the way of a quick tap.
 */
export const RESTING_BADGE_DELAY_MS = 1000;

/**
 * Tracks the tile the pointer is resting on.
 *
 * `rest` starts the timer, `leave` cancels it and hides the badge right
 * away. Only one tile can be resting at a time — there is only one pointer —
 * so the state is a single id rather than a set.
 */
export function useRestingBadge(delay = RESTING_BADGE_DELAY_MS) {
  const [resting, setResting] = useState<string | null>(null);
  const timers = useRef(new Map<string, number>());

  const leave = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setResting((current) => (current === id ? null : current));
  }, []);

  const rest = useCallback(
    (id: string) => {
      // A pointer that is already resting on this tile keeps its timer.
      if (timers.current.has(id)) return;
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        // The tile that rested longest wins: there is only one pointer.
        setResting((current) => (current === id ? current : id));
      }, delay);
      timers.current.set(id, timer);
    },
    [delay],
  );

  // A tile that disappears mid-rest (a drag, a delete) must not leave a
  // timer running behind it.
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  return { resting, rest, leave };
}
