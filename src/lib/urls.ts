/** Public repository links shown in the UI and used in store metadata. */
export const REPOSITORY_URL = "https://github.com/more-nico/nico-newtab";
export const PRIVACY_URL =
  "https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.md";
export const PRIVACY_URL_ZH =
  "https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.zh-CN.md";
export const PRIVACY_URL_JA =
  "https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.ja.md";

import { currentLocale } from "./i18n";

/** Privacy policy in the visitor's language (falls back to English). */
export function privacyUrl(): string {
  const locale = currentLocale();
  return locale === "zh-CN"
    ? PRIVACY_URL_ZH
    : locale === "ja"
      ? PRIVACY_URL_JA
      : PRIVACY_URL;
}
