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
  Cloud,
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
import { artworkOf, t } from "../lib/i18n";
import { privacyUrl } from "../lib/urls";
import { Modal } from "./Modal";
import { SearchEngineSettings } from "./SearchEngineSettings";
import { NutstoreSync, type NutstoreSyncProps } from "./NutstoreSync";
import { useGlassMaterial } from "../lib/glass";

export type SettingsTab = "appearance" | "features" | "sync" | "about";
export function Settings({
  settings,
  customUrl,
  initialTab,
  onClose,
  onChange,
  onUpload,
  onExport,
  onImport,
  nutstore,
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
  nutstore: NutstoreSyncProps;
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
  const m = t();
  async function run(action: () => Promise<void>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.settings.panel.errors.action);
    } finally {
      setBusy(false);
    }
  }
  function change(patch: AppSettingsPatch) {
    setError("");
    void onChange(patch).catch((e) =>
      setError(e instanceof Error ? e.message : m.settings.panel.errors.save),
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
  const caption = art ? artworkOf(art.id) : undefined;
  return (
    <Modal
      label={m.settings.panel.title}
      wide
      onClose={() => {
        if (!busy) onClose();
      }}
      head={
        <GlassSegmentedControl
          className="settings-tabs"
          size="sm"
          cornerRadius={26}
          aria-label={m.settings.panel.tabsAria}
          value={tab}
          onChange={(key) => setTab(key as SettingsTab)}
          onKeyDown={(e) => {
            const ids: SettingsTab[] = [
              "appearance",
              "features",
              "sync",
              "about",
            ];
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
            {
              key: "appearance",
              label: m.settings.panel.tabs.appearance,
              icon: <Images size={15} />,
            },
            {
              key: "features",
              label: m.settings.panel.tabs.features,
              icon: <Palette size={15} />,
            },
            {
              key: "sync",
              label: m.settings.panel.tabs.sync,
              icon: <Cloud size={15} />,
            },
            {
              key: "about",
              label: m.settings.panel.tabs.about,
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
              ? m.settings.panel.status.busy
              : saving
                ? m.settings.panel.status.saving
                : m.settings.panel.status.autoSave}
          </span>
          <GlassButton
            size="sm"
            className="text-glass-button"
            disabled={busy}
            onClick={onClose}
            {...base}
          >
            {m.common.actions.done}
          </GlassButton>
        </>
      }
    >
      <div className="settings-content" id={`panel-${tab}`}>
        <GlassLightGroup>
          <fieldset disabled={busy}>
            {tab === "appearance" && (
              <>
                <div className="section-heading">
                  <h3>{m.settings.appearance.heading.title}</h3>
                  <span>{m.settings.appearance.heading.note}</span>
                </div>
                <GlassSegmentedControl
                  className="wallpaper-picker"
                  cornerRadius={26}
                  aria-label={m.settings.appearance.wallpaperAria}
                  value={settings.wallpaper}
                  onChange={select}
                  items={[
                    ...ARTWORKS.map((a) => ({
                      key: a.id,
                      label: (
                        <span className="wallpaper-slot-label">
                          {artworkOf(a.id).shortTitle}
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
                                {m.settings.appearance.customSlot}
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
                  {art && caption ? (
                    <>
                      <span>
                        {caption.title} · {caption.artistShort} · {art.year}
                      </span>
                      <a href={art.source} target="_blank" rel="noreferrer">
                        {m.common.source.viewCollectionWithArrow}
                      </a>
                    </>
                  ) : (
                    <>
                      <span>{settings.customWallpaper?.name}</span>
                      <span>{m.settings.appearance.customSavedLocally}</span>
                    </>
                  )}
                </p>
                <div className="setting-row">
                  <div>
                    <label>{m.settings.appearance.customSlot}</label>
                    <p>{m.settings.appearance.upload.hint}</p>
                  </div>
                  <GlassButton
                    size="sm"
                    icon={<ImagePlus size={14} strokeWidth={1.6} />}
                    onClick={() => uploadRef.current?.click()}
                    {...base}
                  >
                    {settings.customWallpaper
                      ? m.settings.appearance.upload.replace
                      : m.settings.appearance.upload.upload}
                  </GlassButton>
                </div>
                <input
                  ref={uploadRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  aria-label={m.settings.appearance.upload.aria}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void run(
                        () => onUpload(file),
                        m.settings.appearance.upload.success,
                      );
                  }}
                />
                <div className="setting-row">
                  <div>
                    <label>{m.settings.appearance.fit.title}</label>
                    <p>{m.settings.appearance.fit.hint}</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label={m.settings.appearance.fit.title}
                    value={settings.fit}
                    onChange={(value) =>
                      change({ fit: value as AppSettings["fit"] })
                    }
                    items={[
                      {
                        key: "cover",
                        label: m.settings.appearance.fit.cover,
                      },
                      {
                        key: "contain",
                        label: m.settings.appearance.fit.contain,
                      },
                    ]}
                    {...base}
                  />
                </div>
                <div className="field-grid">
                  <Range
                    label={m.settings.appearance.position.x}
                    value={settings.positionX}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(positionX) => change({ positionX })}
                  />
                  <Range
                    label={m.settings.appearance.position.y}
                    value={settings.positionY}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(positionY) => change({ positionY })}
                  />
                </div>
                <div className="field-grid">
                  <Range
                    label={m.settings.appearance.wallpaperStyle.brightness}
                    value={settings.brightness}
                    min={35}
                    max={120}
                    unit="%"
                    onChange={(brightness) => change({ brightness })}
                  />
                  <Range
                    label={m.settings.appearance.wallpaperStyle.blur}
                    value={settings.blur}
                    min={0}
                    max={20}
                    unit="px"
                    onChange={(blur) => change({ blur })}
                  />
                </div>
                <p className="artwork-source">
                  <Info size={13} />
                  {caption
                    ? `${caption.museum} · ${m.common.source.publicDomainImage}`
                    : m.settings.appearance.customOnly}
                </p>
                <div className="section-heading">
                  <h3>{m.settings.appearance.optics.title}</h3>
                  <span>{m.settings.appearance.optics.note}</span>
                </div>
                <div className="setting-row">
                  <div>
                    <label>{m.settings.appearance.glassMode.title}</label>
                    <p>{m.settings.appearance.glassMode.hint}</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label={m.settings.appearance.glassMode.title}
                    value={settings.glassMode}
                    onChange={(value) =>
                      change({ glassMode: value as AppSettings["glassMode"] })
                    }
                    items={[
                      {
                        key: "auto",
                        label: m.settings.appearance.glassMode.auto,
                      },
                      {
                        key: "light",
                        label: m.settings.appearance.glassMode.light,
                      },
                      {
                        key: "dark",
                        label: m.settings.appearance.glassMode.dark,
                      },
                    ]}
                    {...base}
                  />
                </div>
                <div className="setting-row">
                  <div>
                    <label>{m.settings.appearance.quality.title}</label>
                    <p>{m.settings.appearance.quality.hint}</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label={m.settings.appearance.quality.title}
                    value={settings.quality}
                    onChange={(value) =>
                      change({ quality: value as AppSettings["quality"] })
                    }
                    items={[
                      {
                        key: "low",
                        label: m.settings.appearance.quality.low,
                      },
                      {
                        key: "high",
                        label: m.settings.appearance.quality.high,
                      },
                    ]}
                    {...base}
                  />
                </div>
                <div className="optics-heading">
                  <div>
                    <h3>{m.settings.appearance.glassParams.title}</h3>
                    <p>{m.settings.appearance.glassParams.note}</p>
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
                    {m.settings.appearance.glassParams.reset}
                  </GlassButton>
                </div>
                <div className="field-grid">
                  <Range
                    label={m.settings.appearance.glassParams.blur}
                    value={settings.glass.blur}
                    min={0}
                    max={64}
                    step={1}
                    format={(value) => `${value}px`}
                    onChange={(value) => changeGlass("blur", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.saturation}
                    value={settings.glass.saturation}
                    min={0}
                    max={300}
                    step={1}
                    format={(value) => `${value}%`}
                    onChange={(value) => changeGlass("saturation", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.brightness}
                    value={settings.glass.brightness}
                    min={0}
                    max={2}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("brightness", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.mapScale}
                    value={settings.glass.mapScale}
                    min={0.1}
                    max={0.5}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("mapScale", value)}
                  />
                </div>
                <div className="optics-subheading">
                  <span>{m.settings.appearance.glassParams.refraction}</span>
                  <small>
                    {m.settings.appearance.glassParams.mapScaleNote}
                  </small>
                </div>
                <div className="field-grid">
                  <Range
                    label={m.settings.appearance.glassParams.depth}
                    value={settings.glass.depth}
                    min={0}
                    max={40}
                    step={1}
                    format={(value) => `${value}px`}
                    onChange={(value) => changeGlass("depth", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.curvature}
                    value={settings.glass.curvature}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("curvature", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.dispersion}
                    value={settings.glass.dispersion}
                    min={0}
                    max={1}
                    step={0.01}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("dispersion", value)}
                  />
                </div>
                <div className="optics-subheading">
                  <span>{m.settings.appearance.glassParams.interaction}</span>
                  <small>
                    {m.settings.appearance.glassParams.interactionNote}
                  </small>
                </div>
                <div className="field-grid">
                  <Range
                    label={m.settings.appearance.glassParams.highlight}
                    value={settings.glass.highlight}
                    min={0}
                    max={2}
                    step={0.05}
                    format={(value) => `${Math.round(value * 100)}%`}
                    onChange={(value) => changeGlass("highlight", value)}
                  />
                  <Range
                    label={m.settings.appearance.glassParams.elasticity}
                    value={settings.glass.elasticity}
                    min={0}
                    max={0.5}
                    step={0.01}
                    format={(value) => value.toFixed(2)}
                    onChange={(value) => changeGlass("elasticity", value)}
                  />
                </div>
                <GlassSurface
                  className="settings-note"
                  cornerRadius={26}
                  {...base}
                >
                  {m.settings.appearance.glassParams.environmentNote}
                </GlassSurface>
              </>
            )}
            {tab === "features" && (
              <>
                <div className="setting-row">
                  <div>
                    <label>{m.settings.features.clockFormat.title}</label>
                    <p>{m.settings.features.clockFormat.hint}</p>
                  </div>
                  <GlassSegmentedControl
                    size="sm"
                    aria-label={m.settings.features.clockFormat.title}
                    value={settings.clockFormat}
                    onChange={(value) =>
                      change({
                        clockFormat: value as AppSettings["clockFormat"],
                      })
                    }
                    items={[
                      {
                        key: "24",
                        label: m.settings.features.clockFormat.h24,
                      },
                      {
                        key: "12",
                        label: m.settings.features.clockFormat.h12,
                      },
                    ]}
                    {...base}
                  />
                </div>
                <div className="clock-tint-control">
                  <Range
                    label={m.settings.features.clockTint}
                    value={settings.clockTintStrength * 100}
                    min={0}
                    max={100}
                    step={1}
                    format={(value) => `${value}%`}
                    onChange={(value) =>
                      change({ clockTintStrength: value / 100 })
                    }
                  />
                </div>
                <div className="optics-subheading">
                  <span>{m.settings.features.searchEngines.title}</span>
                  <small>{m.settings.features.searchEngines.note}</small>
                </div>
                <SearchEngineSettings
                  settings={settings}
                  onChange={onChange}
                  busy={busy}
                />
              </>
            )}
            {tab === "sync" && <NutstoreSync {...nutstore} />}
            {tab === "about" && (
              <>
                <div className="section-heading">
                  <h3>{m.settings.about.heading.title}</h3>
                  <span>{m.settings.about.heading.note}</span>
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
                    <strong>{m.settings.about.export.title}</strong>
                    <p>{m.settings.about.export.description}</p>
                  </div>
                  <GlassButton
                    size="sm"
                    onClick={() =>
                      void run(onExport, m.settings.about.export.success)
                    }
                    {...base}
                  >
                    {m.settings.about.export.button}
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
                    <strong>{m.settings.about.import.title}</strong>
                    <p>{m.settings.about.import.description}</p>
                  </div>
                  <GlassButton
                    size="sm"
                    onClick={() => importRef.current?.click()}
                    {...base}
                  >
                    {m.settings.about.import.button}
                  </GlassButton>
                </GlassSurface>
                <input
                  ref={importRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  aria-label={m.settings.about.import.aria}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file)
                      void run(async () => {
                        if (file.size > MAX_BACKUP_BYTES)
                          throw new Error(m.settings.about.import.tooLarge);
                        setPendingBackup(parseBackup(await file.text()));
                      });
                  }}
                />
                {pendingBackup && (
                  <GlassSurface
                    className="import-confirm"
                    role="region"
                    aria-label={m.settings.about.import.confirmAria}
                    cornerRadius={26}
                    {...base}
                  >
                    <strong>{m.settings.about.import.confirmTitle}</strong>
                    <p>
                      {m.settings.about.import.summary(
                        pendingBackup.state.shortcuts.length,
                        Boolean(pendingBackup.wallpaper),
                      )}
                    </p>
                    <div className="button-pair">
                      <GlassButton
                        size="sm"
                        className="text-glass-button"
                        onClick={() => setPendingBackup(null)}
                        {...base}
                      >
                        {m.common.actions.cancel}
                      </GlassButton>
                      <GlassButton
                        className="primary-button"
                        onClick={() =>
                          void run(async () => {
                            await onImport(pendingBackup);
                            setPendingBackup(null);
                          }, m.settings.about.import.success)
                        }
                        {...base}
                      >
                        {m.settings.about.import.confirm}
                      </GlassButton>
                    </div>
                  </GlassSurface>
                )}
                <GlassSurface
                  className="settings-note"
                  cornerRadius={26}
                  {...base}
                >
                  {m.settings.about.privacyNote}
                </GlassSurface>
                <div className="about-line">
                  <span className="mini-wordmark">nico.</span>
                  <span>{m.settings.about.version}</span>
                  <a
                    href="THIRD_PARTY_NOTICES.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {m.settings.about.thirdPartyNotices}
                  </a>
                </div>
                <div className="about-line">
                  <a href={privacyUrl()} target="_blank" rel="noreferrer">
                    {m.settings.about.privacyPolicy}
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
