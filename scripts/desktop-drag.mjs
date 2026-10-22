import { expect } from "@playwright/test";

// Called by smoke.mjs: native drag catches DOM/key wiring that pure tests miss.
export async function checkDesktopDrag(page) {
  const key = "nico.newtab.state.v1";
  const read = () =>
    page.evaluate(
      async (key) => (await chrome.storage.local.get(key))[key],
      key,
    );
  const previous = await read();
  const write = (value) =>
    page.evaluate(
      async ({ key, value }) => chrome.storage.local.set({ [key]: value }),
      { key, value },
    );
  const fixture = {
    ...previous,
    shortcuts: ["a", "b", "c"].map((id) => ({
      id,
      name: id,
      url: `https://${id}.example/`,
    })),
    pages: [
      {
        id: "drag-one",
        name: "第一页",
        items: ["a", "b", "c"].map((id) => ({ type: "shortcut", id })),
      },
      { id: "drag-two", name: "第二页", items: [] },
    ],
    folders: [],
  };
  const desktop = (id) =>
    page.locator(`.shortcut-grid [data-drag-key="shortcut:${id}"]`);
  const member = (id) => page.locator(`.folder-site[data-shortcut-id="${id}"]`);
  const members = async () => (await read()).folders[0]?.shortcutIds;
  const moveTo = (box, fraction) =>
    page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2, {
      steps: 12,
    });
  async function begin(tile, glassSelector = ".shortcut-glass") {
    await tile.hover();
    const glass = await tile.locator(glassSelector).boundingBox();
    const source = await tile.boundingBox();
    await moveTo(glass, 0.5);
    await page.mouse.down();
    await page.mouse.move(
      glass.x + glass.width / 2 + 10,
      glass.y + glass.height / 2 + 10,
      { steps: 4 },
    );
    await expect(tile).toHaveClass(/is-drag-source/);
    return source;
  }

  try {
    await write(fixture);
    await page.reload();
    await page
      .locator(".dock-page:not(.dock-new)")
      .nth(1)
      .click({ button: "right" });
    await expect(page.locator(".page-shell")).toHaveAttribute("inert", "");
    await page.locator(".dialog-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await desktop("b").hover();
    const target = await desktop("b").locator(".shortcut-glass").boundingBox();
    await begin(desktop("a"));
    await moveTo(target, 0.5);
    await page.mouse.up();
    await expect.poll(members).toEqual(["a", "b"]);
    await expect(page.locator(".folder-site-grid")).toBeVisible();

    await member("b").hover();
    const last = await member("b").locator(".shortcut-glass").boundingBox();
    const source = await begin(member("a"));
    await moveTo(last, 0.88);
    await expect
      .poll(async () => (await member("b").boundingBox()).x)
      .toBeLessThan(source.x + 2);
    const held = await member("a").boundingBox();
    expect(held.x).toBeCloseTo(source.x, 0);
    expect(held.y).toBeCloseTo(source.y, 0);
    await page.mouse.up();
    await expect.poll(members).toEqual(["b", "a"]);
    expect((await read()).folders).toHaveLength(1);

    const first = await member("b").locator(".shortcut-glass").boundingBox();
    await begin(member("a"));
    await moveTo(first, 0.12);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator(".folder-site-grid")).toBeVisible();
    expect(await members()).toEqual(["b", "a"]);

    await begin(member("a"));
    await page.mouse.move(20, 20, { steps: 12 });
    await page.mouse.up();
    await expect.poll(members).toEqual(["b"]);
    expect(
      (await read()).pages[0].items.filter((item) => item.id === "a"),
    ).toHaveLength(1);
    await page.locator(".dialog-close").click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const folderId = (await read()).folders[0].id;
    const dock = await page
      .locator(".dock-page:not(.dock-new)")
      .nth(1)
      .boundingBox();
    await begin(page.locator(".folder-item"), ".folder-glass");
    await moveTo(dock, 0.5);
    await page.mouse.up();
    await expect
      .poll(async () => (await read()).pages[1].items)
      .toEqual([{ type: "folder", id: folderId }]);
    await expect(page.locator(".dock-page.is-drop-over")).toHaveCount(0);
    await page.reload();
    expect(await members()).toEqual(["b"]);
  } finally {
    await page.mouse.up();
    await write(previous);
    await page.reload();
  }
}
