import { isExtension } from "./platform";
import {
  defaultSyncSettings,
  parseSyncSettings,
  type SyncSettings,
} from "./sync";

export const SYNC_STORAGE_KEY = "nico.newtab.sync.v1";
const PREVIEW_KEY = `preview.${SYNC_STORAGE_KEY}`;

export interface SyncStorage {
  read(): Promise<SyncSettings>;
  write(settings: SyncSettings): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Chrome extension storage. The API is only touched inside the methods, so
 * importing this module in Node (unit tests) stays safe.
 */
function createExtensionStorage(): SyncStorage {
  return {
    async read() {
      try {
        const stored = await chrome.storage.local.get(SYNC_STORAGE_KEY);
        return parseSyncSettings(stored?.[SYNC_STORAGE_KEY]);
      } catch {
        return defaultSyncSettings();
      }
    },
    async write(settings) {
      await chrome.storage.local.set({ [SYNC_STORAGE_KEY]: settings });
    },
    async clear() {
      await chrome.storage.local.remove(SYNC_STORAGE_KEY);
    },
  };
}

/** Web preview storage: JSON in localStorage behind a `preview.` prefix. */
function createPreviewStorage(): SyncStorage {
  return {
    async read() {
      try {
        const raw = localStorage.getItem(PREVIEW_KEY);
        if (!raw) return defaultSyncSettings();
        return parseSyncSettings(JSON.parse(raw));
      } catch {
        return defaultSyncSettings();
      }
    },
    async write(settings) {
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(settings));
    },
    async clear() {
      localStorage.removeItem(PREVIEW_KEY);
    },
  };
}

export function createSyncStorage(): SyncStorage {
  return isExtension ? createExtensionStorage() : createPreviewStorage();
}

/** 单例，按 isExtension 分支。 */
export const syncStorage: SyncStorage = createSyncStorage();
