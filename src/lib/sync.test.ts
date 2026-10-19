import { describe, expect, it } from "vitest";
import { defaultState } from "../data";
import type { BackupV1 } from "../types";
import { NUTSTORE_SERVER_URL } from "./nutstore";
import {
  AUTO_SYNC_DEBOUNCE_MS,
  DEFAULT_REMOTE_DIR,
  REMOTE_CHECK_INTERVAL_MS,
  SYNC_FILE_NAME,
  buildSnapshot,
  decideSync,
  defaultSyncSettings,
  fingerprintBackup,
  parseSyncFile,
  parseSyncSettings,
  type SyncSettings,
} from "./sync";

const FINGERPRINT = "a".repeat(64);

function validSettings(): SyncSettings {
  return {
    enabled: true,
    serverUrl: "https://dav.jianguoyun.com/dav",
    username: "user@example.com",
    password: "app-password",
    remoteDir: "备份/nico",
    autoSync: false,
    lastSyncedAt: "2026-10-19T10:00:00.000Z",
    lastSyncedFingerprint: FINGERPRINT,
    lastEtag: '"abc123"',
    lastCheckedAt: "2026-10-19T10:05:00.000Z",
    lastError: "上次同步失败",
  };
}

const backupOf = (exportedAt = "2026-10-19T10:00:00.000Z"): BackupV1 => ({
  format: "nico-newtab",
  version: 1,
  exportedAt,
  state: defaultState(),
  wallpaper: null,
});

const caught = (run: () => unknown): unknown => {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("预期调用会抛错，但实际没有。");
};

describe("constants", () => {
  it("matches the agreed sync defaults", () => {
    expect(SYNC_FILE_NAME).toBe("nico-newtab.json");
    expect(DEFAULT_REMOTE_DIR).toBe("nico-newtab");
    expect(AUTO_SYNC_DEBOUNCE_MS).toBe(4000);
    expect(REMOTE_CHECK_INTERVAL_MS).toBe(10 * 60 * 1000);
  });
});

describe("defaultSyncSettings", () => {
  it("returns a fresh disabled configuration", () => {
    expect(defaultSyncSettings()).toEqual({
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
    });
    expect(defaultSyncSettings()).not.toBe(defaultSyncSettings());
  });
});

describe("parseSyncSettings", () => {
  it("round-trips valid settings", () => {
    expect(parseSyncSettings(validSettings())).toEqual(validSettings());
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "nope"],
    ["an array", []],
    ["an empty object", {}],
  ])("falls back to the defaults for %s", (_label, value) => {
    expect(parseSyncSettings(value)).toEqual(defaultSyncSettings());
  });

  it("forces enabled off when the account or password is empty", () => {
    expect(
      parseSyncSettings({ ...validSettings(), username: "" }).enabled,
    ).toBe(false);
    expect(
      parseSyncSettings({ ...validSettings(), password: "" }).enabled,
    ).toBe(false);
    expect(
      parseSyncSettings({ ...validSettings(), username: 42 }).enabled,
    ).toBe(false);
    expect(parseSyncSettings(validSettings()).enabled).toBe(true);
  });

  it("requires enabled to be a real boolean", () => {
    expect(
      parseSyncSettings({ ...validSettings(), enabled: "yes" }).enabled,
    ).toBe(false);
    expect(parseSyncSettings({ ...validSettings(), enabled: 1 }).enabled).toBe(
      false,
    );
  });

  it("repairs individual broken fields without discarding the rest", () => {
    const parsed = parseSyncSettings({
      ...validSettings(),
      serverUrl: "http://example.com/dav",
      remoteDir: "../etc",
      autoSync: "yes",
      lastSyncedAt: "not-a-date",
      lastCheckedAt: 42,
      lastSyncedFingerprint: "ABC".repeat(21),
      lastEtag: "x".repeat(1025),
      lastError: "x".repeat(501),
    });
    expect(parsed.serverUrl).toBe(NUTSTORE_SERVER_URL);
    expect(parsed.remoteDir).toBe(DEFAULT_REMOTE_DIR);
    expect(parsed.autoSync).toBe(true);
    expect(parsed.lastSyncedAt).toBeNull();
    expect(parsed.lastCheckedAt).toBeNull();
    expect(parsed.lastSyncedFingerprint).toBeNull();
    expect(parsed.lastEtag).toBeNull();
    expect(parsed.lastError).toBe("");
    // Valid neighbours survive the lenient parse.
    expect(parsed.username).toBe("user@example.com");
    expect(parsed.password).toBe("app-password");
    expect(parsed.enabled).toBe(true);
  });

  it("accepts values exactly at the size limits", () => {
    const parsed = parseSyncSettings({
      ...validSettings(),
      username: "u".repeat(320),
      password: "p".repeat(2048),
      lastError: "e".repeat(500),
      lastEtag: "t".repeat(1024),
    });
    expect(parsed.username).toHaveLength(320);
    expect(parsed.password).toHaveLength(2048);
    expect(parsed.lastError).toHaveLength(500);
    expect(parsed.lastEtag).toHaveLength(1024);
  });

  it("normalizes server and directory URLs", () => {
    const parsed = parseSyncSettings({
      ...validSettings(),
      serverUrl: "  https://dav.jianguoyun.com/dav/  ",
      remoteDir: "/a/b/",
    });
    expect(parsed.serverUrl).toBe("https://dav.jianguoyun.com/dav");
    expect(parsed.remoteDir).toBe("a/b");
  });

  it("accepts the local mock server over plain HTTP", () => {
    expect(
      parseSyncSettings({
        ...validSettings(),
        serverUrl: "http://127.0.0.1:8787/dav",
      }).serverUrl,
    ).toBe("http://127.0.0.1:8787/dav");
    expect(
      parseSyncSettings({
        ...validSettings(),
        serverUrl: "http://localhost:8787/dav/",
      }).serverUrl,
    ).toBe("http://localhost:8787/dav");
  });

  it("keeps only known properties", () => {
    const parsed = parseSyncSettings({ ...validSettings(), extra: "ignored" });
    expect(parsed).not.toHaveProperty("extra");
  });
});

