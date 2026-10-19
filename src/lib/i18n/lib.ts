import type { Locale } from "./types";

/**
 * User-facing messages raised by the library layer: validation and
 * normalization errors, image processing failures, persistence and platform
 * errors, built-in search engine names, and the suggestion request diagnostic.
 * The zh object is the source of truth and keeps the exact pre-i18n strings.
 */
const zh = {
  validation: {
    invalidFile: "文件内容不完整或格式不受支持，原有数据未更改。",
    urlInvalid: "请输入有效的网址，例如 example.com。",
    urlScheme: "网站地址仅支持 HTTP 和 HTTPS。",
    urlFormat: "网址格式不正确，请检查后重试。",
    urlCredentials: "请输入不含用户名和密码的 HTTP / HTTPS 地址。",
    searchUrlRequired: "请输入搜索地址，例如 https://example.com/search?q=%s。",
    searchUrlPlaceholder: "搜索地址需要且只能包含一个 %s 占位符。",
    backupTooLarge: "备份文件过大，最大支持 32 MB。",
  },
  images: {
    readFailed: "图片读取失败。",
    typeUnsupported: "请选择 JPG、PNG 或 WebP 图片。",
    imageTooLarge: "图片大小需在 0–20 MB 之间。",
    decodeFailed: "无法解码这张图片，请换一张试试。",
    canvasUnavailable: "浏览器暂时无法处理图片。",
    imageConvertFailed: "图片转换失败，请尝试较小的图片。",
    iconTooLarge: "图标大小需在 0–5 MB 之间。",
    emptyPixels: "这张图片没有可用的像素。",
    iconConvertFailed: "图标转换失败，请换一张试试。",
    wallpaperCorrupt: "备份中的壁纸已损坏，原有数据未更改。",
    wallpaperSize: "备份中的图片尺寸不受支持。",
  },
  persistence: {
    missingWallpaper: "缺少壁纸信息。",
    wallpaperIdConflict: "新壁纸需要独立的存储标识。",
    wallpaperMissing: "自定义壁纸丢失，请重新上传后再备份。",
  },
  platform: {
    storageBusy: "图片存储被其他窗口占用，请关闭旧页面重试。",
    saveInterrupted: "图片保存中断。",
    previewOnly: "这是网页预览。在浏览器中加载扩展后，即可使用搜索引擎。",
  },
  /** Built-in engine display names; the brands themselves stay untranslated. */
  engineNames: {
    default: "默认",
    google: "Google",
    bing: "Bing",
    baidu: "百度",
    duckduckgo: "DuckDuckGo",
  },
  suggest: {
    requestFailed: (engineId: string) =>
      `[nico] 搜索建议请求失败（${engineId}）。若是 "violates the following Content Security Policy directive: connect-src"，说明当前加载的扩展 manifest 是旧的，需要在 chrome://extensions 重新加载扩展并新开标签页。`,
  },
};

export type LibMessages = typeof zh;

const en: LibMessages = {
  validation: {
    invalidFile:
      "The file is incomplete or in an unsupported format. Your existing data was not changed.",
    urlInvalid: "Enter a valid address, such as example.com.",
    urlScheme: "Only HTTP and HTTPS addresses are supported.",
    urlFormat: "That address isn't valid. Check it and try again.",
    urlCredentials:
      "Enter an HTTP/HTTPS address without a username or password.",
    searchUrlRequired:
      "Enter a search address, such as https://example.com/search?q=%s.",
    searchUrlPlaceholder:
      "The search address must contain exactly one %s placeholder.",
    backupTooLarge: "The backup file is too large. The maximum is 32 MB.",
  },
  images: {
    readFailed: "Couldn't read the image.",
    typeUnsupported: "Choose a JPG, PNG, or WebP image.",
    imageTooLarge: "The image must be between 0 and 20 MB.",
    decodeFailed: "Couldn't decode this image. Try a different one.",
    canvasUnavailable: "The browser can't process images right now.",
    imageConvertFailed: "Couldn't convert the image. Try a smaller one.",
    iconTooLarge: "The icon must be between 0 and 5 MB.",
    emptyPixels: "This image has no usable pixels.",
    iconConvertFailed: "Couldn't convert the icon. Try a different one.",
    wallpaperCorrupt:
      "The wallpaper in this backup is damaged. Your existing data was not changed.",
    wallpaperSize: "The image size in this backup isn't supported.",
  },
  persistence: {
    missingWallpaper: "Wallpaper information is missing.",
    wallpaperIdConflict: "The new wallpaper needs its own storage ID.",
    wallpaperMissing:
      "The custom wallpaper is missing. Upload it again before making a backup.",
  },
  platform: {
    storageBusy:
      "Image storage is in use by another window. Close the old page and try again.",
    saveInterrupted: "Saving the image was interrupted.",
    previewOnly:
      "This is a web preview. Load the extension in your browser to use search engines.",
  },
  engineNames: {
    default: "Browser default",
    google: "Google",
    bing: "Bing",
    baidu: "Baidu",
    duckduckgo: "DuckDuckGo",
  },
  suggest: {
    requestFailed: (engineId) =>
      `[nico] Suggestion request failed (${engineId}). If it says "violates the following Content Security Policy directive: connect-src", the extension manifest currently loaded is outdated — reload the extension in chrome://extensions and open a new tab.`,
  },
};

