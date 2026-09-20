import { describe, expect, it } from "vitest";
import { DEFAULT_GLASS_SETTINGS, defaultState } from "../data";
import { normalizeUrl, parseBackup, parseState } from "./validation";

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
