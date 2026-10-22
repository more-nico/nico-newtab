import { useRef, useState } from "react";
import { GlassAlert, GlassButton, GlassInput, GlassSurface } from "nico-glass-kit";
import { useGlassMaterial } from "../lib/glass";
import { t } from "../lib/i18n";
import { ClearButton } from "./ClearButton";

/**
 * The naming form shared by the page dialog and the plain name dialog:
 * one field, one trim rule, one clear button, one busy state.
 */

/** The name field plus the state that goes with it. */
export interface NameForm {
  /** The raw text in the field. */
  name: string;
  setName: (next: string) => void;
  /** True while a save is running. */
  busy: boolean;
  /** The message shown under the field, if any. */
  error: string;
  /** The trimmed name, or null when the name is missing. */
  validate: () => string | null;
  /** Runs a save; a failure becomes the message the dialog shows. */
  save: (task: () => Promise<void>) => Promise<boolean>;
}

/**
 * Holds the name, the validation rule and the save state of a naming form.
 * The name is required unless the dialog hides the field (the icon-only
 * page dialog).
 */
export function useNameForm({
  initial,
  required = true,
}: {
  /** The name the field starts with. */
  initial: string;
  /** false when the dialog hides the name field. */
  required?: boolean;
}): NameForm {
  const m = t();
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** True while a save runs, so a second one cannot start beside it. */
  const saving = useRef(false);

  function validate(): string | null {
    const value = name.trim();
    if (required && !value) {
      setError(m.editor.errors.nameRequired);
      return null;
    }
    setError("");
    return value;
  }

  async function save(task: () => Promise<void>): Promise<boolean> {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : m.editor.errors.save);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return { name, setName, busy, error, validate, save };
}

/** The name input: a label, the field and the button that empties it. */
export function NameField({
  id,
  label,
  placeholder,
  maxLength,
  value,
  onChange,
  error,
  disabled,
}: {
  /** The id of the field, so the label points at it. */
  id: string;
  label: string;
  placeholder: string;
  /** The longest name the dialog accepts. */
  maxLength: number;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const { base } = useGlassMaterial();
  const m = t();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <GlassInput
        id={id}
        data-initial-focus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        invalid={Boolean(error)}
        disabled={disabled}
        trailing={
          value ? (
            <ClearButton
              label={m.common.actions.clear}
              onClear={() => onChange("")}
              disabled={disabled}
            />
          ) : undefined
        }
        {...base}
      />
    </>
  );
}

/** The reason a save was refused, shown under the form. */
export function FormError({ message }: { message?: string }) {
  const { base } = useGlassMaterial();
  if (!message) return null;
  return (
    <GlassAlert tone="danger" role="alert" {...base}>
      {message}
    </GlassAlert>
  );
}

/** The glass title block a dialog shows above its body. */
export function DialogTitle({ title }: { title: string }) {
  const { panel } = useGlassMaterial();
  return (
    <GlassSurface className="dialog-head" cornerRadius={26} {...panel}>
      <span className="dialog-title">{title}</span>
    </GlassSurface>
  );
}

/**
 * The action row of a naming form. The save button lives outside the form,
 * so it points at it by id. `disabled` blocks the save for a reason of its
 * own — a picture that is still uploading, say — while cancel stays
 * available unless a save is running.
 */
export function FormActions({
  formId,
  busy,
  disabled,
  onCancel,
}: {
  /** The id of the form the save button submits. */
  formId: string;
  busy?: boolean;
  /** Another reason not to save yet. */
  disabled?: boolean;
  onCancel: () => void;
}) {
  const { base } = useGlassMaterial();
  const m = t();
  return (
    <div className="button-pair push-right">
      <GlassButton
        type="button"
        size="sm"
        className="text-glass-button"
        disabled={busy}
        onClick={onCancel}
        {...base}
      >
        {m.common.actions.cancel}
      </GlassButton>
      <GlassButton
        type="submit"
        form={formId}
        className="primary-button"
        disabled={busy || disabled}
        {...base}
      >
        {busy ? m.common.actions.saving : m.common.actions.save}
      </GlassButton>
    </div>
  );
}
