import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  GlassButton,
  GlassSurface,
  type GlassSurfaceProps,
} from "nico-glass-kit";
import { Pencil, Trash2 } from "lucide-react";
import type { DesktopFolder, Shortcut } from "../types";
import { t } from "../lib/i18n";
import { useGlassMaterial } from "../lib/glass";
import { useRestingBadge } from "../lib/useRestingBadge";
import { useGridDrag } from "../lib/useGridDrag";
import type { GridDragItem } from "../lib/gridDrag";
import { Modal } from "./Modal";
import { ShortcutTile } from "./ShortcutTile";
import { SiteIcon } from "./SiteIcon";

/** Glass props shared by the folder surfaces. */
export type FolderGlass = Pick<
  GlassSurfaceProps,
  "optics" | "elasticity" | "highlightIntensity"
>;

/** Keep a removed member on screen long enough to fade instead of blink out. */
const PREVIEW_EXIT_MS = 180;

/** Click handler shared by the preview's site links. */
type MiniLinkClick = (event: MouseEvent<HTMLAnchorElement>) => void;

/**
 * One persistent grid cell. The cell itself stays mounted (indexed slots are
 * stable), while icons cross-fade when membership changes. That is what makes
 * adding/removing a member look like a transition rather than a repaint.
 *
 * A visible member is a real link: clicking it opens that site. The folder's
 * own open control lives outside the glass, so no anchor is nested in a
 * button; clicks on empty cells and the background bubble to the tile's open
 * handler instead.
 */
function PreviewSlot({
  item,
  onLinkClick,
}: {
  item?: Shortcut;
  onLinkClick?: MiniLinkClick;
}) {
  const [outgoing, setOutgoing] = useState<Shortcut | null>(null);
  const previous = useRef<Shortcut | undefined>(item);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = previous.current;
    previous.current = item;
    if (prev && prev.id !== item?.id) {
      setOutgoing(prev);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(
        () => setOutgoing(null),
        PREVIEW_EXIT_MS,
      );
    } else {
      setOutgoing((current) =>
        current && current.id === item?.id ? null : current,
      );
    }
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
    };
  }, [item?.id]);
  const leaving = outgoing && outgoing.id !== item?.id ? outgoing : null;
  return (
    <span className={`folder-mini${item || leaving ? "" : " is-empty"}`}>
      {leaving && (
        <span
          key={`out-${leaving.id}`}
          className="folder-mini-icon is-leaving"
          aria-hidden="true"
        >
          <SiteIcon item={leaving} />
        </span>
      )}
      {item && (
        <a
          key={`in-${item.id}`}
          className="folder-mini-icon folder-mini-link is-entering"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          aria-label={item.name}
          onClick={onLinkClick}
        >
          <SiteIcon item={item} />
        </a>
      )}
    </span>
  );
}

type StackLayer = { key: string; item: Shortcut; leaving: boolean };

/**
 * The ninth cell once a folder has more than nine sites: eight icons plus the
 * first three surplus ones stacked. Layers animate in and fade out on removal
 * so the stack grows/shrinks rather than swapping its whole contents.
 */
function StackCell({ items }: { items: Shortcut[] }) {
  const signature = items.map((item) => item.id).join("|");
  const [layers, setLayers] = useState<StackLayer[]>(() =>
    items.map((item) => ({ key: item.id, item, leaving: false })),
  );
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const incoming = items.map((item) => ({
      key: item.id,
      item,
      leaving: false,
    }));
    const incomingKeys = new Set(incoming.map((layer) => layer.key));
    setLayers((current) => {
      const outgoing = current
        .filter((layer) => !incomingKeys.has(layer.key))
        .map((layer) => ({ ...layer, leaving: true }));
      return [...incoming, ...outgoing];
    });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setLayers((current) => current.filter((layer) => !layer.leaving));
    }, PREVIEW_EXIT_MS);
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = undefined;
      }
    };
    // The signature is the membership identity; item objects may change on
    // edit without needing a new transition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const currentById = new Map(items.map((item) => [item.id, item]));
  return (
    <span className="folder-mini folder-mini-stack">
      {layers.map((layer, index) => (
        <span
          key={layer.key}
          className={`folder-stack-layer${layer.leaving ? " is-leaving" : ""}`}
          style={{ "--stack": Math.min(index, 2) } as CSSProperties}
        >
          <SiteIcon item={currentById.get(layer.key) ?? layer.item} />
        </span>
      ))}
    </span>
  );
}

