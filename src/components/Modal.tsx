import { useEffect, useRef, type ReactNode } from "react";
import { GlassModal } from "nico-glass-kit";
import { useGlassMaterial } from "../lib/glass";

export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const { panel } = useGlassMaterial();
  // Capture during render, before GlassModal's own effect focuses its overlay.
  const returnFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const previous = returnFocus.current;
    const panel = host.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (!panel) return;
    const elements = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      (
        panel.querySelector<HTMLElement>("[data-initial-focus]") ??
        elements()[0] ??
        panel
      ).focus();
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const controls = elements();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        panel.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus();
        else
          document
            .querySelector<HTMLElement>('[aria-label="添加常用网站"]')
            ?.focus();
      });
    };
  }, []);
  return (
    <div ref={host}>
      <GlassModal
        open
        title={title}
        onClose={onClose}
        width={wide ? 720 : 420}
        className={wide ? "settings-modal" : "editor-modal"}
        {...panel}
      >
        {children}
      </GlassModal>
    </div>
  );
}
