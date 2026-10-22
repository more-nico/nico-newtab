/** A flat stand-in for glass, which Chrome cannot rasterise into a drag image. */
export function buildDragGhost(
  tile: HTMLElement,
  x: number,
  y: number,
  radius: number,
) {
  const glass = tile.querySelector<HTMLElement>(
    ".shortcut-glass, .folder-glass",
  );
  if (!glass) return null;
  const box = glass.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;
  ghost.style.setProperty("--drag-ghost-radius", `${radius}px`);
  ghost.style.left = `${x - box.width / 2}px`;
  ghost.style.top = `${y - box.height / 2}px`;
  const art =
    glass.querySelector(".folder-preview") ??
    glass.querySelector(".site-icon, .site-letter");
  if (art) ghost.append(art.cloneNode(true));
  document.body.append(ghost);
  setTimeout(() => ghost.remove(), 0);
  return { ghost, width: box.width, height: box.height };
}
