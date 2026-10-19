/**
 * Nutstore (坚果云) WebDAV transport.
 *
 * Pure `fetch` client: it never touches the DOM, so the whole module can be
 * unit tested in Node with a stubbed global `fetch`. Error messages are
 * user-facing Chinese strings and can be rendered as-is.
 */

/** 坚果云官方 WebDAV 根地址（来自坚果云帮助中心“第三方应用授权”）。 */
export const NUTSTORE_SERVER_URL = "https://dav.jianguoyun.com/dav";
/** 帮助中心：如何生成第三方应用密码。 */
export const NUTSTORE_MANUAL_URL = "https://help.jianguoyun.com/?p=2064";

/** Every WebDAV request gives up after 30 seconds. */
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SERVER_URL_LENGTH = 2048;
const MAX_REMOTE_DIR_LENGTH = 200;
const MAX_REMOTE_SEGMENT_LENGTH = 64;

export interface NutstoreCredentials {
  /** E.g. https://dav.jianguoyun.com/dav */
  serverUrl: string;
  /** 坚果云账号（邮箱）. */
  username: string;
  /** 第三方应用密码，不是登录密码. */
  password: string;
  /** 同步目录，例如 nico-newtab（可多级，不能为空）. */
  remoteDir: string;
}

export type NutstoreErrorCode =
  | "config"
  | "auth"
  | "rate-limit"
  | "conflict"
  | "quota"
  | "network"
  | "server";

/** 面向用户的中文错误。message 可直接展示。 */
export class NutstoreError extends Error {
  constructor(
    message: string,
    readonly code: NutstoreErrorCode,
    readonly status?: number,
  ) {
    super(message);
    this.name = "NutstoreError";
  }
}

const AUTH_MESSAGE =
  "坚果云账号或应用密码不正确。请在坚果云网页端 → 账户信息 → 安全选项 → 第三方应用管理 生成应用密码后重试。";
const FORBIDDEN_MESSAGE = "坚果云拒绝了这次请求，请确认账号已开通 WebDAV。";
const RATE_LIMIT_MESSAGE = "坚果云请求过于频繁，请稍后再试。";
const CONFLICT_MESSAGE = "云端备份已被其他设备修改，请重新同步。";
const QUOTA_MESSAGE = "坚果云空间不足，无法上传备份。";
const NOT_FOUND_MESSAGE =
  "WebDAV 地址不可用，请检查服务器地址与同步目录是否正确。";
const NETWORK_MESSAGE = "无法连接坚果云，请检查网络或服务器地址。";
const serverMessage = (status: number) =>
  `坚果云暂时不可用（HTTP ${status}），请稍后重试。`;
const rejectedMessage = (status: number) =>
  `坚果云拒绝了这次请求（HTTP ${status}），请检查服务器地址与同步目录是否正确。`;

/** Maps an unexpected HTTP status to the user-facing error taxonomy. */
function statusError(response: Response): NutstoreError {
  const { status } = response;
  if (status === 401) return new NutstoreError(AUTH_MESSAGE, "auth", status);
  if (status === 403)
    return new NutstoreError(FORBIDDEN_MESSAGE, "auth", status);
  if (status === 404)
    return new NutstoreError(NOT_FOUND_MESSAGE, "config", status);
  if (status === 412)
    return new NutstoreError(CONFLICT_MESSAGE, "conflict", status);
  // 429 and 503 are the throttling answers Nutstore is known to send. Keep this
  // branch before the generic 5xx branch.
  if (status === 429 || status === 503)
    return new NutstoreError(
      `${RATE_LIMIT_MESSAGE}${retryAfterSuffix(response)}`,
      "rate-limit",
      status,
    );
  if (status === 507) return new NutstoreError(QUOTA_MESSAGE, "quota", status);
  if (status >= 500)
    return new NutstoreError(serverMessage(status), "server", status);
  return new NutstoreError(rejectedMessage(status), "config", status);
}

/** Appends the server's suggested wait to a throttling message when numeric. */
function retryAfterSuffix(response: Response): string {
  const header = response.headers.get("retry-after");
  if (!header) return "";
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return "";
  return `建议等待约 ${Math.ceil(seconds)} 秒。`;
}

