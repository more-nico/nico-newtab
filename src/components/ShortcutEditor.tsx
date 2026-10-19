import { useRef, useState, type FormEvent } from "react";
import {
  GlassAlert,
  GlassButton,
  GlassInput,
  GlassLightGroup,
  GlassSurface,
} from "nico-glass-kit";
import { ArrowDown, ArrowUp, Link, Trash2 } from "lucide-react";
import type { Shortcut } from "../types";
import { optimizeIcon } from "../lib/images";
import { normalizeUrl } from "../lib/validation";
import { t } from "../lib/i18n";
import { ClearButton } from "./ClearButton";
import { Modal } from "./Modal";
import { useGlassMaterial } from "../lib/glass";

export function ShortcutEditor({
  shortcut,
  index,
  total,
  onClose,
  onSave,
  onRemove,
  onMove,
}: {
  shortcut?: Shortcut;
  index: number;
  total: number;
  onClose: () => void;
  onSave: (name: string, url: string, iconDataUrl: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onMove: (offset: number) => Promise<void>;
}) {
  const [name, setName] = useState(shortcut?.name ?? "");
  const [url, setUrl] = useState(shortcut?.url ?? "");
  const [icon, setIcon] = useState(shortcut?.iconDataUrl ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const iconInput = useRef<HTMLInputElement>(null);
  const { base, panel } = useGlassMaterial();
  const m = t();
  async function run(action: () => Promise<void>, close = true) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.editor.errors.save);
    } finally {
      setBusy(false);
    }
  }
  async function pickIcon(file: File) {
    setBusy(true);
    setError("");
    try {
      setIcon(await optimizeIcon(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : m.editor.errors.icon);
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(m.editor.errors.nameRequired);
      return;
    }
    void run(async () => onSave(name.trim(), normalizeUrl(url), icon));
  }
  const title = shortcut ? m.editor.titles.edit : m.editor.titles.add;
  return (
    <Modal
      label={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      head={
        <GlassSurface className="dialog-head" cornerRadius={26} {...panel}>
          <span className="dialog-title">{title}</span>
        </GlassSurface>
      }
      foot={
        <>
          {shortcut && (
            <GlassButton
              type="button"
              size="sm"
              className="danger"
              disabled={busy}
              onClick={() =>
                confirmDelete ? void run(onRemove) : setConfirmDelete(true)
              }
              icon={<Trash2 size={15} />}
              {...base}
            >
              {confirmDelete ? m.editor.remove : m.common.actions.remove}
            </GlassButton>
          )}
          <div className="button-pair push-right">
            <GlassButton
              type="button"
              size="sm"
              className="text-glass-button"
              onClick={onClose}
              disabled={busy}
              {...base}
            >
              {m.common.actions.cancel}
            </GlassButton>
            <GlassButton
              type="submit"
              form="shortcut-form"
              className="primary-button"
              disabled={busy}
              {...base}
            >
              {busy ? m.common.actions.saving : m.editor.save}
            </GlassButton>
          </div>
        </>
      }
    >
      <p className="dialog-description">{m.editor.description}</p>
      <form id="shortcut-form" onSubmit={submit} className="shortcut-form">
        <GlassLightGroup>
          <label htmlFor="shortcut-name">{m.editor.name.label}</label>
          <GlassInput
            id="shortcut-name"
            data-initial-focus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder={m.editor.name.placeholder}
            invalid={Boolean(error)}
            disabled={busy}
            trailing={
              name ? (
                <ClearButton
                  label={m.editor.name.clearAria}
                  onClear={() => setName("")}
                />
              ) : undefined
            }
            {...base}
          />
          <label htmlFor="shortcut-url">{m.editor.url.label}</label>
          <GlassInput
            id="shortcut-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2048}
            placeholder={m.editor.url.placeholder}
            leading={<Link size={16} />}
            invalid={Boolean(error)}
            disabled={busy}
            trailing={
              url ? (
                <ClearButton
                  label={m.editor.url.clearAria}
                  onClear={() => setUrl("")}
                />
              ) : undefined
            }
            {...base}
          />
          {shortcut && (
            <div className="editor-icon">
              <span className="editor-icon-preview">
                {icon ? (
                  <img src={icon} alt="" draggable={false} />
                ) : (
                  <span className="site-letter">
                    {Array.from(name || "?")[0]?.toUpperCase()}
                  </span>
                )}
              </span>
              <div className="editor-icon-text">
                <label htmlFor="shortcut-icon">{m.editor.icon.label}</label>
                <p>{m.editor.icon.hint}</p>
              </div>
              <div className="button-pair">
                {icon && (
                  <GlassButton
                    type="button"
                    size="sm"
                    className="text-glass-button"
                    disabled={busy}
                    onClick={() => setIcon("")}
                    {...base}
                  >
                    {m.editor.icon.restoreDefault}
                  </GlassButton>
                )}
                <GlassButton
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => iconInput.current?.click()}
                  {...base}
                >
                  {icon ? m.editor.icon.replace : m.editor.icon.upload}
                </GlassButton>
              </div>
              <input
                ref={iconInput}
                id="shortcut-icon"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                aria-label={m.editor.icon.uploadAria}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void pickIcon(file);
                }}
              />
            </div>
          )}
          {shortcut && (
            <div className="editor-order">
              <span>
                {m.editor.order.label}{" "}
                <b>
                  {index + 1} / {total}
                </b>
              </span>
              <div className="button-pair">
                <GlassButton
                  type="button"
                  variant="icon"
                  size="sm"
                  className="plain-icon"
                  aria-label={m.editor.order.moveUpAria}
                  disabled={busy || index <= 0}
                  onClick={() => void run(() => onMove(-1), false)}
                  icon={<ArrowUp size={17} />}
                  {...base}
                />
                <GlassButton
                  type="button"
                  variant="icon"
                  size="sm"
                  className="plain-icon"
                  aria-label={m.editor.order.moveDownAria}
                  disabled={busy || index >= total - 1}
                  onClick={() => void run(() => onMove(1), false)}
                  icon={<ArrowDown size={17} />}
                  {...base}
                />
              </div>
            </div>
          )}
          {error && (
            <GlassAlert tone="danger" role="alert" {...base}>
              {error}
            </GlassAlert>
          )}
          {confirmDelete && (
            <GlassAlert tone="warning" role="status" {...base}>
              {m.editor.confirmRemove(shortcut?.name ?? "")}
            </GlassAlert>
          )}
        </GlassLightGroup>
      </form>
    </Modal>
  );
}
