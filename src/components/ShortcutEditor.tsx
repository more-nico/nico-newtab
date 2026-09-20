import { useState, type FormEvent } from "react";
import {
  GlassAlert,
  GlassButton,
  GlassInput,
  GlassLightGroup,
  GlassSurface,
} from "nico-glass-kit";
import { ArrowDown, ArrowUp, Link, Trash2 } from "lucide-react";
import type { Shortcut } from "../types";
import { normalizeUrl } from "../lib/validation";
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
  onSave: (name: string, url: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onMove: (offset: number) => Promise<void>;
}) {
  const [name, setName] = useState(shortcut?.name ?? "");
  const [url, setUrl] = useState(shortcut?.url ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { base, panel } = useGlassMaterial();
  async function run(action: () => Promise<void>, close = true) {
    setBusy(true);
    setError("");
    try {
      await action();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("给这个网站取一个名字吧。");
      return;
    }
    void run(async () => onSave(name.trim(), normalizeUrl(url)));
  }
  const title = shortcut ? "编辑常用网站" : "添加常用网站";
  return (
    <Modal
      label={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      head={
        <GlassSurface className="dialog-head" cornerRadius={20} {...panel}>
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
              {confirmDelete ? "确认移除" : "移除"}
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
              取消
            </GlassButton>
            <GlassButton
              type="submit"
              form="shortcut-form"
              className="primary-button"
              disabled={busy}
              {...base}
            >
              {busy ? "保存中…" : "保存网站"}
            </GlassButton>
          </div>
        </>
      }
    >
      <p className="dialog-description">把喜欢的网站，放在触手可及的地方。</p>
      <form id="shortcut-form" onSubmit={submit} className="shortcut-form">
        <GlassLightGroup>
          <label htmlFor="shortcut-name">网站名称</label>
          <GlassInput
            id="shortcut-name"
            data-initial-focus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="例如：我的书房"
            invalid={Boolean(error)}
            disabled={busy}
            {...base}
          />
          <label htmlFor="shortcut-url">网站地址</label>
          <GlassInput
            id="shortcut-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={2048}
            placeholder="example.com"
            leading={<Link size={16} />}
            invalid={Boolean(error)}
            disabled={busy}
            {...base}
          />
          {shortcut && (
            <div className="editor-order">
              <span>
                排列位置{" "}
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
                  aria-label="向前移动"
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
                  aria-label="向后移动"
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
              确定移除“{shortcut?.name}”？
            </GlassAlert>
          )}
        </GlassLightGroup>
      </form>
    </Modal>
  );
}
