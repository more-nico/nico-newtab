import type { Locale } from "./types";

// Owned by the App migration task: greeting, date line, footer, search and
// shortcut copy. The Chinese section is the source of truth and must keep the
// exact existing strings so the zh-CN regression tests keep passing.
const zh = {
  header: {
    brandAria: "Nico 新标签页",
    brandCaption: "每一页，都是新的风景",
    gallery: "画作集",
    // The artworks are a fixed built-in set, so the count stays a constant.
    galleryCount: "03",
  },
  greeting: {
    lateNight: "夜深了，给自己一点宁静。",
    morning: "早上好，今天也有好风景。",
    noon: "午间好，留一点时间给自己。",
    afternoon: "下午好，让灵感慢慢发生。",
    evening: "晚上好，把步调放慢一点。",
  },
  clock: {
    aria: "当前时间",
  },
  search: {
    engineAria: "选择搜索引擎",
    inputAria: "搜索",
    placeholder: "搜索，让好奇心带路",
    clearAria: "清空搜索",
    submitAria: "开始搜索",
    suggestionsAria: "搜索建议",
    suggestionsUnavailable:
      "搜索建议不可用：请到 chrome://extensions 重新加载扩展，然后新开一个标签页。",
    engineSaveFailed: "引擎保存失败。",
    unavailable: "搜索暂时不可用，请重试。",
  },
  shortcuts: {
    title: "常用网站",
    sectionAria: "常用网站",
    manage: "整理",
    addAria: "添加常用网站",
    add: "添加网站",
    editAria: (name: string) => `编辑 ${name}`,
    empty: "把常去的地方，留在这里。",
    limit: "最多可添加 200 个网站。",
    removedElsewhere: "这个网站已在其他标签页中移除。",
  },
  footer: {
    myLandscape: "我的风景",
    note: "在日常里，与美相遇",
    wallpaperUnavailable: "壁纸暂不可用 · 已显示备用背景",
    settings: "设置",
  },
  previewBadge: "网页预览",
  status: {
    loadFailed: "暂时无法读取本地数据。为保护已有内容，编辑已暂停。",
    retryLoad: "重新读取",
    customWallpaperFailed: "自定义壁纸暂时无法读取，可以在设置中重新上传。",
    notReady: "本地数据尚未加载，请稍后重试。",
    saveFailed: (message: string) => `保存失败：${message}`,
    saveFailedUnknown: "保存失败，请检查可用空间后重试。",
    closeToastAria: "关闭提示",
  },
  wallpaper: {
    defaultName: "我的壁纸",
  },
};
export type AppMessages = typeof zh;
export const appMessages: Record<Locale, AppMessages> = {
  "zh-CN": zh,
  en: {
    header: {
      brandAria: "Nico new tab page",
      brandCaption: "Every page, a new view",
      gallery: "Artworks",
      galleryCount: "03",
    },
    greeting: {
      lateNight: "It's late — give yourself a little calm.",
      morning: "Good morning — today's view is beautiful too.",
      noon: "Good afternoon — save a little time for yourself.",
      afternoon: "Good afternoon — let inspiration take its time.",
      evening: "Good evening — slow the pace a little.",
    },
    clock: {
      aria: "Current time",
    },
    search: {
      engineAria: "Choose search engine",
      inputAria: "Search",
      placeholder: "Search — let curiosity lead",
      clearAria: "Clear search",
      submitAria: "Start search",
      suggestionsAria: "Search suggestions",
      suggestionsUnavailable:
        "Search suggestions are unavailable: reload the extension at chrome://extensions, then open a new tab.",
      engineSaveFailed: "Couldn't save the search engine.",
      unavailable: "Search isn't available right now. Please try again.",
    },
    shortcuts: {
      title: "Shortcuts",
      sectionAria: "Shortcuts",
      manage: "Organize",
      addAria: "Add shortcut",
      add: "Add site",
      editAria: (name) => `Edit ${name}`,
      empty: "Keep the places you visit most right here.",
      limit: "You can add up to 200 sites.",
      removedElsewhere: "This site was removed in another tab.",
    },
    footer: {
      myLandscape: "My landscape",
      note: "Meet beauty in the everyday",
      wallpaperUnavailable:
        "Wallpaper unavailable · showing a fallback background",
      settings: "Settings",
    },
    previewBadge: "Web preview",
    status: {
      loadFailed:
        "Couldn't read local data right now. Editing is paused to protect your existing content.",
      retryLoad: "Reload",
      customWallpaperFailed:
        "Couldn't load your custom wallpaper. You can upload it again in Settings.",
      notReady: "Local data hasn't loaded yet. Please try again in a moment.",
      saveFailed: (message) => `Couldn't save: ${message}`,
      saveFailedUnknown:
        "Couldn't save. Check the available space and try again.",
      closeToastAria: "Close notification",
    },
    wallpaper: {
      defaultName: "My wallpaper",
    },
  },
  ja: {
    header: {
      brandAria: "Nico の新しいタブページ",
      brandCaption: "ページを開けば、新しい風景。",
      gallery: "作品集",
      galleryCount: "03",
    },
    greeting: {
      lateNight: "夜も深まりました。少し静かな時間を。",
      morning: "おはようございます。今日もいい風景がありますように。",
      noon: "こんにちは。自分のための時間を少しだけ。",
      afternoon: "こんにちは。午後のひととき、ひらめきをゆっくりと。",
      evening: "こんばんは。少し歩調をゆるめましょう。",
    },
    clock: {
      aria: "現在時刻",
    },
    search: {
      engineAria: "検索エンジンを選択",
      inputAria: "検索",
      placeholder: "検索。好奇心の向くままに",
      clearAria: "検索をクリア",
      submitAria: "検索を開始",
      suggestionsAria: "検索候補",
      suggestionsUnavailable:
        "検索候補を利用できません。chrome://extensions で拡張機能を再読み込みしてから、新しいタブを開いてください。",
      engineSaveFailed: "検索エンジンを保存できませんでした。",
      unavailable: "検索を一時的に利用できません。もう一度お試しください。",
    },
    shortcuts: {
      title: "よく使うサイト",
      sectionAria: "よく使うサイト",
      manage: "整理",
      addAria: "よく使うサイトを追加",
      add: "サイトを追加",
      editAria: (name) => `${name} を編集`,
      empty: "よく行く場所を、ここに。",
      limit: "追加できるサイトは最大 200 件です。",
      removedElsewhere: "このサイトは別のタブで削除されました。",
    },
    footer: {
      myLandscape: "私の風景",
      note: "日常の中で、美に出会う。",
      wallpaperUnavailable: "壁紙を利用できません · 代替の背景を表示しています",
      settings: "設定",
    },
    previewBadge: "ウェブプレビュー",
    status: {
      loadFailed:
        "ローカルデータを読み込めません。既存の内容を守るため、編集を一時停止しています。",
      retryLoad: "再読み込み",
      customWallpaperFailed:
        "カスタム壁紙を読み込めません。設定から再アップロードできます。",
      notReady:
        "ローカルデータをまだ読み込んでいません。しばらくしてからもう一度お試しください。",
      saveFailed: (message) => `保存できませんでした：${message}`,
      saveFailedUnknown:
        "保存できませんでした。空き容量を確認して、もう一度お試しください。",
      closeToastAria: "通知を閉じる",
    },
    wallpaper: {
      defaultName: "私の壁紙",
    },
  },
};
