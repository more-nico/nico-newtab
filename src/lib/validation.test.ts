import { describe, expect, it } from "vitest";
import {
  DEFAULT_GLASS_SETTINGS,
  MAX_FOLDER_NAME,
  MAX_PAGE_NAME,
  MAX_PAGES,
  defaultState,
} from "../data";
import type { BackupV1 } from "../types";
import {
  normalizeSearchTemplate,
  normalizeUrl,
  parseBackup,
  parseState,
} from "./validation";

const backup = (): BackupV1 => ({
  format: "nico-newtab",
  version: 1,
  exportedAt: "2026-09-19T00:00:00Z",
  state: defaultState(),
  wallpaper: null,
});
const engine = {
  id: "custom",
  name: "站内",
  urlTemplate: "https://example.com/?q=%s",
};

describe("import and search validation", () => {
  it("normalizes a website address and a custom search template", () => {
    expect(normalizeUrl("  example.com/docs?q=新页  ")).toBe(
      "https://example.com/docs?q=%E6%96%B0%E9%A1%B5",
    );
    expect(normalizeSearchTemplate("example.com/?q={query}")).toBe(
      "https://example.com/?q=%s",
    );
  });

  it.each([
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "hello world",
  ])("rejects an unsafe or invalid site address %s", (url) =>
    expect(() => normalizeUrl(url)).toThrow(),
  );

  it.each(["https://example.com/", "https://example.com/?q=%s&other=%s"])(
    "rejects a template without exactly one query placeholder %s",
    (template) => expect(() => normalizeSearchTemplate(template)).toThrow(),
  );

  it("round-trips custom engines, selection and shortcut icons in a backup", () => {
    const data = backup();
    data.state.settings.customEngines = [engine];
    data.state.settings.searchEngine = engine.id;
    data.state.shortcuts = [
      {
        id: "a",
        name: "A",
        url: "https://example.com/",
        iconDataUrl: "data:image/webp;base64,UklGRg==",
      },
    ];
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
  });

  it.each([
    "{",
    JSON.stringify({ ...backup(), version: 2 }),
    JSON.stringify({ ...backup(), format: "foreign" }),
  ])("refuses an invalid backup envelope", (text) =>
    expect(() => parseBackup(text)).toThrow(),
  );

  it("rejects malformed settings before they reach persistence", () => {
    const data = defaultState();
    data.settings.brightness = 121;
    expect(() => parseState(data)).toThrow();
    data.settings.brightness = 85;
    data.settings.glass.brightness = 3;
    expect(() => parseState(data)).toThrow();
  });

  it.each([null, { name: "pic", dataUrl: "data:image/webp;base64,SGVsbG8=" }])(
    "refuses missing or corrupt custom wallpaper data",
    (wallpaper) => {
      const data = backup();
      data.state.settings.wallpaper = "custom";
      data.state.settings.customWallpaper = {
        assetId: "pic",
        name: "pic",
        mime: "image/webp",
      };
      expect(() =>
        parseBackup(JSON.stringify({ ...data, wallpaper })),
      ).toThrow();
    },
  );

  it("rejects duplicate shortcuts and unsafe URLs in imported state", () => {
    const data = defaultState();
    const site = { id: "a", name: "A", url: "https://example.com/" };
    data.shortcuts = [site, { ...site }];
    expect(() => parseState(data)).toThrow();
    data.shortcuts = [{ ...site, url: "javascript:alert(1)" }];
    expect(() => parseState(data)).toThrow();
  });

  it("ignores prototype keys when loading external settings", () => {
    const data = defaultState();
    Object.defineProperty(data.settings, "__proto__", {
      value: { polluted: true },
      enumerable: true,
    });
    expect(Object.hasOwn(parseState(data).settings, "__proto__")).toBe(false);
  });

  it("migrates old settings without discarding the saved configuration", () => {
    const data = defaultState();
    const old = data.settings as Partial<typeof data.settings>;
    delete old.glass;
    delete old.customEngines;
    delete old.glassMode;
    Object.assign(old, { quality: "medium", searchEngine: "removed" });
    expect(parseState(data).settings).toMatchObject({
      glass: DEFAULT_GLASS_SETTINGS,
      quality: "high",
      glassMode: "auto",
      searchEngine: "default",
      customEngines: [],
    });
  });

  it.each([
    [engine, { ...engine }],
    [{ ...engine, urlTemplate: "javascript:alert(%s)" }],
  ])(
    "rejects ambiguous or unsafe custom engine configurations",
    (...engines) => {
      const data = defaultState();
      data.settings.customEngines = engines;
      expect(() => parseState(data)).toThrow();
    },
  );
});

