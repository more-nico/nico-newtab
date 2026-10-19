# Nico · Microsoft Edge Add-ons 提交材料

> 适用对象：Nico `1.0.0`（Manifest V3，首发语言：全球；UI 支持 zh-CN / en / ja）。
> 依据：Microsoft Edge Add-ons [发布文档](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)、[开发者政策](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies)、[注册文档](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/create-dev-account)。
> 本文只记录 Partner Center 中真实存在的字段；标注「建议」的选项可按实际审核反馈调整。

## 0. 账号与流程速览

| 项目           | 内容                                                                 |
| -------------- | -------------------------------------------------------------------- |
| 开发者账号     | Microsoft 账号（MSA）注册 Partner Center，个人账号即可；**无注册费** |
| 包             | `release/nico-newtab-1.0.0.zip`（`manifest.json` 位于 zip 根目录）   |
| 认证时长       | 通常最长约 7 个工作日                                                |
| 可见性 / 市场  | Public / 全部市场（首发全球）                                        |
| 类别（建议）   | Fun（或 Partner Center 列表中最接近「壁纸 / 外观」的类别）           |
| 发布者显示名称 | NicoTools                                                            |
| 支持联系       | GitHub Issues：https://github.com/more-nico/nico-newtab/issues       |
| 隐私政策 URL   | 见第 4 节（三语）                                                    |
| 远程代码       | No（Manifest V3 禁止，本扩展未使用）                                 |

## 1. Store listing（三语，可直接复制）

### 1.1 扩展名称（扩展名以 manifest / `_locales` 为准）

| 语言  | Extension name            |
| ----- | ------------------------- |
| zh-CN | Nico · 印象新标签页       |
| en    | Nico · Impression New Tab |
| ja    | Nico · 印象派ニュータブ   |

### 1.2 短描述（Short description，≤ 132 字符较稳妥）

| 语言  | 文案                                                                                |
| ----- | ----------------------------------------------------------------------------------- |
| zh-CN | 在印象派画作与轻盈玻璃之间，开始新的浏览。                                          |
| en    | Monet, interactive glass, a clock, search and your favorite sites on every new tab. |
| ja    | モネの絵画とガラス、検索、よく使うサイトで、新しいタブを心地よく。                  |

### 1.3 长描述（Description，每语言 **250–10,000 字符**）

**zh-CN**

```text
Nico 把每一个新标签页变成一小片风景。以莫奈与卡耶博特的公有领域画作为背景，搭配可交互的玻璃材质：指针经过时钟、搜索栏和网站磁贴时，玻璃会折射、泛起边缘高光，并跟随指针轻微回弹。

功能一览：
· 三幅内置画作可离线显示，也可上传自己的 JPG / PNG / WebP 壁纸，在本地压缩为 WebP，并调整铺满方式、位置、亮度、模糊与玻璃参数。
· 时钟支持 12 / 24 小时制，日期与问候语随本地语言显示；玻璃明暗可自动跟随壁纸，也可手动固定浅色或深色。
· 搜索支持浏览器默认引擎、Google、Bing、百度、DuckDuckGo 和自定义引擎；搜索结果在新标签页打开，不替换当前页；内置引擎支持联想词。
· 常用网站可添加、编辑、拖拽排序、上传自定义图标；也可以从工具栏图标把当前网页一键加入。
· 设置页可导出 / 导入完整 JSON 备份（含自定义壁纸），换设备也能带走自己的布局。
· 可选的坚果云同步：使用你自己的坚果云账号与第三方应用密码，把设置和常用网站同步到你自己的网盘；默认关闭，凭据只保存在本机，不写入备份。

Nico 是本地优先的扩展：没有 Nico 账号、没有开发者服务器、没有遥测或广告。所有设置和壁纸默认只保存在你的浏览器里；只有在你主动开启坚果云同步时，数据才会经 HTTPS 发送到你自己的坚果云空间。
```

**en**

