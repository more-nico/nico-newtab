import { readdir, readFile, writeFile } from "node:fs/promises";

let text = "# Nico Newtab · 第三方素材与开源许可\n\n";
text +=
  "## 内置画作\n\n所有作品的原作均已进入公有领域，馆藏均为芝加哥艺术博物馆。其开放图像政策见 https://www.artic.edu/open-access/open-access-images 。\n\n";
text +=
  "本项目使用 Wikimedia Commons 收录的同一作品的忠实平面复制图，文件标记为 Public domain / PD-Art（https://creativecommons.org/publicdomain/mark/1.0/）。这些复制图并非从馆方 CC0 图片接口下载，因此不将 Commons 文件重新标为 CC0。图片经过缩放、WebP 压缩，并生成裁切缩略图。\n\n";
const images = JSON.parse(
  await readFile("public/wallpapers/sources.json", "utf8"),
);
for (const image of images) {
  text += `### ${image.title} (${image.date_display})\n\n- 作者：${image.artist_display}\n- 馆藏：https://www.artic.edu/artworks/${image.id}\n- 复制图来源：${image.commonsPage}\n- 图像许可：${image.license}\n- 本地文件：wallpapers/${image.file}\n\n`;
}
text +=
  "逐张原始下载地址与元数据见 wallpapers/sources.json。扩展运行时不请求这些外部图片。\n\n";
text +=
  "## 字体与图标\n\n界面使用操作系统已有字体；Nico logo 的 SVG 中内嵌了一款 SIL Open Font License 花体字（许可证全文见下）。Nico 图标为本项目原创 SVG 图形的 PNG 导出。界面线条图标来自 Lucide。\n\n";
// Bundle any font licenses that ship with the handwritten logo assets.
for (const directory of ["assets/fonts"]) {
  let entries = [];
  try {
    entries = await readdir(directory);
  } catch {
    continue;
  }
  for (const entry of entries.filter((name) => /ofl|license/i.test(name))) {
    text += `### ${entry}\n\n${await readFile(`${directory}/${entry}`, "utf8")}\n\n`;
  }
}
text +=
  "搜索引擎选择器内嵌各引擎的官方标识（Google、Microsoft Bing、Baidu、DuckDuckGo），矢量路径取自 Simple Icons（CC0-1.0）与 Iconify 的 logos 图标集。这些标识是其各自所有者的商标，在此仅用于指明所选的搜索引擎，不表示任何形式的合作或背书。\n\n";
text += "## 随扩展分发的软件\n\n";
for (const name of [
  "nico-glass-kit",
  "react",
  "react-dom",
  "scheduler",
  "lucide-react",
]) {
  const pkg = JSON.parse(
    await readFile(`node_modules/${name}/package.json`, "utf8"),
  );
  const license = await readFile(`node_modules/${name}/LICENSE`, "utf8");
  text += `### ${name} ${pkg.version}\n\n${license}\n\n`;
}
await writeFile("public/THIRD_PARTY_NOTICES.md", text);
console.log("Updated third-party notices.");
