/**
 * Extension pages on any Chromium flavour: the literal `extension://` plus the
 * `chrome-extension://` / `edge-extension://` shapes the browsers actually use.
 */
const EXTENSION_URL = /^(?:[a-z]+-)?extension:\/\//i;

export interface ExtensionTabRef {
  id?: number;
  windowId?: number;
  url?: string;
}

/**
 * Picks the tab a "jump to extension page" action should land on: this
 * extension's own page first, then any other extension page, most recently
 * used first (the order `chrome.tabs.query` reports). `undefined` means no
 * extension tab is open and a fresh one has to be created.
 */
export function pickExtensionTab(
  tabs: ExtensionTabRef[],
  ownPage: string,
): { id: number; windowId?: number } | undefined {
  const own = tabs.find((tab) => tab.id !== undefined && tab.url === ownPage);
  const other = tabs.find(
    (tab) =>
      tab.id !== undefined &&
      tab.url !== undefined &&
      EXTENSION_URL.test(tab.url),
  );
  const target = own ?? other;
  if (!target || target.id === undefined) return undefined;
  return { id: target.id, windowId: target.windowId };
}
