import type { Locale } from "./types";

// Owned by the settings migration task: Settings panel plus the search engine
// settings block. The Chinese section is the source of truth and keeps the
// pre-migration strings verbatim so the zh-CN UI (and the smoke test) is
// unchanged.
const zh = {
  panel: {
    title: "设置",
    tabsAria: "设置分类",
    tabs: {
      appearance: "外观",
      features: "功能",
      sync: "同步",
      about: "关于",
    },
    status: {
      busy: "正在处理…",
      saving: "正在保存…",
      autoSave: "更改自动保存在此浏览器",
    },
    errors: {
      action: "操作失败，请重试。",
      save: "设置保存失败。",
    },
  },
  appearance: {
    heading: {
      title: "把艺术，留在日常",
      note: "馆藏 · 公有领域",
    },
    wallpaperAria: "选择壁纸",
    customSlot: "我的图片",
    customSavedLocally: "仅保存在当前浏览器",
    upload: {
      hint: "JPG、PNG 或 WebP，最大 20 MB",
      replace: "替换图片",
      upload: "上传图片",
      aria: "上传壁纸文件",
      success: "图片已保存到本地。",
    },
    fit: {
      title: "画面适配",
      hint: "铺满屏幕，或保留完整画作",
      cover: "铺满",
      contain: "完整",
    },
    position: {
      x: "水平位置",
      y: "垂直位置",
    },
    wallpaperStyle: {
      brightness: "壁纸亮度",
      blur: "壁纸模糊",
    },
    customOnly: "你的图片仅保存在当前浏览器。",
    optics: {
      title: "找到舒服的光与影",
      note: "实时预览",
    },
    glassMode: {
      title: "玻璃明暗",
      hint: "自动 = Auto，跟随壁纸；浅色 = Light，深色 = Dark",
      auto: "自动",
      light: "浅色",
      dark: "深色",
    },
    quality: {
      title: "玻璃质感",
      hint: "轻盈只保留模糊与折射，细腻额外开启色散与弹性",
      low: "轻盈",
      high: "细腻",
    },
    glassParams: {
      title: "玻璃光学参数",
      note: "参数范围、步进与默认值和 glass-kit playground 完全一致",
      reset: "恢复 Playground 默认值",
      blur: "模糊 Blur",
      saturation: "饱和度 Saturation",
      brightness: "亮度 Brightness",
      mapScale: "贴图精度 Map scale",
      depth: "折射带 Depth",
      curvature: "曲率 Curvature",
      dispersion: "色散 Dispersion",
      highlight: "高光 Highlight",
      elasticity: "弹性 Elasticity",
      refraction: "折射",
      mapScaleNote: "贴图精度越高，边缘越清晰，也会增加渲染开销",
      interaction: "交互",
      interactionNote: "色散和弹性仅在“细腻”玻璃档位生效",
      environmentNote:
        "玻璃效果会根据浏览器能力自动适配。系统开启“减少动态效果”时，页面会减少动画。",
    },
  },
  features: {
    clockFormat: {
      title: "时间格式",
      hint: "使用设备的本地时间",
      h24: "24 小时",
      h12: "12 小时",
    },
    clockTint: "时钟 Tint 强度",
    searchEngines: {
      title: "搜索引擎",
      note: "自定义搜索地址；自定义引擎不提供搜索建议",
    },
  },
  engines: {
    empty: "还没有自定义搜索引擎。",
    add: "添加搜索引擎",
    limit: (max: number) => `最多 ${max} 个自定义搜索引擎`,
    errors: {
      save: "保存失败，请重试。",
      nameRequired: "给这个搜索引擎取一个名字吧。",
      nameTooLong: (max: number) => `名称最多 ${max} 个字符。`,
      limit: (max: number) => `最多可添加 ${max} 个自定义搜索引擎。`,
      duplicate: "已经有同名的搜索引擎了。",
      invalidUrl: "搜索地址不正确。",
    },
    card: {
      removeBusy: "移除中…",
      confirmRemove: "确认移除",
      confirmRemoveNote: (name: string) =>
        `确定移除“${name}”？ 使用它的搜索栏会回到浏览器默认引擎。`,
    },
    form: {
      name: "名称",
      namePlaceholder: "例如：知乎",
      clearNameAria: "清空引擎名称",
      url: "搜索地址",
      urlPlaceholder: "https://www.zhihu.com/search?q=%s",
      clearUrlAria: "清空搜索地址",
      help: "使用 %s 代表搜索关键词，仅支持 HTTP / HTTPS。",
      save: "保存引擎",
    },
  },
  about: {
    heading: {
      title: "把喜欢的，妥善收藏",
      note: "仅保存在本地",
    },
    export: {
      title: "导出备份",
      description: "包含常用网站、全部设置和自定义壁纸。",
      button: "导出",
      success: "备份文件已导出。",
    },
    import: {
      title: "从备份恢复",
      description: "导入 Nico 的 JSON 备份文件，最大 32 MB。",
      button: "导入",
      aria: "导入备份文件",
      tooLarge: "备份文件最大支持 32 MB。",
      confirmAria: "确认恢复备份",
      confirmTitle: "用这份备份替换当前内容？",
      confirm: "确认替换并恢复",
      success: "备份已恢复。",
      summary: (count: number, hasWallpaper: boolean) =>
        `将恢复 ${count} 个网站、全部外观设置${
          hasWallpaper ? "和一张自定义壁纸" : "；当前上传的壁纸将被移除"
        }。建议先导出当前备份。`,
    },
    privacyNote:
      "无需账号，不收集使用数据。卸载扩展会清除本地内容，请提前备份。",
    version: "印象新标签页 · 1.0.0",
    thirdPartyNotices: "素材与开源许可 ↗",
    privacyPolicy: "隐私政策",
  },
};

