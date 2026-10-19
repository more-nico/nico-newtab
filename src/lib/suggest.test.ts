import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  MAX_SUGGESTIONS,
  decodeBody,
  normalizeSuggestions,
  parseBaiduSuggestions,
  parseSuggestions,
  suggestHosts,
  suggestRequest,
} from "./suggest";
import { NUTSTORE_SERVER_URL } from "./nutstore";

const manifest = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../../public/manifest.json", import.meta.url)),
    "utf8",
  ),
) as {
  host_permissions?: string[];
  content_security_policy?: { extension_pages?: string };
};

describe("suggestion parsing", () => {
  it("reads the OpenSearch pair form", () =>
    expect(
      parseSuggestions('["nico",["nico rosberg","nicovideo"]]', "nico"),
    ).toEqual(["nico rosberg", "nicovideo"]));
  it("reads the DuckDuckGo phrase objects", () =>
    expect(
      parseSuggestions(
        '[{"phrase":"nico rosberg"},{"phrase":"nicovideo"}]',
        "nico",
      ),
    ).toEqual(["nico rosberg", "nicovideo"]));
  it("reads a bare string array", () =>
    expect(parseSuggestions('["alpha","beta"]', "q")).toEqual([
      "alpha",
      "beta",
    ]));
  it("reads Baidu's decoded payload", () =>
    expect(
      parseBaiduSuggestions(
        'window.baidu.sug({q:"nico",p:false,s:["nico rosberg","nicovideo"]})',
        "nico",
      ),
    ).toEqual(["nico rosberg", "nicovideo"]));
  it("keeps a Baidu suggestion that contains a bracket", () =>
    expect(
      parseBaiduSuggestions(
        'window.baidu.sug({q:"a",p:false,s:["a]b","c"]})',
        "a",
      ),
    ).toEqual(["a]b", "c"]));
  it("keeps a Baidu suggestion that contains an escaped quote", () =>
    expect(
      parseBaiduSuggestions('window.baidu.sug({s:["say \\"hi\\"","next"]})'),
    ).toEqual(['say "hi"', "next"]));
  it.each(["", "<html></html>", "null", "{}", "undefined", '["q"]'])(
    "returns nothing for %s",
    (body) => {
      expect(parseSuggestions(body, "q")).toEqual([]);
      expect(parseBaiduSuggestions(body, "q")).toEqual([]);
    },
  );
});

describe("suggestion normalization", () => {
  it("drops the query itself, duplicates and blanks", () =>
    expect(
      normalizeSuggestions(
        ["nico", "NICO", "", "   ", "nicovideo", "nicovideo"],
        "nico",
      ),
    ).toEqual(["nicovideo"]));
  it("folds internal whitespace and trims entries", () =>
    expect(normalizeSuggestions(["  nico   rosberg  "], "q")).toEqual([
      "nico rosberg",
    ]));
  it("drops over-long entries", () =>
    expect(normalizeSuggestions(["ok", "x".repeat(121)], "q")).toEqual(["ok"]));
  it("caps the list", () =>
    expect(
      normalizeSuggestions(
        Array.from({ length: 20 }, (_, i) => `suggestion ${i}`),
        "q",
      ),
    ).toHaveLength(MAX_SUGGESTIONS));
  it("returns nothing for a non-array payload", () =>
    expect(normalizeSuggestions("nope", "q")).toEqual([]));
});

describe("suggestion requests", () => {
  it("returns no endpoint for custom engines", () => {
    expect(suggestRequest("engine-1", "nico")).toBeNull();
    expect(suggestRequest("default", "nico")).toBeNull();
  });
  it.each([
    [
      "google",
      "https://suggestqueries.google.com/complete/search?client=chrome&q=nico",
    ],
    ["bing", "https://api.bing.com/osjson.aspx?query=nico"],
    ["baidu", "https://suggestion.baidu.com/su?wd=nico&ie=utf-8"],
    ["duckduckgo", "https://duckduckgo.com/ac/?q=nico&type=list"],
  ])("builds an encoded endpoint URL for %s", (engine, expected) =>
    expect(suggestRequest(engine, "nico")?.url).toBe(expected),
  );
  it("encodes the query", () =>
    expect(suggestRequest("bing", "a b&c")?.url).toBe(
      "https://api.bing.com/osjson.aspx?query=a%20b%26c",
    ));
  it("marks Baidu as the wrapped-script parser", () =>
    expect(suggestRequest("baidu", "q")?.parser).toBe("baidu"));
  it("uses the plain JSON parser for every other engine", () =>
    expect(
      ["google", "bing", "duckduckgo"].map(
        (engine) => suggestRequest(engine, "q")?.parser,
      ),
    ).toEqual(["opensearch", "opensearch", "opensearch"]));
});

describe("response decoding", () => {
  const utf8 = (text: string) => new TextEncoder().encode(text).buffer;
  // 华为 in GBK.
  const gbk = new Uint8Array([0xbb, 0xaa, 0xce, 0xaa]).buffer;

  it("honours a declared GBK charset", () =>
    expect(decodeBody("text/javascript; charset=GBK", gbk)).toBe("华为"));
  it.each(["application/json; charset=utf-8", "application/json", null, ""])(
    "decodes %s as UTF-8",
    (contentType) => expect(decodeBody(contentType, utf8("华为"))).toBe("华为"),
  );
  it("falls back to UTF-8 for an unknown charset label", () =>
    expect(decodeBody("text/plain; charset=nonsense-9", utf8("华为"))).toBe(
      "华为",
    ));
  // Baidu serves UTF-8 today; decoding it as GBK turned every suggestion into
  // mojibake, so lock the real-world shape end to end.
  it("reads Baidu's live response without mojibake", () => {
    const body =
      'window.baidu.sug({q:"huaw",p:false,s:["huawei","华为","华为云空间"]})';
    const decoded = decodeBody("text/javascript; charset=UTF-8", utf8(body));
    expect(parseBaiduSuggestions(decoded, "huaw")).toEqual([
      "huawei",
      "华为",
      "华为云空间",
    ]);
  });
});

describe("manifest permissions", () => {
  it("grants every suggestion host in both host_permissions and connect-src", () => {
    const connect = manifest.content_security_policy?.extension_pages ?? "";
    for (const host of suggestHosts()) {
      expect(manifest.host_permissions).toContain(`${host}/*`);
      expect(connect).toContain(host);
    }
  });
  it("grants the Nutstore WebDAV host in both places", () => {
    const host = new URL(NUTSTORE_SERVER_URL).origin;
    const connect = manifest.content_security_policy?.extension_pages ?? "";
    expect(manifest.host_permissions).toContain(`${host}/*`);
    expect(connect).toContain(host);
  });
  it("keeps connect-src free of hosts that no endpoint uses", () => {
    const connect = manifest.content_security_policy?.extension_pages ?? "";
    const declared = connect
      .split("connect-src")[1]
      .split(";")[0]
      .trim()
      .split(/\s+/)
      .filter((source) => source !== "'self'");
    const syncHost = new URL(NUTSTORE_SERVER_URL).origin;
    expect(declared.sort()).toEqual([...suggestHosts(), syncHost].sort());
  });
});
