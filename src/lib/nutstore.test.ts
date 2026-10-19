import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NUTSTORE_MANUAL_URL,
  NUTSTORE_SERVER_URL,
  NutstoreError,
  authHeader,
  directoryUrl,
  downloadFile,
  fileUrl,
  normalizeRemoteDir,
  normalizeServerUrl,
  testConnection,
  uploadFile,
  type NutstoreCredentials,
  type NutstoreErrorCode,
} from "./nutstore";

const credentials: NutstoreCredentials = {
  serverUrl: NUTSTORE_SERVER_URL,
  username: "user@example.com",
  password: "app-password",
  remoteDir: "nico-newtab",
};

interface FetchCall {
  url: string;
  init: RequestInit;
}

type Step = Response | (() => Response | Promise<Response>);

let calls: FetchCall[] = [];
let steps: Step[] = [];

const fetchMock = vi.fn(
  async (input: unknown, init?: RequestInit): Promise<Response> => {
    calls.push({ url: String(input), init: init ?? {} });
    const step = steps.shift();
    if (!step) throw new Error("测试中没有预设更多 fetch 响应");
    return typeof step === "function" ? await step() : step;
  },
);

/** Queues the responses (or thrown failures) the next fetch calls see. */
function respond(...next: Step[]): void {
  steps = next;
}

const headersOf = (call: FetchCall): Record<string, string> =>
  call.init.headers as Record<string, string>;

const response = (
  status: number,
  body = "",
  headers: Record<string, string> = {},
): Response => new Response(body, { status, headers });

async function expectNutstoreError(
  run: () => Promise<unknown>,
  code: NutstoreErrorCode,
): Promise<NutstoreError> {
  const error = await run().then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(NutstoreError);
  const nutstoreError = error as NutstoreError;
  expect(nutstoreError.code).toBe(code);
  return nutstoreError;
}