```text
Nico turns every new tab into a small landscape. Public-domain paintings by Monet and Caillebotte set the scene for an interactive glass material: the clock, the search bar and the site tiles refract the light, catch a bright rim and gently follow your pointer.

What you get:
· Three built-in paintings that work offline, plus your own JPG / PNG / WebP wallpaper, compressed to WebP on your device with controls for fit, position, brightness, blur and glass optics.
· A 12/24-hour clock with a localized date and greeting; glass tone follows the wallpaper automatically or stays light/dark if you prefer.
· Search with the browser default engine, Google, Bing, Baidu, DuckDuckGo or your own custom engine. Results open in a new tab so the new tab page stays put, and built-in engines offer suggestions.
· Shortcuts you can add, edit, reorder and give custom icons to — or add the current page from the toolbar with one click.
· Full JSON backup export and import, including your custom wallpaper, so your setup travels with you.
· Optional Nutstore sync: connect your own Nutstore account with an app-specific password to keep your settings and shortcuts in your own cloud. Off by default; credentials stay on your device and are never written into backups.

Nico is local-first: no Nico account, no developer servers, no telemetry and no ads. Your settings and wallpapers stay in your browser unless you deliberately turn on Nutstore sync, in which case the backup travels over HTTPS to your own Nutstore storage.
```

**ja**

```text
Nico は、新しいタブを小さな風景に変えます。モネとカイユボットのパブリックドメイン作品を背景に、操作できるガラスの質感を重ねました。時計、検索バー、サイトタイルの上をポインターが通ると、ガラスが光を屈折させ、縁がほのかに光り、指の動きにやわらかく反応します。

主な機能：
· オフラインでも表示できる内蔵の絵画 3 点。JPG / PNG / WebP の壁紙も追加でき、端末内で WebP に圧縮したうえで、表示方法、位置、明るさ、ぼかし、ガラスの質感を調整できます。
· 12 / 24 時間表示の時計。日付とあいさつは表示言語に合わせて切り替わり、ガラスの明暗は壁紙に自動で追従するほか、ライト / ダークに固定できます。
· ブラウザ既定の検索エンジン、Google、Bing、Baidu、DuckDuckGo、独自の検索エンジンに対応。検索結果は新しいタブで開くため、新しいタブページはそのまま残ります。内蔵エンジンはサジェストにも対応します。
· よく使うサイトの追加・編集・並べ替え・アイコン設定に加え、ツールバーのアイコンから現在のページをワンクリックで追加できます。
· カスタム壁紙を含む JSON バックアップのエクスポート / インポートで、環境をそのまま持ち運べます。
· 任意の Nutstore 同期：ご自身の Nutstore アカウントとアプリパスワードで、設定とよく使うサイトをご自身のクラウドに保存できます。初期状態はオフで、認証情報は端末内にのみ保存され、バックアップには含まれません。

Nico はローカル優先の拡張機能です。Nico のアカウント、開発者のサーバー、テレメトリ、広告はありません。設定と壁紙は、ご自身で Nutstore 同期をオンにしない限りブラウザ内に留まります。同期をオンにした場合も、バックアップは HTTPS でご自身の Nutstore 領域へ送信されます。
```

### 1.4 搜索词（≤ 7 个）

| 语言  | Search terms                                                   |
| ----- | -------------------------------------------------------------- |
| zh-CN | 新标签页、壁纸、莫奈、搜索、快捷网站、坚果云、玻璃             |
| en    | new tab、wallpaper、Monet、glass、search、shortcuts、Nutstore  |
| ja    | 新しいタブ、壁紙、モネ、検索、よく使うサイト、ガラス、Nutstore |

## 2. Partner Center「Privacy」页

### 2.1 单用途（Single purpose）

**zh-CN**：Nico 是一个可定制的新标签页扩展：用画作、时钟、搜索、常用网站和本地壁纸组成一个新的标签页，并提供可选的、用户主动开启的备份 / 坚果云同步。

**en**：Nico is a customizable new tab page that combines artwork, a clock, search, shortcuts and a local wallpaper — with an optional, user-initiated backup / Nutstore sync.

