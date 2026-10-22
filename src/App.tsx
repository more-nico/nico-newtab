import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  GlassAlert,
  GlassButton,
  GlassElasticityGroup,
  GlassInput,
  GlassLightGroup,
  GlassProvider,
  GlassSelect,
  GlassSurface,
  GlassText,
  useOverLight,
} from "nico-glass-kit";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  FolderInput,
  FolderPlus,
  GalleryVerticalEnd,
  ImageIcon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import {
  ARTWORKS,
  MAX_FOLDER_NAME,
  MAX_FOLDERS,
  MAX_PAGES,
  defaultState,
} from "./data";
import type {
  AppSettingsPatch,
  AppState,
  BackupV1,
  DesktopFolder,
  DesktopPage,
  PageIcon,
  Shortcut,
} from "./types";
import {
  dataUrlToBlob,
  optimizeImage,
  validateDecodedWallpaper,
} from "./lib/images";
import { chooseDesktopColumns, planDesktopGrid } from "./lib/desktopLayout";
import { desktopTileRadii } from "./lib/tileRadius";
import { isExtension, repository, search } from "./lib/platform";
import { buildSnapshot } from "./lib/sync";
import { useNutstoreSync } from "./lib/useNutstoreSync";
import { listEngines, resolveEngine } from "./lib/engines";
import { MIN_QUERY_LENGTH, fetchSuggestions } from "./lib/suggest";
import { commitOrder } from "./lib/reorder";
import { useGridDrag } from "./lib/useGridDrag";
import type { GridDragItem } from "./lib/gridDrag";
import type { NutstoreSyncProps } from "./components/NutstoreSync";
import { Settings, type SettingsTab } from "./components/Settings";
import { ShortcutEditor } from "./components/ShortcutEditor";
import { ShortcutTile } from "./components/ShortcutTile";
import { ClearButton } from "./components/ClearButton";
import { EngineIcon } from "./components/EngineIcon";
import { Modal } from "./components/Modal";
import { NameDialog } from "./components/NameDialog";
import { PageDialog } from "./components/PageDialog";
import { PageIconBadge } from "./components/PageIcon";
import {
  FolderDialog,
  FolderTile,
  type FolderGlass,
} from "./components/DesktopFolder";
import { artworkOf, formatClock, formatDate, t } from "./lib/i18n";
import {
  GlassMaterialProvider,
  glassOverLight,
  useGlassMaterial,
  useGlassMaterialValue,
} from "./lib/glass";

/** How long typing settles before a suggestion request goes out. */
const SUGGEST_DEBOUNCE_MS = 200;

/**
 * The clock is `GlassText`, so its glyphs are glass tiles shaped like the
 * character rasters. The font is the playground TextDemo's input-preview
 * letter font (`LETTER_FONT_FAMILY`); the size is one the layout can still
 * breathe at on a phone.
 */
/**
 * Sized from both axes: a 768px-tall window has almost no vertical slack once
 * the search bar and the tiles are in, so width alone would overflow it.
 */
const CLOCK_SIZE = "clamp(80px, min(12.5vw, 18dvh), 200px)";
const CLOCK_FONT = '"Palatino Linotype", serif';

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

type PageItem = DesktopPage["items"][number];

/**
 * What the pointer is carrying. A folder is a first-class drag source: it
 * travels as one tile, keeps its 2×2 block and never changes its contents.
 */
type DragPayload = {
  kind: "shortcut" | "folder";
  id: string;
  /** The page the tile was picked up from. */
  pageId: string;
};

function desktopItemKey(item: Pick<PageItem, "type" | "id">): string {
  return `${item.type}:${item.id}`;
}

/**
 * The page items a previewed order stands for.
 *
 * The "add" tile is not a page item — it is the button that creates one — so
 * it never takes part in a committed order.
 */
function toPageItems(order: readonly GridDragItem[]): PageItem[] {
  return order
    .filter((item) => item.kind !== "add")
    .map((item) => ({
      type:
        item.kind === "folder" ? ("folder" as const) : ("shortcut" as const),
      id: item.id,
    }));
}

type ShortcutPlacement =
  | { kind: "page"; page: DesktopPage; index: number }
  | { kind: "folder"; folder: DesktopFolder; index: number }
  | { kind: "directory"; index: number };

/** The name-only dialog: folders, and the pages that are only renamed. */
type NameDialogState =
  | { kind: "folder-create"; initial: string }
  | {
      kind: "folder-rename";
      id: string;
      initial: string;
      returnFolderId?: string;
    };

/**
 * The page dialog. It covers the four things a page can be changed for: a
 * new page (name and icon), a rename, the dock icon on its own, and the
 * name and the icon together.
 */
type PageDialogState =
  | { mode: "create"; name: string }
  | { mode: "rename"; id: string; name: string }
  | { mode: "icon"; id: string; name: string }
  | { mode: "settings"; id: string; name: string };

type ConfirmState =
  | { kind: "page-delete"; id: string; name: string }
  | { kind: "folder-delete"; id: string; name: string; returnFolderId: string };

/** Every shortcut id that currently lives on a page or inside a folder. */
function placedShortcutIds(state: AppState): Set<string> {
  const ids = new Set<string>();
  for (const page of state.pages)
    for (const item of page.items)
      if (item.type === "shortcut") ids.add(item.id);
  for (const folder of state.folders)
    for (const id of folder.shortcutIds) ids.add(id);
  return ids;
}

/** The page that owns a folder tile, plus the tile's position in it. */
function pageOfFolder(
  state: AppState,
  folderId: string,
): { page: DesktopPage; index: number } | null {
  for (const page of state.pages) {
    const index = page.items.findIndex(
      (item) => item.type === "folder" && item.id === folderId,
    );
    if (index >= 0) return { page, index };
  }
  return null;
}

/**
 * The page that holds an item, whatever kind it is.
 *
 * A site can sit on a page or inside a folder, a folder always sits on a
 * page. The lookup differs, the page it returns does not.
 */
function pageOfItem(
  state: AppState,
  kind: "shortcut" | "folder",
  id: string,
): DesktopPage | null {
  if (kind === "folder") return pageOfFolder(state, id)?.page ?? null;
  const placement = locateShortcut(state, id);
  return placement?.kind === "page" ? placement.page : null;
}

