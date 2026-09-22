import {
  Repository,
  type AssetStorage,
  type StateStorage,
} from "./persistence";
import { DEFAULT_ENGINE_ID, buildSearchUrl } from "./engines";

export const isExtension =
  typeof chrome !== "undefined" &&
  Boolean(chrome.runtime?.id) &&
  Boolean(chrome.storage?.local);
const KEY = "nico.newtab.state.v1";
const PREVIEW_KEY = `preview.${KEY}`;
const eventName = "nico-preview-storage";

const storage: StateStorage = isExtension
  ? {
      async read() {
        return (await chrome.storage.local.get(KEY))[KEY];
      },
      async write(value) {
        await chrome.storage.local.set({ [KEY]: value });
      },
      subscribe(listener) {
        const handler = (
          changes: Record<string, chrome.storage.StorageChange>,
          area: string,
        ) => {
          if (area === "local" && KEY in changes) listener();
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
      },
    }
  : {
      async read() {
        const value = localStorage.getItem(PREVIEW_KEY);
        return value ? JSON.parse(value) : undefined;
      },
      async write(value) {
        localStorage.setItem(PREVIEW_KEY, JSON.stringify(value));
        window.dispatchEvent(new Event(eventName));
      },
      subscribe(listener) {
        const handler = (event: StorageEvent) => {
          if (event.key === PREVIEW_KEY || event.key === null) listener();
        };
        window.addEventListener("storage", handler);
        window.addEventListener(eventName, listener);
        return () => {
          window.removeEventListener("storage", handler);
          window.removeEventListener(eventName, listener);
        };
      },
    };

let dbPromise: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(
        isExtension ? "nico-wallpapers" : "nico-preview-wallpapers",
        1,
      );
      request.onupgradeneeded = () =>
        request.result.createObjectStore("images");
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          dbPromise = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        dbPromise = undefined;
        reject(request.error);
      };
      request.onblocked = () => {
        dbPromise = undefined;
        reject(new Error("图片存储被其他窗口占用，请关闭旧页面重试。"));
      };
    });
  }
  return dbPromise;
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("images", mode);
    const request = action(tx.objectStore("images"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? new Error("图片保存中断。"));
  });
}
const assets: AssetStorage = {
  get: (id) => transaction("readonly", (store) => store.get(id)),
  async put(id, blob) {
    await transaction("readwrite", (store) => store.put(blob, id));
  },
  async remove(id) {
    await transaction("readwrite", (store) => store.delete(id));
  },
};

export const repository = new Repository(
  storage,
  assets,
  async (operation) =>
    await navigator.locks.request(
      "nico-newtab-state",
      async () => await operation(),
    ),
);

export interface SearchTarget {
  id: string;
  /** Absent means the browser's own default engine handles the query. */
  urlTemplate?: string;
}
export async function search(
  text: string,
  target?: SearchTarget,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!isExtension)
    throw new Error("这是网页预览。在浏览器中加载扩展后，即可使用搜索引擎。");
  // Results open in a new tab so the new tab page stays where it was.
  // chrome.search.query cannot target a specific engine, so only the browser
  // default goes through it. Everything else opens the built URL.
  if (!target?.urlTemplate || target.id === DEFAULT_ENGINE_ID) {
    await chrome.search.query({ text: trimmed, disposition: "NEW_TAB" });
    return;
  }
  await chrome.tabs.create({
    url: buildSearchUrl(target.urlTemplate, trimmed),
  });
}
export function favicon(url: string): string | undefined {
  if (!isExtension) return undefined;
  const image = new URL(chrome.runtime.getURL("/_favicon/"));
  image.searchParams.set("pageUrl", url);
  image.searchParams.set("size", "64");
  return image.href;
}

let emptyFavicon: Promise<Uint8Array> | undefined;
export async function loadFavicon(url: string): Promise<Blob | null> {
  const src = favicon(url);
  if (!src) return null;
  // Chromium returns its generic globe with status 200 when no icon is cached.
  // Compare with that local fallback so missing icons still use a useful initial.
  emptyFavicon ??= fetch(favicon("https://nico-newtab.invalid/")!)
    .then((response) => response.arrayBuffer())
    .then((buffer) => new Uint8Array(buffer));
  const response = await fetch(src);
  if (!response.ok) return null;
  const blob = await response.blob();
  const actual = new Uint8Array(await blob.arrayBuffer());
  const empty = await emptyFavicon;
  if (
    actual.length === empty.length &&
    actual.every((byte, i) => byte === empty[i])
  )
    return null;
  return blob;
}
