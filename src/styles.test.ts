import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  fileURLToPath(new URL("./styles.css", import.meta.url)),
  "utf8",
);

/**
 * Comments are stripped before matching: the ones documenting these very rules
 * quote the selectors they forbid, which would otherwise satisfy — or trip —
 * a guard.
 */
const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The kit applies the elastic transform to the inner `.ngs-motion` while the
 * container owns the frame (its box-shadow). Under elasticity the frame stays
 * put and the glass slides out of it, so the frame has to live on the layer
 * that moves. Freezing the motion instead "fixes" the symptom but silently
 * removes the elasticity, so both halves of that rule are locked here.
 */
describe("glass frames", () => {
  it("stops the container from painting and moves the frame inward", () => {
    expect(rules).toMatch(
      /:where\(\.ngs-surface:has\(> \.ngs-motion\):not\(\[data-ngs-shape="glyph"\]\)\)\s*\{\s*box-shadow:\s*none !important/,
    );
    expect(rules).toMatch(
      /:where\(\.ngs-surface:not\(\[data-ngs-shape="glyph"\]\) > \.ngs-motion\)\s*\{\s*box-shadow:\s*var\(--ngs-shadow-sm\)/,
    );
  });

  /**
   * GlassText masks only .ngs-effect and .ngs-highlight to the character, so a
   * frame painted on .ngs-motion draws the tile's rectangle around every glyph
   * — a box around each digit of the clock. The kit already drops the shadow on
   * the container for these; the moving layer has to match.
   */
  it("leaves glyph tiles without a frame", () => {
    expect(rules).not.toMatch(
      /:where\(\.ngs-surface > \.ngs-motion\)\s*\{\s*box-shadow/,
    );
    expect(rules).toMatch(
      /:where\(\.ngs-surface:not\(\[data-ngs-shape="glyph"\]\) > \.ngs-motion\)/,
    );
  });

  it.each([
    ".gallery-button",
    ".search-input",
    ".search-engine .ngs-select-trigger",
    ".shortcut-glass",
    ".settings-button",
    ".dialog-pane",
    ".toast",
    '.dialog-body .ngs-surface:not([data-ngs-shape="glyph"])',
  ])("keeps the custom frame for %s on the moving layer", (selector) => {
    expect(rules).toMatch(
      new RegExp(`${escape(selector)} > \\.ngs-motion[^{}]*\\{[^}]*box-shadow`),
    );
  });

  it.each([".add-glass", ".range-setting .ngs-slider"])(
    "leaves %s without a frame",
    (selector) => {
      expect(rules).toMatch(
        new RegExp(
          `${escape(selector)} > \\.ngs-motion[^{}]*\\{[^}]*box-shadow: none`,
        ),
      );
    },
  );
});

describe("row alignment", () => {
  /**
   * These rows end in a `.button-pair`, and a bare `> div { flex: 1 }` selector
   * matches that too — handing the buttons a stretched box so they sit at its
   * left edge, ~70px short of the fields above them. The text block has to be
   * named instead.
   */
  const rows = [
    { row: ".editor-icon", text: ".editor-icon-text" },
    { row: ".engine-card", text: ".engine-card-text" },
  ];

  it.each(rows)("stretches $text, not a bare div in $row", ({ row, text }) => {
    expect(rules).toMatch(new RegExp(`${escape(text)}\\s*\\{[^}]*flex: 1`));
    expect(rules).not.toMatch(
      new RegExp(`${escape(row)}[^{}]*>\\s*div\\b[^{}]*\\{[^}]*flex:\\s*1`),
    );
  });
});

describe("shortcut hover", () => {
  /**
   * At 细腻 the glass already answers the pointer with dispersion and elasticity;
   * the extra 3px hop in front of it reads as a stutter. The lift has to stay
   * for 轻盈, where it is the only feedback there is.
   */
  it("drops the hover lift at the 细腻 tier only", () => {
    expect(rules).toMatch(
      /\.shortcut-link:hover \.shortcut-glass\s*\{\s*transform: translateY\(-3px\)/,
    );
    expect(rules).toMatch(
      /\.app\[data-quality="high"\] \.shortcut-link:hover \.shortcut-glass\s*\{\s*transform: none/,
    );
  });
});

describe("drag ghost", () => {
  /**
   * Chrome rasterises the default drag image from the dragged element, and the
   * tile's backdrop-filter cannot be resolved into it — the ghost came out as an
   * opaque black box carrying a second copy of the name. These two rules are
   * what replace it.
   */
  it("paints a stand-in that does not depend on the backdrop", () => {
    expect(rules).toMatch(
      /\.drag-ghost\s*\{[^}]*background: rgba\(255, 255, 255/,
    );
    expect(rules).not.toMatch(/\.drag-ghost\s*\{[^}]*backdrop-filter/);
  });

  it("steps the source tile back while it is being moved", () => {
    expect(rules).toMatch(/\.is-dragging\s*\{\s*opacity: 0\.35/);
  });
});

describe("floating glass panels", () => {
  const panels = [".search-engine .ngs-select-popup", ".search-suggestions"];

  it.each(panels)("moves the clip with the frame for %s", (panel) => {
    expect(rules).toMatch(
      new RegExp(`${escape(panel)}[^{}]*\\{[^}]*overflow: visible !important`),
    );
    expect(rules).toMatch(
      new RegExp(
        `${escape(panel)} > \\.ngs-motion[^{}]*\\{[^}]*overflow: hidden`,
      ),
    );
  });

  it.each(panels)("never freezes the elastic motion of %s", (panel) => {
    expect(rules).not.toMatch(
      new RegExp(
        `${escape(panel)}[^{}]*> \\.ngs-motion[^{}]*\\{[^}]*transform:\\s*none`,
      ),
    );
  });
});
