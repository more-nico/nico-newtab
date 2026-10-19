/**
 * Nutstore WebDAV transport.
 *
 * Pure `fetch` client: it never touches the DOM, so the whole module can be
 * unit tested in Node with a stubbed global `fetch`. Error messages are
 * user-facing and localized at throw time.
 */

import { t } from "./i18n";

/**
 * Error copy for the active locale. Resolved per call, never at module load:
 * locale detection runs after the modules are imported.
 */
const messages = () => t().sync.errors;

/** Official Nutstore WebDAV root (from the Nutstore help center). */
export const NUTSTORE_SERVER_URL = "https://dav.jianguoyun.com/dav";
/** Help center: how to generate a third-party app password. */
export const NUTSTORE_MANUAL_URL = "https://help.jianguoyun.com/?p=2064";

/** Every WebDAV request gives up after 30 seconds. */
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SERVER_URL_LENGTH = 2048;
const MAX_REMOTE_DIR_LENGTH = 200;
const MAX_REMOTE_SEGMENT_LENGTH = 64;

export interface NutstoreCredentials {
  /** E.g. https://dav.jianguoyun.com/dav */
  serverUrl: string;
  /** Nutstore account (email). */
  username: string;
  /** Third-party app password, not the login password. */
  password: string;
  /** Sync folder, e.g. nico-newtab (may be nested, must not be empty). */
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

/** User-facing error. The message can be rendered as-is. */
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

/** Maps an unexpected HTTP status to the user-facing error taxonomy. */
function statusError(response: Response): NutstoreError {
  const { status } = response;
  const m = messages();
  if (status === 401) return new NutstoreError(m.auth, "auth", status);
  if (status === 403) return new NutstoreError(m.forbidden, "auth", status);
  if (status === 404) return new NutstoreError(m.notFound, "config", status);
  if (status === 412) return new NutstoreError(m.conflict, "conflict", status);
  // 429 and 503 are the throttling answers Nutstore is known to send. Keep this
  // branch before the generic 5xx branch.
  if (status === 429 || status === 503)
    return new NutstoreError(
      `${m.rateLimit}${retryAfterSuffix(response)}`,
      "rate-limit",
      status,
    );
  if (status === 507) return new NutstoreError(m.quota, "quota", status);
  if (status >= 500)
    return new NutstoreError(m.server(status), "server", status);
  return new NutstoreError(m.rejected(status), "config", status);
}

/** Appends the server's suggested wait to a throttling message when numeric. */
function retryAfterSuffix(response: Response): string {
  const header = response.headers.get("retry-after");
  if (!header) return "";
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return "";
  return messages().retryAfter(Math.ceil(seconds));
}

/** Validates and normalizes the server address: http/https only, no trailing slash; plain http only for localhost/127.0.0.1. */
export function normalizeServerUrl(input: string): string {
  const m = messages();
  const value = typeof input === "string" ? input.trim() : "";
  if (!value || value.length > MAX_SERVER_URL_LENGTH)
    throw new NutstoreError(m.serverUrlEmpty, "config");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NutstoreError(m.serverUrlInvalid, "config");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new NutstoreError(m.serverUrlProtocol, "config");
  if (url.username || url.password)
    throw new NutstoreError(m.serverUrlCredentials, "config");
  if (url.search || url.hash)
    throw new NutstoreError(m.serverUrlQuery, "config");
  // Plain HTTP is only tolerated for the local mock server used in development.
  if (
    url.protocol === "http:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new NutstoreError(m.serverUrlInsecure, "config");
  return url.href.replace(/\/+$/, "");
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Validates and normalizes the sync folder: strips slashes, splits on /, 1–64 chars per segment, no `.`/`..`/control chars, total ≤200. */
export function normalizeRemoteDir(input: string): string {
  const m = messages();
  const value =
    typeof input === "string" ? input.trim().replace(/^\/+|\/+$/g, "") : "";
  if (!value) throw new NutstoreError(m.remoteDirEmpty, "config");
  if (value.length > MAX_REMOTE_DIR_LENGTH)
    throw new NutstoreError(m.remoteDirTooLong, "config");
  const segments = value.split("/");
  for (const segment of segments) {
    if (!segment || segment.length > MAX_REMOTE_SEGMENT_LENGTH)
      throw new NutstoreError(m.remoteDirSegment, "config");
    if (segment === "." || segment === "..")
      throw new NutstoreError(m.remoteDirRelative, "config");
    if (CONTROL_CHARACTERS.test(segment))
      throw new NutstoreError(m.remoteDirControl, "config");
  }
  return segments.join("/");
}

/** Basic auth header, UTF-8 encoded (accounts may be Chinese emails or passwords may contain special characters). */
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

/** Directory URL (with a trailing slash). */
export function directoryUrl(credentials: NutstoreCredentials): string {
  const levels = directoryLevelUrls(credentials);
  return levels[levels.length - 1];
}

/** Builds the remote file URL: serverUrl + "/" + encodeURIComponent per remoteDir segment + "/" + encodeURIComponent(fileName). */
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
      throw new NutstoreError(messages().network, "network");
    throw error;
  }
}

/** PROPFIND Depth:0 to verify credentials and address; 207/200 count as success. */
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
  /** Raw ETag from the server (quotes preserved when present); null if missing. */
  etag: string | null;
  lastModified: string | null;
}

/**
 * GET the remote JSON; 404 returns null; any other error throws NutstoreError.
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
 * PUT the remote JSON. condition:
 * - `{ absent: true }` → `If-None-Match: *` (the remote file should not exist)
 * - `{ etag }` → `If-Match: <etag>` (conditional update against the read version)
 * - undefined → unconditional overwrite
 * When the parent folder is missing (404/409) the folder is created with MKCOL
 * and the write retried once (MKCOL 405 = already exists, keep going).
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