function locateShortcut(
  state: AppState,
  shortcutId: string,
): ShortcutPlacement | null {
  for (const page of state.pages) {
    const index = page.items.findIndex(
      (item) => item.type === "shortcut" && item.id === shortcutId,
    );
    if (index >= 0) return { kind: "page", page, index };
  }
  for (const folder of state.folders) {
    const index = folder.shortcutIds.indexOf(shortcutId);
    if (index >= 0) return { kind: "folder", folder, index };
  }
  const index = state.shortcuts.findIndex((item) => item.id === shortcutId);
  return index >= 0 ? { kind: "directory", index } : null;
}

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(0);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [editor, setEditor] = useState<string | null>(null);
  const [editorReturnFolder, setEditorReturnFolder] = useState<string | null>(
    null,
  );
  const [managing, setManaging] = useState(false);
  const [pageId, setPageId] = useState<string | null>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [pageDialog, setPageDialog] = useState<PageDialogState | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState | null>(null);
  const [moveDialog, setMoveDialog] = useState<{
    shortcutId: string;
    returnFolderId?: string;
  } | null>(null);
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [background, setBackground] = useState<string | null>(null);
  const [wallpaperError, setWallpaperError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Mirrors the composing ref so the suggestion effect can react to IME state.
  const [composingState, setComposingState] = useState(false);
  // Bumped when the field regains focus, so the list comes back without the
  // user having to type another character.
  const [suggestNonce, setSuggestNonce] = useState(0);
  // TEMPORARY: set when a suggestion request is blocked (CSP / missing host
  // permission), so the failure is visible instead of silent.
  const [suggestBlocked, setSuggestBlocked] = useState(false);
  const composing = useRef(false);
  const suggestAbort = useRef<AbortController | null>(null);
  /** The query already handed to the engine, so it stops asking for suggestions. */
  const submitted = useRef("");
  const searchForm = useRef<HTMLFormElement>(null);
  const pageShell = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  /** The drag currently in flight; null once it ends or drops. */
  const dragPayload = useRef<DragPayload | null>(null);
  /**
   * The last drag that started, and when. A click that lands right after a
   * drag must not open the folder the pointer just moved.
   */
  const lastDrag = useRef<{
    kind: "shortcut" | "folder";
    id: string;
    at: number;
  } | null>(null);
  const [dockOver, setDockOver] = useState<string | null>(null);
  /** Measured track capacity of the desktop grid. */
  const [maxCols, setMaxCols] = useState(7);
  /**
   * The corner radius of the two glass tiles. Both follow the measured CSS
   * sizes (see `lib/tileRadius`): the site keeps its own ratio, while the
   * folder uses the balanced square-root size scaling. The sizes are read from
   * CSS, which is where the responsive breakpoints live.
   */
  const [tileRadii, setTileRadii] = useState(() =>
    desktopTileRadii(62, 150, 164),
  );
  const placingUnplaced = useRef(false);
  const refreshVersion = useRef(0);
  const reduced = useReducedMotion();
  const m = t();
  const d = m.app.desktop;
  const s = state.settings;
  const currentArt = ARTWORKS.find((a) => a.id === s.wallpaper);
  const art = currentArt ? artworkOf(currentArt.id) : null;
  const activePage =
    state.pages.find((page) => page.id === pageId) ?? state.pages[0]!;
  const shortcutsById = useMemo(
    () => new Map(state.shortcuts.map((item) => [item.id, item])),
    [state.shortcuts],
  );
  const foldersById = useMemo(
    () => new Map(state.folders.map((item) => [item.id, item])),
    [state.folders],
  );
  const openFolder = openFolderId
    ? (foldersById.get(openFolderId) ?? null)
    : null;
  const movingShortcut = moveDialog
    ? shortcutsById.get(moveDialog.shortcutId)
    : undefined;
  const movePlacement = moveDialog
    ? locateShortcut(state, moveDialog.shortcutId)
    : null;
  const moveSourcePageId =
    movePlacement?.kind === "page"
      ? movePlacement.page.id
      : movePlacement?.kind === "folder"
        ? (pageOfFolder(state, movePlacement.folder.id)?.page.id ?? undefined)
        : undefined;
  const moveTargets = state.pages.filter(
    (page) => page.id !== moveSourcePageId,
  );
  const showAddTile = state.shortcuts.length < 200;
  const layoutItems = useMemo<PageItem[]>(() => {
    const items: PageItem[] = [...activePage.items];
    if (showAddTile) items.push({ type: "shortcut", id: "__add" });
    return items;
  }, [activePage.items, showAddTile]);
  // The track count follows the measured width: the layout with the fewest
  // rows wins, so a wide screen spreads the tiles over the tracks it has
  // instead of stacking them in one long column.
  const columns = useMemo(
    () => chooseDesktopColumns(layoutItems, maxCols),
    [layoutItems, maxCols],
  );
  const restingRows = useMemo(
    () => planDesktopGrid(layoutItems, columns).shape.rows,
    [layoutItems, columns],
  );
  /**
   * The tiles the drag controller measures: the page's own items plus the
   * "add" tile, which is not draggable and keeps its place at the end.
   */
  const dragItems = useMemo<GridDragItem[]>(() => {
    const items: GridDragItem[] = activePage.items.map((item) => ({
      key: desktopItemKey(item),
      kind: item.type,
      id: item.id,
    }));
    if (showAddTile)
      items.push({
        key: "add",
        kind: "add",
        id: "__add",
      });
    return items;
  }, [activePage.items, showAddTile]);
  /**
   * The page's drag controller. It is the same controller the folder sheet
   * uses: the geometry, the hit test, the preview, the placeholder and the
   * glow are shared, and the desktop adds the two gestures a folder sheet
   * does not have — a site joins a folder, and two sites in the middle of
   * each other make a new folder.
   */
  const drag = useGridDrag({
    gridRef: grid,
    items: dragItems,
    measure: {
      holderSelector: "[data-drag-key]",
      holderAttribute: "data-drag-key",
      tileSelector: ".folder-item",
    },
    capabilities: {
      // Two sites make a new folder only while there is room for one; past
      // that the centre of a site means "reorder next to it" again.
      mergeSites: state.folders.length < MAX_FOLDERS,
      joinFolders: true,
      appendTile: true,
    },
    glow: {
      selector:
        ".shortcut-item:not(.add-shortcut) .shortcut-glass, .folder-item .folder-glass",
    },
    ghostRadius: (item) =>
      item.kind === "folder" ? tileRadii.folder : tileRadii.shortcut,
    onBegin: (item) => {
      dragPayload.current = {
        kind: item.kind === "folder" ? "folder" : "shortcut",
        id: item.id,
        pageId: activePage.id,
      };
    },
    onEnd: () => {
      dragPayload.current = null;
      setDockOver(null);
    },
    onDrop: (result) => {
      const payload = dragPayload.current;
      if (!payload) return;
      const { source, hit, order } = result;
      // Every branch hands the write back to the controller: it keeps the
      // preview on screen until the new order has arrived, so the tiles do
      // not jump back before the page has moved them.
      // Only a site can join a folder; a folder is never swallowed by one.
      if (
        hit?.kind === "tile" &&
        hit.intent === "join" &&
        source.kind === "shortcut"
      ) {
        return addShortcutToFolder(source.id, hit.id).catch(reportError);
      }
      // Two sites dropped on each other make a folder of the two.
      if (
        hit?.kind === "tile" &&
        hit.intent === "merge" &&
        source.kind === "shortcut" &&
        state.folders.length < MAX_FOLDERS
      ) {
        return createFolderFromShortcuts(
          payload.pageId,
          source.id,
          hit.id,
        ).catch(reportError);
      }
      // A reorder commits the permutation that was on screen.
      if (order) {
        return commitPageOrder(payload.pageId, toPageItems(order)).catch(
          reportError,
        );
      }
      // Nothing was previewed: the tile goes to the end of the page.
      if (hit?.kind === "add" || hit?.kind === "gap") {
        return movePageItemToEnd(payload.kind, payload.id).catch(reportError);
      }
    },
  });
  // A reorder can move a folder's 2×2 block into a row the resting page did
  // not need. Give the grid that extra row while previewing so the transformed
  // tile stays inside the section instead of overlapping the dock.
  const previewRows = Math.max(restingRows, drag.previewRows);
  const editorPlacement =
    editor && editor !== "new" ? locateShortcut(state, editor) : null;
  const editorIndex =
    editorPlacement?.kind === "page" || editorPlacement?.kind === "folder"
      ? editorPlacement.index
      : editorPlacement?.kind === "directory"
        ? editorPlacement.index
        : -1;
  const editorTotal =
    editorPlacement?.kind === "page"
      ? editorPlacement.page.items.length
      : editorPlacement?.kind === "folder"
        ? editorPlacement.folder.shortcutIds.length
        : state.shortcuts.length;
  const modalOpen =
    settingsTab !== null ||
    editor !== null ||
    openFolder !== null ||
    pageDialog !== null ||
    nameDialog !== null ||
    confirmDialog !== null ||
    moveDialog !== null;
  const material = useGlassMaterialValue(s, reduced);
  const glassOptics = material.base.optics!;
  const clockOptics = useMemo(
    () => ({
      ...glassOptics,
      tint: "rgb(255 255 255)",
      tintStrength: s.clockTintStrength,
    }),
    [glassOptics, s.clockTintStrength],
  );
  const searchOptics = useMemo(
    () => ({ ...glassOptics, tintStrength: 0.24 }),
    [glassOptics],
  );
  const shortcutOptics = useMemo(
    () => ({ ...glassOptics, tintStrength: 0.22 }),
    [glassOptics],
  );
  const addShortcutOptics = useMemo(
    () => ({ ...glassOptics, tintStrength: 0.12 }),
    [glassOptics],
  );
  const glassInteraction = {
    highlightIntensity: material.base.highlightIntensity,
    elasticity: material.base.elasticity,
  };
  /** The glass a site's tile sits on, in the desktop and in the folder sheet. */
  const shortcutTileGlass: FolderGlass = {
    optics: shortcutOptics,
    ...glassInteraction,
  };
  const folderGlass: FolderGlass = useMemo(
    // Folders are containers, not site tiles: they use the base material
    // instead of the shortcut icon's brighter tint.
    () => ({ optics: glassOptics, ...glassInteraction }),
    // The material object is rebuilt with its parts; depending on the values
    // keeps the folder surfaces stable across unrelated renders.
    [glassOptics, material.base.elasticity, material.base.highlightIntensity],
  );
  const engines = useMemo(() => listEngines(s), [s.customEngines]);
  const selectedEngine = useMemo(
    () => resolveEngine(s),
    [s.customEngines, s.searchEngine],
  );
  // The kit resolves `auto` by sampling the backdrop under each glass surface.
  // The app's own text sits directly on the wallpaper rather than on glass, so
  // it needs the same verdict — sample once under the page shell and drive both
  // the provider and a `data-light` flag from it.
  const overLight = glassOverLight(s.glassMode);
  const pageLight = useOverLight(overLight, pageShell);

  // The sync controller reads the committed repository state, so it can share
  // the same backup builder as the JSON export.
  const getLocalSnapshot = useCallback(async () => {
    const { state: saved, blob } = await repository.snapshot();
    return buildSnapshot(saved, blob);
  }, []);
  const nutstore = useNutstoreSync({
    ready,
    state,
    getLocalSnapshot,
    onRestore: importBackup,
  });
  // The controller and the panel use different verbs for the same actions;
  // keep the presentational contract explicit instead of leaking hook naming.
  const nutstorePanel: NutstoreSyncProps = {
    settings: nutstore.settings,
    busy: nutstore.busy,
    error: nutstore.error,
    notice: nutstore.notice,
    pending: nutstore.pending,
    onConnect: nutstore.connect,
    onDisconnect: nutstore.disconnect,
    onSyncNow: nutstore.syncNow,
    onUpload: nutstore.upload,
    onRestore: nutstore.restore,
    onResolvePending: nutstore.resolvePending,
    onAutoSyncChange: nutstore.setAutoSync,
    onClearFeedback: nutstore.clearFeedback,
  };

  const refresh = useCallback(async () => {
    const ticket = ++refreshVersion.current;
    try {
      const loaded = await repository.load();
      if (ticket === refreshVersion.current) {
        setState(loaded);
        setReady(true);
        setLoadError("");
      }
    } catch {
      if (ticket === refreshVersion.current) {
        setReady(false);
        setLoadError(t().app.status.loadFailed);
      }
    }
  }, []);
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => void refresh());
    void refresh();
    return () => {
      ++refreshVersion.current;
      unsubscribe();
    };
  }, [refresh]);
  // The dock and folder contents keep the page model honest when another tab
  // removes the page or folder this tab is looking at.
  useEffect(() => {
    if (openFolderId && !state.folders.some((item) => item.id === openFolderId))
      setOpenFolderId(null);
  }, [openFolderId, state.folders]);
  // A shortcut removed in another tab must not leave the move sheet mounted
  // invisibly (which would keep the page inert).
  useEffect(() => {
    if (
      moveDialog &&
      !state.shortcuts.some((item) => item.id === moveDialog.shortcutId)
    )
      setMoveDialog(null);
  }, [moveDialog, state.shortcuts]);
  // The toolbar/popup still writes straight to `state.shortcuts`; validation
  // deliberately keeps those sites in the directory rather than rejecting the
  // state. Put any such site on the current page so it is never invisible.
  useEffect(() => {
    if (!ready || placingUnplaced.current) return;
    const placed = placedShortcutIds(state);
    const unplaced = state.shortcuts.filter((item) => !placed.has(item.id));
    if (unplaced.length === 0) return;
    placingUnplaced.current = true;
    void mutate(() =>
      repository.update((current) => {
        const already = placedShortcutIds(current);
        const page =
          current.pages.find((item) => item.id === activePage.id) ??
          current.pages[0];
        for (const item of current.shortcuts)
          if (!already.has(item.id))
            page.items.push({ type: "shortcut", id: item.id });
        return current;
      }),
    )
      .catch(() => {
        // A failed placement must not loop; the site stays in the directory and
        // the next storage event retries.
      })
      .finally(() => {
        placingUnplaced.current = false;
      });
  }, [ready, state, activePage.id]);
  // The grid is measured rather than breakpoint-guessed: a 2×2 folder needs
  // two tracks, and the same page can be 7 tracks wide on desktop and 4 on a
  // phone. Reading the cell size from CSS keeps the two in sync.
  useLayoutEffect(() => {
    const element = grid.current;
    if (!element) return;
    const measure = () => {
      const style = getComputedStyle(element);
      const cell =
        Number.parseFloat(style.getPropertyValue("--desktop-cell")) || 80;
      const gap =
        Number.parseFloat(style.getPropertyValue("--desktop-gap")) || 14;
      const width = element.clientWidth;
      if (width <= 0) return;
      // How many tracks fit side by side: n cells and n-1 gaps have to stay
      // inside the measured width.
      const capacity = Math.max(1, Math.floor((width + gap) / (cell + gap)));
      setMaxCols((current) => (current === capacity ? current : capacity));
      // The glass tiles shrink at the compact breakpoints, and their corners
      // follow: the site keeps its own ratio, and the folder uses the balanced
      // square-root scaling from its measured size.
      const shortcutSize =
        Number.parseFloat(style.getPropertyValue("--shortcut-glass-size")) ||
        62;
      const folderSize =
        Number.parseFloat(style.getPropertyValue("--folder-glass-size")) || 150;
      const row =
        Number.parseFloat(style.getPropertyValue("--desktop-row")) || 88;
      const folderHeight = row + gap + shortcutSize;
      const next = desktopTileRadii(shortcutSize, folderSize, folderHeight);
      setTileRadii((current) =>
        current.shortcut === next.shortcut && current.folder === next.folder
          ? current
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setNow(new Date());
    const interval = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    suggestAbort.current?.abort();
    setActiveIndex(-1);
    const text = query.trim();
    if (
      modalOpen ||
      searching ||
      composingState ||
      !selectedEngine.suggest ||
      text.length < MIN_QUERY_LENGTH ||
      // Already committed: the navigation is in flight, so asking for
      // suggestions now would be a wasted request.
      text === submitted.current
    ) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    suggestAbort.current = controller;
    const timer = setTimeout(() => {
      void fetchSuggestions(selectedEngine.id, text, controller.signal).then(
        (outcome) => {
          if (controller.signal.aborted) return;
          setSuggestions(outcome.items);
          // TEMPORARY: surfaces a blocked/permission-less extension instead of
          // failing silently. Remove once the reload path is verified.
          if (outcome.error) setSuggestBlocked(true);
        },
      );
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    modalOpen,
    searching,
    composingState,
    suggestNonce,
    selectedEngine.id,
    selectedEngine.suggest,
  ]);
  useEffect(() => {
    if (suggestions.length === 0) return;
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && !searchForm.current?.contains(target)) setSuggestions([]);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [suggestions.length]);
  useEffect(() => {
    let cancelled = false;
    let url: string | undefined;
    setCustomUrl(null);
    const id = s.customWallpaper?.assetId;
    if (id)
      void repository.assets
        .get(id)
        .then((blob) => {
          if (cancelled) return;
          if (!blob) throw new Error("missing");
          url = URL.createObjectURL(blob);
          setCustomUrl(url);
        })
        .catch(() => {
          if (!cancelled) setNotice(t().app.status.customWallpaperFailed);
        });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [s.customWallpaper?.assetId]);
  useEffect(() => {
    let cancelled = false;
    const src = currentArt?.image ?? customUrl;
    setBackground(null);
    setWallpaperError(false);
    if (!src) return;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setBackground(src);
    };
    image.onerror = () => {
      if (!cancelled) {
        setBackground(null);
        setWallpaperError(true);
      }
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [currentArt?.image, customUrl]);

  async function mutate(operation: () => Promise<unknown>) {
    if (!ready) throw new Error(m.app.status.notReady);
    setPending((n) => n + 1);
    try {
      await operation();
      await refresh();
    } catch (error) {
      await refresh();
      throw new Error(
        error instanceof Error
          ? m.app.status.saveFailed(error.message)
          : m.app.status.saveFailedUnknown,
      );
    } finally {
      setPending((n) => n - 1);
    }
  }
  async function changeSettings(patch: AppSettingsPatch) {
    // Preview immediately, but commit against fresh state inside the cross-tab lock.
    if (!ready) return;
    setState((previous) => ({
      ...previous,
      settings: {
        ...previous.settings,
        ...patch,
        glass: patch.glass
          ? { ...previous.settings.glass, ...patch.glass }
          : previous.settings.glass,
      },
    }));
    await mutate(() =>
      repository.update((current) => ({
        ...current,
        settings: {
          ...current.settings,
          ...patch,
          glass: patch.glass
            ? { ...current.settings.glass, ...patch.glass }
            : current.settings.glass,
        },
      })),
    );
  }
  async function upload(file: File) {
    const blob = await optimizeImage(file);
    const assetId = crypto.randomUUID();
    await mutate(() =>
      repository.replace(
        (current) => ({
          ...current,
          settings: {
            ...current.settings,
            wallpaper: "custom",
            positionX: 50,
            positionY: 50,
            customWallpaper: {
              assetId,
              name: file.name.slice(0, 200) || m.app.wallpaper.defaultName,
              mime: "image/webp",
            },
          },
        }),
        blob,
      ),
    );
  }
  async function exportBackup() {
    const { state: saved, blob } = await repository.snapshot();
    const { backup } = await buildSnapshot(saved, blob);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nico-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function importBackup(backup: BackupV1) {
    const blob = backup.wallpaper
      ? dataUrlToBlob(backup.wallpaper.dataUrl)
      : null;
    if (blob) await validateDecodedWallpaper(blob);
    const next = structuredClone(backup.state);
    if (next.settings.customWallpaper)
      next.settings.customWallpaper.assetId = crypto.randomUUID();
    await mutate(() => repository.replace(() => next, blob));
  }
  async function saveShortcut(name: string, url: string, iconDataUrl: string) {
    await mutate(() =>
      repository.update((current) => {
        if (editor === "new") {
          if (current.shortcuts.length >= 200)
            throw new Error(m.app.shortcuts.limit);
          const id = crypto.randomUUID();
          current.shortcuts.push({
            id,
            name,
            url,
            ...(iconDataUrl ? { iconDataUrl } : {}),
          });
          const page =
            current.pages.find((item) => item.id === activePage.id) ??
            current.pages[0];
          page.items.push({ type: "shortcut", id });
        } else {
          const item = current.shortcuts.find((item) => item.id === editor);
          if (!item) throw new Error(m.app.shortcuts.removedElsewhere);
          item.name = name;
          item.url = url;
          if (iconDataUrl) item.iconDataUrl = iconDataUrl;
          else delete item.iconDataUrl;
        }
        return current;
      }),
    );
  }
  async function deleteShortcut(id: string) {
    await mutate(() =>
      repository.update((current) => {
        current.shortcuts = current.shortcuts.filter((item) => item.id !== id);
        for (const page of current.pages)
          page.items = page.items.filter(
            (item) => !(item.type === "shortcut" && item.id === id),
          );
        for (const folder of current.folders)
          folder.shortcutIds = folder.shortcutIds.filter((item) => item !== id);
        return current;
      }),
    );
  }
  async function moveShortcut(
    id: string,
    target: { id: string } | { offset: number },
  ) {
    await mutate(() =>
      repository.update((current) => {
        const placement = locateShortcut(current, id);
        if (!placement) return current;
        if ("id" in target) {
          if (placement.kind !== "page") return current;
          const page = placement.page;
          const from = page.items.findIndex(
            (item) => item.type === "shortcut" && item.id === id,
          );
          const to = page.items.findIndex(
            (item) => item.type === "shortcut" && item.id === target.id,
          );
          if (from < 0 || to < 0 || from === to) return current;
          const [item] = page.items.splice(from, 1);
          page.items.splice(to, 0, item);
          return current;
        }
        if (placement.kind === "page") {
          const destination = placement.index + target.offset;
          if (destination < 0 || destination >= placement.page.items.length)
            return current;
          const [item] = placement.page.items.splice(placement.index, 1);
          placement.page.items.splice(destination, 0, item);
        } else if (placement.kind === "folder") {
          const destination = placement.index + target.offset;
          if (
            destination < 0 ||
            destination >= placement.folder.shortcutIds.length
          )
            return current;
          const [item] = placement.folder.shortcutIds.splice(
            placement.index,
            1,
          );
          placement.folder.shortcutIds.splice(destination, 0, item);
        } else {
          const destination = placement.index + target.offset;
          if (destination < 0 || destination >= current.shortcuts.length)
            return current;
          const [item] = current.shortcuts.splice(placement.index, 1);
          current.shortcuts.splice(destination, 0, item);
        }
        return current;
      }),
    );
  }
  /**
   * A tile dragged to the end of its page. A site and a folder travel the
   * same way: the tile is one entry on the page, so a folder keeps its
   * members and a site keeps its own tile.
   *
   * The two kinds differ only in where they are looked up: a site can sit on
   * a page or inside a folder, a folder always sits on a page.
   */
  async function movePageItemToEnd(kind: "shortcut" | "folder", id: string) {
    await mutate(() =>
      repository.update((current) => {
        const page = pageOfItem(current, kind, id);
        if (!page) return current;
        const index = page.items.findIndex(
          (item) => item.type === kind && item.id === id,
        );
        if (index < 0 || index === page.items.length - 1) return current;
        const [item] = page.items.splice(index, 1);
        page.items.push(item);
        return current;
      }),
    );
  }
  /**
   * Moves a folder to another page. The folder keeps its members; only the
   * page that shows it changes.
   */
  async function moveFolderToPage(id: string, targetPageId: string) {
    await mutate(() =>
      repository.update((current) => {
        const target = current.pages.find((page) => page.id === targetPageId);
        if (!target) return current;
        const placement = pageOfFolder(current, id);
        if (!placement || placement.page.id === targetPageId) return current;
        placement.page.items.splice(placement.index, 1);
        target.items.push({ type: "folder", id });
        return current;
      }),
    );
  }
  /**
   * Moves a site between pages without touching the shortcut directory. A site
   * pulled out of a folder leaves the folder in place (possibly empty) and is
   * appended to the destination page, so it remains reachable in exactly one
   * place at a time.
   */
  async function moveShortcutToPage(id: string, targetPageId: string) {
    await mutate(() =>
      repository.update((current) => {
        const target = current.pages.find((page) => page.id === targetPageId);
        if (!target) return current;
        const placement = locateShortcut(current, id);
        if (!placement) return current;
        if (placement.kind === "page") {
          if (placement.page.id === targetPageId) return current;
          placement.page.items.splice(placement.index, 1);
        } else if (placement.kind === "folder") {
          const source = pageOfFolder(current, placement.folder.id);
          if (source?.page.id === targetPageId) return current;
          placement.folder.shortcutIds.splice(placement.index, 1);
        }
        target.items.push({ type: "shortcut", id });
        return current;
      }),
    );
  }
  async function createPage(name: string, icon?: PageIcon | null) {
    if (state.pages.length >= MAX_PAGES) return;
    const id = crypto.randomUUID();
    await mutate(() =>
      repository.update((current) => {
        if (current.pages.length >= MAX_PAGES) return current;
        current.pages.push({
          id,
          name,
          items: [],
          ...(icon ? { icon } : {}),
        });
        return current;
      }),
    );
    setPageId(id);
  }
  async function renamePage(id: string, name: string) {
    await updatePage(id, { name });
  }
  /**
   * Sets a page's dock icon, or clears it. A page without an icon falls back
   * to the first letter of its name, which is what the dock has always shown.
   */
  async function setPageIcon(id: string, icon: PageIcon | null) {
    await updatePage(id, { icon });
  }
  /**
   * Changes a page in one write. The icon is tri-state: absent from the
   * change leaves it alone, `null` clears it.
   */
  async function updatePage(
    id: string,
    change: { name?: string; icon?: PageIcon | null },
  ) {
    await mutate(() =>
      repository.update((current) => {
        const page = current.pages.find((item) => item.id === id);
        if (!page) return current;
        if (change.name !== undefined) page.name = change.name;
        if (change.icon !== undefined) {
          if (change.icon) page.icon = change.icon;
          else delete page.icon;
        }
        return current;
      }),
    );
  }
  async function deletePage(id: string) {
    await mutate(() =>
      repository.update((current) => {
        if (current.pages.length <= 1) return current;
        const page = current.pages.find((item) => item.id === id);
        if (!page || page.items.length > 0) return current;
        current.pages = current.pages.filter((item) => item.id !== id);
        return current;
      }),
    );
    setPageId(null);
  }
  async function createFolder(name: string) {
    if (state.folders.length >= MAX_FOLDERS) return;
    const id = crypto.randomUUID();
    await mutate(() =>
      repository.update((current) => {
        if (current.folders.length >= MAX_FOLDERS) return current;
        const page =
          current.pages.find((item) => item.id === activePage.id) ??
          current.pages[0];
        current.folders.push({ id, name, shortcutIds: [] });
        page.items.push({ type: "folder", id });
        return current;
      }),
    );
    setOpenFolderId(id);
  }
  async function renameFolder(id: string, name: string) {
    await mutate(() =>
      repository.update((current) => {
        const folder = current.folders.find((item) => item.id === id);
        if (folder) folder.name = name;
        return current;
      }),
    );
  }
  async function deleteFolder(id: string) {
    await mutate(() =>
      repository.update((current) => {
        const folder = current.folders.find((item) => item.id === id);
        if (!folder) return current;
        const placement = pageOfFolder(current, id);
        if (placement) placement.page.items.splice(placement.index, 1);
        current.folders = current.folders.filter((item) => item.id !== id);
        // Deleting a container must not discard its sites: put them back on the
        // page where the folder stood, in their folder order.
        if (placement)
          placement.page.items.splice(
            placement.index,
            0,
            ...folder.shortcutIds.map(
              (shortcutId): PageItem => ({
                type: "shortcut",
                id: shortcutId,
              }),
            ),
          );
        return current;
      }),
    );
    setOpenFolderId((current) => (current === id ? null : current));
  }
  async function addShortcutToFolder(shortcutId: string, folderId: string) {
    await mutate(() =>
      repository.update((current) => {
        const folder = current.folders.find((item) => item.id === folderId);
        if (!folder || folder.shortcutIds.includes(shortcutId)) return current;
        let source: { page: DesktopPage; index: number } | null = null;
        for (const page of current.pages) {
          const index = page.items.findIndex(
            (item) => item.type === "shortcut" && item.id === shortcutId,
          );
          if (index >= 0) {
            source = { page, index };
            break;
          }
        }
        if (!source) return current;
        source.page.items.splice(source.index, 1);
        folder.shortcutIds.push(shortcutId);
        return current;
      }),
    );
  }
  async function removeShortcutFromFolder(
    shortcutId: string,
    folderId: string,
  ) {
    await mutate(() =>
      repository.update((current) => {
        const folder = current.folders.find((item) => item.id === folderId);
        if (!folder) return current;
        const index = folder.shortcutIds.indexOf(shortcutId);
        if (index < 0) return current;
        folder.shortcutIds.splice(index, 1);
        const placement = pageOfFolder(current, folderId);
        if (placement)
          placement.page.items.push({ type: "shortcut", id: shortcutId });
        return current;
      }),
    );
  }
  /**
   * Writes the order a folder's sites were dragged into.
   *
   * The order is the one the user saw in the preview, and it is only written
   * when the folder still holds the same members: a site that was added or
   * removed elsewhere in the meantime is not thrown away by a stale preview.
   */
  async function reorderFolderShortcuts(
    folderId: string,
    order: readonly string[],
  ) {
    await mutate(() =>
      repository.update((current) => {
        const folder = current.folders.find((item) => item.id === folderId);
        if (!folder) return current;
        const next = commitOrder(folder.shortcutIds, order);
        if (!next) return current;
        folder.shortcutIds = next;
        return current;
      }),
    );
  }
  async function createFolderFromShortcuts(
    sourcePageId: string,
    sourceId: string,
    targetId: string,
  ) {
    if (state.folders.length >= MAX_FOLDERS) return;
    const folderId = crypto.randomUUID();
    await mutate(() =>
      repository.update((current) => {
        if (current.folders.length >= MAX_FOLDERS) return current;
        const page = current.pages.find((item) => item.id === sourcePageId);
        if (!page) return current;
        const sourceIndex = page.items.findIndex(
          (item) => item.type === "shortcut" && item.id === sourceId,
        );
        const targetIndex = page.items.findIndex(
          (item) => item.type === "shortcut" && item.id === targetId,
        );
        if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex)
          return current;
        const insertAt = Math.min(sourceIndex, targetIndex);
        page.items = page.items.filter(
          (item) =>
            !(
              item.type === "shortcut" &&
              (item.id === sourceId || item.id === targetId)
            ),
        );
        page.items.splice(insertAt, 0, { type: "folder", id: folderId });
        current.folders.push({
          id: folderId,
          name: d.createFolder,
          shortcutIds: [sourceId, targetId],
        });
        return current;
      }),
    );
    setOpenFolderId(folderId);
  }
  function reportError(error: unknown) {
    setNotice(
      error instanceof Error ? error.message : m.app.status.saveFailedUnknown,
    );
  }
  /**
   * A click that lands right after a drag must not open what the pointer just
   * moved — neither the folder nor a site link inside its preview.
   */
  function wasJustDragged(kind: "shortcut" | "folder", id: string) {
    const drag = lastDrag.current;
    return Boolean(
      drag &&
        drag.kind === kind &&
        drag.id === id &&
        Date.now() - drag.at < 600,
    );
  }
  /**
   * Ends the drag right away.
   *
   * This is the deliberate reset: the page is changing or the tile is
   * leaving for another page, so there is no preview worth keeping. A drop
   * on the page itself is not reset here — the controller keeps that preview
   * until the new order has been written.
   */
  function finishDrag() {
    drag.reset();
  }
  /**
   * Persists one previewed order, validating it against the freshest state.
   *
   * The order is the permutation the user saw. It is only written when the
   * page still holds exactly the tiles the preview was made for: a page
   * edited in another tab while this drag was in flight cannot be
   * overwritten with a stale permutation, so it is left alone.
   */
  async function commitPageOrder(
    pageIdValue: string,
    order: readonly PageItem[],
  ) {
    await mutate(() =>
      repository.update((current) => {
        const page = current.pages.find((item) => item.id === pageIdValue);
        if (!page) return current;
        const keys = commitOrder(
          page.items.map(desktopItemKey),
          order.map(desktopItemKey),
        );
        if (!keys) return current;
        const byKey = new Map(
          page.items.map((item) => [desktopItemKey(item), item] as const),
        );
        page.items = keys.map((key) => byKey.get(key)!);
        return current;
      }),
    );
  }
  function openShortcutEditor(id: string, returnFolderId?: string) {
    setEditorReturnFolder(returnFolderId ?? null);
    if (returnFolderId) setOpenFolderId(null);
    setEditor(id);
  }
  function closeEditor() {
    const returnFolderId = editorReturnFolder;
    setEditor(null);
    setEditorReturnFolder(null);
    if (
      returnFolderId &&
      state.folders.some((item) => item.id === returnFolderId)
    )
      setOpenFolderId(returnFolderId);
  }
  function beginRenamePage() {
    setPageDialog({
      mode: "rename",
      id: activePage.id,
      name: activePage.name,
    });
  }
  /** The dock icon of a page, on its own. */
  function beginPageIcon(page: DesktopPage = activePage) {
    setPageDialog({ mode: "icon", id: page.id, name: page.name });
  }
  /** A page's name and its dock icon together. */
  function beginPageSettings(page: DesktopPage) {
    setPageDialog({ mode: "settings", id: page.id, name: page.name });
  }
  function beginCreatePage() {
    setPageDialog({
      mode: "create",
      name: d.defaultPage(state.pages.length + 1),
    });
  }
  function beginDeletePage() {
    setConfirmDialog({
      kind: "page-delete",
      id: activePage.id,
      name: activePage.name,
    });
  }
  function beginRenameOpenFolder() {
    if (!openFolder) return;
    const id = openFolder.id;
    const name = openFolder.name;
    setOpenFolderId(null);
    setNameDialog({
      kind: "folder-rename",
      id,
      initial: name,
      returnFolderId: id,
    });
  }
  function beginDeleteOpenFolder() {
    if (!openFolder) return;
    const { id, name } = openFolder;
    setOpenFolderId(null);
    setConfirmDialog({
      kind: "folder-delete",
      id,
      name,
      returnFolderId: id,
    });
  }
  async function submitName(name: string) {
    const dialog = nameDialog;
    if (!dialog) return;
    if (dialog.kind === "folder-create") await createFolder(name);
    else await renameFolder(dialog.id, name);
  }
  /**
   * Saves the page dialog. Each mode changes one thing: a new page, a
   * rename, the dock icon, or the name and the icon together.
   */
  async function submitPageDialog(value: {
    name: string;
    icon: PageIcon | null;
  }) {
    const dialog = pageDialog;
    if (!dialog) return;
    if (dialog.mode === "create") {
      await createPage(value.name, value.icon);
      return;
    }
    if (dialog.mode === "rename") {
      await renamePage(dialog.id, value.name);
      return;
    }
    if (dialog.mode === "icon") {
      await setPageIcon(dialog.id, value.icon);
      return;
    }
    await updatePage(dialog.id, { name: value.name, icon: value.icon });
  }
  function closeNameDialog() {
    const returnFolderId =
      nameDialog?.kind === "folder-rename"
        ? nameDialog.returnFolderId
        : undefined;
    setNameDialog(null);
    if (
      returnFolderId &&
      state.folders.some((item) => item.id === returnFolderId)
    )
      setOpenFolderId(returnFolderId);
  }
  function beginMoveShortcut(shortcutId: string, returnFolderId?: string) {
    if (state.pages.length <= 1) return;
    if (returnFolderId) setOpenFolderId(null);
    setMoveDialog({ shortcutId, returnFolderId });
  }
  function closeMoveDialog() {
    const returnFolderId = moveDialog?.returnFolderId;
    setMoveDialog(null);
    if (
      returnFolderId &&
      state.folders.some((item) => item.id === returnFolderId)
    )
      setOpenFolderId(returnFolderId);
  }
  function cancelConfirm() {
    const returnFolderId =
      confirmDialog?.kind === "folder-delete"
        ? confirmDialog.returnFolderId
        : undefined;
    setConfirmDialog(null);
    if (
      returnFolderId &&
      state.folders.some((item) => item.id === returnFolderId)
    )
      setOpenFolderId(returnFolderId);
  }
  async function confirmDelete() {
    const dialog = confirmDialog;
    if (!dialog) return;
    if (dialog.kind === "page-delete") await deletePage(dialog.id);
    else await deleteFolder(dialog.id);
  }
  function switchPage(id: string) {
    if (id === activePage.id) return;
    setPageId(id);
    setOpenFolderId(null);
    finishDrag();
  }
  function focusDockSibling(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const buttons = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        ".dock-page",
      ) ?? [],
    );
    if (buttons.length === 0) return;
    const index = buttons.indexOf(event.currentTarget);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  }
  function clearSuggestions() {
    suggestAbort.current?.abort();
    setSuggestions([]);
    setActiveIndex(-1);
  }
  async function runSearch(text: string) {
    const trimmed = text.trim();
    if (!trimmed || searching) return;
    clearSuggestions();
    submitted.current = trimmed;
    setSearching(true);
    try {
      await search(trimmed, selectedEngine);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : m.app.search.unavailable);
    } finally {
      setSearching(false);
    }
  }
  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (composing.current) return;
    await runSearch(query);
  }
  function chooseSuggestion(text: string) {
    setQuery(text);
    void runSearch(text);
  }
  const hours = now.getHours();
  const greeting =
    hours < 6
      ? m.app.greeting.lateNight
      : hours < 11
        ? m.app.greeting.morning
        : hours < 14
          ? m.app.greeting.noon
          : hours < 18
            ? m.app.greeting.afternoon
            : m.app.greeting.evening;
  const { clock, period: dayPeriod } = formatClock(now, s.clockFormat);
  const period = dayPeriod?.toUpperCase() ?? null;
  const date = formatDate(now);
  const selectedShortcut = state.shortcuts.find((item) => item.id === editor);

  return (
    <GlassProvider
      quality={reduced ? "low" : s.quality}
      overLight={overLight}
      lensMapRasterScale={s.glass.mapScale}
    >
      <GlassMaterialProvider value={material}>
        <div
          className={`app ${reduced ? "reduced-motion" : ""}`}
          data-light={pageLight}
          data-quality={reduced ? "low" : s.quality}
        >
          <div className="wallpaper-base" />
          <div
            className={`wallpaper ${background ? "is-loaded" : ""}`}
            data-testid="wallpaper"
            style={
              {
                backgroundImage: background
                  ? `url("${background}")`
                  : undefined,
                backgroundSize: s.fit,
                backgroundPosition: `${s.positionX}% ${s.positionY}%`,
                filter: `brightness(${s.brightness / 100}) blur(${s.blur}px)`,
                inset: s.blur > 0 ? `${-s.blur * 2}px` : 0,
              } as CSSProperties
            }
          />
          <div className="wallpaper-shade" />
          <div className="page-shell" ref={pageShell} inert={modalOpen}>
            <header className="page-header">
              <div className="brand" aria-label={m.app.header.brandAria}>
                <span className="brand-wordmark">
                  nico<span>.</span>
                </span>
                <span className="brand-divider" />
                <span className="brand-caption">
                  {m.app.header.brandCaption}
                </span>
              </div>
              <GlassButton
                className="gallery-button"
                size="sm"
                optics={glassOptics}
                {...glassInteraction}
                icon={<GalleryVerticalEnd size={15} />}
                disabled={!ready}
                onClick={() => setSettingsTab("appearance")}
              >
                {m.app.header.gallery}
                <span className="gallery-count">
                  {m.app.header.galleryCount}
                </span>
              </GlassButton>
            </header>
            <main className="main-content">
              <section className="clock-section" aria-label={m.app.clock.aria}>
                <p className="greeting">{greeting}</p>
                <div className="time-line">
                  <time className="clock" dateTime={now.toISOString()}>
                    <GlassElasticityGroup
                      elasticity={glassInteraction.elasticity}
                    >
                      <GlassText
                        text={clock}
                        fontSize={CLOCK_SIZE}
                        fontFamily={CLOCK_FONT}
                        fontWeight={600}
                        letterSpacing={-2}
                        tabularNums
                        optics={clockOptics}
                        {...glassInteraction}
                      />
                    </GlassElasticityGroup>
                  </time>
                  {period && <span className="day-period">{period}</span>}
                </div>
                <p className="date">{date}</p>
              </section>
              <GlassLightGroup>
                <form
                  className="search-form"
                  role="search"
                  ref={searchForm}
                  onSubmit={(event) => void submitSearch(event)}
                >
                  <GlassSelect
                    className="search-engine"
                    size="lg"
                    cornerRadius={26}
                    aria-label={m.app.search.engineAria}
                    disabled={!ready}
                    value={selectedEngine.id}
                    onChange={(key) => {
                      clearSuggestions();
                      setSuggestBlocked(false);
                      void changeSettings({ searchEngine: key }).catch((e) =>
                        setNotice(
                          e instanceof Error
                            ? e.message
                            : m.app.search.engineSaveFailed,
                        ),
                      );
                    }}
                    onFocus={clearSuggestions}
                    // The label already carries the icon, so no `leading` here —
                    // that would show it twice in the trigger.
                    items={engines.map((engine) => ({
                      key: engine.id,
                      label: (
                        <span className="engine-option">
                          <EngineIcon engine={engine} size={16} />
                          <span className="engine-option-name">
                            {engine.name}
                          </span>
                        </span>
                      ),
                    }))}
                    optics={searchOptics}
                    {...glassInteraction}
                  />
                  <GlassInput
                    className="search-input"
                    size="lg"
                    cornerRadius={26}
                    leading={<Search size={20} strokeWidth={1.6} />}
                    aria-label={m.app.search.inputAria}
                    placeholder={m.app.search.placeholder}
                    value={query}
                    onChange={(e) => {
                      // Editing releases the committed query again.
                      submitted.current = "";
                      setQuery(e.target.value);
                    }}
                    // Returning to the field re-asks for suggestions, so clicking
                    // the engine pill and back does not leave the list empty.
                    onFocus={() => setSuggestNonce((n) => n + 1)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2000}
                    aria-autocomplete="list"
                    aria-controls={
                      suggestions.length > 0 ? "search-suggestions" : undefined
                    }
                    aria-activedescendant={
                      activeIndex >= 0
                        ? `search-suggestion-${activeIndex}`
                        : undefined
                    }
                    onCompositionStart={() => {
                      composing.current = true;
                      setComposingState(true);
                    }}
                    onCompositionEnd={() => {
                      composing.current = false;
                      setComposingState(false);
                    }}
                    // An interrupted composition can skip `compositionend`, which
                    // would otherwise suppress suggestions for the rest of the
                    // session. Blurring always clears it.
                    onBlur={() => {
                      composing.current = false;
                      setComposingState(false);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.nativeEvent.isComposing || e.keyCode === 229)
                      ) {
                        e.preventDefault();
                        return;
                      }
                      // While composing, arrows belong to the IME candidate list.
                      if (composing.current || suggestions.length === 0) return;
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setActiveIndex((i) => (i + 1) % suggestions.length);
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setActiveIndex(
                          (i) =>
                            (i - 1 + suggestions.length) % suggestions.length,
                        );
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        clearSuggestions();
                      } else if (e.key === "Enter" && activeIndex >= 0) {
                        // A highlighted suggestion wins over the raw query.
                        e.preventDefault();
                        chooseSuggestion(suggestions[activeIndex]);
                      }
                    }}
                    trailing={
                      <>
                        {query && (
                          <ClearButton
                            label={m.app.search.clearAria}
                            onClear={() => {
                              submitted.current = "";
                              clearSuggestions();
                              setQuery("");
                            }}
                          />
                        )}
                        <button
                          className="search-submit"
                          type="submit"
                          aria-label={m.app.search.submitAria}
                          disabled={searching || !query.trim()}
                        >
                          <ArrowRight size={19} strokeWidth={1.6} />
                        </button>
                      </>
                    }
                    optics={searchOptics}
                    {...glassInteraction}
                  />
                  {suggestions.length > 0 && (
                    <GlassSurface
                      id="search-suggestions"
                      className="search-suggestions"
                      cornerRadius={26}
                      role="listbox"
                      aria-label={m.app.search.suggestionsAria}
                      optics={searchOptics}
                      {...glassInteraction}
                    >
                      <div className="search-suggestions-list">
                        {suggestions.map((item, index) => (
                          <button
                            key={item}
                            type="button"
                            role="option"
                            id={`search-suggestion-${index}`}
                            aria-selected={index === activeIndex}
                            className={`search-suggestion${index === activeIndex ? " is-active" : ""}`}
                            // Keeps the input focused so the list survives the click.
                            onMouseDown={(event) => event.preventDefault()}
                            onMouseEnter={() => setActiveIndex(index)}
                            onClick={() => chooseSuggestion(item)}
                          >
                            <Search
                              size={14}
                              strokeWidth={1.6}
                              className="search-suggestion-icon"
                            />
                            <span className="search-suggestion-text">
                              {item}
                            </span>
                          </button>
                        ))}
                      </div>
                    </GlassSurface>
                  )}
                  {/* TEMPORARY: makes a blocked suggestion request visible.
                      aria-live rather than role="status" so it never collides
                      with the notice toast's live region. */}
                  {suggestBlocked &&
                    selectedEngine.suggest &&
                    suggestions.length === 0 && (
                      <p className="search-suggest-error" aria-live="polite">
                        {m.app.search.suggestionsUnavailable}
                      </p>
                    )}
                </form>
                <section
                  className={`shortcuts-section ${managing ? "is-managing" : ""}`}
                  aria-label={m.app.shortcuts.sectionAria}
                >
                  <div
                    ref={grid}
                    className={`shortcut-grid${drag.hit?.kind === "gap" && !drag.order ? " is-drop-target" : ""}${drag.draggingKey ? " is-page-dragging" : ""}`}
                    style={{
                      gridTemplateColumns: `repeat(${columns}, var(--desktop-cell))`,
                      ...(previewRows > restingRows
                        ? {
                            gridTemplateRows: `repeat(${previewRows}, var(--desktop-row))`,
                          }
                        : {}),
                    }}
                    onDragEnter={drag.handlers.onDragEnter}
                    onDragOver={drag.handlers.onDragOver}
                    onDragLeave={drag.handlers.onDragLeave}
                    onDrop={drag.handlers.onDrop}
                  >
                    {drag.placeholder && (
                      <span
                        className="drag-placeholder"
                        data-drag-span={drag.placeholder.span}
                        aria-hidden="true"
                        style={{
                          left: `${drag.placeholder.left}px`,
                          top: `${drag.placeholder.top}px`,
                          width: `${drag.placeholder.width}px`,
                          height: `${drag.placeholder.height}px`,
                          // The placeholder stands in for the glass it
                          // replaces, so it carries that glass's corner. A
                          // 2×2 folder placeholder uses the folder's balanced
                          // square-root radius, not a scaled-up site corner.
                          borderRadius: `${
                            drag.placeholder.span === 2
                              ? tileRadii.folder
                              : tileRadii.shortcut
                          }px`,
                        }}
                      />
                    )}
                    {activePage.items.map((item) => {
                      if (item.type === "folder") {
                        const folder = foldersById.get(item.id);
                        if (!folder) return null;
                        const key = `folder:${folder.id}`;
                        const target =
                          drag.hit?.kind === "tile" && drag.hit.key === key
                            ? drag.hit
                            : null;
                        const dropIntent = target
                          ? target.intent === "sort"
                            ? "sort"
                            : "folder"
                          : null;
                        return (
                          <div
                            key={`folder-${folder.id}`}
                            className="folder-drag-slot"
                            data-drag-key={key}
                            style={drag.offsetStyle(key)}
                          >
                            <FolderTile
                              folder={folder}
                              shortcutsById={shortcutsById}
                              active={openFolderId === folder.id}
                              dropActive={dropIntent !== null}
                              dropIntent={dropIntent}
                              dropSide={
                                target?.intent === "sort" ? target.side : null
                              }
                              dragging={drag.draggingKey === key}
                              ready={ready}
                              glass={folderGlass}
                              radius={tileRadii.folder}
                              onOpen={() => {
                                // A drag that ends on the tile must not open
                                // the folder behind it.
                                if (wasJustDragged("folder", folder.id)) return;
                                setOpenFolderId(folder.id);
                              }}
                              onMiniLinkClick={(event) => {
                                // The same guard for the site links in the
                                // preview: a drag across an icon must not turn
                                // the pointer-up into a new tab.
                                if (wasJustDragged("folder", folder.id)) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                }
                              }}
                              onRename={() =>
                                setNameDialog({
                                  kind: "folder-rename",
                                  id: folder.id,
                                  initial: folder.name,
                                })
                              }
                              onDragStart={(event) => {
                                // A click that lands right after the drag must
                                // not open the folder.
                                lastDrag.current = {
                                  kind: "folder",
                                  id: folder.id,
                                  at: Date.now(),
                                };
                                drag.beginDrag(event, {
                                  key,
                                  kind: "folder",
                                  id: folder.id,
                                });
                              }}
                              onDragEnd={drag.handlers.onDragEnd}
                            />
                          </div>
                        );
                      }
                      const shortcut = shortcutsById.get(item.id);
                      if (!shortcut) return null;
                      const key = `shortcut:${shortcut.id}`;
                      const target =
                        drag.hit?.kind === "tile" && drag.hit.key === key
                          ? drag.hit
                          : null;
                      const dropIntent = target
                        ? target.intent === "sort"
                          ? "sort"
                          : "folder"
                        : null;
                      const dropSide =
                        target?.intent === "sort" ? target.side : undefined;
                      return (
                        <ShortcutTile
                          key={`shortcut-${shortcut.id}`}
                          item={shortcut}
                          glass={shortcutTileGlass}
                          radius={tileRadii.shortcut}
                          className={[
                            "shortcut-item",
                            dropIntent === "sort" && "drag-over",
                            dropIntent === "sort" &&
                              dropSide === "before" &&
                              "is-sort-before",
                            dropIntent === "sort" &&
                              dropSide === "after" &&
                              "is-sort-after",
                            dropIntent === "folder" && "folder-drop-target",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          dragKey={key}
                          dropIntent={dropIntent ?? undefined}
                          style={drag.offsetStyle(key)}
                          dragging={drag.draggingKey === key}
                          dragActive={drag.draggingKey !== null}
                          draggable={ready}
                          onDragStart={(event) => {
                            // A click that lands right after the drag must not
                            // open the site.
                            lastDrag.current = {
                              kind: "shortcut",
                              id: shortcut.id,
                              at: Date.now(),
                            };
                            drag.beginDrag(event, {
                              key,
                              kind: "shortcut",
                              id: shortcut.id,
                            });
                          }}
                          onDragEnd={drag.handlers.onDragEnd}
                          onEdit={
                            ready
                              ? () => openShortcutEditor(shortcut.id)
                              : undefined
                          }
                          editDisabled={!ready}
                          onActivate={
                            managing
                              ? () => openShortcutEditor(shortcut.id)
                              : undefined
                          }
                          showEdit={!managing}
                          linkLabel={
                            managing
                              ? m.app.shortcuts.editAria(shortcut.name)
                              : shortcut.name
                          }
                          action={
                            state.pages.length > 1 ? (
                              <GlassButton
                                variant="icon"
                                size="sm"
                                className="shortcut-edit shortcut-move"
                                aria-label={`${d.moveToPage}: ${shortcut.name}`}
                                title={d.moveToPage}
                                onClick={() => beginMoveShortcut(shortcut.id)}
                                disabled={!ready}
                                icon={<FolderInput size={13} />}
                                optics={glassOptics}
                                {...glassInteraction}
                              />
                            ) : undefined
                          }
                        />
                      );
                    })}
                    {showAddTile && (
                      <div
                        className="shortcut-item add-shortcut"
                        data-drag-key="add"
                        style={drag.offsetStyle("add")}
                      >
                        <button
                          className="shortcut-link"
                          disabled={!ready}
                          onClick={() => openShortcutEditor("new")}
                          aria-label={m.app.shortcuts.addAria}
                        >
                          <GlassSurface
                            className="shortcut-glass add-glass"
                            cornerRadius={tileRadii.shortcut}
                            optics={addShortcutOptics}
                            {...glassInteraction}
                          >
                            <Plus size={24} strokeWidth={1.4} />
                          </GlassSurface>
                          <span className="shortcut-name">
                            {m.app.shortcuts.add}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                  {activePage.items.length === 0 && (
                    <p className="empty-hint">{m.app.shortcuts.empty}</p>
                  )}
                </section>
              </GlassLightGroup>
              {loadError && (
                <GlassAlert
                  className="load-error"
                  role="alert"
                  tone="danger"
                  {...material.base}
                >
                  <span>{loadError}</span>
                  <GlassButton
                    size="sm"
                    onClick={() => void refresh()}
                    {...material.base}
                  >
                    {m.app.status.retryLoad}
                  </GlassButton>
                </GlassAlert>
              )}
            </main>
            <nav
              className={`page-dock${drag.draggingKey ? " is-dragging-site" : ""}`}
              aria-label={d.dockAria}
            >
              <GlassSurface
                className="dock-surface"
                cornerRadius={26}
                optics={glassOptics}
                {...glassInteraction}
              >
                <div className="dock-inner">
                  {state.pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      className={`dock-page${page.id === activePage.id ? " is-active" : ""}${dockOver === page.id ? " is-drop-over" : ""}`}
                      aria-label={d.pageAria(page.name)}
                      aria-current={
                        page.id === activePage.id ? "page" : undefined
                      }
                      title={page.name}
                      onClick={() => switchPage(page.id)}
                      onKeyDown={focusDockSibling}
                      onContextMenu={(event) => {
                        // The page's own settings: its name and its dock icon.
                        if (!ready) return;
                        event.preventDefault();
                        beginPageSettings(page);
                      }}
                      onDragEnter={(event) => {
                        const payload = dragPayload.current;
                        if (!payload || payload.pageId === page.id) return;
                        event.preventDefault();
                        event.stopPropagation();
                        // Entering the page is what makes it the drop
                        // target: the highlight follows the pointer instead
                        // of waiting for the next dragover.
                        drag.clearFeedback();
                        setDockOver(page.id);
                      }}
                      onDragOver={(event) => {
                        const payload = dragPayload.current;
                        if (!payload || payload.pageId === page.id) return;
                        event.preventDefault();
                        event.stopPropagation();
                        event.dataTransfer.dropEffect = "move";
                        // Leaving the page for the dock abandons any reorder
                        // preview: the drop here moves the site to a page.
                        drag.clearFeedback();
                        setDockOver(page.id);
                      }}
                      onDragLeave={(event) => {
                        if (
                          event.currentTarget.contains(
                            event.relatedTarget as Node,
                          )
                        )
                          return;
                        setDockOver((current) =>
                          current === page.id ? null : current,
                        );
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const payload = dragPayload.current;
                        finishDrag();
                        if (!payload || payload.pageId === page.id) return;
                        // A folder moves to the other page as one tile, with
                        // its members untouched.
                        if (payload.kind === "folder")
                          void moveFolderToPage(payload.id, page.id).catch(
                            reportError,
                          );
                        else
                          void moveShortcutToPage(payload.id, page.id).catch(
                            reportError,
                          );
                      }}
                    >
                      <span className="dock-page-icon" aria-hidden="true">
                        <PageIconBadge page={page} />
                      </span>
                      <span className="dock-page-label">{page.name}</span>
                    </button>
                  ))}
                  {state.pages.length < MAX_PAGES && (
                    <>
                      <span className="dock-divider" aria-hidden="true" />
                      <button
                        type="button"
                        className="dock-page dock-new"
                        aria-label={d.newPage}
                        title={d.newPage}
                        onClick={beginCreatePage}
                        onKeyDown={focusDockSibling}
                      >
                        <span className="dock-page-icon" aria-hidden="true">
                          <Plus size={15} />
                        </span>
                        <span className="dock-page-label">{d.newPage}</span>
                      </button>
                    </>
                  )}
                </div>
              </GlassSurface>
            </nav>
            <footer className="page-footer">
              {currentArt && art ? (
                <a
                  className="art-credit"
                  href={currentArt.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={m.common.source.viewAria(art.title)}
                >
                  <span className="credit-icon">
                    <ImageIcon size={19} strokeWidth={1.4} />
                  </span>
                  <span>
                    <strong>
                      {art.title}
                      <ExternalLink size={11} />
                    </strong>
                    <small>
                      {art.artist}
                      <span className="credit-dot">·</span>
                      {currentArt.year}
                    </small>
                  </span>
                </a>
              ) : (
                <div className="art-credit">
                  <span className="credit-icon">
                    <ImageIcon size={19} strokeWidth={1.4} />
                  </span>
                  <span>
                    <strong>{m.app.footer.myLandscape}</strong>
                    <small>{s.customWallpaper?.name}</small>
                  </span>
                </div>
              )}
              <span className="footer-note">
                {wallpaperError
                  ? m.app.footer.wallpaperUnavailable
                  : m.app.footer.note}
              </span>
              {/*
                The desktop's own actions live in the bottom-right corner,
                immediately left of Settings: the page's own controls first
                (only while organizing), then the folder and the organize
                toggle.
              */}
              <div className="footer-actions">
                {managing && (
                  <>
                    <GlassButton
                      variant="icon"
                      size="sm"
                      className="plain-icon footer-icon"
                      aria-label={d.pageIconAria(activePage.name)}
                      title={d.pageIcon}
                      disabled={!ready}
                      onClick={() => beginPageIcon()}
                      icon={<Smile size={15} />}
                      optics={glassOptics}
                      {...glassInteraction}
                    />
                    <GlassButton
                      variant="icon"
                      size="sm"
                      className="plain-icon footer-icon"
                      aria-label={d.renamePage}
                      title={d.renamePage}
                      disabled={!ready}
                      onClick={beginRenamePage}
                      icon={<Pencil size={15} />}
                      optics={glassOptics}
                      {...glassInteraction}
                    />
                    <GlassButton
                      variant="icon"
                      size="sm"
                      className="plain-icon footer-icon"
                      aria-label={d.deletePage}
                      title={d.deletePage}
                      disabled={
                        !ready ||
                        state.pages.length <= 1 ||
                        activePage.items.length > 0
                      }
                      onClick={beginDeletePage}
                      icon={<Trash2 size={15} />}
                      optics={glassOptics}
                      {...glassInteraction}
                    />
                  </>
                )}
                <GlassButton
                  size="sm"
                  className="footer-action footer-folder"
                  aria-label={d.createFolder}
                  title={d.createFolder}
                  disabled={!ready || state.folders.length >= MAX_FOLDERS}
                  onClick={() =>
                    setNameDialog({
                      kind: "folder-create",
                      initial: d.createFolder,
                    })
                  }
                  icon={<FolderPlus size={14} />}
                  optics={glassOptics}
                  {...glassInteraction}
                >
                  <span className="footer-action-label">{d.createFolder}</span>
                </GlassButton>
                <GlassButton
                  size="sm"
                  className="footer-action"
                  aria-label={
                    managing ? m.common.actions.done : m.app.shortcuts.manage
                  }
                  title={
                    managing ? m.common.actions.done : m.app.shortcuts.manage
                  }
                  disabled={!ready}
                  onClick={() => setManaging((value) => !value)}
                  optics={glassOptics}
                  {...glassInteraction}
                >
                  {managing ? (
                    <>
                      <Check size={12} />
                      <span className="footer-action-label">
                        {m.common.actions.done}
                      </span>
                    </>
                  ) : (
                    <>
                      <MoreHorizontal size={15} />
                      <span className="footer-action-label">
                        {m.app.shortcuts.manage}
                      </span>
                    </>
                  )}
                </GlassButton>
                <GlassButton
                  className="settings-button"
                  size="sm"
                  icon={<Settings2 size={17} strokeWidth={1.5} />}
                  optics={glassOptics}
                  {...glassInteraction}
                  disabled={!ready}
                  onClick={() => setSettingsTab("appearance")}
                >
                  {m.app.footer.settings}
                  <ChevronRight size={13} />
                </GlassButton>
              </div>
            </footer>
            {!isExtension && (
              <span className="preview-badge">{m.app.previewBadge}</span>
            )}
          </div>
          {settingsTab && (
            <Settings
              settings={s}
              customUrl={customUrl}
              initialTab={settingsTab}
              onClose={() => setSettingsTab(null)}
              onChange={changeSettings}
              onUpload={upload}
              onExport={exportBackup}
              onImport={importBackup}
              nutstore={nutstorePanel}
              saving={pending > 0}
            />
          )}
          {openFolder && (
            <FolderDialog
              folder={openFolder}
              shortcutsById={shortcutsById}
              shortcutGlass={shortcutTileGlass}
              shortcutRadius={tileRadii.shortcut}
              onClose={() => setOpenFolderId(null)}
              onEditShortcut={(id) => openShortcutEditor(id, openFolder.id)}
              onRemoveShortcut={(id) =>
                removeShortcutFromFolder(id, openFolder.id).catch(reportError)
              }
              onReorderShortcut={(order) =>
                reorderFolderShortcuts(openFolder.id, order).catch(reportError)
              }
              onRenameFolder={beginRenameOpenFolder}
              onDeleteFolder={beginDeleteOpenFolder}
            />
          )}
          {editor && (
            <ShortcutEditor
              shortcut={selectedShortcut}
              index={Math.max(0, editorIndex)}
              total={editorTotal}
              onClose={closeEditor}
              onSave={saveShortcut}
              onRemove={() => deleteShortcut(editor)}
              onMove={(offset) => moveShortcut(editor, { offset })}
            />
          )}
          {pageDialog && (
            <PageDialog
              mode={pageDialog.mode}
              title={
                pageDialog.mode === "create"
                  ? d.newPage
                  : pageDialog.mode === "rename"
                    ? d.renamePage
                    : pageDialog.mode === "icon"
                      ? d.pageIcon
                      : d.pageSettings
              }
              initialName={pageDialog.name}
              initialIcon={
                pageDialog.mode === "create"
                  ? null
                  : (state.pages.find((page) => page.id === pageDialog.id)
                      ?.icon ?? null)
              }
              onSubmit={submitPageDialog}
              onClose={() => setPageDialog(null)}
            />
          )}
          {nameDialog && (
            <NameDialog
              title={
                nameDialog.kind === "folder-create"
                  ? d.createFolder
                  : d.renameFolder
              }
              label={d.folderName}
              placeholder={d.folderNamePlaceholder}
              initial={nameDialog.initial}
              maxLength={MAX_FOLDER_NAME}
              onSubmit={submitName}
              onClose={closeNameDialog}
            />
          )}
          {confirmDialog && (
            <ConfirmDialog
              title={
                confirmDialog.kind === "page-delete"
                  ? d.deletePage
                  : d.deleteFolder
              }
              message={
                confirmDialog.kind === "page-delete"
                  ? d.confirmDeletePage(confirmDialog.name)
                  : d.confirmDeleteFolder(confirmDialog.name)
              }
              onConfirm={confirmDelete}
              onCancel={cancelConfirm}
              onConfirmed={() => setConfirmDialog(null)}
            />
          )}
          {moveDialog && movingShortcut && (
            <MoveShortcutDialog
              shortcut={movingShortcut}
              pages={moveTargets}
              onMove={(targetPageId) =>
                moveShortcutToPage(moveDialog.shortcutId, targetPageId)
              }
              onClose={closeMoveDialog}
            />
          )}
          {notice && (
            <GlassSurface
              className="toast"
              role="status"
              cornerRadius={26}
              {...material.base}
            >
              <span>{notice}</span>
              <GlassButton
                variant="icon"
                size="sm"
                aria-label={m.app.status.closeToastAria}
                onClick={() => setNotice("")}
                icon={<X size={15} />}
                {...material.base}
              />
            </GlassSurface>
          )}
        </div>
      </GlassMaterialProvider>
    </GlassProvider>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  onConfirmed,
}: {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { base, panel } = useGlassMaterial();
  const m = t();
  async function run() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.editor.errors.save);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      label={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
      head={
        <GlassSurface className="dialog-head" cornerRadius={26} {...panel}>
          <span className="dialog-title">{title}</span>
        </GlassSurface>
      }
      foot={
        <div className="button-pair push-right">
          <GlassButton
            type="button"
            size="sm"
            className="text-glass-button"
            disabled={busy}
            onClick={onCancel}
            {...base}
          >
            {m.common.actions.cancel}
          </GlassButton>
          <GlassButton
            type="button"
            size="sm"
            className="danger"
            disabled={busy}
            onClick={() => void run()}
            {...base}
          >
            {m.common.actions.delete}
          </GlassButton>
        </div>
      }
    >
      <p className="dialog-description">{message}</p>
      {error && (
        <GlassAlert tone="danger" role="alert" {...base}>
          {error}
        </GlassAlert>
      )}
    </Modal>
  );
}