beforeEach(() => {
  calls = [];
  steps = [];
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("constants", () => {
  it("exposes the official server and manual URLs", () => {
    expect(NUTSTORE_SERVER_URL).toBe("https://dav.jianguoyun.com/dav");
    expect(NUTSTORE_MANUAL_URL).toBe("https://help.jianguoyun.com/?p=2064");
  });
});

describe("normalizeServerUrl", () => {
  it.each([
    ["https://dav.jianguoyun.com/dav", "https://dav.jianguoyun.com/dav"],
    ["  https://dav.jianguoyun.com/dav/  ", "https://dav.jianguoyun.com/dav"],
    ["https://dav.jianguoyun.com", "https://dav.jianguoyun.com"],
    ["HTTP://LOCALHOST:8787/dav/", "http://localhost:8787/dav"],
    ["http://127.0.0.1:8787/dav", "http://127.0.0.1:8787/dav"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeServerUrl(input)).toBe(expected),
  );

  it.each([
    ["", "空地址"],
    ["   ", "空白地址"],
    ["not-a-url", "缺少协议"],
    ["dav.jianguoyun.com/dav", "缺少协议"],
    ["ftp://dav.jianguoyun.com/dav", "非 HTTP 协议"],
    ["file:///tmp/dav", "本地文件协议"],
    ["javascript:alert(1)", "脚本协议"],
    ["http://example.com/dav", "非本机的明文 HTTP"],
    ["https://user:pass@dav.jianguoyun.com/dav", "内嵌账号密码"],
    ["https://dav.jianguoyun.com/dav?x=1", "查询参数"],
    ["https://dav.jianguoyun.com/dav#top", "锚点"],
    [`https://dav.jianguoyun.com/${"x".repeat(2049)}`, "超长地址"],
  ])("rejects %s (%s)", (input) =>
    expect(() => normalizeServerUrl(input)).toThrow(NutstoreError),
  );

  it("reports normalization failures as config errors", () => {
    expect(() => normalizeServerUrl("ftp://example.com")).toThrow(
      expect.objectContaining({ code: "config" }),
    );
  });
});

describe("normalizeRemoteDir", () => {
  it.each([
    ["nico-newtab", "nico-newtab"],
    ["  /nico-newtab/  ", "nico-newtab"],
    ["photos/nico", "photos/nico"],
    ["备份/今日 数据", "备份/今日 数据"],
    ["a/b/c", "a/b/c"],
  ])("normalizes %s", (input, expected) =>
    expect(normalizeRemoteDir(input)).toBe(expected),
  );

  it.each([
    ["", "空目录"],
    ["   ", "空白目录"],
    ["/", "只有斜杠"],
    ["///", "只有斜杠"],
    [".", "当前目录"],
    ["..", "上级目录"],
    ["a/../b", "路径穿越"],
    ["a/./b", "当前目录段"],
    ["a//b", "空路径段"],
    ["a".repeat(65), "单段过长"],
    [
      ["a".repeat(60), "b".repeat(60), "c".repeat(60), "d".repeat(60)].join(
        "/",
      ),
      "总长超限",
    ],
    ["a\nb", "换行符"],
    ["a\u0000b", "控制字符"],
    ["a\u007fb", "DEL 控制字符"],
  ])("rejects %s (%s)", (input) =>
    expect(() => normalizeRemoteDir(input)).toThrow(NutstoreError),
  );

  it("reports normalization failures as config errors", () => {
    expect(() => normalizeRemoteDir("..")).toThrow(
      expect.objectContaining({ code: "config" }),
    );
  });
});

describe("authHeader", () => {
  it("encodes credentials as Basic base64", () => {
    expect(authHeader("user@example.com", "app-password")).toBe(
      `Basic ${Buffer.from("user@example.com:app-password", "utf8").toString("base64")}`,
    );
  });

  it("encodes Chinese accounts and passwords as UTF-8, not Latin-1", () => {
    expect(authHeader("中文@例子.com", "密码 🔑")).toBe(
      `Basic ${Buffer.from("中文@例子.com:密码 🔑", "utf8").toString("base64")}`,
    );
  });
});

describe("remote URLs", () => {
  it("builds the directory URL with a trailing slash", () =>
    expect(directoryUrl(credentials)).toBe(
      "https://dav.jianguoyun.com/dav/nico-newtab/",
    ));

  it("builds the file URL", () =>
    expect(fileUrl(credentials, "nico-newtab.json")).toBe(
      "https://dav.jianguoyun.com/dav/nico-newtab/nico-newtab.json",
    ));

  it("encodes every directory segment and the file name", () =>
    expect(
      fileUrl(
        {
          ...credentials,
          serverUrl: "https://dav.jianguoyun.com/dav/",
          remoteDir: "备份/今日 数据",
        },
        "图片.json",
      ),
    ).toBe(
      "https://dav.jianguoyun.com/dav/%E5%A4%87%E4%BB%BD/%E4%BB%8A%E6%97%A5%20%E6%95%B0%E6%8D%AE/%E5%9B%BE%E7%89%87.json",
    ));
});

describe("testConnection", () => {
  it("probes the server root, not the sync directory", async () => {
    respond(response(207));
    await testConnection(credentials);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    // A fresh Nutstore account has no sync folder yet, so the probe must hit
    // the configured server root (the sync dir is created by uploadFile).
    expect(call.url).toBe("https://dav.jianguoyun.com/dav/");
    expect(call.url.endsWith("/dav/")).toBe(true);
    expect(call.url).not.toContain("/nico-newtab");
    expect(call.init.method).toBe("PROPFIND");
    expect(headersOf(call).Depth).toBe("0");
    expect(headersOf(call).Authorization).toBe(
      authHeader(credentials.username, credentials.password),
    );
    expect(call.init.credentials).toBe("omit");
    expect(call.init.cache).toBe("no-store");
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("accepts 200 as well as 207", async () => {
    respond(response(200));
    await expect(testConnection(credentials)).resolves.toBeUndefined();
  });

  it.each([
    [401, "auth", "应用密码"],
    [403, "auth", "WebDAV"],
    [429, "rate-limit", "过于频繁"],
    [503, "rate-limit", "过于频繁"],
    [507, "quota", "空间不足"],
    [500, "server", "HTTP 500"],
    [502, "server", "HTTP 502"],
    [404, "config", "WebDAV 地址不可用"],
    [400, "config", "拒绝"],
  ])("maps HTTP %i to a %s error", async (status, code, message) => {
    respond(response(status));
    const error = await expectNutstoreError(
      () => testConnection(credentials),
      code as NutstoreErrorCode,
    );
    expect(error.status).toBe(status);
    expect(error.message).toContain(message);
  });

  it("maps a 404 to the not-found config message", async () => {
    respond(response(404));
    const error = await expectNutstoreError(
      () => testConnection(credentials),
      "config",
    );
    expect(error.message.startsWith("WebDAV 地址不可用")).toBe(true);
  });

  it("includes a numeric Retry-After wait in throttling messages", async () => {
    respond(response(429, "", { "Retry-After": "30" }));
    const error = await expectNutstoreError(
      () => testConnection(credentials),
      "rate-limit",
    );
    expect(error.message).toContain("过于频繁");
    expect(error.message).toContain("30 秒");
  });

  it("ignores a non-numeric Retry-After header", async () => {
    respond(
      response(503, "", { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }),
    );
    const error = await expectNutstoreError(
      () => testConnection(credentials),
      "rate-limit",
    );
    expect(error.message).toBe("坚果云请求过于频繁，请稍后再试。");
  });

  it.each([
    [
      "a fetch TypeError",
      () => Promise.reject(new TypeError("Failed to fetch")),
    ],
    [
      "a timeout",
      () =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError"),
        ),
    ],
    [
      "an abort",
      () => Promise.reject(new DOMException("Aborted", "AbortError")),
    ],
  ])("maps %s to a network error", async (_label, reject) => {
    respond(reject);
    const error = await expectNutstoreError(
      () => testConnection(credentials),
      "network",
    );
    expect(error.message).toBe("无法连接坚果云，请检查网络或服务器地址。");
  });

  it("rethrows unexpected errors untouched", async () => {
    const crash = new Error("boom");
    respond(() => {
      throw crash;
    });
    await expect(testConnection(credentials)).rejects.toBe(crash);
  });
});

describe("downloadFile", () => {
  it("returns the body, raw ETag and last-modified date", async () => {
    respond(
      response(200, '{"format":"nico-newtab"}', {
        ETag: '"abc123"',
        "Last-Modified": "Mon, 19 Oct 2026 10:00:00 GMT",
      }),
    );
    await expect(
      downloadFile(credentials, "nico-newtab.json"),
    ).resolves.toEqual({
      text: '{"format":"nico-newtab"}',
      etag: '"abc123"',
      lastModified: "Mon, 19 Oct 2026 10:00:00 GMT",
    });
    expect(calls[0].url).toBe(
      "https://dav.jianguoyun.com/dav/nico-newtab/nico-newtab.json",
    );
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.credentials).toBe("omit");
    expect(calls[0].init.cache).toBe("no-store");
  });

  it("returns null ETag and date when the headers are absent", async () => {
    respond(response(200, "{}"));
    await expect(
      downloadFile(credentials, "nico-newtab.json"),
    ).resolves.toEqual({ text: "{}", etag: null, lastModified: null });
  });

  it("returns null when the remote file does not exist", async () => {
    respond(response(404));
    await expect(
      downloadFile(credentials, "nico-newtab.json"),
    ).resolves.toBeNull();
  });

  it("treats Nutstore's AncestorsNotFound 409 as a missing remote backup", async () => {
    // Reproduced against a real Nutstore account on the first sync: the parent
    // collection nico-newtab/ does not exist yet, so GET answers 409 with an
    // AncestorsNotFound XML body instead of 404.
    respond(
      response(
        409,
        '<?xml version="1.0"?><d:error xmlns:d="DAV:"><s:exception xmlns:s="http://sabredav.org/ns">AncestorsNotFound</s:exception></d:error>',
        { "Content-Type": "application/xml; charset=utf-8" },
      ),
    );
    await expect(
      downloadFile(credentials, "nico-newtab.json"),
    ).resolves.toBeNull();
  });

  it("treats a plain 409 on a single-file GET as a missing remote backup", async () => {
    respond(response(409, "Conflict"));
    await expect(
      downloadFile(credentials, "nico-newtab.json"),
    ).resolves.toBeNull();
  });

  it("maps other failures", async () => {
    respond(response(401));
    const error = await expectNutstoreError(
      () => downloadFile(credentials, "nico-newtab.json"),
      "auth",
    );
    expect(error.status).toBe(401);
  });

  it("maps network failures", async () => {
    respond(() => Promise.reject(new TypeError("Failed to fetch")));
    await expectNutstoreError(
      () => downloadFile(credentials, "nico-newtab.json"),
      "network",
    );
  });
});

describe("uploadFile", () => {
  const fileBody = '{"format":"nico-newtab"}';

  it("PUTs JSON with the shared request options", async () => {
    respond(response(201, "", { ETag: '"v1"' }));
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody),
    ).resolves.toEqual({ etag: '"v1"' });
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe(
      "https://dav.jianguoyun.com/dav/nico-newtab/nico-newtab.json",
    );
    expect(call.init.method).toBe("PUT");
    expect(call.init.body).toBe(fileBody);
    expect(headersOf(call)["Content-Type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(headersOf(call).Authorization).toBe(
      authHeader(credentials.username, credentials.password),
    );
    expect(call.init.credentials).toBe("omit");
    expect(call.init.cache).toBe("no-store");
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends no conditional headers without a condition", async () => {
    respond(response(200));
    await uploadFile(credentials, "nico-newtab.json", fileBody);
    expect(headersOf(calls[0])["If-Match"]).toBeUndefined();
    expect(headersOf(calls[0])["If-None-Match"]).toBeUndefined();
  });

  it("sends If-None-Match: * for a create-only write", async () => {
    respond(response(201));
    await uploadFile(credentials, "nico-newtab.json", fileBody, {
      absent: true,
    });
    expect(headersOf(calls[0])["If-None-Match"]).toBe("*");
    expect(headersOf(calls[0])["If-Match"]).toBeUndefined();
  });

  it("sends the raw ETag through If-Match for a conditional write", async () => {
    respond(response(200));
    await uploadFile(credentials, "nico-newtab.json", fileBody, {
      etag: 'W/"v1"',
    });
    expect(headersOf(calls[0])["If-Match"]).toBe('W/"v1"');
    expect(headersOf(calls[0])["If-None-Match"]).toBeUndefined();
  });

  it("maps 412 to a conflict error", async () => {
    respond(response(412));
    const error = await expectNutstoreError(
      () =>
        uploadFile(credentials, "nico-newtab.json", fileBody, { etag: '"x"' }),
      "conflict",
    );
    expect(error.status).toBe(412);
    expect(error.message).toBe("云端备份已被其他设备修改，请重新同步。");
    expect(calls).toHaveLength(1);
  });

  it.each([
    [401, "auth", "应用密码"],
    [403, "auth", "WebDAV"],
    [429, "rate-limit", "过于频繁"],
    [503, "rate-limit", "过于频繁"],
    [507, "quota", "空间不足"],
    [500, "server", "HTTP 500"],
    [400, "config", "拒绝"],
  ])("maps HTTP %i to a %s error", async (status, code, message) => {
    respond(response(status));
    const error = await expectNutstoreError(
      () => uploadFile(credentials, "nico-newtab.json", fileBody),
      code as NutstoreErrorCode,
    );
    expect(error.status).toBe(status);
    expect(error.message).toContain(message);
  });

  it("treats a 409 on the first PUT as a missing parent collection", async () => {
    respond(response(409), response(201), response(201, "", { ETag: '"v6"' }));
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody, { absent: true }),
    ).resolves.toEqual({ etag: '"v6"' });
    expect(calls.map((call) => call.init.method)).toEqual([
      "PUT",
      "MKCOL",
      "PUT",
    ]);
    expect(headersOf(calls[2])["If-None-Match"]).toBe("*");
  });

  it("retries unconditionally when a 409 survives the directory creation", async () => {
    // Some servers reject the precondition header itself with 409; once the
    // folder exists, one unconditional retry keeps first sync usable.
    respond(
      response(409),
      response(405),
      response(409),
      response(201, "", { ETag: '"v5"' }),
    );
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody, { absent: true }),
    ).resolves.toEqual({ etag: '"v5"' });
    expect(calls.map((call) => call.init.method)).toEqual([
      "PUT",
      "MKCOL",
      "PUT",
      "PUT",
    ]);
    expect(headersOf(calls[3])["If-None-Match"]).toBeUndefined();
  });

  it("creates the directory and retries once when the parent is missing", async () => {
    respond(response(404), response(201), response(201, "", { ETag: '"v2"' }));
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody, { absent: true }),
    ).resolves.toEqual({ etag: '"v2"' });
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      ["PUT", "https://dav.jianguoyun.com/dav/nico-newtab/nico-newtab.json"],
      ["MKCOL", "https://dav.jianguoyun.com/dav/nico-newtab/"],
      ["PUT", "https://dav.jianguoyun.com/dav/nico-newtab/nico-newtab.json"],
    ]);
    // The conditional header is replayed on the retried write.
    expect(headersOf(calls[2])["If-None-Match"]).toBe("*");
  });

  it("treats MKCOL 405 as an existing directory and retries", async () => {
    respond(response(409), response(405), response(201));
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody),
    ).resolves.toEqual({ etag: null });
    expect(calls.map((call) => call.init.method)).toEqual([
      "PUT",
      "MKCOL",
      "PUT",
    ]);
  });

  it("accepts MKCOL 200 and 204 as success", async () => {
    respond(response(404), response(200), response(200));
    await expect(
      uploadFile(credentials, "nico-newtab.json", fileBody),
    ).resolves.toEqual({ etag: null });
    expect(calls).toHaveLength(3);
  });

  it("does not retry the write when MKCOL fails", async () => {
    respond(response(404), response(403));
    const error = await expectNutstoreError(
      () => uploadFile(credentials, "nico-newtab.json", fileBody),
      "auth",
    );
    expect(error.status).toBe(403);
    expect(calls).toHaveLength(2);
  });

  it("surfaces the retried write failure without another MKCOL", async () => {
    respond(response(404), response(201), response(500));
    const error = await expectNutstoreError(
      () => uploadFile(credentials, "nico-newtab.json", fileBody),
      "server",
    );
    expect(error.message).toContain("HTTP 500");
    expect(calls).toHaveLength(3);
  });

  it.each([400, 501])(
    "falls back to an unconditional PUT when a %i rejects the precondition header",
    async (status) => {
      respond(response(status), response(201, "", { ETag: '"v3"' }));
      await expect(
        uploadFile(credentials, "nico-newtab.json", fileBody, {
          etag: '"v2"',
        }),
      ).resolves.toEqual({ etag: '"v3"' });
      expect(calls).toHaveLength(2);
      expect(calls[0].init.method).toBe("PUT");
      expect(headersOf(calls[0])["If-Match"]).toBe('"v2"');
      expect(calls[1].init.method).toBe("PUT");
      expect(calls[1].url).toBe(calls[0].url);
      expect(calls[1].init.body).toBe(fileBody);
      expect(headersOf(calls[1])["If-Match"]).toBeUndefined();
      expect(headersOf(calls[1])["If-None-Match"]).toBeUndefined();
    },
  );

  it("surfaces the failure of the unconditional fallback PUT", async () => {
    respond(response(400), response(500));
    const error = await expectNutstoreError(
      () =>
        uploadFile(credentials, "nico-newtab.json", fileBody, {
          absent: true,
        }),
      "server",
    );
    expect(error.status).toBe(500);
    expect(calls).toHaveLength(2);
  });

  it("creates nested remote directories level by level", async () => {
    const nested = { ...credentials, remoteDir: "备份/坚果云" };
    respond(
      response(404),
      response(405),
      response(201),
      response(201, "", { ETag: '"v4"' }),
    );
    await expect(
      uploadFile(nested, "nico-newtab.json", fileBody),
    ).resolves.toEqual({ etag: '"v4"' });
    expect(calls.map((call) => [call.init.method, call.url])).toEqual([
      [
        "PUT",
        "https://dav.jianguoyun.com/dav/%E5%A4%87%E4%BB%BD/%E5%9D%9A%E6%9E%9C%E4%BA%91/nico-newtab.json",
      ],
      ["MKCOL", "https://dav.jianguoyun.com/dav/%E5%A4%87%E4%BB%BD/"],
      [
        "MKCOL",
        "https://dav.jianguoyun.com/dav/%E5%A4%87%E4%BB%BD/%E5%9D%9A%E6%9E%9C%E4%BA%91/",
      ],
      [
        "PUT",
        "https://dav.jianguoyun.com/dav/%E5%A4%87%E4%BB%BD/%E5%9D%9A%E6%9E%9C%E4%BA%91/nico-newtab.json",
      ],
    ]);
  });

  it("stops creating directories at the first failed level", async () => {
    const nested = { ...credentials, remoteDir: "备份/坚果云" };
    respond(response(404), response(201), response(403));
    const error = await expectNutstoreError(
      () => uploadFile(nested, "nico-newtab.json", fileBody),
      "auth",
    );
    expect(error.status).toBe(403);
    expect(calls.map((call) => call.init.method)).toEqual([
      "PUT",
      "MKCOL",
      "MKCOL",
    ]);
  });
});
