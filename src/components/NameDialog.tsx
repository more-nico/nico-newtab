import type { FormEvent } from "react";
import { GlassLightGroup } from "nico-glass-kit";
import { Modal } from "./Modal";
import {
  DialogTitle,
  FormActions,
  FormError,
  NameField,
  useNameForm,
} from "./NameForm";

/**
 * A dialog that asks for one name and nothing else — a new folder, a
 * renamed folder. The field, the trim rule, the clear button, the busy
 * state and the buttons come from the shared naming form.
 */
export function NameDialog({
  title,
  label,
  placeholder,
  initial,
  maxLength,
  onSubmit,
  onClose,
}: {
  title: string;
  /** The text of the label above the field. */
  label: string;
  /** The hint inside the empty field. */
  placeholder: string;
  /** The name the field starts with. */
  initial: string;
  /** The longest name the dialog accepts. */
  maxLength: number;
  /** Saves the name; the dialog closes when it resolves. */
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const form = useNameForm({ initial });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.busy) return;
    const value = form.validate();
    if (value === null) return;
    const saved = await form.save(() => onSubmit(value));
    if (saved) onClose();
  }

  return (
    <Modal
      label={title}
      onClose={() => {
        if (!form.busy) onClose();
      }}
      head={<DialogTitle title={title} />}
      foot={
        <FormActions
          formId="desktop-name-form"
          busy={form.busy}
          onCancel={onClose}
        />
      }
    >
      <form id="desktop-name-form" className="shortcut-form" onSubmit={submit}>
        <GlassLightGroup>
          <NameField
            id="desktop-name"
            label={label}
            placeholder={placeholder}
            maxLength={maxLength}
            value={form.name}
            onChange={form.setName}
            error={form.error}
            disabled={form.busy}
          />
          <FormError message={form.error} />
        </GlassLightGroup>
      </form>
    </Modal>
  );
}
