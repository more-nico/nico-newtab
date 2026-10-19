import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  configureLocale,
  currentLocale,
  detectLocale,
  formatClock,
  formatDate,
  formatDateTime,
  matchLocale,
  t,
} from "./i18n";

afterEach(() => configureLocale("zh-CN"));

describe("locale matching", () => {
  it.each([
    ["zh-CN", "zh-CN"],
    ["zh-TW", "zh-CN"],
    ["zh", "zh-CN"],
    ["en-US", "en"],
    ["en-GB", "en"],
    ["ja-JP", "ja"],
    ["ja", "ja"],
    ["fr-FR", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("maps %s to %s", (tag, expected) => {
    expect(matchLocale(tag)).toBe(expected);
  });
});

describe("locale switching", () => {
  it("defaults to Chinese and switches every namespace", () => {
    expect(currentLocale()).toBe("zh-CN");
    expect(t().common.actions.cancel).toBe("取消");
    expect(t().common.artwork["water-lilies"].artist).toBe("克劳德 · 莫奈");

    configureLocale("en");
    expect(t().common.actions.cancel).toBe("Cancel");
    expect(t().common.artwork["water-lilies"].artist).toBe("Claude Monet");

    configureLocale("ja");
    expect(t().common.actions.cancel).toBe("キャンセル");
    expect(t().common.artwork["rainy-paris"].artistShort).toBe("カイユボット");
  });

  it("detects from navigator languages when chrome is unavailable", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { languages: ["fr-FR", "ja-JP"] },
    });
    expect(detectLocale()).toBe("ja");
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete (globalThis as { navigator?: unknown }).navigator;
  });
});

describe("locale-aware formatting", () => {
  const now = new Date("2026-10-19T18:34:00+08:00");

  it("formats the date line per locale", () => {
    expect(formatDate(now, "zh-CN")).toBe("10月19日 · 星期一");
    expect(formatDate(now, "en")).toBe("October 19 · Monday");
    expect(formatDate(now, "ja")).toBe("10月19日 · 月曜日");
  });

  it("formats the 12h clock and day period per locale", () => {
    expect(formatClock(now, "24", "zh-CN")).toEqual({
      clock: "18:34",
      period: null,
    });
    expect(formatClock(now, "12", "en").clock).toBe("06:34");
    expect(formatClock(now, "12", "en").period).toMatch(/PM/i);
    expect(formatClock(now, "12", "ja").period).toBe("午後");
  });

  it("formats sync timestamps and rejects invalid input", () => {
    expect(formatDateTime("2026-10-19T10:34:00.000Z", "zh-CN")).toContain(
      "10月19日",
    );
    expect(formatDateTime(null)).toBeNull();
    expect(formatDateTime("not-a-date")).toBeNull();
  });
});

describe("manifest locale catalogs", () => {
  const root = fileURLToPath(new URL("../../public", import.meta.url));
  const catalog = (locale: string) =>
    JSON.parse(
      readFileSync(`${root}/_locales/${locale}/messages.json`, "utf8"),
    ) as Record<string, { message: string }>;
  const manifest = JSON.parse(
    readFileSync(`${root}/manifest.json`, "utf8"),
  ) as {
    name: string;
    short_name: string;
    description: string;
    default_locale: string;
    action: { default_title: string };
  };

  it("points every localized manifest field at a catalog key", () => {
    expect(manifest.default_locale).toBe("en");
    expect(manifest.name).toBe("__MSG_extName__");
    expect(manifest.short_name).toBe("__MSG_extShortName__");
    expect(manifest.description).toBe("__MSG_extDescription__");
    expect(manifest.action.default_title).toBe("__MSG_actionTitle__");
  });

  it.each(["en", "zh_CN", "ja"])("ships a complete %s catalog", (locale) => {
    const messages = catalog(locale);
    for (const key of [
      "extName",
      "extShortName",
      "extDescription",
      "actionTitle",
    ]) {
      expect(messages[key]?.message?.trim().length).toBeGreaterThan(0);
    }
    expect(messages.extName.message).not.toBe("__MSG_extName__");
  });
});