describe("decideSync", () => {
  it("uploads when the cloud has no file yet", () => {
    expect(decideSync("local", null, null)).toBe("upload");
    expect(decideSync("local", null, "stale")).toBe("upload");
  });

  it("does nothing when both sides already match", () => {
    expect(decideSync("same", "same", null)).toBe("none");
    expect(decideSync("same", "same", "other")).toBe("none");
  });

  it("conflicts without a baseline when both sides diverged", () => {
    expect(decideSync("local", "remote", null)).toBe("conflict");
  });

  it("uploads when only the local side changed since the last sync", () => {
    expect(decideSync("local", "baseline", "baseline")).toBe("upload");
  });

  it("downloads when only the remote side changed since the last sync", () => {
    expect(decideSync("baseline", "remote", "baseline")).toBe("download");
  });

  it("conflicts when both sides changed", () => {
    expect(decideSync("local", "remote", "baseline")).toBe("conflict");
  });
});

describe("buildSnapshot", () => {
  it("mirrors the exported backup shape without a wallpaper", async () => {
    const state = defaultState();
    state.shortcuts = [
      { id: "one", name: "站点", url: "https://example.com/" },
    ];
    const before = Date.now();
    const { backup, fingerprint } = await buildSnapshot(state, null);
    expect(backup.format).toBe("nico-newtab");
    expect(backup.version).toBe(1);
    expect(backup.wallpaper).toBeNull();
    const exportedAt = Date.parse(backup.exportedAt);
    expect(Number.isFinite(exportedAt)).toBe(true);
    expect(exportedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(backup.state).toEqual(state);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).toBe(await fingerprintBackup(backup));
  });

  it("deep-copies the state so later edits do not leak in", async () => {
    const state = defaultState();
    const { backup } = await buildSnapshot(state, null);
    state.settings.brightness = 100;
    state.shortcuts.push({
      id: "later",
      name: "后来加的",
      url: "https://example.org/",
    });
    expect(backup.state.settings.brightness).toBe(85);
    expect(backup.state.shortcuts).toEqual([]);
  });

  it("produces an importable backup", async () => {
    const { backup } = await buildSnapshot(defaultState(), null);
    expect(parseSyncFile(JSON.stringify(backup)).state).toEqual(backup.state);
  });
});

describe("fingerprintBackup", () => {
  it("returns a lowercase sha256 hex digest", async () => {
    expect(await fingerprintBackup(backupOf())).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores exportedAt", async () => {
    const early = await fingerprintBackup(backupOf("2026-01-01T00:00:00.000Z"));
    const late = await fingerprintBackup(backupOf("2030-12-31T23:59:59.000Z"));
    expect(early).toBe(late);
  });

  it("changes when the state changes", async () => {
    const changed = backupOf();
    changed.state.settings.brightness = 100;
    expect(await fingerprintBackup(changed)).not.toBe(
      await fingerprintBackup(backupOf()),
    );
  });

  it("changes when the custom wallpaper changes", async () => {
    const withWallpaper = backupOf();
    withWallpaper.wallpaper = {
      name: "pic",
      dataUrl: "data:image/webp;base64,UklGRg==",
    };
    expect(await fingerprintBackup(withWallpaper)).not.toBe(
      await fingerprintBackup(backupOf()),
    );
  });

  it("is stable across a backup round trip", async () => {
    const data = backupOf();
    data.state.shortcuts = [
      { id: "one", name: "站点", url: "https://example.com/" },
    ];
    const roundTripped = parseSyncFile(JSON.stringify(data));
    expect(await fingerprintBackup(roundTripped)).toBe(
      await fingerprintBackup(data),
    );
  });
});

describe("parseSyncFile", () => {
  it("parses a valid cloud backup and preserves exportedAt", () => {
    const data = backupOf("2026-10-19T10:00:00.000Z");
    const parsed = parseSyncFile(JSON.stringify(data));
    expect(parsed.exportedAt).toBe("2026-10-19T10:00:00.000Z");
    expect(parsed.state).toEqual(data.state);
    expect(parsed.wallpaper).toBeNull();
  });

  it.each([
    ["malformed JSON", "{"],
    ["a foreign format", JSON.stringify({ ...backupOf(), format: "other" })],
    ["an unknown version", JSON.stringify({ ...backupOf(), version: 2 })],
    [
      "a broken state",
      JSON.stringify({ ...backupOf(), state: { version: 1 } }),
    ],
  ])("reports a friendly Chinese error for %s", (_label, text) => {
    const error = caught(() => parseSyncFile(text));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "云端备份内容不完整或格式不受支持，未改动本机数据。",
    );
  });
});
