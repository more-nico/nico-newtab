import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decodeBody,
  normalizeSuggestions,
  parseBaiduSuggestions,
  parseSuggestions,
  suggestHosts,
  suggestRequest,
} from "./suggest";
import { NUTSTORE_SERVER_URL } from "./nutstore";

describe("search suggestions", () => {
  it.each([
    ['["nico",["nicovideo","nico rosberg"]]', ["nicovideo", "nico rosberg"]],
    ['[{"phrase":"nicovideo"}]', ["nicovideo"]],
  ])("reads a supported JSON response %s", (body, expected) => {
    expect(parseSuggestions(body as string, "nico")).toEqual(expected);
  });

  it("decodes Baidu responses without executing script or corrupting Chinese", () => {
    const bytes = new TextEncoder().encode(
      'window.baidu.sug({s:["华为","a]b"]})',
    ).buffer;
    expect(
      parseBaiduSuggestions(
        decodeBody("text/javascript; charset=UTF-8", bytes),
      ),
    ).toEqual(["华为", "a]b"]);
  });

  it("filters duplicates, the query and invalid entries, and caps the result", () => {
    const entries = Array.from({ length: 10 }, (_, i) => `result ${i}`);
    expect(
      normalizeSuggestions(
        ["nico", "NICO", "", "x".repeat(121), ...entries, entries[0]],
        "nico",
      ),
    ).toEqual(entries.slice(0, 8));
  });

  it("degrades malformed server responses to an empty list", () => {
    expect(parseSuggestions("<html>server error</html>")).toEqual([]);
    expect(parseBaiduSuggestions("unrelatedFunction()")).toEqual([]);
  });

  it("encodes requests and never sends custom-engine queries to a preset provider", () => {
    expect(suggestRequest("bing", "a b&c")?.url).toBe(
      "https://api.bing.com/osjson.aspx?query=a%20b%26c",
    );
    expect(suggestRequest("custom", "private query")).toBeNull();
  });

  it("ships extension permissions and CSP access for the configured endpoints", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../../public/manifest.json", import.meta.url),
        "utf8",
      ),
    );
    for (const host of [
      ...suggestHosts(),
      new URL(NUTSTORE_SERVER_URL).origin,
    ]) {
      expect(manifest.host_permissions).toContain(`${host}/*`);
      expect(manifest.content_security_policy.extension_pages).toContain(host);
    }
  });
});