export type SettingsMessages = typeof zh;

const en: SettingsMessages = {
  panel: {
    title: "Settings",
    tabsAria: "Settings sections",
    tabs: {
      appearance: "Appearance",
      features: "Features",
      sync: "Sync",
      about: "About",
    },
    status: {
      busy: "Working…",
      saving: "Saving…",
      autoSave: "Changes are saved automatically in this browser",
    },
    errors: {
      action: "Something went wrong. Please try again.",
      save: "Couldn't save your settings.",
    },
  },
  appearance: {
    heading: {
      title: "Keep art in your everyday",
      note: "Museum collection · Public domain",
    },
    wallpaperAria: "Choose wallpaper",
    customSlot: "My image",
    customSavedLocally: "Stored in this browser only",
    upload: {
      hint: "JPG, PNG or WebP, up to 20 MB",
      replace: "Replace image",
      upload: "Upload image",
      aria: "Upload wallpaper file",
      success: "Image saved locally.",
    },
    fit: {
      title: "Image fit",
      hint: "Fill the screen or keep the whole painting visible",
      cover: "Fill",
      contain: "Whole",
    },
    position: {
      x: "Horizontal position",
      y: "Vertical position",
    },
    wallpaperStyle: {
      brightness: "Wallpaper brightness",
      blur: "Wallpaper blur",
    },
    customOnly: "Your image is stored in this browser only.",
    optics: {
      title: "Find a comfortable light",
      note: "Live preview",
    },
    glassMode: {
      title: "Glass tone",
      hint: "Auto follows the wallpaper; Light and Dark fix the glass tone",
      auto: "Auto",
      light: "Light",
      dark: "Dark",
    },
    quality: {
      title: "Glass detail",
      hint: "Light keeps blur and refraction; Detailed also adds dispersion and elasticity",
      low: "Light",
      high: "Detailed",
    },
    glassParams: {
      title: "Glass optics",
      note: "Ranges, steps and defaults match the glass-kit playground exactly",
      reset: "Restore playground defaults",
      blur: "Blur",
      saturation: "Saturation",
      brightness: "Brightness",
      mapScale: "Map scale",
      depth: "Depth",
      curvature: "Curvature",
      dispersion: "Dispersion",
      highlight: "Highlight",
      elasticity: "Elasticity",
      refraction: "Refraction",
      mapScaleNote:
        "A higher map scale keeps edges sharper but adds rendering cost",
      interaction: "Interaction",
      interactionNote:
        "Dispersion and elasticity apply only to the Detailed glass quality",
      environmentNote:
        "Glass effects adapt to your browser's capabilities. Animations are reduced when the system's reduce motion setting is on.",
    },
  },
  features: {
    clockFormat: {
      title: "Time format",
      hint: "Uses your device's local time",
      h24: "24-hour",
      h12: "12-hour",
    },
    clockTint: "Clock tint strength",
    searchEngines: {
      title: "Search engines",
      note: "Add custom search URLs; custom engines don't offer suggestions",
    },
  },
  engines: {
    empty: "No custom search engines yet.",
    add: "Add search engine",
    limit: (max) => `Up to ${max} custom search engines`,
    errors: {
      save: "Couldn't save. Please try again.",
      nameRequired: "Give this search engine a name.",
      nameTooLong: (max) => `Names can be up to ${max} characters.`,
      limit: (max) => `You can add up to ${max} custom search engines.`,
      duplicate: "A search engine with that name already exists.",
      invalidUrl: "That search URL doesn't look right.",
    },
    card: {
      removeBusy: "Removing…",
      confirmRemove: "Confirm removal",
      confirmRemoveNote: (name) =>
        `Remove “${name}”? Searches using it will fall back to the browser's default engine.`,
    },
    form: {
      name: "Name",
      namePlaceholder: "e.g. Wikipedia",
      clearNameAria: "Clear engine name",
      url: "Search URL",
      urlPlaceholder: "https://duckduckgo.com/?q=%s",
      clearUrlAria: "Clear search URL",
      help: "Use %s for the search terms. Only HTTP and HTTPS are supported.",
      save: "Save engine",
    },
  },
  about: {
    heading: {
      title: "Keep what you love, safely stored",
      note: "Stored locally only",
    },
    export: {
      title: "Export backup",
      description:
        "Includes your shortcuts, all settings and your custom wallpaper.",
      button: "Export",
      success: "Backup exported.",
    },
    import: {
      title: "Restore from backup",
      description: "Import a Nico JSON backup, up to 32 MB.",
      button: "Import",
      aria: "Import backup file",
      tooLarge: "Backups can be up to 32 MB.",
      confirmAria: "Confirm backup restore",
      confirmTitle: "Replace the current content with this backup?",
      confirm: "Replace and restore",
      success: "Backup restored.",
      summary: (count, hasWallpaper) =>
        `This will restore ${count} ${
          count === 1 ? "shortcut" : "shortcuts"
        }, all appearance settings${
          hasWallpaper
            ? ", and your custom wallpaper"
            : ", and remove the uploaded wallpaper"
        }. Export your current backup first if you want to keep it.`,
    },
    privacyNote:
      "No account needed and no usage data collected. Uninstalling the extension clears local content, so back it up first.",
    version: "Impression New Tab · 1.0.0",
    thirdPartyNotices: "Assets and open-source licenses ↗",
    privacyPolicy: "Privacy policy",
  },
};

