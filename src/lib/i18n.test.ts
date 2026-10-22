import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureLocale,
  detectLocale,
  formatClock,
  matchLocale,
  t,
} from "./i18n";

afterEach(() => {
  configureLocale("zh-CN");
  vi.unstubAllGlobals();
});

describe("localization", () => {
  it("selects the first supported browser language", () => {
    vi.stubGlobal("navigator", { languages: ["fr-FR", "ja-JP", "en-US"] });
    expect(detectLocale()).toBe("ja");
    expect(matchLocale("zh-TW")).toBe("zh-CN");
  });

  it("switches the displayed dictionary", () => {
    configureLocale("en");
    expect(t().common.actions.cancel).toBe("Cancel");
    configureLocale("ja");
    expect(t().common.actions.cancel).toBe("キャンセル");
  });

  it("distinguishes 24h and localized 12h clock output", () => {
    const now = new Date(2026, 9, 19, 18, 34);
    expect(formatClock(now, "24", "zh-CN")).toEqual({
      clock: "18:34",
      period: null,
    });
    expect(formatClock(now, "12", "en")).toEqual({
      clock: "06:34",
      period: "PM",
    });
  });

  it("resolves every localized manifest field in each shipped catalog", () => {
    const read = (path: string) =>
      JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
    const manifest = read("../../public/manifest.json");
    const keys = [
      manifest.name,
      manifest.short_name,
      manifest.description,
      manifest.action.default_title,
    ].map((value: string) => /^__MSG_(.+)__$/.exec(value)?.[1]);
    for (const locale of ["en", "zh_CN", "ja"]) {
      const catalog = read(`../../public/_locales/${locale}/messages.json`);
      for (const key of keys)
        expect(key && catalog[key]?.message?.trim()).toBeTruthy();
    }
  });
});