/**
 * Folder artwork: a 2×2 grid for up to four sites, a 3×3 grid for five to
 * nine, and a 3×3 grid whose last cell stacks the first three surplus icons
 * once the folder holds more than nine. Nine slots are always mounted (the
 * surplus five are hidden in the 2×2 layout), so a layout change moves and
 * animates the existing icons instead of replacing the whole preview.
 *
 * Each individually drawn icon is a link to that site. The stacked ninth cell
 * represents several sites at once, so it is left non-interactive: a click on
 * it bubbles to the folder's open handler, which is the sensible destination
 * for the group.
 */
export function FolderPreview({
  folder,
  shortcutsById,
  radius,
  onLinkClick,
}: {
  folder: DesktopFolder;
  shortcutsById: ReadonlyMap<string, Shortcut>;
  radius: number;
  onLinkClick?: MiniLinkClick;
}) {
  const count = folder.shortcutIds.length;
  const entries = folder.shortcutIds.map((id) => shortcutsById.get(id));
  const stacked = count > 9;
  const layout = stacked ? "is-3 is-stacked" : count <= 4 ? "is-2" : "is-3";
  return (
    <span
      className={`folder-preview ${layout}`}
      style={{ "--folder-preview-radius": `${radius}px` } as CSSProperties}
    >
      {Array.from({ length: 8 }, (_, index) => (
        <PreviewSlot
          key={index}
          item={entries[index]}
          onLinkClick={onLinkClick}
        />
      ))}
      {stacked ? (
        <StackCell
          items={entries
            .slice(8, 11)
            .filter((item): item is Shortcut => Boolean(item))}
        />
      ) : (
        <PreviewSlot item={entries[8]} onLinkClick={onLinkClick} />
      )}
    </span>
  );
}

