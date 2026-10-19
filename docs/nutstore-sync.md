# Nico × 坚果云（Nutstore）WebDAV 同步接入说明

> 调研时间：2026-10-19　范围：v1「单个 JSON 文件」同步方案
> 所有结论标注依据：**✅ 官方文档 / 实测**、**⚠️ 第三方实测（非官方）**、**🧪 待实测**。
> 本文只做事实记录，不含实现代码，不修改除本文之外的任何文件。

---

## 1. 背景

Nico 是 Chrome MV3 新标签页扩展，数据以本地 JSON 为主。为支持多设备恢复，v1 计划把「一个 JSON 文件」同步到用户自己的坚果云网盘。

选择坚果云的原因：坚果云官方提供了**面向第三方应用的 WebDAV 授权机制**（应用密码），用户无需注册开发者账号、无需审核，5 分钟内即可自行完成配置。这也是坚果云官方文档里给所有第三方软件（WPS、Zotero、KeePass、Tampermonkey 等）指定的**唯一公开接入方式**。

v1 明确**不做**：文件级双向同步、目录树镜像、冲突自动合并、多文件增量同步。v1 只做「整包写入 / 整包读取」，因此下面关于分页、遍历的内容仅作为背景记录，本版本不需要实现。

---

## 2. 官方接入方式：WebDAV

### 2.1 官方文档

