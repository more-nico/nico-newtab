import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NUTSTORE_SERVER_URL,
  downloadFile,
  normalizeRemoteDir,
  normalizeServerUrl,
  testConnection,
  uploadFile,
  type NutstoreCredentials,
} from "./nutstore";

const credentials: NutstoreCredentials = {
  serverUrl: NUTSTORE_SERVER_URL,
  username: "中文@example.com",
  password: "应用密码",
  remoteDir: "nico-newtab",
};
const fetchMock = vi.fn<typeof fetch>();
const response = (status: number, body = "", headers = {}) =>
  new Response(body, { status, headers });
const respond = (...responses: Response[]) =>
  responses.forEach((value) => fetchMock.mockResolvedValueOnce(value));
const headers = (index: number) =>
  fetchMock.mock.calls[index][1]?.headers as Record<string, string>;
const methods = () => fetchMock.mock.calls.map(([, init]) => init?.method);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("WebDAV", () => {
  it.each(["http://example.com/dav", "https://user:pass@example.com/dav"])(
    "rejects an unsafe credential endpoint %s",
    (url) => expect(() => normalizeServerUrl(url)).toThrow(),
  );

  it("normalizes the server but rejects a traversing directory", () => {
    expect(normalizeServerUrl(`  ${NUTSTORE_SERVER_URL}/  `)).toBe(
      NUTSTORE_SERVER_URL,
    );
    expect(() => normalizeRemoteDir("backups/../private")).toThrow();
  });

  it("probes the root with UTF-8 authentication, without browser credentials", async () => {
    respond(response(207));
    await testConnection(credentials);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${NUTSTORE_SERVER_URL}/`);
    expect(methods()).toEqual(["PROPFIND"]);
    const encoded = headers(0).Authorization.split(" ")[1];
    expect(Buffer.from(encoded, "base64").toString("utf8")).toBe(
      `${credentials.username}:${credentials.password}`,
    );
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("omit");
  });

  it.each([
    [401, "auth"],
    [429, "rate-limit"],
    [507, "quota"],
    [500, "server"],
  ])("reports HTTP %i as %s", async (status, code) => {
    respond(response(status as number));
    await expect(testConnection(credentials)).rejects.toMatchObject({
      code,
      status,
    });
  });

  it("reports transport failure as a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(testConnection(credentials)).rejects.toMatchObject({
      code: "network",
    });
  });

  it("downloads the backup and preserves its raw ETag", async () => {
    respond(response(200, "{}", { ETag: 'W/"v1"' }));
    await expect(
      downloadFile(credentials, "backup.json"),
    ).resolves.toMatchObject({ text: "{}", etag: 'W/"v1"' });
  });

  it.each([404, 409])(
    "treats a fresh-account GET %i as no backup",
    async (status) => {
      respond(response(status));
      await expect(
        downloadFile(credentials, "backup.json"),
      ).resolves.toBeNull();
    },
  );

  it("creates nested directories and replays a create-only write", async () => {
    respond(
      response(409),
      response(405),
      response(201),
      response(201, "", { ETag: '"v2"' }),
    );
    await expect(
      uploadFile(
        { ...credentials, remoteDir: "备份/今日" },
        "backup.json",
        "{}",
        { absent: true },
      ),
    ).resolves.toEqual({ etag: '"v2"' });
    expect(methods()).toEqual(["PUT", "MKCOL", "MKCOL", "PUT"]);
    expect(String(fetchMock.mock.calls[2][0])).toBe(
      `${NUTSTORE_SERVER_URL}/%E5%A4%87%E4%BB%BD/%E4%BB%8A%E6%97%A5/`,
    );
    expect(headers(3)["If-None-Match"]).toBe("*");
    expect(fetchMock.mock.calls[3][1]?.body).toBe("{}");
  });

  it("stops before writing if directory creation fails", async () => {
    respond(response(404), response(403));
    await expect(
      uploadFile(credentials, "backup.json", "{}"),
    ).rejects.toMatchObject({ code: "auth" });
    expect(methods()).toEqual(["PUT", "MKCOL"]);
  });

  it("never overwrites a backup after an ETag conflict", async () => {
    respond(response(412));
    await expect(
      uploadFile(credentials, "backup.json", "{}", { etag: 'W/"v1"' }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(headers(0)["If-Match"]).toBe('W/"v1"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries an unsupported precondition only once and surfaces its failure", async () => {
    respond(response(400), response(500));
    await expect(
      uploadFile(credentials, "backup.json", "{}", { absent: true }),
    ).rejects.toMatchObject({ code: "server" });
    expect(methods()).toEqual(["PUT", "PUT"]);
    expect(headers(1)["If-None-Match"]).toBeUndefined();
  });
});
