import { describe, expect, it } from "vitest";
import {
  MAX_PAGE_ICON_DATA_URL,
  normalizePageEmoji,
  isPageIconImageDataUrl,
} from "./pageIcon";

const WEBP =
  "data:image/webp;base64,UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=";

describe("page icon input", () => {
  it.each(["🏠", "👨🏽‍👩🏽‍👧🏽", "🇯🇵", "1️⃣"])(
    "accepts one emoji grapheme %s",
    (emoji) => expect(normalizePageEmoji(`  ${emoji}  `)).toBe(emoji),
  );

  it.each(["", "home", "🏠🏠", "🏠a", "🇯", "\u200D🏠", "🏠".repeat(33)])(
    "rejects a non-single emoji %j",
    (value) => expect(normalizePageEmoji(value)).toBeNull(),
  );

  it("accepts optimized WebP images and rejects foreign, corrupt or oversized input", () => {
    expect(isPageIconImageDataUrl(WEBP)).toBe(true);
    const corrupt = Buffer.from(WEBP.split(",")[1], "base64");
    corrupt.writeUInt32LE(0, 4);
    for (const value of [
      "https://example.com/icon.webp",
      WEBP.replace("image/webp", "image/png"),
      "data:image/webp;base64,!!!!",
      WEBP.slice(0, -8),
      "data:image/webp;base64," + corrupt.toString("base64"),
      "data:image/webp;base64," + "A".repeat(MAX_PAGE_ICON_DATA_URL),
    ])
      expect(isPageIconImageDataUrl(value)).toBe(false);
  });
});
