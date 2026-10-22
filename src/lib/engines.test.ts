import { describe, expect, it } from "vitest";
import { defaultState } from "../data";
import { buildSearchUrl, listEngines, resolveEngine } from "./engines";

describe("search engines", () => {
  it("falls back to the browser default when an engine has been removed", () => {
    const settings = { ...defaultState().settings, searchEngine: "removed" };
    expect(resolveEngine(settings)).toMatchObject({
      id: "default",
      urlTemplate: undefined,
    });
  });

  it("lists and resolves a custom engine without sending suggestions", () => {
    const custom = {
      id: "custom",
      name: "站内搜索",
      urlTemplate: "https://example.com/?q=%s",
    };
    const settings = {
      ...defaultState().settings,
      searchEngine: custom.id,
      customEngines: [custom],
    };
    expect(listEngines(settings).at(-1)?.id).toBe(custom.id);
    expect(resolveEngine(settings)).toMatchObject({
      ...custom,
      kind: "custom",
      suggest: false,
    });
  });

  it("trims and escapes the query without injecting URL parameters", () => {
    expect(buildSearchUrl("https://example.com/?q=%s", "  印象&派=画  ")).toBe(
      "https://example.com/?q=%E5%8D%B0%E8%B1%A1%26%E6%B4%BE%3D%E7%94%BB",
    );
  });
});
