import { describe, expect, it, vi } from "vitest";
import { defaultState } from "../data";
import { Repository, type Exclusive } from "./persistence";
import type { AppState } from "../types";

function setup(initial: AppState | undefined = defaultState()) {
  let saved = initial;
  const blobs = new Map<string, Blob>();
  const storage = {
    read: vi.fn(
      async (): Promise<AppState | undefined> =>
        saved ? structuredClone(saved) : undefined,
    ),
    write: vi.fn(async (state: AppState) => {
      saved = structuredClone(state);
    }),
    subscribe: () => () => {},
  };
  const assets = {
    get: vi.fn(async (id: string) => blobs.get(id)),
    put: vi.fn(async (id: string, blob: Blob) => {
      blobs.set(id, blob);
    }),
    remove: vi.fn(async (id: string) => {
      blobs.delete(id);
    }),
  };
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive: Exclusive = (operation) => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => {});
    return result;
  };
  return {
    repo: new Repository(storage, assets, exclusive),
    storage,
    assets,
    blobs,
  };
}
describe("durable state and assets", () => {
  it("does not write defaults during initial loading", async () => {
    const { repo, storage } = setup();
    storage.read.mockResolvedValueOnce(undefined);
    expect(await repo.load()).toEqual(defaultState());
    expect(storage.write).not.toHaveBeenCalled();
  });
  it("serializes concurrent changes against fresh data", async () => {
    const { repo } = setup();
    await Promise.all([
      repo.update((s) => ({ ...s, settings: { ...s.settings, blur: 10 } })),
      repo.update((s) => ({
        ...s,
        settings: { ...s.settings, clockFormat: "12" },
      })),
    ]);
    expect((await repo.load()).settings).toMatchObject({
      blur: 10,
      clockFormat: "12",
    });
  });
  it("rolls back the staged wallpaper when the state commit fails", async () => {
    const state = defaultState();
    state.settings.customWallpaper = {
      assetId: "old",
      name: "old.webp",
      mime: "image/webp",
    };
    state.settings.wallpaper = "custom";
    const { repo, storage, blobs } = setup(state);
    blobs.set("old", new Blob(["old"]));
    storage.write.mockRejectedValueOnce(new Error("quota"));
    await expect(
      repo.replace(
        (s) => ({
          ...s,
          settings: {
            ...s.settings,
            customWallpaper: {
              assetId: "new",
              name: "new.webp",
              mime: "image/webp",
            },
          },
        }),
        new Blob(["new"]),
      ),
    ).rejects.toThrow("quota");
    expect(blobs.has("old")).toBe(true);
    expect(blobs.has("new")).toBe(false);
    expect((await repo.load()).settings.customWallpaper?.assetId).toBe("old");
  });
  it("does not commit settings when asset storage fails", async () => {
    const { repo, storage, assets } = setup();
    assets.put.mockRejectedValueOnce(new Error("disk"));
    await expect(
      repo.replace(
        (s) => ({
          ...s,
          settings: {
            ...s.settings,
            wallpaper: "custom",
            customWallpaper: {
              assetId: "new",
              name: "new",
              mime: "image/webp",
            },
          },
        }),
        new Blob(),
      ),
    ).rejects.toThrow("disk");
    expect(storage.write).not.toHaveBeenCalled();
  });
  it("refuses incomplete backups when the referenced blob is missing", async () => {
    const state = defaultState();
    state.settings.customWallpaper = {
      assetId: "missing",
      name: "pic",
      mime: "image/webp",
    };
    const { repo } = setup(state);
    await expect(repo.snapshot()).rejects.toThrow("丢失");
  });
});
