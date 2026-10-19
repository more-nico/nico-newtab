import type { Locale } from "./types";

// Owned by the settings migration task: the shortcut editor dialog copy.
// The Chinese section keeps the pre-migration strings verbatim.
const zh = {
  titles: {
    add: "添加常用网站",
    edit: "编辑常用网站",
  },
  save: "保存网站",
  remove: "确认移除",
  description: "把喜欢的网站，放在触手可及的地方。",
  name: {
    label: "网站名称",
    placeholder: "例如：我的书房",
    clearAria: "清空网站名称",
  },
  url: {
    label: "网站地址",
    placeholder: "example.com",
    clearAria: "清空网站地址",
  },
  icon: {
    label: "网站图标",
    hint: "留空时使用网站自己的图标",
    restoreDefault: "恢复默认",
    replace: "替换图标",
    upload: "上传图标",
    uploadAria: "上传网站图标",
  },
  order: {
    label: "排列位置",
    moveUpAria: "向前移动",
    moveDownAria: "向后移动",
  },
  errors: {
    save: "保存失败，请重试。",
    icon: "图标处理失败，请换一张试试。",
    nameRequired: "给这个网站取一个名字吧。",
  },
  confirmRemove: (name: string) => `确定移除“${name}”？`,
};

export type EditorMessages = typeof zh;

const en: EditorMessages = {
  titles: {
    add: "Add shortcut",
    edit: "Edit shortcut",
  },
  save: "Save site",
  remove: "Confirm removal",
  description: "Keep the sites you love within easy reach.",
  name: {
    label: "Site name",
    placeholder: "e.g. My study",
    clearAria: "Clear site name",
  },
  url: {
    label: "Site address",
    placeholder: "example.com",
    clearAria: "Clear site address",
  },
  icon: {
    label: "Site icon",
    hint: "Leave empty to use the site's own icon",
    restoreDefault: "Use default",
    replace: "Replace icon",
    upload: "Upload icon",
    uploadAria: "Upload site icon",
  },
  order: {
    label: "Position",
    moveUpAria: "Move up",
    moveDownAria: "Move down",
  },
  errors: {
    save: "Couldn't save. Please try again.",
    icon: "Couldn't process this icon. Try a different image.",
    nameRequired: "Give this site a name.",
  },
  confirmRemove: (name) => `Remove “${name}”?`,
};

const ja: EditorMessages = {
  titles: {
    add: "よく使うサイトを追加",
    edit: "よく使うサイトを編集",
  },
  save: "サイトを保存",
  remove: "削除を確定",
  description: "よく使うサイトを、すぐ手の届く場所に。",
  name: {
    label: "サイト名",
    placeholder: "例：私の書斎",
    clearAria: "サイト名をクリア",
  },
  url: {
    label: "サイトの URL",
    placeholder: "example.com",
    clearAria: "サイトの URL をクリア",
  },
  icon: {
    label: "サイトアイコン",
    hint: "空欄の場合はサイト自身のアイコンを使用します",
    restoreDefault: "既定に戻す",
    replace: "アイコンを変更",
    upload: "アイコンをアップロード",
    uploadAria: "サイトアイコンをアップロード",
  },
  order: {
    label: "表示位置",
    moveUpAria: "前へ移動",
    moveDownAria: "後ろへ移動",
  },
  errors: {
    save: "保存に失敗しました。もう一度お試しください。",
    icon: "アイコンを処理できませんでした。別の画像をお試しください。",
    nameRequired: "サイトの名前を入力してください。",
  },
  confirmRemove: (name) => `「${name}」を削除しますか？`,
};

export const editorMessages: Record<Locale, EditorMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