const ja: SettingsMessages = {
  panel: {
    title: "設定",
    tabsAria: "設定カテゴリ",
    tabs: {
      appearance: "外観",
      features: "機能",
      sync: "同期",
      about: "このアプリについて",
    },
    status: {
      busy: "処理中…",
      saving: "保存中…",
      autoSave: "変更はこのブラウザに自動保存されます",
    },
    errors: {
      action: "操作に失敗しました。もう一度お試しください。",
      save: "設定を保存できませんでした。",
    },
  },
  appearance: {
    heading: {
      title: "アートを、日常に",
      note: "所蔵作品 · パブリックドメイン",
    },
    wallpaperAria: "壁紙を選択",
    customSlot: "マイ画像",
    customSavedLocally: "このブラウザにのみ保存",
    upload: {
      hint: "JPG、PNG、WebP 形式、最大 20 MB",
      replace: "画像を変更",
      upload: "画像をアップロード",
      aria: "壁紙ファイルをアップロード",
      success: "画像をローカルに保存しました。",
    },
    fit: {
      title: "画面への合わせ方",
      hint: "画面いっぱいに表示するか、作品全体を表示します",
      cover: "画面いっぱい",
      contain: "全体表示",
    },
    position: {
      x: "水平位置",
      y: "垂直位置",
    },
    wallpaperStyle: {
      brightness: "壁紙の明るさ",
      blur: "壁紙のぼかし",
    },
    customOnly: "画像はこのブラウザにのみ保存されます。",
    optics: {
      title: "心地よい光と影を見つける",
      note: "リアルタイムプレビュー",
    },
    glassMode: {
      title: "ガラスの明暗",
      hint: "自動は壁紙に合わせます。ライト／ダークでは明暗を固定します",
      auto: "自動",
      light: "ライト",
      dark: "ダーク",
    },
    quality: {
      title: "ガラスの質感",
      hint: "ライトはぼかしと屈折のみ、高精細は分散と弾性も有効になります",
      low: "ライト",
      high: "高精細",
    },
    glassParams: {
      title: "ガラス光学パラメータ",
      note: "範囲・ステップ・既定値は glass-kit playground と完全に同じです",
      reset: "Playground の既定値に戻す",
      blur: "ぼかし Blur",
      saturation: "彩度 Saturation",
      brightness: "明るさ Brightness",
      mapScale: "マップスケール Map scale",
      depth: "屈折の深さ Depth",
      curvature: "曲率 Curvature",
      dispersion: "分散 Dispersion",
      highlight: "ハイライト Highlight",
      elasticity: "弾性 Elasticity",
      refraction: "屈折",
      mapScaleNote:
        "マップスケールを上げるほど輪郭がくっきりしますが、描画負荷も増えます",
      interaction: "インタラクション",
      interactionNote: "分散と弾性は「高精細」のときのみ有効です",
      environmentNote:
        "ガラス効果はブラウザの性能に合わせて自動調整されます。システムで「視差効果を減らす」が有効なときは、アニメーションを控えめにします。",
    },
  },
  features: {
    clockFormat: {
      title: "時刻表示",
      hint: "端末のローカル時刻を使用します",
      h24: "24時間",
      h12: "12時間",
    },
    clockTint: "時計のティント強さ",
    searchEngines: {
      title: "検索エンジン",
      note: "検索 URL をカスタマイズできます。カスタムエンジンではサジェストは表示されません",
    },
  },
  engines: {
    empty: "カスタム検索エンジンはまだありません。",
    add: "検索エンジンを追加",
    limit: (max) => `カスタム検索エンジンは最大 ${max} 個`,
    errors: {
      save: "保存に失敗しました。もう一度お試しください。",
      nameRequired: "検索エンジンの名前を入力してください。",
      nameTooLong: (max) => `名前は ${max} 文字以内で入力してください。`,
      limit: (max) => `カスタム検索エンジンは最大 ${max} 個まで追加できます。`,
      duplicate: "同じ名前の検索エンジンがすでにあります。",
      invalidUrl: "検索 URL が正しくありません。",
    },
    card: {
      removeBusy: "削除中…",
      confirmRemove: "削除を確定",
      confirmRemoveNote: (name) =>
        `「${name}」を削除しますか？このエンジンを使用している検索バーはブラウザの既定エンジンに戻ります。`,
    },
    form: {
      name: "名前",
      namePlaceholder: "例：Wikipedia",
      clearNameAria: "エンジン名をクリア",
      url: "検索 URL",
      urlPlaceholder: "https://duckduckgo.com/?q=%s",
      clearUrlAria: "検索 URL をクリア",
      help: "%s を検索キーワードに置き換えます。対応しているのは HTTP / HTTPS のみです。",
      save: "エンジンを保存",
    },
  },
  about: {
    heading: {
      title: "お気に入りを、大切に保存",
      note: "ローカルにのみ保存",
    },
    export: {
      title: "バックアップをエクスポート",
      description: "よく使うサイト、すべての設定、カスタム壁紙が含まれます。",
      button: "エクスポート",
      success: "バックアップをエクスポートしました。",
    },
    import: {
      title: "バックアップから復元",
      description:
        "Nico の JSON バックアップをインポートします（最大 32 MB）。",
      button: "インポート",
      aria: "バックアップファイルをインポート",
      tooLarge: "バックアップは最大 32 MB までです。",
      confirmAria: "バックアップの復元を確認",
      confirmTitle: "このバックアップで現在の内容を置き換えますか？",
      confirm: "置き換えて復元",
      success: "バックアップを復元しました。",
      summary: (count, hasWallpaper) =>
        `よく使うサイト ${count} 件と外観設定をすべて復元します${
          hasWallpaper
            ? "。カスタム壁紙も復元されます"
            : "。現在アップロードしている壁紙は削除されます"
        }。必要に応じて、先に現在のバックアップをエクスポートしてください。`,
    },
    privacyNote:
      "アカウントは不要で、利用データも収集しません。拡張機能をアンインストールするとローカルの内容が削除されるため、事前にバックアップしてください。",
    version: "インプレッション ニュータブ · 1.0.0",
    thirdPartyNotices: "素材とオープンソースライセンス ↗",
    privacyPolicy: "プライバシーポリシー",
  },
};

export const settingsMessages: Record<Locale, SettingsMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