export function FolderTile({
  folder,
  shortcutsById,
  active,
  dropActive,
  dropIntent,
  dropSide,
  dragging,
  ready,
  glass,
  radius,
  onOpen,
  onMiniLinkClick,
  onRename,
  onDragStart,
  onDragEnd,
}: {
  folder: DesktopFolder;
  shortcutsById: ReadonlyMap<string, Shortcut>;
  active: boolean;
  dropActive: boolean;
  /** "folder" when a site would join it, "sort" when the folder would move
   *  next to it. */
  dropIntent: "folder" | "sort" | null;
  /** Which side of the folder the dragged tile would land on. */
  dropSide: "before" | "after" | null;
  /** True while this folder is the one being dragged. */
  dragging: boolean;
  /** The page is only draggable once its state has loaded. */
  ready: boolean;
  glass: FolderGlass;
  /** Corner radius of the folder's glass, in pixels. */
  radius: number;
  onOpen: () => void;
  /** Guards a preview link when the pointer has just finished a folder drag. */
  onMiniLinkClick: MiniLinkClick;
  onRename: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  const m = t();
  const { base } = useGlassMaterial();
  const count = folder.shortcutIds.length;
  const [previewVersion, setPreviewVersion] = useState(0);
  const previousActive = useRef(active);
  // The pencil waits for the pointer to rest on the tile, so a quick pass
  // over a folder never flashes an edit button.
  const badge = useRestingBadge();
  const badgeId = `folder:${folder.id}`;
  // A pointer click anywhere on the tile opens the folder unless it landed on
  // a mini site link (which navigates) or on the open control itself (which
  // handles its own click). The glass keeps its pointer events, so the kit's
  // highlight/elasticity still answers the pointer over the folder.
  function handleTileClick(event: MouseEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest(".folder-mini-link, .folder-open")
    )
      return;
    onOpen();
  }
  // Closing the sheet reveals the tile again. Replaying a short preview
  // entrance makes edits made behind the dialog (add/remove/move) read as a
  // transition rather than a silent swap.
  useEffect(() => {
    if (previousActive.current && !active)
      setPreviewVersion((version) => version + 1);
    previousActive.current = active;
  }, [active]);
  return (
    <div
      className={[
        "folder-item",
        dropActive ? "drag-over" : "",
        dropIntent === "sort" && dropSide === "before" ? "is-sort-before" : "",
        dropIntent === "sort" && dropSide === "after" ? "is-sort-after" : "",
        dragging ? "is-dragging is-drag-source" : "",
        badge.resting === badgeId ? "is-badge-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerEnter={() => {
        if (!dragging) badge.rest(badgeId);
      }}
      onPointerLeave={() => badge.leave(badgeId)}
    >
      <div
        className="folder-tile"
        onClick={handleTileClick}
        // The folder is a desktop item like any other: the whole tile can be
        // picked up and moved, including when the drag begins on a mini icon.
        // The links opt out of native link dragging, so the pointer still
        // moves the folder rather than the URL.
        draggable={ready}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {/*
          A transparent control owns the folder-open action for assistive
          technology. It is a sibling of the preview — never its ancestor — so
          no anchor is nested in a button; pointer clicks on the glass and the
          label bubble to the tile handler above, and mini links handle their
          own navigation.
        */}
        <button
          type="button"
          className="folder-open"
          onClick={onOpen}
          aria-label={`${m.app.desktop.folderAria(folder.name)} · ${m.app.desktop.folderItems(count)}`}
          aria-haspopup="dialog"
          aria-expanded={active}
        />
        <GlassSurface className="folder-glass" cornerRadius={radius} {...glass}>
          <FolderPreview
            key={previewVersion}
            folder={folder}
            shortcutsById={shortcutsById}
            radius={radius}
            onLinkClick={onMiniLinkClick}
          />
        </GlassSurface>
        {/* The visible name stays plain text: the open button above already
            carries it as the accessible name, so this is not a second tab
            stop or a duplicate announcement. */}
        <span className="folder-name" aria-hidden="true">
          {folder.name}
        </span>
      </div>
      <GlassButton
        variant="icon"
        size="sm"
        className="shortcut-edit folder-edit"
        aria-label={m.app.desktop.renameFolder}
        title={m.app.desktop.renameFolder}
        onClick={onRename}
        icon={<Pencil size={13} />}
        {...base}
      />
    </div>
  );
}

/**
 * The opened folder. Its sites use the same tile as the desktop and the same
 * drag controller: the geometry, the hit test, the preview and the
 * placeholder are the desktop's, with the two gestures a folder does not
 * have switched off — a site never joins another folder from here, and a
 * site dropped outside the sheet leaves the folder.
 */