/** 校验并规范化服务器地址：仅 http/https；去尾部斜杠；http 只允许 localhost/127.0.0.1。 */
export function normalizeServerUrl(input: string): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value || value.length > MAX_SERVER_URL_LENGTH)
    throw new NutstoreError(
      "服务器地址不能为空，且不超过 2048 个字符。",
      "config",
    );
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NutstoreError(
      "服务器地址格式不正确，请填写完整的 WebDAV 地址。",
      "config",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new NutstoreError("服务器地址仅支持 HTTP 或 HTTPS。", "config");
  if (url.username || url.password)
    throw new NutstoreError("服务器地址不能包含账号和密码。", "config");
  if (url.search || url.hash)
    throw new NutstoreError("服务器地址不能包含查询参数或锚点。", "config");
  // Plain HTTP is only tolerated for the local mock server used in development.
  if (
    url.protocol === "http:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new NutstoreError(
      "出于安全考虑，HTTP 地址只允许本机（localhost / 127.0.0.1）测试使用。",
      "config",
    );
  return url.href.replace(/\/+$/, "");
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** 校验并规范化同步目录：去首尾斜杠，按 / 分段，每段 1–64 字符，禁止 `.` `..` 和控制字符，总长 ≤200。 */
export function normalizeRemoteDir(input: string): string {
  const value =
    typeof input === "string" ? input.trim().replace(/^\/+|\/+$/g, "") : "";
  if (!value)
    throw new NutstoreError("同步目录不能为空，例如 nico-newtab。", "config");
  if (value.length > MAX_REMOTE_DIR_LENGTH)
    throw new NutstoreError("同步目录过长，最多 200 个字符。", "config");
  const segments = value.split("/");
  for (const segment of segments) {
    if (!segment || segment.length > MAX_REMOTE_SEGMENT_LENGTH)
      throw new NutstoreError("同步目录的每一级需为 1–64 个字符。", "config");
    if (segment === "." || segment === "..")
      throw new NutstoreError("同步目录不能使用 . 或 .. 相对路径。", "config");
    if (CONTROL_CHARACTERS.test(segment))
      throw new NutstoreError("同步目录不能包含控制字符。", "config");
  }
  return segments.join("/");
}

/** Basic 认证头，按 UTF-8 编码（账号可能是中文邮箱/密码含特殊字符）。 */
export function authHeader(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  // Chunked conversion keeps the fromCharCode argument count safe.
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `Basic ${btoa(binary)}`;
}

const serverRootUrl = (credentials: NutstoreCredentials): string =>
  `${normalizeServerUrl(credentials.serverUrl)}/`;

const remoteDirSegments = (credentials: NutstoreCredentials): string[] =>
  normalizeRemoteDir(credentials.remoteDir)
    .split("/")
    .map((segment) => encodeURIComponent(segment));

/** Per-level directory URLs, ancestors first: a/b -> [.../a/, .../a/b/]. */
function directoryLevelUrls(credentials: NutstoreCredentials): string[] {
  const serverUrl = normalizeServerUrl(credentials.serverUrl);
  const segments = remoteDirSegments(credentials);
  return segments.map(
    (_, index) => `${serverUrl}/${segments.slice(0, index + 1).join("/")}/`,
  );
}

/** 目录 URL（末尾带 /）。 */
export function directoryUrl(credentials: NutstoreCredentials): string {
  const levels = directoryLevelUrls(credentials);
  return levels[levels.length - 1];
}

/** 拼接远端文件 URL：serverUrl + "/" + 逐段 encodeURIComponent(remoteDir) + "/" + encodeURIComponent(fileName)。 */
export function fileUrl(
  credentials: NutstoreCredentials,
  fileName: string,
): string {
  return `${directoryUrl(credentials)}${encodeURIComponent(fileName)}`;
}

interface NutstoreRequest {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Network failures and timeouts both look like "could not reach Nutstore". */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    return name === "TimeoutError" || name === "AbortError";
  }
  return false;
}

