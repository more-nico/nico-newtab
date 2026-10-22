import { useRef, useState, type FormEvent } from "react";
import { GlassLightGroup } from "nico-glass-kit";
import type { PageIcon } from "../types";
import { MAX_PAGE_NAME } from "../data";
import { t } from "../lib/i18n";
import { Modal } from "./Modal";
import { PageIconPicker } from "./PageIcon";
import {
  DialogTitle,
  FormActions,
  FormError,
  NameField,
  useNameForm,
} from "./NameForm";

/**
 * What the page dialog is opened for. The modes share one dialog so the
 * name field and the icon picker look and behave the same everywhere: a new
 * page gets both, a rename only touches the name, the icon mode only
 * touches the icon, and the settings mode changes both at once.
 */
export type PageDialogMode = "create" | "rename" | "icon" | "settings";

export function PageDialog({
  mode,
  title,
  initialName,
  initialIcon,
  onSubmit,
  onClose,
}: {
  mode: PageDialogMode;
  title: string;
  initialName: string;
  /** The icon in effect; null means "use the page name's first letter". */
  initialIcon: PageIcon | null;
  onSubmit: (value: {
    name: string;
    icon: PageIcon | null;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const showName = mode !== "icon";
  const showIcon = mode !== "rename";
  const m = t();
  // The icon-only mode has no name field, so the name cannot be missing.
  const form = useNameForm({ initial: initialName, required: showName });
  const [icon, setIcon] = useState<PageIcon | null>(initialIcon);
  /** The newest icon, so a save always takes the current one. */
  const iconRef = useRef(icon);
  /** The picker is optimizing a picture; saving would race it. */
  const [uploading, setUploading] = useState(false);
  const busy = form.busy;

  function changeIcon(next: PageIcon | null) {
    iconRef.current = next;
    setIcon(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || uploading) return;
    const value = form.validate();
    if (value === null) return;
    const saved = await form.save(() =>
      onSubmit({ name: value, icon: iconRef.current }),
    );
    if (saved) onClose();
  }

  return (
    <Modal
      label={title}
      onClose={() => {
        if (!busy) onClose();
      }}
      head={<DialogTitle title={title} />}
      foot={
        <FormActions
          formId="page-form"
          busy={busy}
          disabled={uploading}
          onCancel={onClose}
        />
      }
    >
      <form id="page-form" className="shortcut-form" onSubmit={submit}>
        <GlassLightGroup>
          {showName && (
            <NameField
              id="page-name"
              label={m.app.desktop.pageName}
              placeholder={m.app.desktop.pageNamePlaceholder}
              maxLength={MAX_PAGE_NAME}
              value={form.name}
              onChange={form.setName}
              error={form.error}
              disabled={busy}
            />
          )}
          {showIcon && (
            <PageIconPicker
              value={icon}
              name={form.name}
              onChange={changeIcon}
              disabled={busy}
              onBusyChange={setUploading}
            />
          )}
          <FormError message={form.error} />
        </GlassLightGroup>
      </form>
    </Modal>
  );
}
