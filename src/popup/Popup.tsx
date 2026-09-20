import { useEffect, useState, type FormEvent } from "react";
import {
  GlassButton,
  GlassInput,
  GlassLightGroup,
  GlassProvider,
  GlassSurface,
} from "nico-glass-kit";
import { Check, Globe, LoaderCircle, Plus, TriangleAlert } from "lucide-react";
import { ARTWORKS, defaultState } from "../data";
import type { AppState } from "../types";
import { normalizeUrl } from "../lib/validation";
import { loadFavicon, repository } from "../lib/platform";
import { GlassMaterialProvider, useGlassMaterialValue } from "../lib/glass";

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
        setError("本地数据暂时读不出来，稍后再试。");
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
      setError("给这个网站取一个名字吧。");
      return;
    }
    setError("");
    try {
      const url = normalizeUrl(page.url);
      await repository.update((current) => {
        if (current.shortcuts.some((item) => item.url === url))
          throw new Error("这个网站已经在列表里了。");
        if (current.shortcuts.length >= MAX_SHORTCUTS)
          throw new Error(`最多可添加 ${MAX_SHORTCUTS} 个网站。`);
        current.shortcuts.push({ id: crypto.randomUUID(), name: value, url });
        return current;
      });
      setStatus("saved");
      window.setTimeout(() => window.close(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    }
  }

  const host = page ? new URL(page.url).hostname : "";

  return (
    <GlassProvider
      quality={reduced ? "low" : state.settings.quality}
      overLight="auto"
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
                  正在读取当前页面…
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
                      网站名称
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
                        ? "这个网站已经在常用网站里了。"
                        : status === "full"
                          ? `已经放满 ${MAX_SHORTCUTS} 个网站，先在新标签页里整理一下吧。`
                          : "添加到新标签页的常用网站。"}
                    </p>

                    <div className="popup-actions">
                      <GlassButton
                        type="button"
                        size="sm"
                        className="text-glass-button"
                        onClick={() => window.close()}
                        {...material.base}
                      >
                        取消
                      </GlassButton>
                      <GlassButton
                        type="submit"
                        size="sm"
                        className="primary-button"
                        disabled={status !== "ready"}
                        icon={<Plus size={14} strokeWidth={1.8} />}
                        {...material.base}
                      >
                        添加
                      </GlassButton>
                    </div>
                  </form>
                )}

              {status === "unsupported" && (
                <div className="popup-empty">
                  <span className="popup-empty-icon">
                    <Globe size={19} strokeWidth={1.5} />
                  </span>
                  <strong>这个页面不能添加</strong>
                  <p>
                    浏览器内部页面、扩展页面和本地文件都没有可访问的网址。切到普通网页再点一次图标吧。
                  </p>
                  <GlassButton
                    size="sm"
                    className="text-glass-button"
                    onClick={() => window.close()}
                    {...material.base}
                  >
                    关闭
                  </GlassButton>
                </div>
              )}

              {status === "saved" && (
                <div className="popup-empty">
                  <span className="popup-empty-icon is-done">
                    <Check size={19} strokeWidth={1.8} />
                  </span>
                  <strong>已添加到常用网站</strong>
                  <p>回到新标签页就能看到它了。</p>
                </div>
              )}
            </GlassLightGroup>
          </GlassSurface>
        </div>
      </GlassMaterialProvider>
    </GlassProvider>
  );
}
