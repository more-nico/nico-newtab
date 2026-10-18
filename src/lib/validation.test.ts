import { describe, expect, it } from "vitest";
import { DEFAULT_GLASS_SETTINGS, defaultState } from "../data";
import { MAX_CUSTOM_ENGINES } from "./engines";
import {
  normalizeSearchTemplate,
  normalizeUrl,
  parseBackup,
  parseState,
} from "./validation";

describe("website addresses", () => {
  it.each([
    [
      "  example.com/docs?q=新页  ",
      "https://example.com/docs?q=%E6%96%B0%E9%A1%B5",
    ],
    ["http://localhost:5173", "http://localhost:5173/"],
    ["example.com:8080/path", "https://example.com:8080/path"],
    ["https://例子.测试", "https://xn--fsqu00a.xn--0zwm56d/"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeUrl(input)).toBe(expected),
  );
  it.each([
    "",
    "hello world",
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///C:/secret",
    "ftp://example.com",
    "https://user:pass@example.com",
    "https://",
  ])("rejects %s", (value) => expect(() => normalizeUrl(value)).toThrow());
});

const backup = () => ({
  format: "nico-newtab",
  version: 1,
  exportedAt: "2026-09-19T00:00:00Z",
  state: defaultState(),
  wallpaper: null,
});
describe("backup validation", () => {
  it("round-trips a built-in wallpaper backup", () =>
    expect(parseBackup(JSON.stringify(backup()))).toEqual(backup()));
  it("preserves clock tint strength and defaults it for older backups", () => {
    const current = backup();
    current.state.settings.clockTintStrength = 0.37;
    expect(
      parseBackup(JSON.stringify(current)).state.settings.clockTintStrength,
    ).toBe(0.37);

    const older = backup();
    delete (older.state.settings as Partial<typeof older.state.settings>)
      .clockTintStrength;
    expect(
      parseBackup(JSON.stringify(older)).state.settings.clockTintStrength,
    ).toBe(0.1);
  });
  it("rejects unknown versions and malformed JSON", () => {
    expect(() => parseBackup("{")).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...backup(), version: 2 })),
    ).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...backup(), format: "other-app" })),
    ).toThrow();
  });
  it.each([
    ["brightness", 121],
    ["blur", -1],
    ["positionX", "50"],
    ["quality", ["low"]],
    ["fit", "stretch"],
    ["wallpaper", "unknown"],
  ])("rejects invalid setting %s", (key, value) => {
    const data = backup();
    Object.assign(data.state.settings, { [key]: value });
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
  });
  it("rejects missing and mismatched wallpaper references", () => {
    const data = backup();
    data.state.settings.wallpaper = "custom";
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
    data.state.settings.customWallpaper = {
      assetId: "old",
      name: "pic",
      mime: "image/webp",
    };
    expect(() => parseBackup(JSON.stringify(data))).toThrow();
  });
  it("does not trust a data URL MIME type without the image signature", () => {
    const data = backup();
    data.state.settings.customWallpaper = {
      assetId: "id",
      name: "pic",
      mime: "image/webp",
    };
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...data,
          wallpaper: {
            name: "pic",
            dataUrl: "data:image/webp;base64,SGVsbG8=",
          },
        }),
      ),
    ).toThrow();
  });
  it("rejects duplicate ids and unsafe imported URLs", () => {
    const data = defaultState();
    data.shortcuts = [
      { id: "one", name: "site", url: "https://example.com" },
      { id: "one", name: "site", url: "https://example.org" },
    ];
    expect(() => parseState(data)).toThrow();
    data.shortcuts = [{ id: "one", name: "site", url: "javascript:alert(1)" }];
    expect(() => parseState(data)).toThrow();
  });
  it("copies only known properties without prototype keys", () => {
    const data = JSON.parse(JSON.stringify(defaultState()));
    Object.defineProperty(data.settings, "__proto__", {
      value: { polluted: true },
      enumerable: true,
    });
    expect(Object.hasOwn(parseState(data).settings, "__proto__")).toBe(false);
  });
  it("migrates settings written before glass controls to playground defaults", () => {
    const data = defaultState();
    delete (data.settings as Partial<typeof data.settings>).glass;
    expect(parseState(data).settings.glass).toEqual(DEFAULT_GLASS_SETTINGS);
  });
  it("defaults clock tint strength and accepts the full slider range", () => {
    expect(defaultState().settings.clockTintStrength).toBe(0.1);
    const data = defaultState();
    delete (data.settings as Partial<typeof data.settings>).clockTintStrength;
    expect(parseState(data).settings.clockTintStrength).toBe(0.1);

    for (const value of [0, 1]) {
      data.settings.clockTintStrength = value;
      expect(parseState(data).settings.clockTintStrength).toBe(value);
    }
  });
  it.each([-0.01, 1.01, Number.NaN, "0.1", null])(
    "rejects invalid clock tint strength %s",
    (value) => {
      const data = defaultState();
      Object.assign(data.settings, { clockTintStrength: value });
      expect(() => parseState(data)).toThrow();
    },
  );
  it("folds the retired medium tier into high and rejects unknown tiers", () => {
    const data = defaultState();
    const tier = (value: string) => {
      Object.assign(data.settings, { quality: value });
      return parseState(data).settings.quality;
    };
    expect(tier("medium")).toBe("high");
    expect(tier("high")).toBe("high");
    expect(tier("low")).toBe("low");
    expect(() => tier("ultra")).toThrow();
  });
  it.each([
    ["blur", 65],
    ["saturation", -1],
    ["brightness", 2.01],
    ["mapScale", 0.05],
    ["depth", 41],
    ["curvature", 1.01],
    ["dispersion", -0.01],
    ["highlight", 2.01],
    ["elasticity", 0.51],
  ])("rejects invalid glass setting %s", (key, value) => {
    const data = defaultState();
    Object.assign(data.settings.glass, { [key]: value });
    expect(() => parseState(data)).toThrow();
  });
});

