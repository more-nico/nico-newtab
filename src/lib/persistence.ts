import { defaultState } from "../data";
import type { AppState } from "../types";
import { parseState } from "./validation";
import { t } from "./i18n";

export interface StateStorage {
  read(): Promise<unknown>;
  write(value: AppState): Promise<void>;
  subscribe(listener: () => void): () => void;
}
export interface AssetStorage {
  get(id: string): Promise<Blob | undefined>;
  put(id: string, blob: Blob): Promise<void>;
  remove(id: string): Promise<void>;
}
export type Exclusive = <T>(operation: () => Promise<T>) => Promise<T>;

export class Repository {
  constructor(
    private storage: StateStorage,
    readonly assets: AssetStorage,
    private exclusive: Exclusive,
  ) {}

  async load(): Promise<AppState> {
    const value = await this.storage.read();
    return value === undefined || value === null
      ? defaultState()
      : parseState(value);
  }
  subscribe(listener: () => void) {
    return this.storage.subscribe(listener);
  }

  update(change: (state: AppState) => AppState): Promise<AppState> {
    return this.exclusive(async () => {
      const current = await this.load();
      const next = parseState(change(structuredClone(current)));
      await this.storage.write(next);
      return next;
    });
  }

  // Stage a new immutable blob before committing its reference. A failed write
  // cannot change the old wallpaper; post-commit cleanup is best effort only.
  replace(
    change: (current: AppState) => AppState,
    blob: Blob | null,
  ): Promise<AppState> {
    return this.exclusive(async () => {
      const previous = await this.load();
      const next = parseState(change(structuredClone(previous)));
      const newId = next.settings.customWallpaper?.assetId;
      if (blob && !newId) throw new Error(t().lib.persistence.missingWallpaper);
      if (blob && newId === previous.settings.customWallpaper?.assetId)
        throw new Error(t().lib.persistence.wallpaperIdConflict);
      if (blob && newId) await this.assets.put(newId, blob);
      try {
        await this.storage.write(next);
      } catch (error) {
        if (blob && newId) await this.assets.remove(newId).catch(() => {});
        throw error;
      }
      const oldId = previous.settings.customWallpaper?.assetId;
      if (oldId && oldId !== newId)
        await this.assets.remove(oldId).catch(() => {});
      return next;
    });
  }

  snapshot(): Promise<{ state: AppState; blob: Blob | null }> {
    return this.exclusive(async () => {
      const state = await this.load();
      const id = state.settings.customWallpaper?.assetId;
      const blob = id ? await this.assets.get(id) : null;
      if (id && !blob) throw new Error(t().lib.persistence.wallpaperMissing);
      return { state, blob: blob ?? null };
    });
  }
}