export function FolderDialog({
  folder,
  shortcutsById,
  shortcutGlass,
  shortcutRadius,
  onClose,
  onEditShortcut,
  onRemoveShortcut,
  onReorderShortcut,
  onRenameFolder,
  onDeleteFolder,
}: {
  folder: DesktopFolder;
  shortcutsById: ReadonlyMap<string, Shortcut>;
  shortcutGlass: FolderGlass;
  shortcutRadius: number;
  onClose: () => void;
  onEditShortcut: (id: string) => void;
  /** Takes a site out of the folder; the sheet waits for the write. */
  onRemoveShortcut: (id: string) => Promise<void>;
  /** Writes the order the sites were dragged into. */
  onReorderShortcut: (order: readonly string[]) => Promise<void>;
  onRenameFolder: () => void;
  onDeleteFolder: () => void;
}) {
  const m = t();
  const { base, panel } = useGlassMaterial();
  const gridRef = useRef<HTMLDivElement>(null);
  const count = folder.shortcutIds.length;
  const items = useMemo<GridDragItem[]>(
    () =>
      folder.shortcutIds.map((id) => ({
        key: `shortcut:${id}`,
        kind: "shortcut" as const,
        id,
      })),
    [folder.shortcutIds],
  );
  const drag = useGridDrag({
    gridRef,
    items,
    // The tiles are measured by the same key the desktop uses: the holder's
    // `data-drag-key` is the item's key. `data-shortcut-id` stays on the
    // tile as the plain id, but it is not the key the controller looks for.
    measure: {
      holderSelector: ".folder-site[data-drag-key]",
      holderAttribute: "data-drag-key",
    },
    // The sheet holds one cell per site: no folder is created here, and no
    // site joins another folder from inside a folder.
    capabilities: {
      mergeSites: false,
      joinFolders: false,
      appendTile: false,
    },
    offsetVars: { x: "--folder-drag-x", y: "--folder-drag-y" },
    glow: { selector: ".folder-site .shortcut-glass" },
    ghostRadius: () => shortcutRadius,
    onDrop: async (result) => {
      const { source, hit, order } = result;
      // A site dropped outside the sheet leaves the folder.
      if (hit?.kind === "outside") {
        await onRemoveShortcut(source.id);
        return;
      }
      // The drop commits the order that was on screen, whether the pointer
      // ended on a tile or in the gap between two of them.
      if (!order) return;
      await onReorderShortcut(
        order.filter((item) => item.kind !== "add").map((item) => item.id),
      );
    },
  });
  return (
    <Modal
      label={folder.name}
      onClose={onClose}
      onDragOver={drag.handlers.onDragOver}
      onDragEnter={drag.handlers.onDragEnter}
      onDrop={drag.handlers.onDrop}
      head={
        <GlassSurface
          className="dialog-head folder-head"
          cornerRadius={26}
          {...panel}
        >
          <span className="folder-head-text">
            <span className="dialog-title">{folder.name}</span>
            <small>{m.app.desktop.folderItems(count)}</small>
          </span>
          <button
            type="button"
            className="folder-rename"
            aria-label={m.app.desktop.renameFolder}
            title={m.app.desktop.renameFolder}
            onClick={onRenameFolder}
          >
            <Pencil size={14} />
          </button>
        </GlassSurface>
      }
      foot={
        <GlassButton
          type="button"
          size="sm"
          className="danger"
          icon={<Trash2 size={15} />}
          onClick={onDeleteFolder}
          {...base}
        >
          {m.app.desktop.deleteFolder}
        </GlassButton>
      }
    >
      <div
        className={`folder-dialog${drag.draggingKey ? " is-reordering" : ""}`}
      >
        {count === 0 ? (
          <p className="folder-empty">{m.app.desktop.emptyFolder}</p>
        ) : (
          <>
            <div ref={gridRef} className="folder-site-grid">
              {drag.order && drag.placeholder && (
                <span
                  className="folder-drag-placeholder"
                  style={{
                    left: `${drag.placeholder.left}px`,
                    top: `${drag.placeholder.top}px`,
                    width: `${drag.placeholder.width}px`,
                    height: `${drag.placeholder.height}px`,
                    borderRadius: shortcutRadius,
                  }}
                />
              )}
              {folder.shortcutIds.map((id, index) => {
                const item = shortcutsById.get(id);
                if (!item) return null;
                const key = `shortcut:${id}`;
                return (
                  <ShortcutTile
                    key={id}
                    item={item}
                    glass={shortcutGlass}
                    radius={shortcutRadius}
                    className="folder-site"
                    linkClassName="folder-site-link"
                    style={
                      {
                        "--folder-index": Math.min(index, 12),
                        ...drag.offsetStyle(key),
                      } as CSSProperties
                    }
                    dragKey={key}
                    shortcutId={id}
                    dragging={drag.draggingKey === key}
                    dragActive={drag.draggingKey !== null}
                    draggable
                    onDragStart={(event) =>
                      drag.beginDrag(event, {
                        key,
                        kind: "shortcut",
                        id,
                      })
                    }
                    onDragEnd={drag.handlers.onDragEnd}
                    onEdit={() => onEditShortcut(id)}
                    editTitle={m.common.actions.edit}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
