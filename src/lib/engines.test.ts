import { describe, expect, it } from "vitest";
import { defaultState } from "../data";
import type { AppSettings } from "../types";
import {
  BUILT_IN_ENGINES,
  DEFAULT_ENGINE_ID,
  buildSearchUrl,
  isBuiltInEngineId,
  listEngines,
  resolveEngine,
} from "./engines";

const settingsWith = (patch: Partial<AppSettings>): AppSettings => ({
  ...defaultState().settings,
  ...patch,
});

describe("search engines", () => {
  it("offers the browser default plus the four built-in engines", () => {
    const engines = listEngines(defaultState().settings);
    expect(engines.map((engine) => engine.id)).toEqual([
      "default",
      "google",
      "bing",
      "baidu",
      "duckduckgo",
    ]);
    expect(engines.every((engine) => engine.kind === "builtin")).toBe(true);
  });
  it("marks every engine but the browser default as suggestion-capable", () =>
    expect(
      BUILT_IN_ENGINES.filter((engine) => engine.suggest).map((e) => e.id),
    ).toEqual(["google", "bing", "baidu", "duckduckgo"]));
  it("gives every engine but the browser default a URL template", () =>
    expect(
      BUILT_IN_ENGINES.filter((engine) => !engine.urlTemplate).map(
        (engine) => engine.id,
      ),
    ).toEqual([DEFAULT_ENGINE_ID]));
  it("recognises only the reserved built-in ids", () => {
    expect(isBuiltInEngineId("bing")).toBe(true);
    expect(isBuiltInEngineId("engine-1")).toBe(false);
  });
  it("resolves an unknown engine id back to the browser default", () => {
    const resolved = resolveEngine(
      settingsWith({ searchEngine: "removed-engine" }),
    );
    expect(resolved.id).toBe(DEFAULT_ENGINE_ID);
    expect(resolved.urlTemplate).toBeUndefined();
  });
  it("resolves a built-in engine by id", () =>
    expect(
      resolveEngine(settingsWith({ searchEngine: "baidu" })),
    ).toMatchObject({
      id: "baidu",
      name: "百度",
      suggest: true,
      kind: "builtin",
    }));
  it("resolves a custom engine by id and never offers suggestions", () => {
    const resolved = resolveEngine(
      settingsWith({
        searchEngine: "engine-1",
        customEngines: [
          {
            id: "engine-1",
            name: "知乎",
            urlTemplate: "https://www.zhihu.com/search?q=%s",
          },
        ],
      }),
    );
    expect(resolved).toMatchObject({
      id: "engine-1",
      name: "知乎",
      suggest: false,
      kind: "custom",
    });
    expect(resolved.glyph).toBeUndefined();
  });
  it("lists custom engines after the built-ins", () => {
    const engines = listEngines(
      settingsWith({
        customEngines: [
          { id: "e1", name: "A", urlTemplate: "https://a.com/?q=%s" },
          { id: "e2", name: "B", urlTemplate: "https://b.com/?q=%s" },
        ],
      }),
    );
    expect(engines.slice(-2).map((engine) => engine.id)).toEqual(["e1", "e2"]);
  });
  it.each([
    [
      "https://www.bing.com/search?q=%s",
      "nico",
      "https://www.bing.com/search?q=nico",
    ],
    [
      "https://www.bing.com/search?q=%s",
      "nico 印象派",
      "https://www.bing.com/search?q=nico%20%E5%8D%B0%E8%B1%A1%E6%B4%BE",
    ],
    ["https://e.com/?q=%s", "a&b=c", "https://e.com/?q=a%26b%3Dc"],
    ["https://e.com/s/%s", "  padded  ", "https://e.com/s/padded"],
  ])("builds an encoded search URL from %s", (template, text, expected) =>
    expect(buildSearchUrl(template, text)).toBe(expected),
  );
});