坚果园帮助中心的主文档：[坚果云第三方应用授权WebDAV开启方法](https://help.jianguoyun.com/?p=2064)（页面标题原文如此）。官方定义：

> 第三方应用授权是指用户通过给予一个应用访问用户文件的授权，使其可以通过 WebDAV 协议上传，下载和管理用户的文件内容。

同一篇文档还给出了各端生成应用密码的路径、上传大小限制、访问频率限制、单次请求条目数限制（详见第 6 节）。

官方针对具体第三方软件各有一篇教程，可交叉验证「服务器地址 + 账号邮箱 + 应用密码」这三要素，且全部指向 WebDAV：

| 官方教程         | 链接                                  | 与本项目相关的信息                                                                                               |
| ---------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Zotero           | <https://help.jianguoyun.com/?p=3168> | 明确写出服务器地址 `https://dav.jianguoyun.com/dav/`、用户名为坚果云账号、密码为应用密码（非登录密码）           |
| Documents（iOS） | <https://help.jianguoyun.com/?p=3234> | 默认服务器地址 `https://dav.jianguoyun.com/dav/`；可在地址后追加子目录，如 `https://dav.jianguoyun.com/dav/work` |
| Tampermonkey     | <https://help.jianguoyun.com/?p=5627> | 「登录：您的坚果云账号邮箱；密码：第三方应用密码」；导出后自动创建 `Tampermonkey` 文件夹                         |
| WPS              | <https://help.jianguoyun.com/?p=2622> | 应用密码命名示例（如 `wps`）                                                                                     |

补充：p=2064 文末说明，坚果云也可为企业提供**有偿**集成咨询，常见场景为邮件服务、OA、CRM。这意味着企业级对接走商务渠道，而非自助开放平台（见 2.2）。

### 2.2 关于 OAuth 2.0 / 开放平台：**结论是不存在公开可注册的开放平台**

调研结论：**坚果云没有面向普通开发者的、可自助注册的 OAuth 2.0 开放平台**。v1 采用 WebDAV + 应用密码是当前唯一公开可行的路径。证据如下（均为本次调研的一手观察）：

1. **帮助中心无入口**：在官方帮助中心站内检索 `OAuth`、`开放平台`、`单点登录`，命中数均为 0；检索 `SSO` 仅命中与第三方接入无关的文章（客户端更新日志、隐私协议、企业版条款等）。✅
2. **官网无入口**：`https://www.jianguoyun.com/` 首页 HTML 中 `开放平台`、`开发者`、`OAuth` 关键词均为 0 次命中（`API` 仅 2 次且与开放平台无关），导航链接中没有开发者/开放平台页面。✅
3. **候选域名均无开发者站点**：`open.` / `api.` / `developer.` / `oauth.` / `dev.jianguoyun.com` 全部返回坚果云通用的「坚果云 - 404」页面，与随机不存在子域（如 `zzz-not-exist-98765.jianguoyun.com`）返回的页面字节数完全一致（752 bytes）——即这些域名没有部署任何独立服务。✅
4. **官方开源客户端的实现方式侧面印证**：坚果云官方 Obsidian 插件 [nutstore/obsidian-nutstore-sync](https://github.com/nutstore/obsidian-nutstore-sync) 的「单点登录」使用 `@nutstore/sso-js` 的 `createOAuthUrl()`，但：
   - WebDAV 端点常量来自构建期环境变量 `NS_DAV_ENDPOINT` / `NS_NSDAV_ENDPOINT`（由 GitHub Actions 仓库变量注入），并非公开文档中的固定值；
   - 另有 `LLM_GATEWAY_CLIENT_ID` 同样由构建期注入；
   - `@nutstore/sso-js` 在 npm 上可查到（`Nutstore SSO JS Library`，v0.0.8，2025-07 发布），但**没有仓库地址、没有主页、没有文档**。
     这组事实说明：OAuth/SSO 的端点与 client_id 是**坚果云给自家构建产物（及合作方）注入**的，不是公开注册能力。✅（基于公开源码观察）
5. **官方文档只认 WebDAV**：p=2064 是官方对「第三方应用授权」的唯一说明，全部内容围绕 WebDAV 与应用密码展开，全文未出现 OAuth、client_id、回调地址等概念。✅

因此本文后续只记录 WebDAV。**切勿**在实现中猜测或硬编码任何 OAuth 端点/参数——那属于臆造。

---

## 3. 账号与应用密码申请步骤

以下步骤来自 p=2064 正文，并经同页截图核对（截图 `1.png`、`22.png`、`1-3.png`）。✅

### 3.1 网页端（推荐，扩展内可引导用户走这条路径）

1. 打开坚果云官网 <https://www.jianguoyun.com/> 并登录。
2. 点击右上角账户名，在弹出菜单中选择 **【账户信息】**（截图里该菜单还包含：账户升级、在线客服、切换版本、退出）。
3. 在「账户信息」页面顶部切换到 **【安全选项】** 标签页。
4. 页面向下找到 **【第三方应用管理】** 区块（该区块上方是「手机身份验证」「退出所有设备登录」）。
5. 点击 **【添加应用】**（蓝色按钮）→ 输入名称（官方示例 `WPS`，Nico 建议填 `Nico`）。
   - 输入框上方的原文提示：「第一步，请输入名称，以帮助您记住使用该密码的应用」。
6. 点击 **【生成密码】**，得到应用密码。
7. 管理员列表是一个表格，列为：**应用名称 | 授权日期 | 应用密码**。该密码就是第三方应用要填的密码。

> 截图级细节：编辑器示例区写明「服务器地址：`https://dav.jianguoyun.com/dav/`、账户：（账号邮箱）、密码：（应用密码）」。
> 「第三方应用管理」区块有一行红色安全提示，原文：「坚果云官方人员不会向您索取应用密码。为了您的数据安全，请勿将应用密码告知任何人。」这条文案可以原样引用到 Nico 的同步设置页，对用户很有用。

### 3.2 移动端（备用引导）

- iOS 客户端：设置页面 →「第三方应用管理」。
- Android 客户端：设置 →「第三方应用管理」。
- 添加方式与网页端一致。✅（p=2064 正文）

### 3.3 注意事项

- **应用密码 ≠ 账号登录密码**，两者不可混用（p=3168、p=5627 均专门强调）。✅
- 每个应用单独生成一个密码，便于单独吊销；「添加应用」可以重复执行。✅
- 应用密码是否可以重复查看是 🧪 待实测：官方文档未说明，建议引导用户「生成后立即复制」。
- 吊销方式：在「第三方应用管理」里删除对应应用条目，删除后该密码立即失效（具体生效时延 🧪 待实测）。

---

## 4. 服务器与认证参数

| 参数                    | 取值                                                  | 依据                                                                                                                                                            |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 服务器地址（WebDAV 根） | `https://dav.jianguoyun.com/dav/`                     | ✅ 官方 p=3168 / p=3234 / p=5627 三处一致，p=2064 截图示例一致，官方插件默认可配置值一致                                                                        |
| 协议                    | HTTPS（HTTP/2）                                       | ✅ 实测：TLS 证书 `CN=*.jianguoyun.com`，签发者 Sectigo DV，有效期 2026-02-09 ~ 2027-02-19；响应 `HTTP/2`。官方文档只给出 `https://` 地址。**实现只允许 https** |
| 认证方式                | HTTP Basic                                            | ✅ 实测：无凭据请求返回 `401` + `WWW-Authenticate: Basic realm="nutstore"`                                                                                      |
| 用户名                  | 坚果云账号邮箱                                        | ✅ 官方 p=5627「登录：您的坚果云账号邮箱」；p=3168「用户名是您的坚果云账号」                                                                                    |
| 密码                    | 第三方应用密码（非登录密码）                          | ✅ 官方 p=2064 / p=3168 / p=5627                                                                                                                                |
| 建议远端目录            | `/Nico/`（即 `https://dav.jianguoyun.com/dav/Nico/`） | 建议值，非官方规定                                                                                                                                              |
| 建议远端文件            | `/Nico/nico-sync.json`                                | 建议值                                                                                                                                                          |
| 自定义域名/私有云       | 允许用户填自有域名，按 `${base}/dav` 拼接             | ⚠️ 依据官方插件 `getNutstoreDavEndpoint()` 的实现（企业版地址 + `/dav`）；普通用户忽略此项                                                                      |

### 4.1 尾斜杠（trailing slash）

- 官方文档里的地址**统一带尾斜杠**：`https://dav.jianguoyun.com/dav/`。✅
- 集合（collection/目录）URL 建议**以 `/` 结尾**；文件 URL **不带**尾斜杠。
- 官方插件里有一处针对性补丁：在 iOS 客户端上，对**不带尾斜杠**的地址发 `PROPFIND` 若收到 `401`，会自动补 `/` 重试一次才能成功（[webdav-patch.ts](https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/webdav-patch.ts)）。⚠️ 说明尾斜杠在个别环境下会影响结果；桌面 Chrome 环境是否同样敏感 🧪 待实测。Nico 实现时应统一规整：目录加 `/`，文件不加。
- 用户粘贴地址时可能带了/漏了尾斜杠，建议在保存前做归一化（去空格、补协议、目录补 `/`）。

### 4.2 对 Nico 的落地要求（manifest 层面，非代码）

`public/manifest.json` 里**两处都必须有**，缺一处请求就会被拦：

1. `host_permissions` 需要 `"https://dav.jianguoyun.com/*"`；
2. `content_security_policy.extension_pages` 的 `connect-src` 需要 `https://dav.jianguoyun.com`——**只加 host_permissions 不够**，MV3 的扩展页 CSP 会独立拦截 `fetch`。

> 现状（2026-10-19 核对）：本次同步功能改造已把这两个位置都加上了 `dav.jianguoyun.com`。后续若重构 manifest 或收紧 CSP，请保留这两项，否则同步会在浏览器层面直接失败（报 CSP 违规，而非网络错误，容易被误判为坚果云侧问题）。

另：MV3 下**扩展页面**（新标签页/弹窗/Service Worker）在拥有 host permission 时可以跨域请求、不受 CORS 限制；但 **content script** 仍受页面同源策略约束。因此同步逻辑要放在扩展页面或 Service Worker 里，不要放在 content script。✅（Chrome 扩展平台规则）

---

## 5. 接口与状态码

以下方法/状态码中，`207`/`401`/`403` 有公开实测佐证，其余按 RFC 4918 与官方客户端行为记录，并标注 🧪。

### 5.1 方法

| 方法                     | 用途（Nico）         | 预期成功码                       | 依据                                                                                                                                                                |
| ------------------------ | -------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROPFIND`（`Depth: 0`） | **校验凭据**（推荐） | `207 Multi-Status`               | ⚠️ 第三方实测：`PROPFIND https://dav.jianguoyun.com/dav/`（`Depth: 0` + Basic）返回 `207`（[all-api-hub#981](https://github.com/qixing-jk/all-api-hub/issues/981)） |
| `PROPFIND`（`Depth: 1`） | 列目录（v1 不需要）  | `207`                            | ✅ 官方插件即如此实现并解析 XML                                                                                                                                     |
| `MKCOL`                  | 首次创建 `/Nico/`    | `201 Created`                    | 🧪 官方插件用 `createDirectory(..., { recursive: true })`，未显式断言状态码                                                                                         |
| `PUT`                    | 写入 JSON            | `201 Created` / `204 No Content` | 🧪                                                                                                                                                                  |
| `GET`                    | 读取 JSON            | `200 OK`（不存在时 `404`）       | 🧪                                                                                                                                                                  |
| `OPTIONS`                | 探测能力             | ——                               | 实测：不带凭据时直接 `401`，**拿不到 `Allow`/`DAV` 头**，因此不能用于无凭据探测                                                                                     |

> **关键坑（必须遵守）**：**不要用普通 `GET` 请求集合 URL 来校验凭据**。
> 坚果云对 `GET https://dav.jianguoyun.com/dav/`（即使是合法凭据）返回 **`403 Forbidden`**，而对同一地址的 `PROPFIND Depth: 0` 返回 `207`。把 403 当作「用户名/密码错误」会误导用户。⚠️（all-api-hub#981 复现记录，直连与代理结果一致）
> 正确做法：校验凭据 = `PROPFIND Depth: 0`，`207`/`2xx` 视为成功；读文件 = `GET` 具体 `.json` 文件地址。

### 5.2 状态码与处理建议

| 状态码 | 含义                                 | Nico 处理建议                                                                        | 依据                                                                                                      |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `207`  | 多状态响应，WebDAV 成功              | 视为成功（校验/列目录）                                                              | ⚠️ 实测                                                                                                   |
| `401`  | 未认证/凭据错误                      | 提示「应用密码无效或已吊销」，引导重新生成；不要自动重试                             | ✅ 实测无凭据即 401                                                                                       |
| `403`  | 已认证但该操作被禁止                 | **不代表密码错**。常见于：`GET` 目录 URL、访问无权限路径。提示语应区分于 401         | ⚠️ 社区实测                                                                                               |
| `404`  | 文件/目录不存在                      | 首次同步正常分支：走 `MKCOL` + `PUT`                                                 | 🧪                                                                                                        |
| `409`  | 冲突（父目录不存在、同名资源冲突）   | 先 `MKCOL` 建父目录再 `PUT`                                                          | 🧪 RFC 4918；真实账号已复现首个 GET 返回 409 + `AncestorsNotFound`，Nico 视为「云端暂无备份」继续首次上传 |
| `412`  | 前置条件失败（`If-Match` 不匹配）    | 仅在使用条件写时出现                                                                 | 🧪                                                                                                        |
| `429`  | 请求过多（限流）                     | 退避重试（指数退避 + 抖动）                                                          | 🧪 坚果云未公开状态码                                                                                     |
| `503`  | 服务暂不可用 / **限流**              | **官方客户端对 503 的处理是等待 60 秒后重试**（`is-503-error.ts` + `sleep(60_000)`） | ✅ 官方插件源码                                                                                           |
| `507`  | 存储空间不足（Insufficient Storage） | 提示用户清理坚果云空间/升级；**停止自动重试**                                        | 🧪 坚果云未公开                                                                                           |
| `413`  | 请求体过大                           | JSON 过大时出现；提示文件过大                                                        | 🧪                                                                                                        |

> 限流的实际表现：官方插件 Issue [#15](https://github.com/nutstore/obsidian-nutstore-sync/issues/15) 中用户看到的提示是「请求过于频繁，请于 XX:XX 后尝试」，维护者回复确认了 600/1500 次每 30 分钟的规则，并说明「1.5k 个文件至少要 1.5k 次请求，免费版需 60 分钟、付费版需 30 分钟」。⚠️
> 但**具体 HTTP 状态码（429 还是 503）官方从未公开**，官方客户端只针对性处理了 `503`。因此实现应**同时**把 `429` 和 `503` 当作限流，读取 `Retry-After`（若有），否则至少等待 60 秒。🧪 待实测确认。

### 5.3 分页（v1 不需要，记录备查）

官方文档：「单次请求文件数（包含文件和文件夹）为 750 个，支持分多页多次加载」。✅
官方客户端的实现方式：`PROPFIND` 返回的响应头中若存在 `Link: <...>; rel="next"`，则按该 URL 继续请求下一页，直到没有 `Link` 头（[api/webdav.ts](https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/api/webdav.ts)）。✅
→ 说明「750 条分页」是通过标准 `Link` 头实现的；第三方工具若不做分页会「同步不完整」（官方原话）。v1 只读写单文件，不受影响。

### 5.4 ETag / If-Match

- 官方文档**未提及** ETag 或条件请求。✅（文档全文检索无相关概念）
- 官方 Obsidian 插件**没有使用** `ETag`/`If-Match`/`If-None-Match`：源码在全仓库检索 `if-match`、`if-none-match` 均为 0 命中，且解析 `PROPFIND` 时显式把 `etag` 置为 `null`。✅
- → 结论：服务端**是否**返回 `ETag`、是否支持 `If-Match` 条件写，均 **🧪 待实测**。坚果云官方客户端本身不做乐观锁，冲突策略是「客户端侧比对 + 冲突副本」。
- v1 建议：**不要依赖 ETag**。采用「单写者 + 读-改-写 + 本地保留上一版备份」的兜底策略；若后续实测确认支持 `ETag`/`If-Match`，再升级为条件写。
- Nico 当前实现：有 ETag 时使用条件写（首次创建用 `If-None-Match: *`，更新用 `If-Match`），412 视为冲突；若服务端以 **400/501** 表示不接受条件头，则自动回退为一次无条件写入，避免真实端点不兼容时整个同步不可用（见第 9 节）。

### 5.5 CORS（影不影响 Vite 预览 / 网页调试）

实测结论（2026-10-19，curl）：

- 无凭据 `GET https://dav.jianguoyun.com/dav/` + `Origin: http://localhost:5173` → `401`，响应中**没有任何 `Access-Control-Allow-*` 头**；
- 预检 `OPTIONS https://dav.jianguoyun.com/dav/` + `Origin` + `Access-Control-Request-Method: PROPFIND` → `401`，同样**无 CORS 头**；
- `GET https://dav.jianguoyun.com/`（nginx 根）→ `403`，同样**无 CORS 头**。

→ 三条独立观察都未出现 `Access-Control-Allow-Origin`，可判定该端点**不会给浏览器的跨域请求放行**。影响：

1. **Vite 网页预览（`http://127.0.0.1:5173`）里调用会失败**——这是浏览器同源策略导致的预期结果，不是代码 bug，也不是网络问题。而且 `PROPFIND`/`PUT` 都不是简单请求，会先发预检，预检拿不到 CORS 头即失败。
2. **扩展页面 + `host_permissions` 可以正常调用**——扩展上下文不受 CORS 约束（前提是第 4.2 节的 manifest 两处都配好）。
3. 因此：**联调/自测必须加载已构建的扩展（或至少用扩展页面）**，不能只在 Vite 页面里验证同步功能。若一定要在网页里调试，需要本地代理转发（仅限开发环境，且绝不能把用户凭据放进代理）。

🧪 待实测：带合法凭据的成功响应（`207`/`200`）是否附带 CORS 头。理论上不会（nginx 层未配置），但未能在无凭据条件下验证。

---

## 6. 限制与配额

全部来自官方 p=2064：✅

| 项目               | 限制                                           | 备注                                                                                                               |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 单文件上传大小     | **500 MB**（默认值；私有云可通过设置调整）     | 官方原话：「当前 WebDAV 客户端和网页端上传大小的限制是一致的，默认为 500M」；官方插件也把 `500MB` 硬编码为上限阈值 |
| 访问频率（免费版） | **600 次请求 / 30 分钟**                       | ≈ 20 次/分钟 ≈ 每 3 秒 1 次                                                                                        |
| 访问频率（付费版） | **1500 次请求 / 30 分钟**                      | ≈ 50 次/分钟 ≈ 每 1.2 秒 1 次                                                                                      |
| 单次请求条目数     | **750 个**（含文件与文件夹），支持分页多次加载 | 不做分页会同步不完整                                                                                               |
| 协议定位           | 「WebDAV 协议比较占用系统资源」                | 官方对限流原因的解释                                                                                               |

### 对 Nico 的量化估算

一次完整同步的请求数：

- 校验凭据：1 次 `PROPFIND`（可缓存，不必每次同步都做）
- 读取远端：1 次 `GET`
- 写入远端：0 或 1 次 `PUT`
- 首次创建目录：+1 次 `MKCOL`

即**常规 2~3 次请求/次同步**。按免费版 600 次/30 分钟计算，理论上可支撑 200 次以上同步，因此限流**不是 v1 的瓶颈**。但仍建议：

- 手动同步加去抖（例如 3~5 秒内重复点击只执行一次）；
- 自动同步最低间隔远大于 1 分钟（建议 ≥ 5 分钟），并在失败时指数退避；
- 请求串行执行（官方插件用 Bottleneck 的 `maxConcurrent: 1`），不要并发打多个请求；
- 命中 429/503 时至少退避 60 秒，不要立即重试。

### 其他未核实项

- 坚果云免费版的**存储空间容量**、单项文件数上限、单目录文件数上限：本次未在官方 WebDAV 文档中找到确切数字 → 🧪 另行确认，不要写进 UI 的硬性提示。
- 是否存在针对 WebDAV 的**流量**（带宽）限制：官方文档未提及 → 🧪 待实测。

---

## 7. 安全与隐私注意

坚果云 WebDAV 用的是 **HTTP Basic**：用户名:密码 仅做 Base64 编码，**不是加密**（实测 `WWW-Authenticate: Basic realm="nutstore"`）。✅ 因此：

1. **强制 HTTPS**：只允许 `https://dav.jianguoyun.com` 前缀，禁止 http、禁止用户自定义任意主机（企业版自定义域名可作为高级选项，但要有明确警示）。否则凭据会明文上网。
2. **凭据只存本地**：写入 `chrome.storage.local`，**不要**写入 `chrome.storage.sync`（会跨设备同步到云端）、不要写进导出的备份文件、不要出现在分享/演示数据里。
3. **只在必要时发送**：凭据只发给 `dav.jianguoyun.com`，不发给任何统计分析、错误上报、第三方接口。日志与错误信息里必须对 `Authorization` 头做脱敏（官方插件在调试日志里把该头替换为 `<retracted>`，可参考此做法）。
4. **UI 掩码**：设置页里应用密码默认隐藏，提供「显示」按钮；输入框设置 `autocomplete="off"`、`type="password"`。
5. **可吊销、可清除**：提供「断开连接」按钮，清除本地保存的邮箱+应用密码；并提示用户到坚果云「第三方应用管理」里删除对应条目（这是彻底吊销的唯一途径）。
6. **最小作用域**：只操作 `/Nico/` 目录，不做全盘遍历、不读取用户其他文件。
7. **文案可直接引用官方红字**：「坚果云官方人员不会向您索取应用密码。为了您的数据安全，请勿将应用密码告知任何人。」（p=2064 页面原文）
8. **不要把应用密码等同于账号密码去引导**：错误提示要能区分「这是应用密码，不是登录密码」。
9. **备份语义**：远端 JSON 可能包含用户新标签页数据（书签/壁纸配置等），属于用户隐私；同步状态 UI 应说明「数据保存在你自己的坚果云账号中」，Nico 不做服务器中转。

---

## 8. 后续实测清单

拿到真实账号后按此顺序自测，把结果回填到本表「实测结果」列。

| #   | 步骤                                                             | 预期                                                         | 实测结果               |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------- |
| 1   | 网页端生成应用密码，观察是否只显示一次、能否再次查看             | 官方未说明 → 记录实际情况                                    | 🧪                     |
| 2   | `PROPFIND https://dav.jianguoyun.com/dav/`，`Depth: 0`，合法凭据 | `207`                                                        | 🧪（第三方已复现 207） |
| 3   | 同 2，但故意用**登录密码**                                       | `401`                                                        | 🧪                     |
| 4   | 同 2，但故意用错误应用密码                                       | `401`                                                        | 🧪                     |
| 5   | `GET https://dav.jianguoyun.com/dav/`，合法凭据                  | `403`（记住：**这不是认证失败**）                            | 🧪（第三方已复现 403） |
| 6   | `MKCOL https://dav.jianguoyun.com/dav/Nico/`                     | `201`；重复 MKCOL 的实际码（可能 405）                       | 🧪                     |
| 7   | `PUT` 一个小 JSON 到 `/Nico/nico-sync.json`                      | `201`/`204`；记录**响应头是否含 `ETag`**                     | 🧪                     |
| 8   | `GET` 该文件                                                     | `200`；比对内容；记录 `ETag`/`Last-Modified`/CORS 相关响应头 | 🧪                     |
| 9   | 用**过期的 ETag** 发 `If-Match: <etag>` 再 `PUT`                 | 若支持 → `412`；若不支持可能直接覆盖                         | 🧪                     |
| 10  | 删除文件后再 `GET`                                               | `404`                                                        | 🧪                     |
| 11  | 写入超过 500MB 的文件                                            | 观察返回码（`413`/`507`/连接中断）                           | 🧪                     |
| 12  | 30 分钟内快速连发约 700 次请求                                   | 观察是 `429` 还是 `503`，是否带 `Retry-After`                | 🧪                     |
| 13  | 在坚果云后台**删除**该应用密码后立即请求                         | `401`（记录生效时延）                                        | 🧪                     |
| 14  | Vite 网页预览（`127.0.0.1:5173`）里 fetch 同一地址               | 必然失败（CORS / 预检）；确认报错形态                        | 🧪                     |
| 15  | 加载已构建扩展（配好 host_permissions + CSP）后 fetch            | 成功                                                         | 🧪                     |
| 16  | 断网 / 代理异常 / 手动填错服务器地址                             | 错误被正确分类，UI 提示不误导                                | 🧪                     |
| 17  | 首次同步（远端无目录）                                           | 自动 `MKCOL` 建目录后 `PUT` 成功                             | 🧪                     |
| 18  | 两设备交替写入（无需并发）                                       | 后写覆盖先写，本地保留上一版备份                             | 🧪                     |

补充建议：

- 第 2/5 条可以用 `curl -u '邮箱:应用密码' -X PROPFIND -H 'Depth: 0' https://dav.jianguoyun.com/dav/` 快速验证，避免把「实现 bug」误判成「坚果云不支持」。
- 团队的本地 mock WebDAV 服务只能覆盖 UI 与错误分支联调，**不能替代**第 2~13 条对真实端点的实测（真实端点的 403/限流/分页行为与 mock 必然不同）。

---

## 9. 当前实现与联调记录（2026-10-19）

### 9.1 代码落点

| 位置                                                    | 内容                                                                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/manifest.json`                                  | `host_permissions` 与 `extension_pages` CSP 两处都加入 `https://dav.jianguoyun.com/*` / `https://dav.jianguoyun.com`                                          |
| `src/lib/nutstore.ts`                                   | WebDAV 传输层：Basic（UTF-8）认证、`PROPFIND` 校验、`GET`/`PUT`/`MKCOL`、ETag 条件写与 400/409/501 回退、中文错误分类（401/403/404/412/429/503/507/网络超时） |
| `src/lib/sync.ts`                                       | `SyncSettings`、宽松 `parseSyncSettings`、与导出备份同构的 `buildSnapshot`、SHA-256 指纹（排除 `exportedAt`）、`decideSync` 三方比较                          |
| `src/lib/syncStore.ts`                                  | 配置持久化：扩展为 `chrome.storage.local` 的 `nico.newtab.sync.v1`；网页预览为 `preview.*` localStorage                                                       |
| `src/lib/useNutstoreSync.ts`                            | 编排：连接/首次冲突选择、立即同步、上传、恢复、断开、4 秒防抖自动上传、打开页面时节流检查（10 分钟）                                                          |
| `src/components/NutstoreSync.tsx` + `nutstore-sync.css` | 设置 → 同步面板：连接表单、已连接卡片、云端备份方向选择、自动同步开关、错误/成功提示、断开确认                                                                |
| `scripts/mock-webdav.mjs` (`npm run mock:webdav`)       | 本地 WebDAV 模拟服务（`http://127.0.0.1:8787/dav`，账号 `demo@example.com` / `demo-app-password`），供网页预览联调                                            |

### 9.2 已验证（本地 mock WebDAV + 浏览器预览）

- 单元测试：`npx vitest run` 全绿（新增 `nutstore.test.ts` 89 条 + `sync.test.ts` 34 条，覆盖错误码映射、认证头、条件写回退、建目录重试、决策表、指纹与配置解析）。
- 浏览器预览（Edge + `npm run dev` + `npm run mock:webdav`）实测通过：
  1. 错误应用密码 → 就地显示 401 中文错误；
  2. 正确凭据 + 空云端 → 连接后自动上传，`nico-newtab/nico-newtab.json` 写入成功；
  3. 云端已有备份 → 首次连接出现「选择覆盖方向」卡片，「上传本机覆盖云端 / 从云端恢复」均可用；
  4. 本机改动（12/24 小时制）→ 4 秒后自动 PUT，远端 JSON 更新；
  5. 本机与云端同时改动 → 「立即同步」给出冲突提示，不静默覆盖；
  6. 从云端恢复（二次确认）→ 本机内容被远端备份替换；
  7. 断开连接（二次确认）→ 本地凭据清空，云端文件保留；
  8. 390px 移动端宽度下设置面板四个标签不换行、表单可用。
- 注意：网页预览无法跨域访问真实坚果云（见 5.5），上表验证的是 UI 与 WebDAV 协议行为，真实端点仍需按第 8 节自测。

### 9.3 真实账号首测记录（2026-10-19）

- 现象：真实坚果云账号点击「连接并同步」后返回 `HTTP 409`。
- 根因：**同步目录尚不存在时，坚果云对远端文件的 GET 返回 409（XML body 含 `AncestorsNotFound`）而不是 404**，与社区复现 [all-api-hub#665](https://github.com/qixing-jk/all-api-hub/issues/665) 一致；旧实现把它当成了致命错误。
- 修复：单文件 GET 的 409 一律按「云端暂无备份」处理，继续走首次上传（PUT → 父目录不存在时 404/409 → `MKCOL` → 重试 PUT）；「条件写被服务端以 400/409/501 拒绝」的兜底扩展为一次无条件 PUT 重试，412 仍视为真实冲突。
- 回归：`nutstore.test.ts` 新增 AncestorsNotFound、普通 GET 409、409 后 MKCOL 重试、条件写 409 回退等用例；本地 mock WebDAV 也改为按坚果云语义返回 409/404。
- 结论：凭据校验（`PROPFIND`）已通过，说明账号与应用密码本身可用；首次连接失败属于首次目录创建/读取的协议差异，不是账号问题。

### 9.4 交给真实账号实测时的关注点

1. 重点验证第 8 节第 2、6、7、9、12、13 条（真实端点的 401/403、MKCOL/PUT/GET 状态码、ETag 条件写、限流形态、应用密码吊销）。
2. 若 PUT 带条件头被服务端拒绝（400/409/501），实现会自动重试无条件写入；此时冲突保护退化为「客户端读改写 + 指纹三方比较」，请记录实际表现。
3. 首次连接会在 `https://dav.jianguoyun.com/dav/` 下创建 `nico-newtab/` 目录并写入 `nico-newtab.json`；如账号已有同名文件，首次连接会要求选择覆盖方向。
4. 凭据只在扩展本机的 `chrome.storage.local`，不写入导出的 JSON 备份；网页预览的连接只用于本地 mock 测试。

## 10. 参考链接

官方文档：

- 坚果云第三方应用授权WebDAV开启方法（主文档）：<https://help.jianguoyun.com/?p=2064>
- 如何在 Zotero 中设置 WebDAV 连接到坚果云（含 `https://dav.jianguoyun.com/dav/` 与用户名说明）：<https://help.jianguoyun.com/?p=3168>
- 如何使用 Documents 访问坚果云里的文件（含子目录地址写法）：<https://help.jianguoyun.com/?p=3234>
- 如何使用 WebDAV 关联坚果云与 Tampermonkey（含「账号邮箱 + 应用密码」表述）：<https://help.jianguoyun.com/?p=5627>
- 如何在 WPS 中启用 WebDAV 连接到坚果云：<https://help.jianguoyun.com/?p=2622>
- 坚果云官网：<https://www.jianguoyun.com/>
- 坚果云帮助中心首页：<https://help.jianguoyun.com/>

官方开源客户端（坚果云官方 Obsidian 插件，用作行为佐证）：

- 仓库：<https://github.com/nutstore/obsidian-nutstore-sync>
- `src/api/webdav.ts`（`PROPFIND`、`Link: rel="next"` 分页、`etag: null`）：<https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/api/webdav.ts>
- `src/utils/is-503-error.ts`（503 检测）：<https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/utils/is-503-error.ts>
- `src/webdav-patch.ts`（iOS 下无尾斜杠 `PROPFIND` 收到 401 时补 `/` 重试；日志脱敏 `authorization`）：<https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/webdav-patch.ts>
- `src/settings/common.ts`（`https://help.jianguoyun.com/?p=2064` 作为来源注释，`500MB` 上限）：<https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/settings/common.ts>
- `src/utils/nutstore-endpoints.ts`（企业版 `${base}/dav` 拼接）：<https://github.com/nutstore/obsidian-nutstore-sync/blob/main/src/utils/nutstore-endpoints.ts>
- Issue #15（限流实测与「请求过于频繁」提示）：<https://github.com/nutstore/obsidian-nutstore-sync/issues/15>

第三方实测与佐证：

- all-api-hub #981：坚果云 WebDAV 目录 `GET` 返回 403 但 `PROPFIND` 成功（校验凭据不能用 GET）：<https://github.com/qixing-jk/all-api-hub/issues/981>
- all-api-hub #665：坚果云首次同步时 GET 远端文件返回 409 + `AncestorsNotFound`（同步目录尚未创建）：<https://github.com/qixing-jk/all-api-hub/issues/665>
- `@nutstore/sso-js`（npm，无文档/仓库，佐证 SSO 非公开）：<https://www.npmjs.com/package/@nutstore/sso-js>

规范与平台文档：

- RFC 4918（WebDAV，状态码 `207`/`409`/`412`/`423`/`507` 定义）：<https://www.rfc-editor.org/rfc/rfc4918>
- Chrome 扩展跨域请求与 host permissions：<https://developer.chrome.com/docs/extensions/develop/concepts/network-requests>
- Chrome 扩展 CSP（`connect-src` 限制）：<https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy>
