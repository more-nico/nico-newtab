import type { Locale } from "./types";

/**
 * Cross-component copy: shared verbs, document metadata and the artwork
 * captions. `src/data.ts` keeps only the assets and museum links, so every
 * visible name comes from here.
 */
const zh = {
  meta: {
    documentTitle: "Nico · 新标签页",
    popupTitle: "添加到 Nico 新标签页",
  },
  actions: {
    close: "关闭",
    cancel: "取消",
    save: "保存",
    saving: "保存中…",
    done: "完成",
    edit: "编辑",
    remove: "移除",
    delete: "删除",
    confirm: "确认",
    retry: "重试",
    add: "添加",
    clear: "清空",
    loading: "正在处理…",
  },
  artwork: {
    "water-lilies": {
      title: "睡莲",
      shortTitle: "睡莲",
      artist: "克劳德 · 莫奈",
      artistShort: "莫奈",
      museum: "芝加哥艺术博物馆",
      license: "公有领域 · PD-Art",
    },
    "cliff-walk": {
      title: "普尔维尔的悬崖漫步",
      shortTitle: "悬崖漫步",
      artist: "克劳德 · 莫奈",
      artistShort: "莫奈",
      museum: "芝加哥艺术博物馆",
      license: "公有领域 · PD-Art",
    },
    "rainy-paris": {
      title: "巴黎街道，雨天",
      shortTitle: "巴黎街道",
      artist: "古斯塔夫 · 卡耶博特",
      artistShort: "卡耶博特",
      museum: "芝加哥艺术博物馆",
      license: "公有领域 · PD-Art",
    },
  },
  source: {
    viewCollection: "查看馆藏",
    viewCollectionWithArrow: "查看馆藏 ↗",
    viewAria: (title: string) => `查看馆藏：${title}`,
    publicDomainImage: "公有领域图像",
  },
};

export type CommonMessages = typeof zh;

const en: CommonMessages = {
  meta: {
    documentTitle: "Nico · Impression New Tab",
    popupTitle: "Add to Nico",
  },
  actions: {
    close: "Close",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    done: "Done",
    edit: "Edit",
    remove: "Remove",
    delete: "Delete",
    confirm: "Confirm",
    retry: "Retry",
    add: "Add",
    clear: "Clear",
    loading: "Working…",
  },
  artwork: {
    "water-lilies": {
      title: "Water Lilies",
      shortTitle: "Water Lilies",
      artist: "Claude Monet",
      artistShort: "Monet",
      museum: "Art Institute of Chicago",
      license: "Public domain · PD-Art",
    },
    "cliff-walk": {
      title: "Cliff Walk at Pourville",
      shortTitle: "Cliff Walk",
      artist: "Claude Monet",
      artistShort: "Monet",
      museum: "Art Institute of Chicago",
      license: "Public domain · PD-Art",
    },
    "rainy-paris": {
      title: "Paris Street; Rainy Day",
      shortTitle: "Paris, Rainy Day",
      artist: "Gustave Caillebotte",
      artistShort: "Caillebotte",
      museum: "Art Institute of Chicago",
      license: "Public domain · PD-Art",
    },
  },
  source: {
    viewCollection: "View at the museum",
    viewCollectionWithArrow: "View at the museum ↗",
    viewAria: (title) => `View ${title} at the museum`,
    publicDomainImage: "Public domain image",
  },
};

const ja: CommonMessages = {
  meta: {
    documentTitle: "Nico · インプレッション ニュータブ",
    popupTitle: "Nico に追加",
  },
  actions: {
    close: "閉じる",
    cancel: "キャンセル",
    save: "保存",
    saving: "保存中…",
    done: "完了",
    edit: "編集",
    remove: "削除",
    delete: "削除",
    confirm: "確認",
    retry: "再試行",
    add: "追加",
    clear: "クリア",
    loading: "処理中…",
  },
  artwork: {
    "water-lilies": {
      title: "睡蓮",
      shortTitle: "睡蓮",
      artist: "クロード・モネ",
      artistShort: "モネ",
      museum: "シカゴ美術館",
      license: "パブリックドメイン · PD-Art",
    },
    "cliff-walk": {
      title: "プールヴィルの断崖",
      shortTitle: "断崖の散歩",
      artist: "クロード・モネ",
      artistShort: "モネ",
      museum: "シカゴ美術館",
      license: "パブリックドメイン · PD-Art",
    },
    "rainy-paris": {
      title: "パリの街、雨の日",
      shortTitle: "雨のパリ",
      artist: "ギュスターヴ・カイユボット",
      artistShort: "カイユボット",
      museum: "シカゴ美術館",
      license: "パブリックドメイン · PD-Art",
    },
  },
  source: {
    viewCollection: "美術館で見る",
    viewCollectionWithArrow: "美術館で見る ↗",
    viewAria: (title) => `美術館で「${title}」を見る`,
    publicDomainImage: "パブリックドメイン画像",
  },
};

export const commonMessages: Record<Locale, CommonMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