describe("search address templates", () => {
  it.each([
    ["https://example.com/search?q=%s", "https://example.com/search?q=%s"],
    ["example.com/?q=%s", "https://example.com/?q=%s"],
    ["https://example.com/?q={query}", "https://example.com/?q=%s"],
    ["  https://例子.测试/s?q=%s  ", "https://xn--fsqu00a.xn--0zwm56d/s?q=%s"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeSearchTemplate(input)).toBe(expected),
  );
  it.each([
    "",
    "https://example.com/",
    "https://example.com/?q=%s&x=%s",
    "https://example.com/?q=%s&x={query}",
    "javascript:alert(%s)",
    "ftp://example.com/?q=%s",
    "https://user:pass@example.com/?q=%s",
    "https://example.com/?q=%s %s",
  ])("rejects %s", (value) =>
    expect(() => normalizeSearchTemplate(value)).toThrow(),
  );
  it("does not mistake a template that already holds the probe token", () =>
    expect(() =>
      normalizeSearchTemplate("https://example.com/?q=nico-query-token&x=%s"),
    ).toThrow("占位符"));
});

describe("custom search engines", () => {
  const withEngines = (engines: unknown) => {
    const data = JSON.parse(JSON.stringify(defaultState()));
    data.settings.customEngines = engines;
    return data;
  };
  const zhihu = {
    id: "engine-1",
    name: "知乎",
    urlTemplate: "https://www.zhihu.com/search?q=%s",
  };

  it("defaults a missing engine selection to the browser default", () => {
    const data = JSON.parse(JSON.stringify(defaultState()));
    delete data.settings.searchEngine;
    expect(parseState(data).settings.searchEngine).toBe("default");
  });
  it("drops an unknown engine selection back to the browser default", () => {
    const data = defaultState();
    data.settings.searchEngine = "removed-engine";
    expect(parseState(data).settings.searchEngine).toBe("default");
  });
  it("keeps a built-in engine selection", () => {
    const data = defaultState();
    data.settings.searchEngine = "duckduckgo";
    expect(parseState(data).settings.searchEngine).toBe("duckduckgo");
  });
  it("keeps the selected custom engine when it still exists", () => {
    const data = withEngines([zhihu]);
    data.settings.searchEngine = "engine-1";
    const parsed = parseState(data).settings;
    expect(parsed.searchEngine).toBe("engine-1");
    expect(parsed.customEngines).toEqual([zhihu]);
  });
  it("migrates settings written before engines existed", () => {
    const data = JSON.parse(JSON.stringify(defaultState()));
    delete data.settings.searchEngine;
    delete data.settings.customEngines;
    const parsed = parseState(data).settings;
    expect(parsed.searchEngine).toBe("default");
    expect(parsed.customEngines).toEqual([]);
  });
  it("normalizes a custom engine template on load", () => {
    const data = withEngines([
      { id: "e", name: "  示例  ", urlTemplate: "example.com/s?q={query}" },
    ]);
    expect(parseState(data).settings.customEngines).toEqual([
      { id: "e", name: "示例", urlTemplate: "https://example.com/s?q=%s" },
    ]);
  });
  it.each([
    [
      "a template without a placeholder",
      [{ ...zhihu, urlTemplate: "https://example.com/" }],
    ],
    ["a name beyond the limit", [{ ...zhihu, name: "x".repeat(21) }]],
    ["duplicate ids", [zhihu, { ...zhihu, name: "另一家" }]],
    ["an id that shadows a built-in engine", [{ ...zhihu, id: "bing" }]],
    ["a non-array payload", "nope"],
  ])("rejects %s", (_label, engines) =>
    expect(() => parseState(withEngines(engines))).toThrow(),
  );
  it("caps the number of custom engines", () => {
    const many = Array.from({ length: MAX_CUSTOM_ENGINES + 1 }, (_, i) => ({
      ...zhihu,
      id: `engine-${i}`,
    }));
    expect(() => parseState(withEngines(many))).toThrow();
    expect(
      parseState(withEngines(many.slice(0, MAX_CUSTOM_ENGINES))).settings
        .customEngines,
    ).toHaveLength(MAX_CUSTOM_ENGINES);
  });
  it("carries custom engines through a backup round trip", () => {
    const data = backup();
    data.state.settings.customEngines = [zhihu];
    data.state.settings.searchEngine = "engine-1";
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
  });
});

describe("glass mode", () => {
  const mode = (value: unknown) => {
    const data = defaultState();
    Object.assign(data.settings, { glassMode: value });
    return parseState(data).settings.glassMode;
  };
  it("defaults to auto for settings written before the control existed", () => {
    const data = defaultState();
    delete (data.settings as Partial<typeof data.settings>).glassMode;
    expect(parseState(data).settings.glassMode).toBe("auto");
  });
  it.each([
    ["auto", "auto"],
    ["light", "light"],
    ["dark", "dark"],
    ["ultra", "auto"],
    [true, "auto"],
    [null, "auto"],
  ])("reads %s as %s", (value, expected) => expect(mode(value)).toBe(expected));
});

describe("shortcut icons", () => {
  const icon = "data:image/webp;base64,UklGRg==";
  const parse = (value: unknown) => {
    const data = defaultState();
    data.shortcuts = [
      {
        id: "a",
        name: "站点",
        url: "https://example.com/",
        iconDataUrl: value,
      } as never,
    ];
    return parseState(data).shortcuts[0];
  };
  it("keeps an uploaded icon", () =>
    expect(parse(icon).iconDataUrl).toBe(icon));
  it.each([
    ["a remote address", "https://example.com/icon.png"],
    ["a non-image data URL", "data:text/html,<b>x</b>"],
    ["an oversized payload", "data:image/webp;base64," + "A".repeat(200_001)],
    ["a number", 42],
  ])("drops %s", (_label, value) =>
    expect(parse(value)).not.toHaveProperty("iconDataUrl"),
  );
  it("carries icons through a backup round trip", () => {
    const data = backup();
    data.state.shortcuts = [
      {
        id: "a",
        name: "站点",
        url: "https://example.com/",
        iconDataUrl: icon,
      },
    ];
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
  });
});
