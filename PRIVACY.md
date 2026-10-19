# Nico Privacy Policy

**Effective date: October 19, 2026**

Nico ("Nico · Impression New Tab") is a browser extension for Chrome and Microsoft Edge that replaces the new tab page with artwork, a clock, search, shortcuts and an optional bookmarks-free backup flow. This policy explains what the extension stores, what it accesses, and what leaves your device.

Nico is published by **NicoTools** ("we", "us"). We do not operate any account system, backend server, analytics service or advertising network for this extension.

## 1. Data stored on your device

The extension keeps the following data locally in your browser profile:

- **Settings and shortcuts** — appearance preferences, custom search engines, clock settings and the list of sites you add, stored in `chrome.storage.local` (key `nico.newtab.state.v1`).
- **Uploaded wallpapers** — images you choose are compressed locally and stored in the extension's IndexedDB.
- **Nutstore sync configuration (optional)** — if you connect Nutstore, your Nutstore account e-mail, app-specific password, sync folder and last-sync metadata are stored in `chrome.storage.local` (key `nico.newtab.sync.v1`). They are **not** written into exported JSON backups. They are stored in the browser's extension storage on this device and are removed when you disconnect.

All of this data stays on your device unless you explicitly export a backup file or enable Nutstore sync.

## 2. Data accessed by the extension

- **The active tab's title and URL** — only when you click the Nico toolbar icon to add the current page as a shortcut. This uses the browser's `activeTab` and `tabs` permissions.
- **Site icons** — shortcut icons are read from the browser's local favicon cache (`favicon` permission). The extension does not contact the shortcut's website to fetch icons.
- **Search text you type in the new tab search field** — used to navigate to the search engine you selected.

Nico does not read your browsing history, does not inject scripts into web pages, and does not collect data in the background.

## 3. Data transmitted to third parties

Nico only makes network requests in the following cases:

1. **Search suggestions.** When you use a built-in engine that offers suggestions (Google, Bing, Baidu or DuckDuckGo) and type at least two characters, the text you typed is sent to that engine's suggestion endpoint:
   - Google: `suggestqueries.google.com`
   - Microsoft Bing: `api.bing.com`
   - Baidu: `suggestion.baidu.com`
   - DuckDuckGo: `duckduckgo.com`

   These requests are handled by the respective search engine under its own privacy policy. The browser's default engine and custom engines never request suggestions. This feature does not use your account or identity.

2. **Nutstore sync (optional, off by default).** If you connect a Nutstore account, Nico uploads a backup JSON file (your shortcuts, settings and custom wallpaper) to **your own** Nutstore WebDAV storage at `https://dav.jianguoyun.com/dav/`. This uses the account e-mail and app-specific password you provide, over HTTPS. The data is stored in your Nutstore account, not on a Nico server. You can stop this at any time by disconnecting or turning off auto-sync. Nico does not receive a copy of your data.

3. **Links you click.** Artwork credits, the Nutstore help page and the privacy policy link open in a new tab only when you click them.

Search suggestions are sent only when you type and only for engines that support them; Nutstore sync only runs after you deliberately connect your account.

## 4. What we do not collect

- No telemetry, analytics, crash reporting or usage statistics.
- No advertising, tracking pixels or fingerprinting.
- No selling, renting or sharing of personal data for commercial purposes.
- No developer-operated servers: nothing is transmitted to NicoTools.
- No reading of passwords, cookies, form data or page content.
- No data collection from children; the extension is a general-audience visual customization tool and is not directed to children under 13.

## 5. Retention and your controls

- **Delete local data** — uninstalling the extension removes its local storage and IndexedDB data. You can also export a JSON backup first and import it later.
- **Export / import** — the settings page lets you export a complete JSON backup (including an embedded custom wallpaper) and restore it.
- **Nutstore sync** — disconnect clears the Nutstore account and app password from this device. Your data already written to Nutstore remains in your Nutstore account until you delete it there; you can revoke the app password in Nutstore's "Third-party apps" settings at any time.
- **Search suggestions** — switch to the browser default engine or a custom engine to avoid suggestion requests.

## 6. Security

- All network requests made by the extension use HTTPS.
- Nutstore credentials are stored only in the browser's extension storage on this device, are sent only to `dav.jianguoyun.com` and are never included in exported backups. They are not additionally encrypted at rest by Nico; protect your device account and disconnect when the device is shared.
- You can revoke a Nutstore app password at any time from your Nutstore account settings.

## 7. Changes to this policy

If the extension's data practices change, this policy will be updated in the same repository and the effective date above will change. Continued use after an update means you accept the updated policy.

## 8. Contact

Questions about this policy or your data can be raised at:
https://github.com/more-nico/nico-newtab/issues

Data controller: NicoTools. This policy is also available in [简体中文](PRIVACY.zh-CN.md) and [日本語](PRIVACY.ja.md).