describe("desktop data", () => {
  type State = ReturnType<typeof defaultState>;
  const layout = (): State => ({
    ...defaultState(),
    shortcuts: [
      { id: "a", name: "甲", url: "https://a.example/" },
      { id: "b", name: "乙", url: "https://b.example/" },
      { id: "c", name: "丙", url: "https://c.example/" },
    ],
    pages: [
      {
        id: "p1",
        name: "工作",
        items: [
          { type: "shortcut", id: "a" },
          { type: "folder", id: "f1" },
        ],
      },
    ],
    folders: [{ id: "f1", name: "工具", shortcutIds: ["b", "c"] }],
  });

  it("migrates old state and backups without losing shortcuts", () => {
    const legacy: Partial<State> = layout();
    delete legacy.pages;
    delete legacy.folders;
    const expected = legacy.shortcuts!.map(({ id }) => ({
      type: "shortcut",
      id,
    }));
    expect(parseState(legacy).pages[0].items).toEqual(expected);
    const data = { ...backup(), state: legacy };
    expect(parseBackup(JSON.stringify(data)).state.pages[0].items).toEqual(
      expected,
    );
    expect(parseState({ ...legacy, shortcuts: [] }).pages).toHaveLength(1);
  });

  it("preserves pages, membership and icons in a backup round trip", () => {
    const state = layout();
    state.pages[0].icon = { kind: "emoji", value: "📚" };
    const data = { ...backup(), state };
    expect(parseBackup(JSON.stringify(data)).state).toEqual(state);
  });

  it("keeps shortcuts added before they are assigned to a page", () => {
    const state = layout();
    state.shortcuts.push({
      id: "new",
      name: "新网站",
      url: "https://new.example/",
    });
    expect(parseState(state).shortcuts).toHaveLength(4);
  });

  const invalid: [string, (state: State) => void][] = [
    [
      "no pages",
      (s) => {
        s.pages = [];
      },
    ],
    [
      "duplicate pages",
      (s) => {
        s.pages.push({ ...s.pages[0] });
      },
    ],
    [
      "too many pages",
      (s) => {
        s.pages = Array.from({ length: MAX_PAGES + 1 }, (_, i) => ({
          id: `p${i}`,
          name: "页",
          items: [],
        }));
      },
    ],
    [
      "invalid page name",
      (s) => {
        s.pages[0].name = " ";
      },
    ],
    [
      "overlong page name",
      (s) => {
        s.pages[0].name = "x".repeat(MAX_PAGE_NAME + 1);
      },
    ],
    [
      "overlong folder name",
      (s) => {
        s.folders[0].name = "x".repeat(MAX_FOLDER_NAME + 1);
      },
    ],
    [
      "unknown item type",
      (s) => {
        s.pages[0].items.push({ type: "page", id: "a" } as never);
      },
    ],
    [
      "dangling shortcut",
      (s) => {
        s.pages[0].items.push({ type: "shortcut", id: "missing" });
      },
    ],
    [
      "dangling folder",
      (s) => {
        s.pages[0].items.push({ type: "folder", id: "missing" });
      },
    ],
    [
      "shortcut in both page and folder",
      (s) => {
        s.pages[0].items.push({ type: "shortcut", id: "b" });
      },
    ],
    [
      "folder placed twice",
      (s) => {
        s.pages.push({
          id: "p2",
          name: "第二页",
          items: [{ type: "folder", id: "f1" }],
        });
      },
    ],
    [
      "missing folder member",
      (s) => {
        s.folders[0].shortcutIds.push("missing");
      },
    ],
    [
      "duplicate folder member",
      (s) => {
        s.folders[0].shortcutIds.push("b");
      },
    ],
  ];
  it.each(invalid)("rejects %s", (_label, change) => {
    const state = layout();
    change(state);
    expect(() => parseState(state)).toThrow();
  });

  it("loads uploaded page icons and tolerates older or invalid icon fields", () => {
    const state = layout();
    const dataUrl =
      "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=";
    state.pages[0].icon = { kind: "image", dataUrl };
    expect(parseState(state).pages[0].icon).toEqual({ kind: "image", dataUrl });
    delete state.pages[0].icon;
    expect(parseState(state).pages[0].icon).toBeUndefined();
    Object.assign(state.pages[0], { icon: { kind: "sticker", value: "🏠" } });
    expect(parseState(state).pages[0].icon).toBeUndefined();
  });
});
