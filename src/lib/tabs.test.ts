import { describe, expect, it } from "vitest";
import { pickExtensionTab } from "./tabs";

describe("extension tab selection", () => {
  const own = "chrome-extension://abc/index.html";
  it("prefers this extension over another extension", () => {
    expect(
      pickExtensionTab(
        [
          { id: 2, windowId: 1, url: "chrome-extension://other/options.html" },
          { id: 1, windowId: 1, url: own },
        ],
        own,
      ),
    ).toEqual({ id: 1, windowId: 1 });
  });
  it("never switches to a web page or an unusable tab", () => {
    expect(
      pickExtensionTab(
        [{ id: 3, url: "https://example.com/" }, { url: own }],
        own,
      ),
    ).toBeUndefined();
  });
});
