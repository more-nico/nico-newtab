import { describe, expect, it } from "vitest";
import { defaultState } from "../data";
import {
  buildSnapshot,
  decideSync,
  fingerprintBackup,
  parseSyncFile,
  parseSyncSettings,
} from "./sync";

const settings = {
  enabled: true,
  username: "user@example.com",
  password: "app-password",
  serverUrl: "https://dav.jianguoyun.com/dav",
  remoteDir: "nico-newtab",
};

describe("sync", () => {
  it("disables syncing without credentials", () => {
    expect(parseSyncSettings({}).enabled).toBe(false);
    expect(parseSyncSettings({ ...settings, password: "" }).enabled).toBe(
      false,
    );
    expect(parseSyncSettings(settings)).toMatchObject(settings);
  });

  it("repairs invalid sync metadata without discarding valid credentials", () => {
    expect(
      parseSyncSettings({
        ...settings,
        remoteDir: "../private",
        lastSyncedFingerprint: "invalid",
      }),
    ).toMatchObject({
      enabled: true,
      username: settings.username,
      remoteDir: "nico-newtab",
      lastSyncedFingerprint: null,
    });
  });

  it.each([
    ["local", null, null, "upload"],
    ["same", "same", null, "none"],
    ["local", "remote", null, "conflict"],
    ["local", "baseline", "baseline", "upload"],
    ["baseline", "remote", "baseline", "download"],
    ["local", "remote", "baseline", "conflict"],
  ] as const)(
    "compares local=%s, remote=%s, baseline=%s → %s",
    (local, remote, baseline, decision) => {
      expect(decideSync(local, remote, baseline)).toBe(decision);
    },
  );

  it("builds an importable snapshot unaffected by later local edits", async () => {
    const state = defaultState();
    const { backup, fingerprint } = await buildSnapshot(state, null);
    state.settings.brightness = 100;
    expect(backup.state.settings.brightness).toBe(85);
    expect(parseSyncFile(JSON.stringify(backup)).state).toEqual(backup.state);
    expect(await fingerprintBackup(backup)).toBe(fingerprint);
  });

  it("fingerprints synchronized content, ignoring the export time", async () => {
    const { backup, fingerprint } = await buildSnapshot(defaultState(), null);
    expect(
      await fingerprintBackup({
        ...backup,
        exportedAt: "2030-01-01T00:00:00Z",
      }),
    ).toBe(fingerprint);
    const changed = structuredClone(backup);
    changed.state.settings.brightness = 100;
    expect(await fingerprintBackup(changed)).not.toBe(fingerprint);
    changed.state = backup.state;
    changed.wallpaper = {
      name: "pic",
      dataUrl: "data:image/webp;base64,UklGRg==",
    };
    expect(await fingerprintBackup(changed)).not.toBe(fingerprint);
  });
});