/**
 * Explicit "move to page" picker. It is opened from a tile's manage action or a
 * folder site, so the destination is chosen by name rather than inferred from
 * the current position.
 */
function MoveShortcutDialog({
  shortcut,
  pages,
  onMove,
  onClose,
}: {
  shortcut: Shortcut;
  pages: DesktopPage[];
  onMove: (pageId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { base, panel } = useGlassMaterial();
  const m = t();
  const d = m.app.desktop;
  async function move(pageId: string) {
    setBusy(true);
    setError("");
    try {
      await onMove(pageId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.editor.errors.save);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      label={d.moveToPage}
      onClose={() => {
        if (!busy) onClose();
      }}
      head={
        <GlassSurface className="dialog-head" cornerRadius={26} {...panel}>
          <span className="dialog-title">{d.moveToPage}</span>
        </GlassSurface>
      }
      foot={
        <div className="button-pair push-right">
          <GlassButton
            type="button"
            size="sm"
            className="text-glass-button"
            disabled={busy}
            onClick={onClose}
            {...base}
          >
            {m.common.actions.cancel}
          </GlassButton>
        </div>
      }
    >
      <p className="dialog-description">{shortcut.name}</p>
      <div className="move-page-list">
        {pages.map((page) => (
          <button
            key={page.id}
            type="button"
            className="move-page-item"
            disabled={busy}
            aria-label={d.pageAria(page.name)}
            onClick={() => void move(page.id)}
          >
            <span className="move-page-icon" aria-hidden="true">
              <PageIconBadge page={page} />
            </span>
            <span className="move-page-name">{page.name}</span>
            <ArrowRight size={15} />
          </button>
        ))}
      </div>
      {error && (
        <GlassAlert tone="danger" role="alert" {...base}>
          {error}
        </GlassAlert>
      )}
    </Modal>
  );
}
