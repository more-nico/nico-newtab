import { useEffect, useState, type FormEvent } from "react";
import {
  GlassButton,
  GlassInput,
  GlassLightGroup,
  GlassProvider,
  GlassSurface,
} from "nico-glass-kit";
import {
  ArrowRight,
  Check,
  Globe,
  LoaderCircle,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { ARTWORKS, defaultState } from "../data";
import type { AppState } from "../types";
import { normalizeUrl } from "../lib/validation";
import { isExtension, loadFavicon, repository } from "../lib/platform";
import { t } from "../lib/i18n";
import { pickExtensionTab } from "../lib/tabs";
import {
  GlassMaterialProvider,
  glassOverLight,
  useGlassMaterialValue,
} from "../lib/glass";

const MAX_SHORTCUTS = 200;
const MAX_NAME_LENGTH = 40;

type Status =
  | "loading"
  | "ready"
  | "duplicate"
  | "full"
  | "unsupported"
  | "saved";

function useReducedMotion(): boolean {
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
 * Toolbar popup for the tab the user is looking at. `activeTab` is granted by
 * the click that opened this page, so the address is only readable here — the
 * new tab page itself can never see it.
 */
export function Popup() {
  const m = t();
  const [state, setState] = useState<AppState>(defaultState);
  const [status, setStatus] = useState<Status>("loading");
  const [page, setPage] = useState<{ url: string; title: string } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const material = useGlassMaterialValue(state.settings, reduced);
  const art = ARTWORKS.find((a) => a.id === state.settings.wallpaper);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    void (async () => {
      let loaded = defaultState();
      try {
        loaded = await repository.load();
      } catch {
        setError(m.popup.errors.loadFailed);
      }
      let tab: { url?: string; title?: string } | undefined;
      try {
        [tab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });
      } catch {
        tab = undefined;
      }
      if (cancelled) return;
      setState(loaded);
      setStatus(
        loaded.shortcuts.length >= MAX_SHORTCUTS ? "full" : "unsupported",
      );
      if (!tab?.url) return;
      let url: string;
      try {
        url = normalizeUrl(tab.url);
      } catch {
        return;
      }
      const title = tab.title?.trim() || new URL(url).hostname;
      setPage({ url, title });
      setName(title.slice(0, MAX_NAME_LENGTH));
      setStatus(
        loaded.shortcuts.some((item) => item.url === url)
          ? "duplicate"
          : loaded.shortcuts.length >= MAX_SHORTCUTS
            ? "full"
            : "ready",
      );
      try {
        const blob = await loadFavicon(url);
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setIcon(objectUrl);
      } catch {
        /* keep the letter fallback */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!page) return;
    const value = name.trim();
    if (!value) {
      setError(m.popup.errors.emptyName);
      return;
    }
    setError("");
    try {
      const url = normalizeUrl(page.url);
      await repository.update((current) => {
        if (current.shortcuts.some((item) => item.url === url))
          throw new Error(m.popup.errors.duplicate);
        if (current.shortcuts.length >= MAX_SHORTCUTS)
          throw new Error(m.popup.errors.maxShortcuts(MAX_SHORTCUTS));
        current.shortcuts.push({ id: crypto.randomUUID(), name: value, url });
        return current;
      });
      setStatus("saved");
      window.setTimeout(() => window.close(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.popup.errors.saveFailed);
    }
  }

  /**
   * Jumps to an extension page tab: an already-open one wins (this extension's
   * own page first), otherwise a fresh tab is opened on this extension's page.
   */
  async function jumpToExtensionPage() {
    if (!isExtension) {
      window.close();
      return;
    }
    const ownPage = chrome.runtime.getURL("index.html");
    let tabs: chrome.tabs.Tab[] = [];
    try {
      tabs = await chrome.tabs.query({});
    } catch {
      tabs = [];
    }
    const target = pickExtensionTab(tabs, ownPage);
    try {
      if (target) {
        await chrome.tabs.update(target.id, { active: true });
        if (target.windowId !== undefined)
          await chrome.windows.update(target.windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: ownPage });
      }
    } catch {
      /* The popup closes regardless; the toolbar click can be repeated. */
    }
    window.close();
  }

  const host = page ? new URL(page.url).hostname : "";

  return (
    <GlassProvider
      quality={reduced ? "low" : state.settings.quality}
      overLight={glassOverLight(state.settings.glassMode)}
      lensMapRasterScale={state.settings.glass.mapScale}
    >
      <GlassMaterialProvider value={material}>
        <div className="popup">
          <div
            className="popup-backdrop"
            style={
              art ? { backgroundImage: `url(${art.thumbnail})` } : undefined
            }
          />
          <GlassSurface
            className="popup-panel"
            cornerRadius={26}
            {...material.panel}
          >
            <GlassLightGroup>
              {status === "loading" && (
                <p className="popup-loading">
                  <LoaderCircle size={15} className="spinning" />
                  {m.popup.loading}
                </p>
              )}

              {(status === "ready" ||
                status === "duplicate" ||
                status === "full") &&
                page && (
                  <form onSubmit={(event) => void save(event)}>
                    <GlassSurface
                      className="page-row"
                      cornerRadius={22}
                      {...material.base}
                    >
                      <span className="page-icon">
                        {icon ? (
                          <img src={icon} alt="" />
                        ) : (
                          <Globe size={17} strokeWidth={1.6} />
                        )}
                      </span>
                      <span className="page-copy">
                        <strong>{page.title}</strong>
                        <small>{host}</small>
                      </span>
                    </GlassSurface>

                    <label className="popup-label" htmlFor="popup-name">
                      {m.popup.form.nameLabel}
                    </label>
                    <GlassInput
                      id="popup-name"
                      data-initial-focus
                      className="popup-input"
                      value={name}
                      maxLength={MAX_NAME_LENGTH}
                      disabled={status !== "ready"}
                      onChange={(e) => setName(e.target.value)}
                    />

                    {error && (
                      <p className="popup-error" role="alert">
                        <TriangleAlert size={13} />
                        {error}
                      </p>
                    )}
                    <p className="popup-hint">
                      {status === "duplicate"
                        ? m.popup.hints.duplicate
                        : status === "full"
                          ? m.popup.hints.full(MAX_SHORTCUTS)
                          : m.popup.hints.ready}
                    </p>

                    <div className="popup-actions">
                      <GlassButton
                        type="button"
                        size="sm"
                        className="text-glass-button"
                        onClick={() => window.close()}
                        {...material.base}
                      >
                        {m.common.actions.cancel}
                      </GlassButton>
                      <GlassButton
                        type="submit"
                        size="sm"
                        className="primary-button"
                        disabled={status !== "ready"}
                        icon={<Plus size={14} strokeWidth={1.8} />}
                        {...material.base}
                      >
                        {m.common.actions.add}
                      </GlassButton>
                    </div>
                  </form>
                )}

              {status === "unsupported" && (
                <div className="popup-empty">
                  <span className="popup-empty-icon">
                    <Globe size={19} strokeWidth={1.5} />
                  </span>
                  <strong>{m.popup.unsupported.title}</strong>
                  <p>{m.popup.unsupported.body}</p>
                  <GlassButton
                    size="sm"
                    className="text-glass-button"
                    onClick={() => window.close()}
                    {...material.base}
                  >
                    {m.common.actions.close}
                  </GlassButton>
                </div>
              )}

              {status === "saved" && (
                <div className="popup-empty">
                  <span className="popup-empty-icon is-done">
                    <Check size={19} strokeWidth={1.8} />
                  </span>
                  <strong>{m.popup.saved.title}</strong>
                  <p>{m.popup.saved.body}</p>
                </div>
              )}

              <div className="popup-footer">
                <GlassButton
                  type="button"
                  size="sm"
                  className="text-glass-button"
                  icon={<ArrowRight size={14} strokeWidth={1.8} />}
                  onClick={() => void jumpToExtensionPage()}
                  {...material.base}
                >
                  {m.popup.actions.goToNewTab}
                </GlassButton>
              </div>
            </GlassLightGroup>
          </GlassSurface>
        </div>
      </GlassMaterialProvider>
    </GlassProvider>
  );
}
