/**
 * The corner radius shared by the desktop's glass tiles.
 *
 * A site's glass is 62px with a 21px corner on the default breakpoint, and it
 * shrinks with the layout (54px/18px and 56px/19px at the compact
 * breakpoints). The folder is much larger (140–150px), so neither extreme
 * reads correctly beside it:
 *
 * - keeping the site's exact pixel corner makes the folder look too square;
 * - scaling the corner by the folder's own size (19px → 47px) over-rounds it.
 *
 * The folder therefore uses a balanced size scaling, halfway between those
 * two on a logarithmic scale:
 *
 *     folderRadius = round(siteRadius × sqrt(folderSize / siteSize))
 *
 * This is a documented design heuristic, not an Apple-published formula:
 * Apple's icon masks are specified in terms of matching the platform's UI
 * curvature, without a public radius calculation. The square-root rule keeps
 * the folder recognisably in the same family as a site while letting its
 * corner grow enough to feel proportionate at 140–164px. For the taller folder
 * glass, the longer dimension drives its corner, preserving that balance.
 *
 * CSS `corner-shape: squircle` is deliberately not used. The kit paints its
 * glass on nested layers that default to round corners, and its displacement
 * lens map is generated from the circular `cornerRadius` alone. Propagating
 * the shape onto those layers changes the outline without changing the
 * refraction field, so the corners would no longer describe the same optical
 * surface.
 *
 * The radius is applied through the kit's `cornerRadius` prop rather than in
 * CSS, because the prop is what the refraction/optical map is built from: a
 * radius that only lived in the stylesheet would leave the lens map describing
 * a different shape than the one on screen.
 */

/** The site's own radius on its own size: 21px on a 62px glass. */
export const TILE_RADIUS_RATIO = 21 / 62;

/** The corner radius a site glass of `size` pixels gets. */
export function tileRadius(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 0;
  return Math.round(size * TILE_RADIUS_RATIO);
}

/**
 * The folder's corner radius for a site/folder pair at one breakpoint.
 *
 * The square root is the deliberate middle ground between “same pixels” and
 * “same ratio”; see the module comment. Invalid sizes produce no radius rather
 * than `NaN`.
 */
export function folderRadius(siteSize: number, folderSize: number): number {
  if (!Number.isFinite(siteSize) || siteSize <= 0) return 0;
  if (!Number.isFinite(folderSize) || folderSize <= 0) return 0;
  return Math.round(tileRadius(siteSize) * Math.sqrt(folderSize / siteSize));
}

/**
 * The desktop's two glass tile radii at a breakpoint.
 *
 * The folder may be taller than it is wide so its bottom edge meets the
 * second row of site glass. The longer side sets the visual corner scale.
 */
export function desktopTileRadii(
  siteSize: number,
  folderWidth: number,
  folderHeight = folderWidth,
): {
  shortcut: number;
  folder: number;
} {
  return {
    shortcut: tileRadius(siteSize),
    folder: folderRadius(siteSize, Math.max(folderWidth, folderHeight)),
  };
}
