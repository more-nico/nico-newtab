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
  GlassInput,
  GlassLightGroup,
  GlassProvider,
  GlassSurface,
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
  blobToDataUrl,
  dataUrlToBlob,
  optimizeImage,
  validateDecodedWallpaper,
} from "./lib/images";
import { loadFavicon, isExtension, repository, search } from "./lib/platform";
import { Settings, type SettingsTab } from "./components/Settings";
import { ShortcutEditor } from "./components/ShortcutEditor";
import { GlassMaterialProvider, useGlassMaterialValue } from "./lib/glass";

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
  const composing = useRef(false);
  const dragged = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const reduced = useReducedMotion();
  const s = state.settings;
  const currentArt = ARTWORKS.find((a) => a.id === s.wallpaper);
  const modalOpen = settingsTab !== null || editor !== null;
  const material = useGlassMaterialValue(s, reduced);
  const glassOptics = material.base.optics!;
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
        setLoadError("暂时无法读取本地数据。为保护已有内容，编辑已暂停。");
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
          if (!cancelled)
            setNotice("自定义壁纸暂时无法读取，可以在设置中重新上传。");
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
    if (!ready) throw new Error("本地数据尚未加载，请稍后重试。");
    setPending((n) => n + 1);
    try {
      await operation();
      await refresh();
    } catch (error) {
      await refresh();
      throw new Error(
        error instanceof Error
          ? `保存失败：${error.message}`
          : "保存失败，请检查可用空间后重试。",
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
              name: file.name.slice(0, 200) || "我的壁纸",
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
    const backup: BackupV1 = {
      format: "nico-newtab",
      version: 1,
      exportedAt: new Date().toISOString(),
      state: saved,
      wallpaper: blob
        ? {
            name: saved.settings.customWallpaper!.name,
            dataUrl: await blobToDataUrl(blob),
          }
        : null,
    };
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
  async function saveShortcut(name: string, url: string) {
    await mutate(() =>
      repository.update((current) => {
        if (editor === "new") {
          if (current.shortcuts.length >= 200)
            throw new Error("最多可添加 200 个网站。");
          current.shortcuts.push({ id: crypto.randomUUID(), name, url });
        } else {
          const item = current.shortcuts.find((item) => item.id === editor);
          if (!item) throw new Error("这个网站已在其他标签页中移除。");
          item.name = name;
          item.url = url;
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
  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (composing.current || !query.trim() || searching) return;
    setSearching(true);
    try {
      await search(query);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "搜索暂时不可用，请重试。");
    } finally {
      setSearching(false);
    }
  }
  const hours = now.getHours();
  const greeting =
    hours < 6
      ? "夜深了，给自己一点宁静。"
      : hours < 11
        ? "早上好，今天也有好风景。"
        : hours < 14
          ? "午间好，留一点时间给自己。"
          : hours < 18
            ? "下午好，让灵感慢慢发生。"
            : "晚上好，把步调放慢一点。";
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: s.clockFormat === "12" ? "h12" : "h23",
  }).formatToParts(now);
  const clock = time
    .filter((p) => ["hour", "minute", "literal"].includes(p.type))
    .map((p) => p.value)
    .join("")
    .trim();
  const period = time.find((p) => p.type === "dayPeriod")?.value.toUpperCase();
  const date = `${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(now)} · ${new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(now)}`;
  const selectedShortcut = state.shortcuts.find((item) => item.id === editor);

  return (
    <GlassProvider
      quality={reduced ? "low" : s.quality}
      overLight="auto"
      lensMapRasterScale={s.glass.mapScale}
    >
      <GlassMaterialProvider value={material}>
        <div className={`app ${reduced ? "reduced-motion" : ""}`}>
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
          <div className="page-shell" inert={modalOpen}>
            <header className="page-header">
              <div className="brand" aria-label="Nico 新标签页">
                <span className="brand-wordmark">
                  nico<span>.</span>
                </span>
                <span className="brand-divider" />
                <span className="brand-caption">每一页，都是新的风景</span>
              </div>
              <GlassButton
                overLight={false}
                className="gallery-button"
                size="sm"
                optics={glassOptics}
                {...glassInteraction}
                icon={<GalleryVerticalEnd size={15} />}
                disabled={!ready}
                onClick={() => setSettingsTab("wallpaper")}
              >
                画作集<span className="gallery-count">03</span>
              </GlassButton>
            </header>
            <main className="main-content">
              <section className="clock-section" aria-label="当前时间">
                <p className="greeting">{greeting}</p>
                <div className="time-line">
                  <time className="clock" dateTime={now.toISOString()}>
                    {clock}
                  </time>
                  {period && <span className="day-period">{period}</span>}
                </div>
                <p className="date">{date}</p>
              </section>
              <GlassLightGroup>
                <form
                  className="search-form"
                  role="search"
                  onSubmit={(event) => void submitSearch(event)}
                >
                  <GlassInput
                    className="search-input"
                    size="lg"
                    cornerRadius={26}
                    leading={<Search size={20} strokeWidth={1.6} />}
                    aria-label="搜索"
                    placeholder="搜索，让好奇心带路"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={2000}
                    onCompositionStart={() => {
                      composing.current = true;
                    }}
                    onCompositionEnd={() => {
                      composing.current = false;
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        (e.nativeEvent.isComposing || e.keyCode === 229)
                      )
                        e.preventDefault();
                    }}
                    trailing={
                      <button
                        className="search-submit"
                        type="submit"
                        aria-label="开始搜索"
                        disabled={searching || !query.trim()}
                      >
                        <ArrowRight size={19} strokeWidth={1.6} />
                      </button>
                    }
                    optics={searchOptics}
                    {...glassInteraction}
                  />
                </form>
                <section
                  className={`shortcuts-section ${managing ? "is-managing" : ""}`}
                  aria-label="常用网站"
                >
                  {state.shortcuts.length > 0 && (
                    <div className="shortcut-toolbar">
                      <span>常用网站</span>
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
                            完成
                          </>
                        ) : (
                          <>
                            <MoreHorizontal size={15} />
                            整理
                          </>
                        )}
                      </GlassButton>
                    </div>
                  )}
                  <div className="shortcut-grid">
                    {state.shortcuts.map((item) => (
                      <div
                        key={item.id}
                        className={`shortcut-item ${dragOver === item.id ? "drag-over" : ""}`}
                        draggable={ready}
                        onDragStart={(event) => {
                          dragged.current = item.id;
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", item.id);
                        }}
                        onDragEnd={() => {
                          dragged.current = null;
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
                            managing ? `编辑 ${item.name}` : item.name
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
                            aria-label={`编辑 ${item.name}`}
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
                          aria-label="添加常用网站"
                        >
                          <GlassSurface
                            className="shortcut-glass add-glass"
                            cornerRadius={21}
                            optics={addShortcutOptics}
                            {...glassInteraction}
                          >
                            <Plus size={24} strokeWidth={1.4} />
                          </GlassSurface>
                          <span className="shortcut-name">添加网站</span>
                        </button>
                      </div>
                    )}
                  </div>
                  {state.shortcuts.length === 0 && (
                    <p className="empty-hint">把常去的地方，留在这里。</p>
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
                    重新读取
                  </GlassButton>
                </GlassAlert>
              )}
            </main>
            <footer className="page-footer">
              {currentArt ? (
                <a
                  className="art-credit"
                  href={currentArt.source}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`查看馆藏：${currentArt.title}`}
                >
                  <span className="credit-icon">
                    <ImageIcon size={19} strokeWidth={1.4} />
                  </span>
                  <span>
                    <strong>
                      {currentArt.title}
                      <ExternalLink size={11} />
                    </strong>
                    <small>
                      {currentArt.artist}
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
                    <strong>我的风景</strong>
                    <small>{s.customWallpaper?.name}</small>
                  </span>
                </div>
              )}
              <span className="footer-note">
                {wallpaperError
                  ? "壁纸暂不可用 · 已显示备用背景"
                  : "在日常里，与美相遇"}
              </span>
              <GlassButton
                className="settings-button"
                overLight={false}
                size="sm"
                icon={<Settings2 size={17} strokeWidth={1.5} />}
                optics={glassOptics}
                {...glassInteraction}
                disabled={!ready}
                onClick={() => setSettingsTab("appearance")}
              >
                个性化
                <ChevronRight size={13} />
              </GlassButton>
            </footer>
            {!isExtension && <span className="preview-badge">网页预览</span>}
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
                aria-label="关闭提示"
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
  }, [item.url]);
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
