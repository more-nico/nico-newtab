import type { AppMessages } from "./app";
import type { CommonMessages } from "./common";
import type { EditorMessages } from "./editor";
import type { LibMessages } from "./lib";
import type { PopupMessages } from "./popup";
import type { SettingsMessages } from "./settings";
import type { SyncMessages } from "./sync";
import type { Locale } from "./types";
import { appMessages } from "./app";
import { commonMessages } from "./common";
import { editorMessages } from "./editor";
import { libMessages } from "./lib";
import { popupMessages } from "./popup";
import { settingsMessages } from "./settings";
import { syncMessages } from "./sync";

export type { Locale } from "./types";

export interface Messages {
  app: AppMessages;
  common: CommonMessages;
  editor: EditorMessages;
  lib: LibMessages;
  popup: PopupMessages;
  settings: SettingsMessages;
  sync: SyncMessages;
}

export const SUPPORTED_LOCALES: readonly Locale[] = ["zh-CN", "en", "ja"];

/** BCP 47 tag for `Intl` formatting. */
const INTL_LOCALES: Record<Locale, string> = {
  "zh-CN": "zh-CN",
  en: "en-US",
  ja: "ja-JP",
};

// Default is zh-CN: unit tests import library modules directly and assert the
// original Chinese messages, while entry points call configureLocale(detectLocale()).
let locale: Locale = "zh-CN";

function buildMessages(): Messages {
  return {
    app: appMessages[locale],
    common: commonMessages[locale],
    editor: editorMessages[locale],
    lib: libMessages[locale],
    popup: popupMessages[locale],
    settings: settingsMessages[locale],
    sync: syncMessages[locale],
  };
}

let current = buildMessages();

/** Artwork captions by id (the ids come from `ARTWORKS` in src/data.ts). */
export function artworkOf(id: string) {
  const artworks = current.common.artwork;
  return artworks[id as keyof typeof artworks];
}

/** All user-facing copy for the active locale. */
export function t(): Messages {
  return current;
}

export function currentLocale(): Locale {
  return locale;
}

export function configureLocale(next: Locale): void {
  locale = next;
  current = buildMessages();
  if (typeof document !== "undefined") document.documentElement.lang = next;
}

/** Maps a `navigator.language`-style tag onto a shipped locale. */
export function matchLocale(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  if (lower.startsWith("zh")) return "zh-CN";
  if (lower.startsWith("ja")) return "ja";
  if (lower.startsWith("en")) return "en";
  return null;
}

/**
 * Browser UI language first (in an extension, `chrome.i18n` reports the
 * browser's UI locale), then the user's language preferences. Unknown
 * languages fall back to English.
 */
export function detectLocale(): Locale {
  const candidates: string[] = [];
  if (typeof chrome !== "undefined" && chrome.i18n?.getUILanguage)
    candidates.push(chrome.i18n.getUILanguage());
  if (typeof navigator !== "undefined") {
    candidates.push(...(navigator.languages ?? [navigator.language]));
  }
  for (const candidate of candidates) {
    const match = matchLocale(candidate);
    if (match) return match;
  }
  return "en";
}

function intl(localeOverride?: Locale): string {
  return INTL_LOCALES[localeOverride ?? locale];
}

/** `10月19日 · 星期一` / `October 19 · Monday` / `10月19日 · 月曜日` */
export function formatDate(now: Date, localeOverride?: Locale): string {
  const tag = intl(localeOverride);
  const monthDay = new Intl.DateTimeFormat(tag, {
    month: "long",
    day: "numeric",
  }).format(now);
  const weekday = new Intl.DateTimeFormat(tag, { weekday: "long" }).format(now);
  return `${monthDay} · ${weekday}`;
}

/** Splits the clock into the digits and the localized 12h day period. */
export function formatClock(
  now: Date,
  hourCycle: "12" | "24",
  localeOverride?: Locale,
): { clock: string; period: string | null } {
  const parts = new Intl.DateTimeFormat(intl(localeOverride), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: hourCycle === "12" ? "h12" : "h23",
  }).formatToParts(now);
  const clock = parts
    .filter((part) => ["hour", "minute", "literal"].includes(part.type))
    .map((part) => part.value)
    .join("")
    .trim();
  const period = parts.find((part) => part.type === "dayPeriod")?.value ?? null;
  return { clock, period };
}

/** Short local timestamp for sync status lines, e.g. `10月19日 18:30`. */
export function formatDateTime(
  iso: string | null,
  localeOverride?: Locale,
): string | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return null;
  return new Intl.DateTimeFormat(intl(localeOverride), {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(time));
}
