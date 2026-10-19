import type { AppState, BackupV1 } from "../types";
import { blobToDataUrl } from "./images";
import {
  NUTSTORE_SERVER_URL,
  normalizeRemoteDir,
  normalizeServerUrl,
} from "./nutstore";
import { parseBackup } from "./validation";

export const SYNC_FILE_NAME = "nico-newtab.json";
export const DEFAULT_REMOTE_DIR = "nico-newtab";
/** 自动同步上传延迟；限流保护（坚果云免费账号 600 请求 / 30 分钟）。 */
export const AUTO_SYNC_DEBOUNCE_MS = 4000;
/** 打开新标签页时检查云端的最小间隔。 */
export const REMOTE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

export interface SyncSettings {
  enabled: boolean;
  serverUrl: string;
  username: string;
  password: string;
  remoteDir: string;
  autoSync: boolean;
  lastSyncedAt: string | null; // ISO
  lastSyncedFingerprint: string | null; // sha256 hex
  lastEtag: string | null; // 最近一次读/写远端得到的 ETag
  lastCheckedAt: string | null; // ISO，用于节流拉取
  lastError: string; // 面向用户的错误，无则 ""
}

const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_USERNAME_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 2048;
const MAX_ERROR_LENGTH = 500;
const MAX_ETAG_LENGTH = 1024;

export function defaultSyncSettings(): SyncSettings {
  return {
    enabled: false,
    serverUrl: NUTSTORE_SERVER_URL,
    username: "",
    password: "",
    remoteDir: DEFAULT_REMOTE_DIR,
    autoSync: true,
    lastSyncedAt: null,
    lastSyncedFingerprint: null,
    lastEtag: null,
    lastCheckedAt: null,
    lastError: "",
  };
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const boundedString = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.length <= max ? value : null;

const isoString = (value: unknown): string | null =>
  typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;

function normalizedServerUrl(value: unknown): string {
  if (typeof value !== "string") return NUTSTORE_SERVER_URL;
  try {
    return normalizeServerUrl(value);
  } catch {
    return NUTSTORE_SERVER_URL;
  }
}

function normalizedRemoteDir(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_REMOTE_DIR;
  try {
    return normalizeRemoteDir(value);
  } catch {
    return DEFAULT_REMOTE_DIR;
  }
}

/** 宽松解析存储值，永不抛错；字段缺失/损坏回退默认值。密码/账号为空时 enabled 强制 false。 */
export function parseSyncSettings(value: unknown): SyncSettings {
  if (!record(value)) return defaultSyncSettings();
  const username = boundedString(value.username, MAX_USERNAME_LENGTH) ?? "";
  const password = boundedString(value.password, MAX_PASSWORD_LENGTH) ?? "";
  const enabled = value.enabled === true && username !== "" && password !== "";
  return {
    enabled,
    serverUrl: normalizedServerUrl(value.serverUrl),
    username,
    password,
    remoteDir: normalizedRemoteDir(value.remoteDir),
    autoSync: typeof value.autoSync === "boolean" ? value.autoSync : true,
    lastSyncedAt: isoString(value.lastSyncedAt),
    lastSyncedFingerprint:
      typeof value.lastSyncedFingerprint === "string" &&
      FINGERPRINT_PATTERN.test(value.lastSyncedFingerprint)
        ? value.lastSyncedFingerprint
        : null,
    lastEtag:
      typeof value.lastEtag === "string" &&
      value.lastEtag.length > 0 &&
      value.lastEtag.length <= MAX_ETAG_LENGTH
        ? value.lastEtag
        : null,
    lastCheckedAt: isoString(value.lastCheckedAt),
    lastError: boundedString(value.lastError, MAX_ERROR_LENGTH) ?? "",
  };
}

export interface SyncSnapshot {
  backup: BackupV1;
  fingerprint: string;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/** 与“导出备份”完全同构，但 exportedAt 每次刷新；blob 为自定义壁纸。 */
export async function buildSnapshot(
  state: AppState,
  wallpaper: Blob | null,
): Promise<SyncSnapshot> {
  const copied = structuredClone(state);
  const backup: BackupV1 = {
    format: "nico-newtab",
    version: 1,
    exportedAt: new Date().toISOString(),
    state: copied,
    wallpaper: wallpaper
      ? {
          name: copied.settings.customWallpaper!.name,
          dataUrl: await blobToDataUrl(wallpaper),
        }
      : null,
  };
  return { backup, fingerprint: await fingerprintBackup(backup) };
}

/** 对 backup.state + backup.wallpaper.dataUrl 做 SHA-256（**不含 exportedAt**），hex 小写。 */
export async function fingerprintBackup(backup: BackupV1): Promise<string> {
  // exportedAt changes on every snapshot, so it must not take part in the
  // identity of the payload: only the state and the wallpaper do.
  return sha256Hex(
    JSON.stringify({
      state: backup.state,
      wallpaper: backup.wallpaper?.dataUrl ?? null,
    }),
  );
}

/** 远端 JSON → BackupV1，直接复用 parseBackup，错误转成中文提示。 */
export function parseSyncFile(text: string): BackupV1 {
  try {
    return parseBackup(text);
  } catch {
    throw new Error("云端备份内容不完整或格式不受支持，未改动本机数据。");
  }
}

export type SyncDecision = "none" | "upload" | "download" | "conflict";

/**
 * 三方比较：
 * - remoteFingerprint === null（远端无文件）→ "upload"
 * - remote === local → "none"
 * - lastSynced === null（无基线）→ "conflict"
 * - remote === lastSynced（仅本机改动）→ "upload"
 * - local === lastSynced（仅云端改动）→ "download"
 * - 否则 → "conflict"
 */
export function decideSync(
  localFingerprint: string,
  remoteFingerprint: string | null,
  lastSyncedFingerprint: string | null,
): SyncDecision {
  if (remoteFingerprint === null) return "upload";
  if (remoteFingerprint === localFingerprint) return "none";
  if (lastSyncedFingerprint === null) return "conflict";
  if (remoteFingerprint === lastSyncedFingerprint) return "upload";
  if (localFingerprint === lastSyncedFingerprint) return "download";
  return "conflict";
}
