# Nico · 印象新标签页

一个使用印象派画作与轻盈玻璃质感的 Chrome / Edge 新标签页。以 `nico-glass-kit@0.3.0` 为界面基础，所有个人数据保存在本地。

## 安装

需要桌面版 Chrome / Edge 120 或更高版本，推荐使用当前稳定版。

1. 下载并解压 `release/nico-newtab-1.0.0.zip`，或直接使用本项目构建好的 `dist` 文件夹。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 打开「开发者模式」，点击「加载已解压的扩展程序」。
4. 选择包含 `manifest.json` 的文件夹（项目的 `dist`，或 ZIP 解压后的根目录）。
5. 新建标签页；若浏览器提示确认新标签页变更，选择保留。已有其他新标签页扩展时，需要禁用其中一个。

请保留加载的文件夹。更新后在扩展管理页点击「重新加载」，然后重新打开新标签页。保持目录不变可保留扩展标识与已有数据。隐私/无痕窗口不支持新标签页替换。

## 使用

- **搜索**：输入关键词后回车，使用当前浏览器默认搜索引擎，在当前标签页显示结果。
- **网站**：点击「添加网站」，填写名称和 HTTP/HTTPS 地址。拖拽可排序；「整理」、图标上的省略号或右键可编辑、删除；编辑面板也提供前后移动按钮。
- **壁纸**：右上角「画作集」用一条带缩略图的玻璃分段挑选三幅内置画作；上传 JPG、PNG、WebP（最大 20 MB）后会出现「我的图片」分段，可以直接切换。上传图片在本地转换为长边不超过 2560 像素的 WebP。保留一张上传图片，成功上传新图片后才替换旧图片。
- **外观**：右下角「个性化」分别调整壁纸亮度/模糊，以及玻璃的 Blur、Saturation、Brightness、Map scale、Depth、Curvature、Dispersion、Highlight、Elasticity；支持恢复 Playground 默认值。这些参数会实时作用于首页、设置弹窗、网站编辑和其中的输入框、滑杆及按钮。壁纸页可设置铺满/完整显示与位置，外观页也可切换玻璃档位和 12/24 小时制。设置弹窗与网站编辑使用和首页同一套透明玻璃：窗口本身不带自己的颜色，也不跟随指针弹性；窗口外的所有组件都会弹性响应。
- **备份**：设置的「备份」页导出 JSON，包含网站列表、外观设置和上传壁纸。导入会先校验，再显示替换确认。最多支持 200 个网站和 32 MB 的备份文件。

三幅内置画作及上传图片可离线显示。网站访问和搜索需要网络。输入框采用 glass-kit Playground 的原生焦点与输入行为。玻璃折射会按浏览器能力自动降级；系统设置减少动态效果时使用低档玻璃、关闭弹性并简化动画。

玻璃参数的范围、步进和初始值均与 `nico-glass-kit@0.3.0` Playground 一致：Blur `3px`、Saturation `100%`、Brightness `1.10`、Map scale `20%`、Depth `8px`、Curvature `0.20`、Dispersion `10%`、Highlight `100%`、Elasticity `0.20`。玻璃档位只有「轻盈」与「细腻」两档，色散和弹性在「细腻」档位生效。旧数据里的「均衡」档会在读取时并入「细腻」。

## 本地开发

```powershell
npm ci
npm run dev
```

打开终端显示的 `http://127.0.0.1:5173`。网页预览的数据使用独立的 localStorage / IndexedDB，和扩展数据不互通。预览中提交搜索会提示安装扩展，不会偷偷切换搜索引擎。

```powershell
npm test          # 网址、备份校验、存储一致性与失败处理
npm run typecheck # TypeScript
npm run build     # 构建 dist，可直接加载到浏览器
npm run package   # 构建并生成 release/nico-newtab-1.0.0.zip
npm run test:e2e  # 在独立 Chrome / Edge 测试配置中验收
```

端到端验收使用本机安装的 Chrome / Edge（需要支持 Extensions.loadUnpacked 的近期版本），通过浏览器级调试会话加载扩展，不接触日常使用的用户配置。报告和截图在 `test-results`，隔离测试配置在 `.cache`。没有这两个浏览器时可用 `npx playwright install chromium` 后运行 `node scripts/inspect-ui.mjs` 检查 Chromium 中的扩展界面。

内置优化图片已包含在仓库，构建不需要联网下载画作。仅在需要重新生成素材时执行 `npm run assets`：它从馆方 API 核对作品信息、从 Commons 下载公有领域复制图，并使用 Sharp 生成 WebP、缩略图及扩展图标。

## 数据与权限

- 设置和网站列表：`chrome.storage.local` 中的 `nico.newtab.state.v1`。
- 上传壁纸：扩展独立 IndexedDB，使用不可变图片标识；新图片写入成功后再提交设置，失败时保留旧数据。
- 多个标签页：Web Locks 串行处理修改，读取最新状态合并，通过存储事件同步界面。
- 只请求 `storage`、`search`、`favicon`；不请求网页读取权限，不注入脚本，不读取浏览历史或书签。
- 没有账号、后台服务、遥测、云端同步或在线壁纸请求。点击馆藏/许可链接时才访问外部站点。网站图标由浏览器 favicon 接口提供，缺失时显示名称首字。
- 卸载扩展会删除浏览器内的扩展数据，请事先导出备份。浏览器未完成保存时不要立即关闭页面，设置底部会显示保存状态。

## 项目结构

```text
src/components/   设置、网站编辑与可访问弹窗
src/lib/          校验、存储事务、图片处理、平台适配与单元测试
src/App.tsx       首页与交互
src/data.ts       默认设置、画作元数据
public/           Manifest、图标、画作和授权说明
scripts/          素材准备、打包、许可生成和浏览器验收
```

数据类型位于 `src/types.ts`，备份使用 `BackupV1` 格式。未知版本和无效字段会被拒绝，避免静默覆盖。无法读取已有设置时会暂停编辑并提供重试。

画作与运行时依赖的完整来源及许可证见 [第三方说明](public/THIRD_PARTY_NOTICES.md)。