async function request(
  credentials: NutstoreCredentials,
  url: string,
  init: NutstoreRequest,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: init.method,
      headers: {
        Authorization: authHeader(credentials.username, credentials.password),
        ...init.headers,
      },
      body: init.body,
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isNetworkFailure(error))
      throw new NutstoreError(NETWORK_MESSAGE, "network");
    throw error;
  }
}

/** PROPFIND Depth:0 验证凭据与地址；207/200 视为成功。 */
export async function testConnection(
  credentials: NutstoreCredentials,
): Promise<void> {
  // Probe the configured server root, not the sync directory: a fresh account
  // has no sync folder yet, and uploadFile creates it on the first write.
  const response = await request(credentials, serverRootUrl(credentials), {
    method: "PROPFIND",
    headers: { Depth: "0" },
  });
  if (response.status !== 207 && response.status !== 200)
    throw statusError(response);
}

export interface RemoteFile {
  text: string;
  /** 服务器给的原始 ETag（含引号则保留）；没有则为 null。 */
  etag: string | null;
  lastModified: string | null;
}

/**
 * GET 远端 JSON；404 返回 null；其他错误抛 NutstoreError。
 *
 * Nutstore answers **409 Conflict** with an `AncestorsNotFound` XML body when
 * the file's parent collection does not exist yet — i.e. the very first sync
 * on a fresh account. That is "no remote backup", not a failing request: the
 * caller must be able to fall through to the first upload, which creates the
 * folder. A 409 for a single-file GET carries no other useful meaning here, so
 * both the documented marker and plain 409s map to `null`; a genuine problem
 * resurfaces on the following PUT.
 */
export async function downloadFile(
  credentials: NutstoreCredentials,
  fileName: string,
): Promise<RemoteFile | null> {
  const response = await request(credentials, fileUrl(credentials, fileName), {
    method: "GET",
  });
  if (response.status === 404) return null;
  if (response.status === 409) {
    // Drain the (possibly XML) error body so the connection can be reused.
    await response.text().catch(() => "");
    return null;
  }
  if (!response.ok) throw statusError(response);
  return {
    text: await response.text(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

export type WriteCondition = { etag: string } | { absent: true } | undefined;

function conditionalHeaders(condition: WriteCondition): Record<string, string> {
  if (!condition) return {};
  return "absent" in condition
    ? { "If-None-Match": "*" }
    : { "If-Match": condition.etag };
}

/**
 * Creates the sync directory and any missing ancestors, level by level; 405
 * means another device already created that level, which is fine.
 */
async function ensureDirectory(
  credentials: NutstoreCredentials,
): Promise<void> {
  for (const url of directoryLevelUrls(credentials)) {
    const response = await request(credentials, url, { method: "MKCOL" });
    if (response.ok || response.status === 405) continue;
    throw statusError(response);
  }
}

/**
 * PUT 远端 JSON。condition:
 * - `{ absent: true }` → `If-None-Match: *`（远端应不存在）
 * - `{ etag }` → `If-Match: <etag>`（基于读到的版本做条件更新）
 * - undefined → 无条件覆盖
 * 父目录缺失（404/409）时自动 MKCOL 目录再重试一次（MKCOL 405 = 已存在，可继续）。
 */
export async function uploadFile(
  credentials: NutstoreCredentials,
  fileName: string,
  text: string,
  condition?: WriteCondition,
): Promise<{ etag: string | null }> {
  const url = fileUrl(credentials, fileName);
  const put = (conditional: boolean) =>
    request(credentials, url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(conditional ? conditionalHeaders(condition) : {}),
      },
      body: text,
    });
  let response = await put(true);
  // First upload on a fresh account: the parent collection does not exist yet.
  // Create it and retry exactly once so a broken config cannot loop.
  if (response.status === 404 || response.status === 409) {
    await ensureDirectory(credentials);
    response = await put(true);
  }
  // Nutstore does not document conditional writes, so a server may reject the
  // precondition header itself (400/501, and some replies use 409 after the
  // folder exists). One conditional-free retry keeps ETag support safe without
  // masking real conflicts (412) or other errors.
  if (
    condition &&
    (response.status === 400 ||
      response.status === 409 ||
      response.status === 501)
  )
    response = await put(false);
  if (!response.ok) throw statusError(response);
  return { etag: response.headers.get("etag") };
}
