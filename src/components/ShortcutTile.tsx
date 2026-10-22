import type { CSSProperties, DragEvent, ReactNode } from "react";
import {
  GlassButton,
  GlassSurface,
  type GlassSurfaceProps,
} from "nico-glass-kit";
import { Pencil } from "lucide-react";
import type { Shortcut } from "../types";
import { useGlassMaterial } from "../lib/glass";
import { useRestingBadge } from "../lib/useRestingBadge";
import { t } from "../lib/i18n";
import { SiteIcon } from "./SiteIcon";

/** The glass a site tile's icon sits on. */
export type ShortcutTileGlass = Pick<
  GlassSurfaceProps,
  "optics" | "elasticity" | "highlightIntensity"
>;

export type ShortcutTileProps = {
  /** The site the tile shows. */
  item: Shortcut;
  /** The glass the icon sits on. */
  glass: ShortcutTileGlass;
  /** The glass's corner radius, in pixels. */
  radius: number;
  /**
   * The wrapper's class list. The desktop and the sheet that opens a folder
   * lay their tiles out differently, so the class is the caller's.
   */
  className?: string;
  /** The link's extra class list. */
  linkClassName?: string;
  /** The wrapper's inline style; the drag offset lives here. */
  style?: CSSProperties;
  /** The key the drag controller measures the tile by. */
  dragKey?: string;
  /** The id the folder sheet measures the tile by. */
  shortcutId?: string;
  /** The drop the tile is currently offering. */
  dropIntent?: string;
  /** True while this tile is the one being dragged. */
  dragging?: boolean;
  /** True while a drag is running on this surface. */
  dragActive?: boolean;
  /** The classes the drag source carries. */
  draggingClassName?: string;
  /** Whether the tile can be picked up. */
  draggable?: boolean;
  onDragStart?: (event: DragEvent<HTMLElement>) => void;
  onDragEnd?: () => void;
  /**
   * Opens the site editor; the pencil and the right-click menu use it. When
   * it is missing the tile offers no editor at all.
   */
  onEdit?: () => void;
  /** The pencil is shown but cannot be used yet. */
  editDisabled?: boolean;
  /** Called when the tile is activated (the desktop's managing mode). */
  onActivate?: () => void;
  /** Whether the pencil badge is offered at all. */
  showEdit?: boolean;
  /** The pencil's tooltip. */
  editTitle?: string;
  /** Extra buttons beside the pencil (the desktop's move-to-page control). */
  action?: ReactNode;
  /** The link's accessible name. */
  linkLabel?: string;
};

/**
 * One site tile.
 *
 * The desktop page and the sheet that opens a folder show their sites the
 * same way: a link with the site's glass on it, the name underneath and a
 * pencil in the corner. The pencil waits for the pointer to rest on the
 * tile, so a quick pass over a site never flashes an edit button.
 *
 * What the two surfaces do differently is passed in: the desktop manages
 * its tiles (the pencil gives way to the move control) and offers the
 * right-click editor, while the sheet always offers both.
 */
export function ShortcutTile({
  item,
  glass,
  radius,
  className,
  linkClassName,
  style,
  dragKey,
  shortcutId,
  dropIntent,
  dragging = false,
  dragActive = false,
  draggingClassName = "is-dragging is-drag-source",
  draggable = false,
  onDragStart,
  onDragEnd,
  onEdit,
  editDisabled = false,
  onActivate,
  showEdit = true,
  editTitle,
  action,
  linkLabel,
}: ShortcutTileProps) {
  const m = t();
  const { base } = useGlassMaterial();
  // The badge waits for the pointer to rest on the tile (a second), so a
  // quick pass over a site must not flash an edit button.
  const badge = useRestingBadge();
  const badgeKey = `shortcut:${item.id}`;
  const classes = [
    className,
    badge.resting === badgeKey ? "is-badge-visible" : "",
    dragging ? draggingClassName : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={classes}
      style={style}
      data-drag-key={dragKey}
      data-shortcut-id={shortcutId}
      data-drop-intent={dropIntent}
      draggable={draggable}
      onPointerEnter={() => {
        // A drag is not a hover: no tile shows its badge while a tile moves.
        if (!dragActive) badge.rest(badgeKey);
      }}
      onPointerLeave={() => badge.leave(badgeKey)}
      onDragStart={(event) => {
        // The tile that is picked up does not keep its badge.
        badge.leave(badgeKey);
        onDragStart?.(event);
      }}
      onDragEnd={onDragEnd}
    >
      <a
        href={item.url}
        className={`shortcut-link${linkClassName ? ` ${linkClassName}` : ""}`}
        draggable={false}
        // Keep the new tab page where it is: a shortcut opens beside it
        // rather than replacing it.
        target="_blank"
        rel="noopener noreferrer"
        onClick={
          onActivate
            ? (event) => {
                event.preventDefault();
                onActivate();
              }
            : undefined
        }
        onContextMenu={
          onEdit
            ? (event) => {
                event.preventDefault();
                onEdit();
              }
            : undefined
        }
        aria-label={linkLabel ?? item.name}
      >
        <GlassSurface
          className="shortcut-glass"
          cornerRadius={radius}
          {...glass}
        >
          <SiteIcon item={item} />
        </GlassSurface>
        <span className="shortcut-name">{item.name}</span>
      </a>
      {action}
      {showEdit && (
        <GlassButton
          variant="icon"
          size="sm"
          className="shortcut-edit"
          aria-label={m.app.shortcuts.editAria(item.name)}
          title={editTitle}
          onClick={onEdit}
          disabled={editDisabled}
          icon={<Pencil size={13} />}
          {...base}
        />
      )}
    </div>
  );
}
