import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { GlassButton, GlassSurface } from "nico-glass-kit";
import { X } from "lucide-react";
import { useGlassMaterial } from "../lib/glass";

/** Leave animation length; keep in sync with the .nico-* keyframes. */
const LEAVE_MS = 180;

/**
 * Accessible glass dialog. A top row of two separate panes — the caller's head
 * block and a round close button — over one content pane that carries both the
 * scrolling body and the action row. Nothing sits on a second sheet of glass.
 */
export function Modal({
  label,
  head,
  foot,
  children,
  wide = false,
  onClose,
}: {
  /** Accessible name for the dialog. */
  label: string;
  /** Glass block rendered left of the close button (tabs, or the title). */
  head?: ReactNode;
  /** Action row rendered inside the content pane; omitted when there is none. */
  foot?: ReactNode;
  children: ReactNode;
  /** Fixed 720px layout with a fixed height instead of fitting the content. */
  wide?: boolean;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const { base, panel } = useGlassMaterial();
  const [leaving, setLeaving] = useState(false);
  const closed = useRef(false);
  // Keep the callback out of the effect deps so the trap mounts only once.
  const close = useRef(onClose);
  close.current = onClose;
  // Capture during render, before the dialog's own effect focuses it.
  const returnFocus = useRef(document.activeElement as HTMLElement | null);

  const dismiss = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    setLeaving(true);
    window.setTimeout(() => close.current(), LEAVE_MS);
  }, []);

  // Drive the overflow fade: an edge only masks out when content sits behind it.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      el.dataset.fadeTop = el.scrollTop > 2 ? "true" : "false";
      el.dataset.fadeBottom =
        el.scrollTop + el.clientHeight < el.scrollHeight - 2 ? "true" : "false";
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const resize = new ResizeObserver(update);
    resize.observe(el);
    // Section switches replace the whole subtree, which changes the height.
    const mutation = new MutationObserver(update);
    mutation.observe(el, { childList: true, subtree: true });
    return () => {
      el.removeEventListener("scroll", update);
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);

  useEffect(() => {
    const previous = returnFocus.current;
    const pane = host.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (!pane) return;
    const elements = () =>
      Array.from(
        pane.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    const frame = requestAnimationFrame(() => {
      (
        pane.querySelector<HTMLElement>("[data-initial-focus]") ??
        elements()[0] ??
        pane
      ).focus();
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = elements();
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        pane.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || !pane.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !pane.contains(document.activeElement))
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
  }, [dismiss]);

  return (
    <div
      ref={host}
      className={`nico-overlay${leaving ? " is-leaving" : ""}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        className={`nico-dialog${wide ? " nico-dialog--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
      >
        <div className="dialog-bar">
          <div className="dialog-bar-lead">{head}</div>
          <GlassButton
            variant="icon"
            size="lg"
            className="dialog-close"
            aria-label="关闭"
            icon={<X size={19} strokeWidth={1.8} />}
            onClick={dismiss}
            {...base}
          />
        </div>
        <GlassSurface
          className="dialog-pane dialog-body"
          cornerRadius={20}
          {...panel}
        >
          <div className="dialog-content" ref={scroller}>
            {children}
          </div>
          {foot && <div className="dialog-actions">{foot}</div>}
        </GlassSurface>
      </div>
    </div>
  );
}