**ja**：Nico は、絵画・時計・検索・よく使うサイト・ローカルの壁紙で新しいタブページを構成するカスタマイズ拡張機能です。任意で、ユーザー自身が開始するバックアップ / Nutstore 同期も提供します。

### 2.2 权限说明（Permission justification，逐项填写；英文可直接用）

| 权限                                       | English justification                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                  | Stores the user's appearance settings, clock/search preferences, custom engines and shortcut list in `chrome.storage.local`, plus the Nutstore sync configuration (including the app password) when the user enables sync. Without it the new tab page could not remember anything. |
| `search`                                   | Uses `chrome.search.query` to open results for the search text in the browser's default search engine in a new tab. This is the core search behavior of the new tab page.                                                                                                           |
| `favicon`                                  | Reads the site icons for shortcut tiles from the browser's local favicon cache through the `/_favicon/` endpoint. No network request is made to the shortcut's website.                                                                                                             |
| `activeTab`                                | When the user clicks the toolbar icon to add the current page, the extension reads that tab's title and URL to prefill the shortcut form. Access is temporary and only for that user gesture.                                                                                       |
| `tabs`                                     | The toolbar popup reads the active tab's title/URL (same user action as above) and enumerates tab IDs/window IDs so it can focus an already-open Nico tab instead of opening duplicates. No background or history access.                                                           |
| host `https://suggestqueries.google.com/*` | Google search suggestions, only while the user types in the search box with Google selected and at least 2 characters entered.                                                                                                                                                      |
| host `https://api.bing.com/*`              | Microsoft Bing search suggestions under the same condition.                                                                                                                                                                                                                         |
| host `https://suggestion.baidu.com/*`      | Baidu search suggestions under the same condition.                                                                                                                                                                                                                                  |
| host `https://duckduckgo.com/*`            | DuckDuckGo search suggestions under the same condition.                                                                                                                                                                                                                             |
| host `https://dav.jianguoyun.com/*`        | Optional Nutstore WebDAV sync. Used only after the user enters their own Nutstore account and app password; uploads the backup JSON to the user's own Nutstore storage over HTTPS. Off by default.                                                                                  |

### 2.3 远程代码

选择 **No, I am not using remote code**。扩展的所有脚本都打包在 zip 内，CSP 限制为 `script-src 'self'`，不使用 `eval` / `new Function` / 远程脚本。

### 2.4 Data usage（建议勾选，与隐私政策保持一致）

| 建议勾选项                    | 对应行为                                                                                  | 是否离开设备                             |
| ----------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| Authentication information    | 用户主动连接坚果云时保存的应用密码（`chrome.storage.local`），只发往 `dav.jianguoyun.com` | 是（仅坚果云）                           |
| Web browsing activity         | 用户点击工具栏图标时的当前标签页标题/URL；内置引擎联想时输入的文字                        | 是（联想接口 / 用户自己的坚果云）        |
| Website content（如选项存在） | 用户主动保存的常用网站列表与备份 JSON                                                     | 是（仅用户自己的坚果云；不开启同步则否） |

- 声明扩展**不**向开发者服务器收集数据、无遥测 / 广告 / 追踪 / 出售。
- 隐私政策必须覆盖以上三类数据，见第 4 节。

### 2.5 隐私政策 URL

| 语言            | URL                                                                   |
| --------------- | --------------------------------------------------------------------- |
| en（canonical） | https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.md       |
| zh-CN           | https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.zh-CN.md |
| ja              | https://github.com/more-nico/nico-newtab/blob/master/PRIVACY.ja.md    |

## 3. 认证测试说明（Notes for certification，英文可直接粘贴）

