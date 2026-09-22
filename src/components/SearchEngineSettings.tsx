import { useState, type FormEvent } from "react";
import {
  GlassAlert,
  GlassButton,
  GlassInput,
  GlassLightGroup,
  GlassSurface,
} from "nico-glass-kit";
import { Link, Plus } from "lucide-react";
import type { AppSettings, AppSettingsPatch, CustomEngine } from "../types";
import {
  DEFAULT_ENGINE_ID,
  MAX_CUSTOM_ENGINES,
  MAX_ENGINE_NAME,
  type ResolvedEngine,
} from "../lib/engines";
import { normalizeSearchTemplate } from "../lib/validation";
import { ClearButton } from "./ClearButton";
import { EngineIcon } from "./EngineIcon";
import { useGlassMaterial } from "../lib/glass";

const asEngine = (engine: CustomEngine): ResolvedEngine => ({
  id: engine.id,
  name: engine.name,
  urlTemplate: engine.urlTemplate,
  suggest: false,
  kind: "custom",
});

const hostOf = (urlTemplate: string) => {
  try {
    return new URL(urlTemplate).host;
  } catch {
    return urlTemplate;
  }
};

export function SearchEngineSettings({
  settings,
  onChange,
  busy,
}: {
  settings: AppSettings;
  onChange: (patch: AppSettingsPatch) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<{
    id: string | null;
    name: string;
    urlTemplate: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const { base } = useGlassMaterial();
  const engines = settings.customEngines;
  const atLimit = engines.length >= MAX_CUSTOM_ENGINES;
  const locked = busy || saving;

  async function commit(patch: AppSettingsPatch) {
    setSaving(true);
    setError("");
    try {
      await onChange(patch);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError("给这个搜索引擎取一个名字吧。");
    if (name.length > MAX_ENGINE_NAME)
      return setError(`名称最多 ${MAX_ENGINE_NAME} 个字符。`);
    if (draft.id === null && atLimit)
      return setError(`最多可添加 ${MAX_CUSTOM_ENGINES} 个自定义搜索引擎。`);
    if (
      engines.some((engine) => engine.name === name && engine.id !== draft.id)
    )
      return setError("已经有同名的搜索引擎了。");
    let urlTemplate: string;
    try {
      urlTemplate = normalizeSearchTemplate(draft.urlTemplate);
    } catch (e) {
      return setError(e instanceof Error ? e.message : "搜索地址不正确。");
    }
    const ok = await commit({
      customEngines: draft.id
        ? engines.map((engine) =>
            engine.id === draft.id ? { ...engine, name, urlTemplate } : engine,
          )
        : [...engines, { id: crypto.randomUUID(), name, urlTemplate }],
    });
    if (ok) setDraft(null);
  }

  async function remove(id: string) {
    const ok = await commit({
      customEngines: engines.filter((engine) => engine.id !== id),
      // Removing the engine in use falls back in the same write, so the picker
      // never points at something that no longer exists.
      ...(settings.searchEngine === id
        ? { searchEngine: DEFAULT_ENGINE_ID }
        : {}),
    });
    if (ok) setConfirmId(null);
  }

  return (
    <div className="engine-settings">
      {engines.length === 0 && !draft && (
        <p className="engine-empty">还没有自定义搜索引擎。</p>
      )}
      {engines.map((engine) => (
        <GlassSurface
          key={engine.id}
          className="engine-card"
          cornerRadius={22}
          {...base}
        >
          <span className="engine-card-icon">
            <EngineIcon engine={asEngine(engine)} size={19} />
          </span>
          <div className="engine-card-text">
            <strong>{engine.name}</strong>
            <small>{hostOf(engine.urlTemplate)}</small>
          </div>
          {confirmId === engine.id ? (
            <div className="button-pair">
              <GlassButton
                size="sm"
                className="text-glass-button"
                disabled={locked}
                onClick={() => setConfirmId(null)}
                {...base}
              >
                取消
              </GlassButton>
              <GlassButton
                size="sm"
                className="danger"
                disabled={locked}
                onClick={() => void remove(engine.id)}
                {...base}
              >
                {saving ? "移除中…" : "确认移除"}
              </GlassButton>
            </div>
          ) : (
            <div className="button-pair">
              <GlassButton
                size="sm"
                className="text-glass-button"
                disabled={locked}
                onClick={() => {
                  setError("");
                  setDraft({
                    id: engine.id,
                    name: engine.name,
                    urlTemplate: engine.urlTemplate,
                  });
                }}
                {...base}
              >
                编辑
              </GlassButton>
              <GlassButton
                size="sm"
                className="text-glass-button"
                disabled={locked}
                onClick={() => setConfirmId(engine.id)}
                {...base}
              >
                移除
              </GlassButton>
            </div>
          )}
        </GlassSurface>
      ))}
      {confirmId && (
        <GlassAlert
          className="engine-confirm"
          tone="warning"
          role="status"
          {...base}
        >
          确定移除“{engines.find((engine) => engine.id === confirmId)?.name}”？
          使用它的搜索栏会回到浏览器默认引擎。
        </GlassAlert>
      )}
      {draft ? (
        <GlassSurface className="engine-editor" cornerRadius={22} {...base}>
          <form
            className="engine-form"
            onSubmit={(event) => void submit(event)}
          >
            <GlassLightGroup>
              <label htmlFor="engine-name">名称</label>
              <GlassInput
                id="engine-name"
                value={draft.name}
                onChange={(e) =>
                  setDraft((current) =>
                    current ? { ...current, name: e.target.value } : current,
                  )
                }
                maxLength={MAX_ENGINE_NAME}
                placeholder="例如：知乎"
                invalid={Boolean(error)}
                disabled={locked}
                trailing={
                  draft.name ? (
                    <ClearButton
                      label="清空引擎名称"
                      onClear={() =>
                        setDraft((current) =>
                          current ? { ...current, name: "" } : current,
                        )
                      }
                    />
                  ) : undefined
                }
                {...base}
              />
              <label htmlFor="engine-url">搜索地址</label>
              <GlassInput
                id="engine-url"
                value={draft.urlTemplate}
                onChange={(e) =>
                  setDraft((current) =>
                    current
                      ? { ...current, urlTemplate: e.target.value }
                      : current,
                  )
                }
                maxLength={2048}
                placeholder="https://www.zhihu.com/search?q=%s"
                leading={<Link size={16} />}
                invalid={Boolean(error)}
                disabled={locked}
                trailing={
                  draft.urlTemplate ? (
                    <ClearButton
                      label="清空搜索地址"
                      onClear={() =>
                        setDraft((current) =>
                          current ? { ...current, urlTemplate: "" } : current,
                        )
                      }
                    />
                  ) : undefined
                }
                {...base}
              />
              <p className="engine-help">
                使用 %s 代表搜索关键词，仅支持 HTTP / HTTPS。
              </p>
              {error && (
                <GlassAlert tone="danger" role="alert" {...base}>
                  {error}
                </GlassAlert>
              )}
              <div className="button-pair">
                <GlassButton
                  type="button"
                  size="sm"
                  className="text-glass-button"
                  disabled={locked}
                  onClick={() => {
                    setDraft(null);
                    setError("");
                  }}
                  {...base}
                >
                  取消
                </GlassButton>
                <GlassButton
                  type="submit"
                  className="primary-button"
                  disabled={locked}
                  {...base}
                >
                  {saving ? "保存中…" : "保存引擎"}
                </GlassButton>
              </div>
            </GlassLightGroup>
          </form>
        </GlassSurface>
      ) : (
        <div className="engine-actions">
          {error && (
            <GlassAlert tone="danger" role="alert" {...base}>
              {error}
            </GlassAlert>
          )}
          <GlassButton
            size="sm"
            icon={<Plus size={15} />}
            disabled={locked || atLimit}
            onClick={() => {
              setError("");
              setConfirmId(null);
              setDraft({ id: null, name: "", urlTemplate: "" });
            }}
            {...base}
          >
            添加搜索引擎
          </GlassButton>
          {atLimit && (
            <span className="engine-limit">
              最多 {MAX_CUSTOM_ENGINES} 个自定义搜索引擎
            </span>
          )}
        </div>
      )}
    </div>
  );
}