const ja: LibMessages = {
  validation: {
    invalidFile:
      "ファイルの内容が不完全か、対応していない形式です。既存のデータは変更されていません。",
    urlInvalid: "有効な URL を入力してください（例：example.com）。",
    urlScheme: "サイトのアドレスは HTTP と HTTPS のみ対応しています。",
    urlFormat:
      "URL の形式が正しくありません。確認してからもう一度お試しください。",
    urlCredentials:
      "ユーザー名とパスワードを含まない HTTP / HTTPS アドレスを入力してください。",
    searchUrlRequired:
      "検索 URL を入力してください（例：https://example.com/search?q=%s）。",
    searchUrlPlaceholder:
      "検索 URL には %s プレースホルダーを 1 つだけ含めてください。",
    backupTooLarge:
      "バックアップファイルが大きすぎます。最大 32 MB まで対応しています。",
  },
  images: {
    readFailed: "画像を読み込めませんでした。",
    typeUnsupported: "JPG、PNG、WebP のいずれかの画像を選択してください。",
    imageTooLarge: "画像サイズは 0～20 MB の範囲で指定してください。",
    decodeFailed:
      "この画像をデコードできませんでした。別の画像をお試しください。",
    canvasUnavailable: "ブラウザが一時的に画像を処理できません。",
    imageConvertFailed:
      "画像の変換に失敗しました。より小さい画像をお試しください。",
    iconTooLarge: "アイコンサイズは 0～5 MB の範囲で指定してください。",
    emptyPixels: "この画像には使用できるピクセルがありません。",
    iconConvertFailed:
      "アイコンの変換に失敗しました。別の画像をお試しください。",
    wallpaperCorrupt:
      "バックアップ内の壁紙が破損しています。既存のデータは変更されていません。",
    wallpaperSize: "バックアップ内の画像のサイズは対応していません。",
  },
  persistence: {
    missingWallpaper: "壁紙の情報がありません。",
    wallpaperIdConflict: "新しい壁紙には固有の保存 ID が必要です。",
    wallpaperMissing:
      "カスタム壁紙が見つかりません。再度アップロードしてからバックアップしてください。",
  },
  platform: {
    storageBusy:
      "画像ストレージが別のウィンドウで使用中です。古いページを閉じて再試行してください。",
    saveInterrupted: "画像の保存が中断されました。",
    previewOnly:
      "これはウェブプレビューです。ブラウザで拡張機能を読み込むと、検索エンジンを使用できます。",
  },
  engineNames: {
    default: "ブラウザの既定",
    google: "Google",
    bing: "Bing",
    baidu: "Baidu",
    duckduckgo: "DuckDuckGo",
  },
  suggest: {
    requestFailed: (engineId) =>
      `[nico] 検索サジェストのリクエストに失敗しました（${engineId}）。"violates the following Content Security Policy directive: connect-src" と表示される場合は、現在読み込まれている拡張機能の manifest が古いため、chrome://extensions で拡張機能を再読み込みして新しいタブを開いてください。`,
  },
};

export const libMessages: Record<Locale, LibMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
