import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState, BackupV1 } from "../types";
import {
  AUTO_SYNC_DEBOUNCE_MS,
  REMOTE_CHECK_INTERVAL_MS,
  SYNC_FILE_NAME,
  decideSync,
  defaultSyncSettings,
  fingerprintBackup,
  parseSyncFile,
  type SyncSettings,
  type SyncSnapshot,
} from "./sync";
import {
  NutstoreError,
  downloadFile,
  normalizeServerUrl,
  testConnection,
  uploadFile,
  type NutstoreCredentials,
} from "./nutstore";
import { syncStorage } from "./syncStore";

export interface NutstoreConnectInput {
  serverUrl: string;
  username: string;
  password: string;
}

export interface PendingRemoteBackup {
  exportedAt: string;
}

export interface NutstoreSyncApi {
  settings: SyncSettings;
  busy: boolean;
  /** Transient failure from the last user-initiated action. */
  error: string;
  /** Transient success/info message from the last action. */
  notice: string;
  /** Set when the first connection found a remote backup to merge. */
  pending: PendingRemoteBackup | null;
  connect(input: NutstoreConnectInput): Promise<void>;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
  upload(): Promise<void>;
  restore(): Promise<void>;
  resolvePending(choice: "upload" | "restore"): Promise<void>;
  setAutoSync(enabled: boolean): Promise<void>;
  clearFeedback(): void;
}

interface PendingRemote {
  backup: BackupV1;
  fingerprint: string;
  etag: string | null;
  exportedAt: string;
  localFingerprint: string;
}

/** A backup downloaded during a sync, already parsed and fingerprinted. */
interface RemoteSnapshot {
  backup: BackupV1;
  fingerprint: string;
  etag: string | null;
}

const serialize = (backup: BackupV1) => JSON.stringify(backup, null, 2);

function message(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请重试。";
}

function credentialsOf(settings: SyncSettings): NutstoreCredentials {
  return {
    serverUrl: settings.serverUrl,
    username: settings.username,
    password: settings.password,
    remoteDir: settings.remoteDir,
  };
}

function parseTime(value: string | null): number {
  return value ? Date.parse(value) : Number.NaN;
}

/**
 * Owns the 坚果云 sync lifecycle for the settings panel and the new-tab page:
 * connection setup, manual sync/upload/restore, conflict handling and the two
 * background paths (debounced upload after local edits, throttled pull on open).
 *
 * Credentials live in `syncStorage` — deliberately not in `AppState` — so they
 * never travel inside a JSON backup.
 */
