import type { Locale } from "./types";

/**
 * Toolbar popup copy: the add-current-page flow, its states and hints. The zh
 * object is the source of truth and keeps the exact pre-i18n strings.
 */
const zh = {
  loading: "正在读取当前页面…",
  errors: {
    loadFailed: "本地数据暂时读不出来，稍后再试。",
    emptyName: "给这个网站取一个名字吧。",
    duplicate: "这个网站已经在列表里了。",
    saveFailed: "保存失败，请重试。",
    maxShortcuts: (max: number) => `最多可添加 ${max} 个网站。`,
  },
  form: {
    nameLabel: "网站名称",
  },
  hints: {
    duplicate: "这个网站已经在常用网站里了。",
    full: (max: number) => `已经放满 ${max} 个网站，先在新标签页里整理一下吧。`,
    ready: "添加到新标签页的常用网站。",
  },
  unsupported: {
    title: "这个页面不能添加",
    body: "浏览器内部页面、扩展页面和本地文件都没有可访问的网址。切到普通网页再点一次图标吧。",
  },
  saved: {
    title: "已添加到常用网站",
    body: "回到新标签页就能看到它了。",
  },
  actions: {
    goToNewTab: "前往新标签页",
  },
};

export type PopupMessages = typeof zh;

const en: PopupMessages = {
  loading: "Reading the current page…",
  errors: {
    loadFailed: "Couldn't read your local data. Try again in a moment.",
    emptyName: "Give this site a name.",
    duplicate: "This site is already in your list.",
    saveFailed: "Couldn't save. Try again.",
    maxShortcuts: (max) => `You can add up to ${max} sites.`,
  },
  form: {
    nameLabel: "Site name",
  },
  hints: {
    duplicate: "This site is already in your shortcuts.",
    full: (max) =>
      `All ${max} shortcuts are in use. Tidy them up on the new tab page first.`,
    ready: "Add to the shortcuts on your new tab page.",
  },
  unsupported: {
    title: "This page can't be added",
    body: "Browser-internal pages, extension pages, and local files have no accessible address. Switch to a regular web page and click the icon again.",
  },
  saved: {
    title: "Added to shortcuts",
    body: "You'll see it on your new tab page.",
  },
  actions: {
    goToNewTab: "Go to new tab page",
  },
};

const ja: PopupMessages = {
  loading: "現在のページを読み込んでいます…",
  errors: {
    loadFailed:
      "ローカルデータを読み込めませんでした。しばらくしてからもう一度お試しください。",
    emptyName: "このサイトの名前を入力してください。",
    duplicate: "このサイトはすでに一覧にあります。",
    saveFailed: "保存できませんでした。もう一度お試しください。",
    maxShortcuts: (max) => `追加できるサイトは最大 ${max} 件です。`,
  },
  form: {
    nameLabel: "サイト名",
  },
  hints: {
    duplicate: "このサイトはすでによく使うサイトに登録されています。",
    full: (max) =>
      `上限の ${max} 件に達しています。新しいタブページで整理してください。`,
    ready: "新しいタブページのよく使うサイトに追加します。",
  },
  unsupported: {
    title: "このページは追加できません",
    body: "ブラウザの内部ページ、拡張機能のページ、ローカルファイルにはアクセス可能な URL がありません。通常のウェブページに切り替えてから、もう一度アイコンをクリックしてください。",
  },
  saved: {
    title: "よく使うサイトに追加しました",
    body: "新しいタブページを開くと表示されます。",
  },
  actions: {
    goToNewTab: "新しいタブページへ",
  },
};

export const popupMessages: Record<Locale, PopupMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
