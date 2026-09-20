import { useRef, useState } from "react";
import {
  GlassAlert,
  GlassButton,
  GlassLightGroup,
  GlassSegmentedControl,
  GlassSlider,
  GlassSurface,
} from "nico-glass-kit";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCheck,
  ImagePlus,
  Images,
  Info,
  LoaderCircle,
  Palette,
  SlidersHorizontal,
} from "lucide-react";
import { ARTWORKS, DEFAULT_GLASS_SETTINGS } from "../data";
import type {
  AppSettings,
  AppSettingsPatch,
  BackupV1,
  GlassSettings,
} from "../types";
import { MAX_BACKUP_BYTES, parseBackup } from "../lib/validation";
import { Modal } from "./Modal";
import { useGlassMaterial } from "../lib/glass";

export type SettingsTab = "wallpaper" | "appearance" | "data";
export function Settings({
  settings,
  customUrl,
  initialTab,
  onClose,
  onChange,
  onUpload,
  onExport,
  onImport,
  saving,
}: {
  settings: AppSettings;
  customUrl: string | null;
  initialTab: SettingsTab;
  onClose: () => void;
  onChange: (patch: AppSettingsPatch) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  onExport: () => Promise<void>;
  onImport: (backup: BackupV1) => Promise<void>;
  saving: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingBackup, setPendingBackup] = useState<BackupV1 | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { base } = useGlassMaterial();
  async function run(action: () => Promise<void>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function change(patch: AppSettingsPatch) {
    setError("");
    void onChange(patch).catch((e) =>
      setError(e instanceof Error ? e.message : "设置保存失败。"),
    );
  }
  function changeGlass<K extends keyof GlassSettings>(
    key: K,
    value: GlassSettings[K],
  ) {
    change({ glass: { [key]: value } });
  }
  const select = (wallpaper: string) =>
    change({ wallpaper, positionX: 50, positionY: 50 });
  const art = ARTWORKS.find((a) => a.id === settings.wallpaper);
  return (
    <Modal
      label="设置"
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
      head={
        <GlassSegmentedControl
          className="settings-tabs"
          size="sm"
          cornerRadius={26}
          aria-label="设置分类"
          value={tab}
          onChange={(key) => setTab(key as SettingsTab)}
          onKeyDown={(e) => {
            const ids: SettingsTab[] = ["wallpaper", "appearance", "data"];
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            e.preventDefault();
            const next =
              ids[
                (ids.indexOf(tab) +
                  (e.key === "ArrowRight" ? 1 : ids.length - 1)) %
                  ids.length
              ];
            setTab(next);
            e.currentTarget
              .querySelectorAll<HTMLElement>(".ngs-segment")
              [ids.indexOf(next)]?.focus();
          }}
          items={[
            { key: "wallpaper", label: "壁纸", icon: <Images size={15} /> },
            { key: "appearance", label: "外观", icon: <Palette size={15} /> },
            {
              key: "data",
              label: "备份",
              icon: <SlidersHorizontal size={15} />,
            },
          ]}
          {...base}
        />
      }
      foot={
        <>
          <span className="settings-status">
            {busy || saving ? (
              <LoaderCircle size={13} className="spinning" />
            ) : (
              <CheckCheck size={14} />
            )}
            {busy
              ? "正在处理…"
              : saving
                ? "正在保存…"
                : "更改自动保存在此浏览器"}
          </span>
          <GlassButton
            size="sm"
            className="text-glass-button"
            disabled={busy}
            onClick={onClose}
            {...base}
          >
            完成
          </GlassButton>
        </>
      }
    >
      <div className="settings-content" id={`panel-${tab}`}>
        <GlassLightGroup>
          <fieldset disabled={busy}>
            {tab === "wallpaper" && (
              <>
                <div className="section-heading">
                  <h3>把艺术，留在日常</h3>
                  <span>馆藏 · 公有领域</span>
                </div>
                <GlassSegmentedControl
                  className="wallpaper-picker"
                  cornerRadius={26}
                  aria-label="选择壁纸"
                  value={settings.wallpaper}
                  onChange={select}
                  items={[
                    ...ARTWORKS.map((a) => ({
                      key: a.id,
                      label: (
                        <span className="wallpaper-slot-label">
                          {a.shortTitle}
                        </span>
                      ),
                      icon: (
                        <img
                          className="wallpaper-thumb"
                          src={a.thumbnail}
                          alt=""
                        />
                      ),
                    })),
                    ...(settings.customWallpaper
                      ? [
                          {
                            key: "custom",
                            label: (
                              <span className="wallpaper-slot-label">
                                我的图片
                              </span>
                            ),
                            icon: customUrl ? (
                              <img
                                className="wallpaper-thumb"
                                src={customUrl}
                                alt=""
                              />
                            ) : (
                              <span className="wallpaper-thumb wallpaper-thumb-empty" />
                            ),
                          },
                        ]
                      : []),
                  ]}
                  {...base}
                />
                <p className="setting-hint">
                  {art ? (
                    <>
                      <span>
                        {art.title} ·{" "}
                        {art.artist
                          .replace("克劳德 · ", "")
                          .replace("古斯塔夫 · ", "")}{" "}
                        · {art.year}
                      </span>
                      <a href={art.source} target="_blank" rel="noreferrer">
                        查看馆藏 ↗
                      </a>
                    </>
                  ) : (
                    <>
                      <span>{settings.customWallpaper?.name}</span>
                      <span>仅保存在当前浏览器</span>
                    </>
                  )}
                </p>
                <div className="setting-row">
                  <div>
                    <label>我的图片</label>
                    <p>JPG、PNG 或 WebP，最大 20 MB</p>
                  </div>
                  <GlassButton
                    size="sm"
                    icon={<ImagePlus size={14} strokeWidth={1.6} />}
                    onClick={() => uploadRef.current?.click()}
                    {...base}
                  >
                    {settings.customWallpaper ? "替换图片" : "上传图片"}
                  </GlassButton>
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  aria-label="上传壁纸文件"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void run(() => onUpload(file), "图片已保存到本地。");
                  }}
                />
                <div className="setting-row">
                  <div>
                    <label>画面适配</label>
                    <p>铺满屏幕，或保留完整画作</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label="画面适配"
                    value={settings.fit}
                    onChange={(value) =>
                      change({ fit: value as AppSettings["fit"] })
                    }
                    items={[
                      { key: "cover", label: "铺满" },
                      { key: "contain", label: "完整" },
                    ]}
                    {...base}
                  />
                </div>
                <div className="field-grid">
                  <Range
                    label="水平位置"
                    value={settings.positionX}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(positionX) => change({ positionX })}
                  />
                  <Range
                    label="垂直位置"
                    value={settings.positionY}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(positionY) => change({ positionY })}
                  />
                </div>
                <p className="artwork-source">
                  <Info size={13} />
                  {art
                    ? `${art.museum} · 公有领域图像`
                    : "你的图片仅保存在当前浏览器。"}
                </p>
              </>
            )}
            {tab === "appearance" && (
              <>
                <div className="section-heading">
                  <h3>找到舒服的光与影</h3>
                  <span>实时预览</span>
                </div>
                <div className="field-grid">
                  <Range
                    label="壁纸亮度"
                    value={settings.brightness}
                    min={35}
                    max={120}
                    unit="%"
                    onChange={(brightness) => change({ brightness })}
                  />
                  <Range
                    label="壁纸模糊"
                    value={settings.blur}
                    min={0}
                    max={20}
                    unit="px"
                    onChange={(blur) => change({ blur })}
                  />
                </div>
                <div className="optics-heading">
                  <div>
                    <h3>玻璃光学参数</h3>
                    <p>
                      参数范围、步进与默认值和 glass-kit playground 完全一致
                    </p>
                  </div>
                  <GlassButton
                    type="button"
                    size="sm"
                    className="text-glass-button"
                    disabled={
                      JSON.stringify(settings.glass) ===
                      JSON.stringify(DEFAULT_GLASS_SETTINGS)
                    }
                    onClick={() =>
                      change({ glass: { ...DEFAULT_GLASS_SETTINGS } })
                    }
                    {...base}
                  >
                    恢复 Playground 默认值
                  </GlassButton>
                </div>
                <div className="field-grid">
                  <Range
                    label="模糊 Blur"
                    value={settings.glass.blur}
                    min={0}
                    max={64}
                    step={1}
                    format={(value) => `${value}px`}
                    onChange={(value) => changeGlass("blur", value)}
                  />
                  <Range
                    label="饱和度 Saturation"
                    value={settings.glass.saturation}
                    min={0}
                    max={300}
                    step={1}
                    format={(value) => `${value}%`}
                    onChange={(value) => changeGlass("saturation", value)}
                  />
                  <Range
                    label="亮度 Brightness"
                    value={settings.glass.brightness}
                    min={0}
                    max={2}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("brightness", value)}
                  />
                  <Range
                    label="贴图精度 Map scale"
                    value={settings.glass.mapScale}
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("mapScale", value)}
                  />
                </div>
                <div className="optics-subheading">
                  <span>折射</span>
                  <small>贴图精度越高，边缘越清晰，也会增加渲染开销</small>
                </div>
                <div className="field-grid">
                  <Range
                    label="折射带 Depth"
                    value={settings.glass.depth}
                    min={0}
                    max={40}
                    step={1}
                    format={(value) => `${value}px`}
                    onChange={(value) => changeGlass("depth", value)}
                  />
                  <Range
                    label="曲率 Curvature"
                    value={settings.glass.curvature}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("curvature", value)}
                  />
                  <Range
                    label="色散 Dispersion"
                    value={settings.glass.dispersion}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("dispersion", value)}
                  />
                </div>
                <div className="optics-subheading">
                  <span>交互</span>
                  <small>色散和弹性仅在“细腻”玻璃档位生效</small>
                </div>
                <div className="field-grid">
                  <Range
                    label="高光 Highlight"
                    value={settings.glass.highlight}
                    min={0}
                    max={2}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("highlight", value)}
                  />
                  <Range
                    label="弹性 Elasticity"
                    value={settings.glass.elasticity}
                    min={0}
                    max={0.5}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("elasticity", value)}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <label>玻璃质感</label>
                    <p>轻盈只保留模糊与折射，细腻额外开启色散与弹性</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label="玻璃质感"
                    value={settings.quality}
                    onChange={(value) =>
                      change({ quality: value as AppSettings["quality"] })
                    }
                    items={[
                      { key: "low", label: "轻盈" },
                      { key: "high", label: "细腻" },
                    ]}
                    {...base}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <label>时间格式</label>
                    <p>使用设备的本地时间</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label="时间格式"
                    value={settings.clockFormat}
                    onChange={(value) =>
                      change({
                        clockFormat: value as AppSettings["clockFormat"],
                      })
                    }
                    items={[
                      { key: "24", label: "24 小时" },
                      { key: "12", label: "12 小时" },
                    ]}
                    {...base}
                  />
                </div>
                <GlassSurface
                  className="settings-note"
                  cornerRadius={26}
                  {...base}
                >
                  玻璃效果会根据浏览器能力自动适配。系统开启“减少动态效果”时，页面会减少动画。
                </GlassSurface>
              </>
            )}
            {tab === "data" && (
              <>
                <div className="section-heading">
                  <h3>把喜欢的，妥善收藏</h3>
                  <span>仅保存在本地</span>
                </div>
                <GlassSurface
                  className="backup-card"
                  cornerRadius={26}
                  {...base}
                >
                  <span className="backup-icon">
                    <ArrowDownToLine size={23} />
                  </span>
                  <div>
                    <strong>导出备份</strong>
                    <p>包含常用网站、全部设置和自定义壁纸。</p>
                  </div>
                  <GlassButton
                    size="sm"
                    onClick={() => void run(onExport, "备份文件已导出。")}
                    {...base}
                  >
                    导出
                  </GlassButton>
                </GlassSurface>
                <GlassSurface
                  className="backup-card"
                  cornerRadius={26}
                  {...base}
                >
                  <span className="backup-icon">
                    <ArrowUpFromLine size={23} />
                  </span>
                  <div>
                    <strong>从备份恢复</strong>
                    <p>导入 Nico 的 JSON 备份文件，最大 32 MB。</p>
                  </div>
                  <GlassButton
                    size="sm"
                    onClick={() => importRef.current?.click()}
                    {...base}
                  >
                    导入
                  </GlassButton>
                </GlassSurface>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  aria-label="导入备份文件"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void run(async () => {
                        if (file.size > MAX_BACKUP_BYTES)
                          throw new Error("备份文件最大支持 32 MB。");
                        setPendingBackup(parseBackup(await file.text()));
                      });
                  }}
                />
                {pendingBackup && (
                  <GlassSurface
                    className="import-confirm"
                    role="region"
                    aria-label="确认恢复备份"
                    cornerRadius={26}
                    {...base}
                  >
                    <strong>用这份备份替换当前内容？</strong>
                    <p>
                      将恢复 {pendingBackup.state.shortcuts.length}{" "}
                      个网站、全部外观设置
                      {pendingBackup.wallpaper
                        ? "和一张自定义壁纸"
                        : "；当前上传的壁纸将被移除"}
                      。建议先导出当前备份。
                    </p>
                    <div className="button-pair">
                      <GlassButton
                        size="sm"
                        className="text-glass-button"
                        onClick={() => setPendingBackup(null)}
                        {...base}
                      >
                        取消
                      </GlassButton>
                      <GlassButton
                        className="primary-button"
                        onClick={() =>
                          void run(async () => {
                            await onImport(pendingBackup);
                            setPendingBackup(null);
                          }, "备份已恢复。")
                        }
                        {...base}
                      >
                        确认替换并恢复
                      </GlassButton>
                    </div>
                  </GlassSurface>
                )}
                <GlassSurface
                  className="settings-note"
                  cornerRadius={26}
                  {...base}
                >
                  无需账号，不收集使用数据。卸载扩展会清除本地内容，请提前备份。
                </GlassSurface>
                <div className="about-line">
                  <span className="mini-wordmark">nico.</span>
                  <span>印象新标签页 · 1.0.0</span>
                  <a
                    href="THIRD_PARTY_NOTICES.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    素材与开源许可 ↗
                  </a>
                </div>
              </>
            )}
          </fieldset>
        </GlassLightGroup>
        {error && (
          <GlassAlert
            className="inline-feedback"
            tone="danger"
            role="alert"
            {...base}
          >
            {error}
          </GlassAlert>
        )}
        {notice && (
          <GlassAlert
            className="inline-feedback"
            tone="success"
            role="status"
            {...base}
          >
            {notice}
          </GlassAlert>
        )}
      </div>
    </Modal>
  );
}

function Range({
  label,
  value,
  min,
  max,
  unit = "",
  step = 1,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { base } = useGlassMaterial();
  return (
    <div className="range-setting">
      <div>
        <label>{label}</label>
        <output>
          {format ? format(value) : value}
          {!format && <span>{unit}</span>}
        </output>
      </div>
      <GlassSlider
        size="sm"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        {...base}
      />
    </div>
  );
}