```text
Nico is a new tab page extension. It intentionally overrides the new tab page via chrome_url_overrides; it does not modify the address bar, home page, bookmarks or any other browser setting.

No account or test credentials are required to test the extension:
1. Install the extension and open a new tab.
2. Check the clock, the greeting and the artwork credit at the bottom.
3. Open 设置 (Settings) → 外观 (Appearance): switch between the three built-in paintings and change fit/position/brightness/blur. Change the glass tone and quality tier.
4. Open a normal website, click the Nico toolbar icon, and add the page as a shortcut; click the shortcut tile to open it.
5. Type in the search box with Google selected (suggestions appear after 2 characters) and press Enter; results open in a new tab.
6. Settings → 功能 (Features): switch the clock to 12/24-hour and manage custom search engines.
7. Settings → 关于 (About): export a JSON backup, then import it back.

The Nutstore sync is an optional, user-initiated feature (off by default). It requires the tester's own Nutstore account and an app-specific password, so we cannot provide shared test credentials (Developer policy 1.3.1). The sync UI can be reviewed without connecting: Settings → 同步 (Sync) shows the connection form, the official setup instructions and the security notes. Connecting sends a backup JSON to the tester's own https://dav.jianguoyun.com WebDAV storage only. No core feature depends on this integration.

Network access happens only for (a) search suggestions while typing with a suggestion-capable built-in engine, and (b) Nutstore sync after the user connects. No telemetry, no remote code, no developer servers.

Permissions: storage (local settings), search (default-engine search), favicon (local cached shortcut icons), activeTab/tabs (read the active tab only when the user clicks the toolbar icon).
```

## 4. 商店素材清单

| 素材                 | 要求                            | 当前状态                                                                            |
| -------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| 扩展 Logo            | 1:1，最小 128×128，推荐 300×300 | ✅ `assets/logo/logo-300.png`（300×300）；`public/icons/icon-*.png` 已同步为新 logo |
| 截图                 | 1–6 张，640×480 或 1280×800     | ✅ 已生成，见下表（1280×800 JPEG）                                                  |
| 小宣传图（可选）     | 440×280                         | 可选，暂不提供                                                                      |
| 大宣传图（可选）     | 1400×560 PNG                    | 可选，暂不提供                                                                      |
| YouTube 视频（可选） | —                               | 不提供                                                                              |
| 隐私政策             | URL 必须可访问                  | ✅ 三语文件已加入仓库；**提交前需 push 到 GitHub 使 URL 生效**                      |
| 搜索词               | ≤ 7 个                          | 见 1.4                                                                              |

### 4.1 已生成的截图（1280×800，JPEG）

| 语言  | 新标签页                                        | 外观设置                                           | 同步设置                                     |
| ----- | ----------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| zh-CN | `assets/store/screenshots/zh-CN/01-new-tab.jpg` | `assets/store/screenshots/zh-CN/02-appearance.jpg` | `assets/store/screenshots/zh-CN/03-sync.jpg` |
| en-US | `assets/store/screenshots/en-US/01-new-tab.jpg` | `assets/store/screenshots/en-US/02-appearance.jpg` | `assets/store/screenshots/en-US/03-sync.jpg` |
| ja    | `assets/store/screenshots/ja/01-new-tab.jpg`    | `assets/store/screenshots/ja/02-appearance.jpg`    | `assets/store/screenshots/ja/03-sync.jpg`    |

重新生成：`npm run build && node scripts/capture-store-screenshots.mjs`（脚本会注入一组演示用常用网站，不接触真实用户数据）。

## 5. 提交前 P0 清单

- [x] logo SVG / PNG 生成并覆盖 `public/icons/icon-*.png` 与 `assets/logo/logo-300.png`，重新构建 zip
- [ ] 提交并 push 到 GitHub，确认三个隐私政策 URL 可打开（当前尚未 push）
- [x] 生成 1280×800 商店截图（zh-CN / en-US / ja 各 3 张，见 4.1）
- [ ] Partner Center 创建扩展，上传 zip，填写 Availability / Properties / Privacy / Store listings
- [ ] 权限说明逐项粘贴，远程代码选 No，Data usage 勾选与隐私政策一致
- [ ] 认证备注粘贴第 3 节英文说明
- [ ] 提交认证（最长约 7 个工作日）
