import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
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
  GalleryVerticalEnd,
  ImageIcon,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { ARTWORKS, defaultState } from "./data";
import type { AppSettingsPatch, AppState, BackupV1, Shortcut } from "./types";
import {
  dataUrlToBlob,
  optimizeImage,
  validateDecodedWallpaper,
} from "./lib/images";
import { loadFavicon, isExtension, repository, search } from "./lib/platform";
import { buildSnapshot } from "./lib/sync";
import { useNutstoreSync } from "./lib/useNutstoreSync";
import { listEngines, resolveEngine } from "./lib/engines";
import { MIN_QUERY_LENGTH, fetchSuggestions } from "./lib/suggest";
import type { NutstoreSyncProps } from "./components/NutstoreSync";
import { Settings, type SettingsTab } from "./components/Settings";
import { ShortcutEditor } from "./components/ShortcutEditor";
import { ClearButton } from "./components/ClearButton";
import { EngineIcon } from "./components/EngineIcon";
import { artworkOf, formatClock, formatDate, t } from "./lib/i18n";
import {
  GlassMaterialProvider,
  glassOverLight,
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

/**
 * Chrome builds the default drag image by rasterising the dragged element, but
 * it cannot resolve the tile's `backdrop-filter` backdrop — the glass comes out
 * as an opaque black box, and because the ghost is the whole tile it drags a
 * second copy of the name (and the hover-revealed edit button) along with it.
 * Hand the browser a plain stand-in instead: same size, a flat tint, the icon
 * and nothing else.
 *
 * The node is parked under the cursor for a single task. It has to outlive the
 * `dragstart` handler — the snapshot is taken once the handler returns — but
 * anything longer would trail a second ghost behind the pointer.
 */
function buildDragGhost(tile: HTMLElement, x: number, y: number) {
  const glass = tile.querySelector<HTMLElement>(".shortcut-glass");
  if (!glass) return null;
  const box = glass.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.width = `${box.width}px`;
  ghost.style.height = `${box.height}px`;
  // Mirror the live tile rather than restating the number, so the two cannot
  // drift apart at the narrow breakpoint.
  ghost.style.borderRadius = getComputedStyle(glass).borderRadius;
  ghost.style.left = `${x - box.width / 2}px`;
  ghost.style.top = `${y - box.height / 2}px`;
  const icon = glass.querySelector(".site-icon, .site-letter");
  if (icon) ghost.append(icon.cloneNode(true));
  document.body.append(ghost);
  setTimeout(() => ghost.remove(), 0);
  return { ghost, width: box.width, height: box.height };
}

export default function App() {
  const [state, setState] = useState<AppState>(defaultState);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(0);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [editor, setEditor] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
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
  const dragged = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  /** Mirrors `dragged` so the tile being moved can style itself. */
  const [dragging, setDragging] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const reduced = useReducedMotion();
  const m = t();
  const s = state.settings;
  const currentArt = ARTWORKS.find((a) => a.id === s.wallpaper);
  const art = currentArt ? artworkOf(currentArt.id) : null;
  const modalOpen = settingsTab !== null || editor !== null;
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
          current.shortcuts.push({
            id: crypto.randomUUID(),
            name,
            url,
            ...(iconDataUrl ? { iconDataUrl } : {}),
          });
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
  async function moveShortcut(
    id: string,
    target: { id: string } | { offset: number },
  ) {
    await mutate(() =>
      repository.update((current) => {
        const index = current.shortcuts.findIndex((item) => item.id === id);
        const destination =
          "id" in target
            ? current.shortcuts.findIndex((item) => item.id === target.id)
            : index + target.offset;
        if (
          index < 0 ||
          destination < 0 ||
          destination >= current.shortcuts.length
        )
          return current;
        const [item] = current.shortcuts.splice(index, 1);
        current.shortcuts.splice(destination, 0, item);
        return current;
      }),
    );
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
                  {state.shortcuts.length > 0 && (
                    <div className="shortcut-toolbar">
                      <span>{m.app.shortcuts.title}</span>
                      <GlassButton
                        size="sm"
                        className="toolbar-button"
                        disabled={!ready}
                        onClick={() => setManaging((value) => !value)}
                        optics={glassOptics}
                        {...glassInteraction}
                      >
                        {managing ? (
                          <>
                            <Check size={12} />
                            {m.common.actions.done}
                          </>
                        ) : (
                          <>
                            <MoreHorizontal size={15} />
                            {m.app.shortcuts.manage}
                          </>
                        )}
                      </GlassButton>
                    </div>
                  )}
                  <div className="shortcut-grid">
                    {state.shortcuts.map((item) => (
                      <div
                        key={item.id}
                        className={`shortcut-item ${
                          dragOver === item.id ? "drag-over" : ""
                        } ${dragging === item.id ? "is-dragging" : ""}`}
                        draggable={ready}
                        onDragStart={(event) => {
                          dragged.current = item.id;
                          setDragging(item.id);
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", item.id);
                          const ghost = buildDragGhost(
                            event.currentTarget,
                            event.clientX,
                            event.clientY,
                          );
                          if (ghost)
                            event.dataTransfer.setDragImage(
                              ghost.ghost,
                              ghost.width / 2,
                              ghost.height / 2,
                            );
                        }}
                        onDragEnd={() => {
                          dragged.current = null;
                          setDragging(null);
                          setDragOver(null);
                        }}
                        onDragOver={(event) => {
                          if (dragged.current && dragged.current !== item.id) {
                            event.preventDefault();
                            setDragOver(item.id);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const id = dragged.current;
                          dragged.current = null;
                          setDragOver(null);
                          if (id && id !== item.id)
                            void moveShortcut(id, { id: item.id }).catch((e) =>
                              setNotice(e.message),
                            );
                        }}
                      >
                        <a
                          href={item.url}
                          className="shortcut-link"
                          draggable={false}
                          // Keep the new tab page where it is: a shortcut
                          // opens beside it rather than replacing it.
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => {
                            if (managing) {
                              event.preventDefault();
                              setEditor(item.id);
                            }
                          }}
                          onContextMenu={(event) => {
                            if (ready) {
                              event.preventDefault();
                              setEditor(item.id);
                            }
                          }}
                          aria-label={
                            managing
                              ? m.app.shortcuts.editAria(item.name)
                              : item.name
                          }
                        >
                          <GlassSurface
                            className="shortcut-glass"
                            cornerRadius={21}
                            optics={shortcutOptics}
                            {...glassInteraction}
                          >
                            <SiteIcon item={item} />
                          </GlassSurface>
                          <span className="shortcut-name">{item.name}</span>
                        </a>
                        {!managing && (
                          <GlassButton
                            variant="icon"
                            size="sm"
                            className="shortcut-edit"
                            aria-label={m.app.shortcuts.editAria(item.name)}
                            onClick={() => setEditor(item.id)}
                            disabled={!ready}
                            icon={<MoreHorizontal size={14} />}
                            optics={glassOptics}
                            {...glassInteraction}
                          />
                        )}
                      </div>
                    ))}
                    {state.shortcuts.length < 200 && (
                      <div className="shortcut-item add-shortcut">
                        <button
                          className="shortcut-link"
                          disabled={!ready}
                          onClick={() => setEditor("new")}
                          aria-label={m.app.shortcuts.addAria}
                        >
                          <GlassSurface
                            className="shortcut-glass add-glass"
                            cornerRadius={21}
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
                  {state.shortcuts.length === 0 && (
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
          {editor && (
            <ShortcutEditor
              shortcut={selectedShortcut}
              index={state.shortcuts.findIndex((item) => item.id === editor)}
              total={state.shortcuts.length}
              onClose={() => setEditor(null)}
              onSave={saveShortcut}
              onRemove={() =>
                mutate(() =>
                  repository.update((current) => ({
                    ...current,
                    shortcuts: current.shortcuts.filter(
                      (item) => item.id !== editor,
                    ),
                  })),
                )
              }
              onMove={(offset) => moveShortcut(editor, { offset })}
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

function SiteIcon({ item }: { item: Shortcut }) {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    // A user-chosen icon wins over whatever the site publishes.
    if (item.iconDataUrl) {
      setFailed(false);
      setSrc(item.iconDataUrl);
      return;
    }
    setFailed(false);
    setSrc(null);
    void loadFavicon(item.url)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [item.url, item.iconDataUrl]);
  return src && !failed ? (
    <img
      className="site-icon"
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className="site-letter">
      {Array.from(item.name)[0]?.toUpperCase()}
    </span>
  );
}