export function useNutstoreSync({
  ready,
  state,
  getLocalSnapshot,
  onRestore,
}: {
  ready: boolean;
  /** Bumped by every local edit; drives the debounced auto upload. */
  state: AppState;
  getLocalSnapshot: () => Promise<SyncSnapshot>;
  onRestore: (backup: BackupV1) => Promise<void>;
}): NutstoreSyncApi {
  const [settings, setSettings] = useState<SyncSettings>(defaultSyncSettings);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<PendingRemote | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const busyRef = useRef(false);
  const restoreRef = useRef(onRestore);
  restoreRef.current = onRestore;
  const snapshotRef = useRef(getLocalSnapshot);
  snapshotRef.current = getLocalSnapshot;
  // One throttled background check per mounted new-tab page is enough.
  const checkedThisMount = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void syncStorage
      .read()
      .then((stored) => {
        if (cancelled) return;
        setSettings(stored);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback(async (next: SyncSettings) => {
    settingsRef.current = next;
    setSettings(next);
    await syncStorage.write(next);
  }, []);

  /** Serialises user-initiated operations; background work checks `busyRef`. */
  const guard = useCallback(async (operation: () => Promise<void>) => {
    if (busyRef.current) {
      setNotice("上一步同步还在进行，请稍候。");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (caught) {
      setError(message(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const fetchRemote = useCallback(
    async (
      credentials: NutstoreCredentials,
    ): Promise<RemoteSnapshot | null> => {
      const remote = await downloadFile(credentials, SYNC_FILE_NAME);
      if (!remote) return null;
      const backup = parseSyncFile(remote.text);
      return {
        backup,
        fingerprint: await fingerprintBackup(backup),
        etag: remote.etag,
      };
    },
    [],
  );

  const rememberSynced = useCallback(
    async (
      fingerprints: { local: string } | { remote: string },
      etag: string | null,
    ) => {
      const now = new Date().toISOString();
      await persist({
        ...settingsRef.current,
        lastSyncedAt: now,
        lastSyncedFingerprint:
          "local" in fingerprints ? fingerprints.local : fingerprints.remote,
        lastEtag: etag,
        lastCheckedAt: now,
        lastError: "",
      });
    },
    [persist],
  );

  const uploadSnapshot = useCallback(
    async (credentials: NutstoreCredentials, snapshot: SyncSnapshot) => {
      const remote = await fetchRemote(credentials);
      const condition = remote
        ? remote.etag
          ? { etag: remote.etag }
          : undefined
        : ({ absent: true } as const);
      const written = await uploadFile(
        credentials,
        SYNC_FILE_NAME,
        serialize(snapshot.backup),
        condition,
      );
      await rememberSynced({ local: snapshot.fingerprint }, written.etag);
      return remote;
    },
    [fetchRemote, rememberSynced],
  );

  const connect = useCallback(
    (input: NutstoreConnectInput) =>
      guard(async () => {
        const serverUrl = normalizeServerUrl(input.serverUrl);
        const username = input.username.trim();
        const password = input.password;
        if (!username) throw new Error("请输入坚果云账号（邮箱）。");
        if (!password) throw new Error("请输入第三方应用密码。");
        const next: SyncSettings = {
          ...settingsRef.current,
          enabled: true,
          serverUrl,
          username,
          password,
          lastError: "",
        };
        const credentials = credentialsOf(next);
        await testConnection(credentials);
        const snapshot = await snapshotRef.current();
        const remote = await fetchRemote(credentials);
        const now = new Date().toISOString();
        if (!remote) {
          const written = await uploadFile(
            credentials,
            SYNC_FILE_NAME,
            serialize(snapshot.backup),
            { absent: true },
          );
          await persist({
            ...next,
            lastSyncedAt: now,
            lastSyncedFingerprint: snapshot.fingerprint,
            lastEtag: written.etag,
            lastCheckedAt: now,
          });
          setPending(null);
          setNotice("已连接坚果云，当前内容已上传。");
          return;
        }
        const same = remote.fingerprint === snapshot.fingerprint;
        await persist({
          ...next,
          lastSyncedAt: same ? now : null,
          lastSyncedFingerprint: same ? snapshot.fingerprint : null,
          lastEtag: remote.etag,
          lastCheckedAt: now,
        });
        if (same) {
          setPending(null);
          setNotice("已连接坚果云，云端与当前内容一致。");
          return;
        }
        setPending({
          backup: remote.backup,
          fingerprint: remote.fingerprint,
          etag: remote.etag,
          exportedAt: remote.backup.exportedAt,
          localFingerprint: snapshot.fingerprint,
        });
        setNotice("已连接坚果云。云端已有备份，请选择覆盖方向。");
      }),
    [fetchRemote, guard, persist],
  );

  const resolvePending = useCallback(
    (choice: "upload" | "restore") =>
      guard(async () => {
        const current = pending;
        if (!current) return;
        const credentials = credentialsOf(settingsRef.current);
        if (choice === "restore") {
          await restoreRef.current(current.backup);
          await rememberSynced({ remote: current.fingerprint }, current.etag);
          setNotice("已用云端备份覆盖本机内容。");
        } else {
          const snapshot = await snapshotRef.current();
          const written = await uploadFile(
            credentials,
            SYNC_FILE_NAME,
            serialize(snapshot.backup),
            current.etag ? { etag: current.etag } : undefined,
          );
          await rememberSynced({ local: snapshot.fingerprint }, written.etag);
          setNotice("已用本机内容覆盖云端备份。");
        }
        setPending(null);
      }),
    [guard, pending, rememberSynced],
  );

  const syncNow = useCallback(
    () =>
      guard(async () => {
        const current = settingsRef.current;
        if (!current.enabled) throw new Error("请先连接坚果云。");
        const credentials = credentialsOf(current);
        const now = new Date().toISOString();
        const snapshot = await snapshotRef.current();
        const remote = await fetchRemote(credentials);
        if (!remote) {
          const written = await uploadFile(
            credentials,
            SYNC_FILE_NAME,
            serialize(snapshot.backup),
            { absent: true },
          );
          await persist({
            ...current,
            lastSyncedAt: now,
            lastSyncedFingerprint: snapshot.fingerprint,
            lastEtag: written.etag,
            lastCheckedAt: now,
            lastError: "",
          });
          setNotice("云端还没有备份，已上传当前内容。");
          return;
        }
        const decision = decideSync(
          snapshot.fingerprint,
          remote.fingerprint,
          current.lastSyncedFingerprint,
        );
        if (decision === "none") {
          await persist({
            ...current,
            lastSyncedAt: now,
            lastSyncedFingerprint: snapshot.fingerprint,
            lastEtag: remote.etag,
            lastCheckedAt: now,
            lastError: "",
          });
          setNotice("本机与云端已一致。");
          return;
        }
        if (decision === "upload") {
          const written = await uploadFile(
            credentials,
            SYNC_FILE_NAME,
            serialize(snapshot.backup),
            remote.etag ? { etag: remote.etag } : undefined,
          );
          await persist({
            ...current,
            lastSyncedAt: now,
            lastSyncedFingerprint: snapshot.fingerprint,
            lastEtag: written.etag,
            lastCheckedAt: now,
            lastError: "",
          });
          setNotice("本机改动已上传到坚果云。");
          return;
        }
        if (decision === "download") {
          await restoreRef.current(remote.backup);
          await persist({
            ...current,
            lastSyncedAt: now,
            lastSyncedFingerprint: remote.fingerprint,
            lastEtag: remote.etag,
            lastCheckedAt: now,
            lastError: "",
          });
          setNotice("已从坚果云恢复云端备份。");
          return;
        }
        throw new Error(
          "本机与云端都有改动。请选择「上传本机」或「从云端恢复」来决定保留哪一份。",
        );
      }),
    [fetchRemote, guard, persist],
  );

  const upload = useCallback(
    () =>
      guard(async () => {
        const current = settingsRef.current;
        if (!current.enabled) throw new Error("请先连接坚果云。");
        const snapshot = await snapshotRef.current();
        await uploadSnapshot(credentialsOf(current), snapshot);
        setNotice("已上传到坚果云。");
      }),
    [guard, uploadSnapshot],
  );

  const restore = useCallback(
    () =>
      guard(async () => {
        const current = settingsRef.current;
        if (!current.enabled) throw new Error("请先连接坚果云。");
        const remote = await fetchRemote(credentialsOf(current));
        if (!remote) throw new Error("云端还没有备份。可以先上传本机内容。");
        await restoreRef.current(remote.backup);
        await rememberSynced({ remote: remote.fingerprint }, remote.etag);
        setNotice("已从坚果云恢复备份。");
      }),
    [fetchRemote, guard, rememberSynced],
  );

  const disconnect = useCallback(
    () =>
      guard(async () => {
        await syncStorage.clear();
        settingsRef.current = defaultSyncSettings();
        setSettings(defaultSyncSettings());
        setPending(null);
        setNotice("已断开坚果云同步，本机保存的账号与应用密码已清除。");
      }),
    [guard],
  );

  const setAutoSync = useCallback(
    async (enabled: boolean) => {
      const next = { ...settingsRef.current, autoSync: enabled };
      try {
        await persist(next);
      } catch (caught) {
        setError(message(caught));
      }
    },
    [persist],
  );

  const clearFeedback = useCallback(() => {
    setError("");
    setNotice("");
    const current = settingsRef.current;
    if (current.lastError) void persist({ ...current, lastError: "" });
  }, [persist]);

  /** Failures here are background-only: store them instead of shouting. */
  const reportBackgroundError = useCallback(
    async (caught: unknown) => {
      try {
        await persist({ ...settingsRef.current, lastError: message(caught) });
      } catch {
        // Storage is the last resort; nothing else to do.
      }
    },
    [persist],
  );

  // Debounced auto upload: the local edit already happened; only push when the
  // fingerprint moved past the last synced baseline.
  useEffect(() => {
    if (
      !ready ||
      !loaded ||
      !settings.enabled ||
      !settings.autoSync ||
      settings.lastSyncedFingerprint === null ||
      pending
    )
      return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || busyRef.current) return;
      void (async () => {
        try {
          const snapshot = await snapshotRef.current();
          if (cancelled) return;
          if (
            snapshot.fingerprint === settingsRef.current.lastSyncedFingerprint
          )
            return;
          busyRef.current = true;
          setBusy(true);
          try {
            const current = settingsRef.current;
            const written = await uploadFile(
              credentialsOf(current),
              SYNC_FILE_NAME,
              serialize(snapshot.backup),
              current.lastEtag ? { etag: current.lastEtag } : undefined,
            );
            await persist({
              ...settingsRef.current,
              lastSyncedAt: new Date().toISOString(),
              lastSyncedFingerprint: snapshot.fingerprint,
              lastEtag: written.etag,
              lastCheckedAt: new Date().toISOString(),
              lastError: "",
            });
          } finally {
            busyRef.current = false;
            setBusy(false);
          }
        } catch (caught) {
          await reportBackgroundError(
            caught instanceof NutstoreError && caught.code === "conflict"
              ? new Error(
                  "云端有更新，自动上传已暂停。请到设置 → 同步中手动同步。",
                )
              : caught,
          );
        }
      })();
    }, AUTO_SYNC_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // `state` is the trigger (a new object per repository refresh); the rest is
    // the connection state that decides whether background upload may run.
  }, [
    ready,
    loaded,
    state,
    settings.enabled,
    settings.autoSync,
    settings.lastSyncedFingerprint,
    settings.lastEtag,
    pending,
    persist,
    reportBackgroundError,
  ]);

  // Throttled pull-on-open. Only announces a conflict; otherwise newer remote
  // content is applied silently because the local side has no unsynced edits.
  useEffect(() => {
    if (
      !ready ||
      !loaded ||
      !settings.enabled ||
      !settings.autoSync ||
      pending ||
      checkedThisMount.current
    )
      return;
    const last = parseTime(settings.lastCheckedAt);
    if (Number.isFinite(last) && Date.now() - last < REMOTE_CHECK_INTERVAL_MS)
      return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || checkedThisMount.current || busyRef.current) return;
      checkedThisMount.current = true;
      void (async () => {
        try {
          const current = settingsRef.current;
          const credentials = credentialsOf(current);
          const snapshot = await snapshotRef.current();
          if (cancelled) return;
          const remote = await fetchRemote(credentials);
          if (cancelled) return;
          const now = new Date().toISOString();
          if (!remote) {
            await persist({ ...settingsRef.current, lastCheckedAt: now });
            return;
          }
          const decision = decideSync(
            snapshot.fingerprint,
            remote.fingerprint,
            current.lastSyncedFingerprint,
          );
          if (decision === "none") {
            await persist({
              ...settingsRef.current,
              lastSyncedAt: now,
              lastSyncedFingerprint: snapshot.fingerprint,
              lastEtag: remote.etag,
              lastCheckedAt: now,
            });
            return;
          }
          if (decision === "download") {
            setBusy(true);
            try {
              await restoreRef.current(remote.backup);
              await persist({
                ...settingsRef.current,
                lastSyncedAt: now,
                lastSyncedFingerprint: remote.fingerprint,
                lastEtag: remote.etag,
                lastCheckedAt: now,
                lastError: "",
              });
              setNotice("已从坚果云同步了云端更新。");
            } finally {
              setBusy(false);
            }
            return;
          }
          if (decision === "conflict") {
            await reportBackgroundError(
              new Error(
                "云端与本机都有改动，自动同步已暂停。请到设置 → 同步中手动处理。",
              ),
            );
            return;
          }
          // Only the local side moved; the debounced upload effect owns it.
          await persist({ ...settingsRef.current, lastCheckedAt: now });
        } catch (caught) {
          await reportBackgroundError(caught);
        } finally {
          busyRef.current = false;
        }
      })();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally only re-runs when the connection state changes.
  }, [ready, loaded, settings.enabled, settings.autoSync, pending]);

  return {
    settings,
    busy,
    error,
    notice,
    pending,
    connect,
    disconnect,
    syncNow,
    upload,
    restore,
    resolvePending,
    setAutoSync,
    clearFeedback,
  };
}

/** Re-exported for the panel's type imports without reaching into ./sync twice. */
export type { SyncSettings };
/** Kept next to the hook so tests/consumers can assert error codes. */
export { NutstoreError };
