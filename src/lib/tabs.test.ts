import { describe, expect, it } from "vitest";
import { pickExtensionTab } from "./tabs";

describe("pickExtensionTab", () => {
  const own = "chrome-extension://abc123/index.html";

  it("prefers this extension's own page over other extension tabs", () => {
    expect(
      pickExtensionTab(
        [
          { id: 2, windowId: 1, url: "chrome-extension://xyz/options.html" },
          { id: 1, windowId: 1, url: own },
        ],
        own,
      ),
    ).toEqual({ id: 1, windowId: 1 });
  });

  it("falls back to any other extension page", () => {
    expect(
      pickExtensionTab(
        [
          { id: 3, url: "https://example.com/" },
          { id: 5, windowId: 2, url: "edge-extension://def/popup.html" },
        ],
        own,
      ),
    ).toEqual({ id: 5, windowId: 2 });
  });

  it("matches the literal extension:// scheme too", () => {
    expect(
      pickExtensionTab([{ id: 9, url: "extension://abc/panel.html" }], own),
    ).toEqual({ id: 9 });
  });

  it("ignores web tabs and tabs without an id", () => {
    expect(
      pickExtensionTab(
        [
          { id: 3, url: "https://example.com/" },
          { id: 4, url: "chrome://newtab" },
          { url: own },
        ],
        own,
      ),
    ).toBeUndefined();
  });

  it("returns undefined when nothing is open", () => {
    expect(pickExtensionTab([], own)).toBeUndefined();
  });
});
