import { useRef, useState } from "react";
import { GlassButton, GlassInput } from "nico-glass-kit";
import { ImagePlus, Trash2 } from "lucide-react";
import type { DesktopPage, PageIcon } from "../types";
import {
  MAX_PAGE_ICON_EMOJI,
  PAGE_ICON_SUGGESTIONS,
  normalizePageEmoji,
  pageIconLetter,
} from "../lib/pageIcon";
import { optimizeIcon } from "../lib/images";
import { t } from "../lib/i18n";
import { useGlassMaterial } from "../lib/glass";

/**
 * The icon a page shows in the dock. It is an abbreviation of the page, so
 * the name itself always stays available as text: the dock label on hover
 * and the button's accessible name.
 *
 * A page without an icon of its own falls back to the first letter of its
 * name, which is what the dock has always shown.
 */
export function PageIconBadge({
  page,
}: {
  page: Pick<DesktopPage, "name" | "icon">;
}) {
  if (page.icon?.kind === "emoji")
    return (
      <span className="page-icon-emoji" aria-hidden="true">
        {page.icon.value}
      </span>
    );
  if (page.icon?.kind === "image")
    return (
      <img
        className="page-icon-image"
        src={page.icon.dataUrl}
        alt=""
        draggable={false}
      />
    );
  return (
    <span className="page-icon-letter" aria-hidden="true">
      {pageIconLetter(page.name)}
    </span>
  );
}

/**
 * The editor for a page's dock icon: an emoji field, a one-tap palette and an
 * upload for a picture. The picker never decides on its own what is stored —
 * it hands the choice up, so the dialog owns saving.
 *
 * The emoji field accepts one emoji grapheme. Invalid text keeps the last
 * valid choice instead of silently dropping the icon, and the field is marked
 * invalid so the dialog's native form validation refuses to save it. The
 * inline message is localized, so the reason is visible rather than a save
 * that quietly falls back to the page name's first letter.
 */
export function PageIconPicker({
  value,
  name,
  onChange,
  disabled = false,
  onBusyChange,
}: {
  /** The icon in effect; null means "use the page name's first letter". */
  value: PageIcon | null;
  /** The page name, used for the letter fallback in the preview. */
  name: string;
  onChange: (next: PageIcon | null) => void;
  /** The dialog is busy: every control of the picker is frozen. */
  disabled?: boolean;
  /** Reports the picker's own busy state, e.g. while a picture is optimized. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const m = t();
  const d = m.app.desktop;
  const { base } = useGlassMaterial();
  const fileInput = useRef<HTMLInputElement>(null);
  const fields = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(value?.kind === "emoji" ? value.value : "");
  const [busy, setBusy] = useState(false);
  const [emojiError, setEmojiError] = useState("");
  const [fileError, setFileError] = useState("");
  /** The picker is frozen while it works or while the dialog saves. */
  const locked = busy || disabled;

  /** The visible GlassInput's native field, for custom validity on save. */
  function emojiField(): HTMLInputElement | null {
    return (
      fields.current?.querySelector<HTMLInputElement>("#page-icon-emoji") ??
      null
    );
  }

  function clearEmojiError() {
    setEmojiError("");
    emojiField()?.setCustomValidity("");
  }

  function showEmojiError(message: string, input: HTMLInputElement) {
    setEmojiError(message);
    input.setCustomValidity(message);
  }

  async function pickImage(file: File) {
    setBusy(true);
    onBusyChange?.(true);
    setFileError("");
    try {
      const dataUrl = await optimizeIcon(file);
      setText("");
      clearEmojiError();
      onChange({ kind: "image", dataUrl });
    } catch (e) {
      setFileError(e instanceof Error ? e.message : m.editor.errors.icon);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function typeEmoji(raw: string, input: HTMLInputElement) {
    setText(raw);
    const emoji = normalizePageEmoji(raw);
    if (!raw.trim()) {
      clearEmojiError();
      if (value?.kind === "emoji") onChange(null);
      return;
    }
    if (emoji) {
      clearEmojiError();
      onChange({ kind: "emoji", value: emoji });
      return;
    }
    showEmojiError(d.pageIconEmojiInvalid, input);
  }

  function chooseEmoji(emoji: string) {
    setText(emoji);
    setFileError("");
    clearEmojiError();
    onChange({ kind: "emoji", value: emoji });
  }

  return (
    <div className="page-icon-editor">
      <span className="page-icon-preview" aria-hidden="true">
        <PageIconBadge page={{ name, icon: value ?? undefined }} />
      </span>
      <div className="page-icon-fields" ref={fields}>
        <label htmlFor="page-icon-emoji">{d.pageIconEmojiLabel}</label>
        <GlassInput
          id="page-icon-emoji"
          data-initial-focus
          value={text}
          maxLength={MAX_PAGE_ICON_EMOJI * 2}
          placeholder={d.pageIconEmojiPlaceholder}
          disabled={locked}
          invalid={Boolean(emojiError)}
          aria-describedby={emojiError ? "page-icon-emoji-error" : undefined}
          onChange={(event) => typeEmoji(event.target.value, event.target)}
          {...base}
        />
        <div
          className="page-icon-suggestions"
          role="group"
          aria-label={d.pageIconSuggestions}
        >
          {PAGE_ICON_SUGGESTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="page-icon-suggestion"
              aria-label={emoji}
              disabled={locked}
              onClick={() => chooseEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="button-pair">
          <GlassButton
            type="button"
            size="sm"
            className="text-glass-button"
            disabled={locked || !value}
            onClick={() => {
              setText("");
              setFileError("");
              clearEmojiError();
              onChange(null);
            }}
            icon={<Trash2 size={14} />}
            {...base}
          >
            {d.pageIconRemove}
          </GlassButton>
          <GlassButton
            type="button"
            size="sm"
            disabled={locked}
            onClick={() => fileInput.current?.click()}
            icon={<ImagePlus size={14} />}
            {...base}
          >
            {d.pageIconUpload}
          </GlassButton>
          <input
            ref={fileInput}
            id="page-icon-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={locked}
            aria-label={d.pageIconUploadAria}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickImage(file);
            }}
          />
        </div>
        <p className="page-icon-hint">{d.pageIconHint}</p>
        {emojiError && (
          <p
            id="page-icon-emoji-error"
            className="page-icon-error"
            role="alert"
          >
            {emojiError}
          </p>
        )}
        {fileError && (
          <p className="page-icon-error" role="alert">
            {fileError}
          </p>
        )}
      </div>
    </div>
  );
}
