import { X } from "lucide-react";

/**
 * Clear affordance for `GlassInput`'s `trailing` slot — the placement the kit
 * documents ("content after the field, e.g. a clear button"). The kit already
 * resets buttons inside `.ngs-input-affix`, so this only adds the look and the
 * behaviour. The trailing affix is not `aria-hidden` (unlike the leading one),
 * so the label reaches assistive tech.
 */
export function ClearButton({
  label,
  onClear,
  disabled,
}: {
  label: string;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="field-clear"
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        // Grab the field before clearing: the button unmounts with the value.
        const field = event.currentTarget
          .closest(".ngs-input")
          ?.querySelector("input");
        onClear();
        field?.focus();
      }}
    >
      <X size={15} strokeWidth={1.9} />
    </button>
  );
}
