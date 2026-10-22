/**
 * The dock icon of a page: a single emoji or an uploaded image.
 *
 * The rules live here rather than in the view so both the picker and the
 * storage validation can agree on what a usable icon is. The dock icon is an
 * abbreviation — the full page name is still shown as text on hover — so the
 * icon stays deliberately small: one emoji grapheme, or one square picture.
 */
import type { PageIcon } from "../types";

/**
 * Defensive ceiling for a single emoji grapheme, counted in code points. It is
 * not the rule — one grapheme is — but it keeps a pathological ZWJ chain from
 * becoming a stored icon. Real sequences stay far below this: a family of four
 * with skin tones is only about eleven code points.
 */
export const MAX_PAGE_ICON_EMOJI = 32;

/**
 * Upper bound for a stored page icon (a 128px WebP data URL is a few KB).
 * The same ceiling the shortcut icons use.
 */
export const MAX_PAGE_ICON_DATA_URL = 200_000;

/** What `optimizeIcon` writes: a base64 WebP data URL, never a remote image. */
export const PAGE_ICON_IMAGE_PREFIX = "data:image/webp;base64,";

/**
 * The letter a page falls back to when it has no icon of its own: the first
 * character of its name, upper-cased. An empty name has no letter, so the
 * dock shows nothing rather than a stray glyph.
 */
export function pageIconLetter(name: string): string {
  return Array.from(name)[0]?.toUpperCase() ?? "";
}

const graphemeSegmenter = new Intl.Segmenter("en", {
  granularity: "grapheme",
});

/** Split text the way an editor moves the cursor: by user-perceived glyph. */
function graphemes(value: string): string[] {
  return Array.from(graphemeSegmenter.segment(value), (part) => part.segment);
}

// A keycap is the one emoji built from an ASCII base (`1`, `#`, `*`) plus the
// enclosing keycap mark, with an optional emoji presentation selector.
const KEYCAP = /^[0-9#*]\uFE0F?\u20E3$/u;
// A flag is exactly one pair of regional indicators; a lone indicator is not
// a flag and renders as a letter-like symbol.
const FLAG = /^\p{Regional_Indicator}{2}$/u;
const REGIONAL_INDICATOR = /\p{Regional_Indicator}/u;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
// Every code point a single emoji cluster may contain: pictographs, skin-tone
// modifiers, regional indicators, joiners/selectors and tag characters used by
// subdivision flags. Anything else (letters, combining marks, stray symbols)
// makes the cluster invalid rather than "an emoji with extra characters".
const EMOJI_CLUSTER_CHAR =
  /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\uFE0F\u20E3\u{E0020}-\u{E007F}]$/u;

/**
 * True for exactly one emoji grapheme: a family joined by ZWJ, a flag, a
 * skin-tone variant, a keycap or a plain pictograph. Words, lone letters,
 * multiple emoji and broken clusters are rejected.
 */
function isEmojiGrapheme(cluster: string): boolean {
  if (KEYCAP.test(cluster)) return true;
  if (REGIONAL_INDICATOR.test(cluster)) return FLAG.test(cluster);
  if (!PICTOGRAPHIC.test(cluster)) return false;
  if (cluster.startsWith("\u200D") || cluster.endsWith("\u200D")) return false;
  return Array.from(cluster).every((char) => EMOJI_CLUSTER_CHAR.test(char));
}

/**
 * Normalizes an emoji the user typed. The value is trimmed and must be one
 * emoji grapheme — a single glyph such as 🏠, a joined family, a flag, a
 * skin-tone variant or a keycap. Plain words, single letters, several emoji
 * and malformed sequences are not icons.
 */
export function normalizePageEmoji(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/\s/u.test(trimmed)) return null;
  if (Array.from(trimmed).length > MAX_PAGE_ICON_EMOJI) return null;
  const cluster = graphemes(trimmed);
  if (cluster.length !== 1) return null;
  return isEmojiGrapheme(cluster[0]!) ? trimmed : null;
}

/** True when the value can be stored as a page's emoji icon. */
export function isPageEmoji(value: string): boolean {
  return normalizePageEmoji(value) !== null;
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const WEBP_CHUNKS = new Set(["VP8 ", "VP8L", "VP8X"]);

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
}

/**
 * True for the WebP data URL shape `optimizeIcon` produces: a base64 payload
 * with a RIFF/WEBP header, a known first chunk and a size field that matches
 * the decoded bytes. Length is capped, so a hand-written or foreign image is
 * dropped instead of being carried in the state forever.
 */
export function isPageIconImageDataUrl(value: string): boolean {
  if (!value.startsWith(PAGE_ICON_IMAGE_PREFIX)) return false;
  if (value.length > MAX_PAGE_ICON_DATA_URL) return false;
  const payload = value.slice(PAGE_ICON_IMAGE_PREFIX.length);
  // The shortest acceptable file is a 16-byte WebP header, which is 24
  // base64 characters once padded.
  if (payload.length < 24 || payload.length % 4 !== 0) return false;
  if (!BASE64.test(payload)) return false;
  let bytes: Uint8Array;
  try {
    const binary = atob(payload);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return false;
  }
  if (bytes.length < 16) return false;
  if (!asciiAt(bytes, 0, "RIFF") || !asciiAt(bytes, 8, "WEBP")) return false;
  const chunk = String.fromCharCode(
    bytes[12]!,
    bytes[13]!,
    bytes[14]!,
    bytes[15]!,
  );
  if (!WEBP_CHUNKS.has(chunk)) return false;
  const riffSize =
    (bytes[4]! | (bytes[5]! << 8) | (bytes[6]! << 16) | (bytes[7]! << 24)) >>>
    0;
  return riffSize === bytes.length - 8;
}

/**
 * Reads a stored icon. Anything unusable — a missing field, a foreign shape,
 * an invalid emoji, a non-optimized picture — is dropped rather than rejected,
 * so a state written by a newer version (or by hand) still opens.
 */
export function parsePageIcon(value: unknown): PageIcon | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "emoji" && typeof record.value === "string") {
    const emoji = normalizePageEmoji(record.value);
    return emoji ? { kind: "emoji", value: emoji } : null;
  }
  if (record.kind === "image" && typeof record.dataUrl === "string") {
    const dataUrl = record.dataUrl;
    return isPageIconImageDataUrl(dataUrl) ? { kind: "image", dataUrl } : null;
  }
  return null;
}

/**
 * A small palette of one-tap emojis. They are suggestions, not a limit: the
 * field accepts any single emoji the user pastes.
 */
export const PAGE_ICON_SUGGESTIONS: readonly string[] = [
  "🏠",
  "💼",
  "🎨",
  "📚",
  "🧭",
  "✈️",
  "🎵",
  "🛒",
  "⚙️",
  "☕️",
];
