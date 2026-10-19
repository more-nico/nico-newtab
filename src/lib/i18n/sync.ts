import type { Locale } from "./types";

/**
 * Settings → Sync (Nutstore) panel copy plus every message the WebDAV client,
 * the sync file parser and the sync hook can surface.
 *
 * The Chinese section is the single source of truth and keeps the exact
 * pre-i18n strings: the unit tests assert those keywords and the library
 * defaults to zh-CN when imported directly.
 */
const zh = {
  panel: {
    heading: "把设置带到每台设备",
    service: "坚果云 · WebDAV",
    connected: "已连接坚果云",
    account: (username: string) => `账号 ${username}`,
    server: (serverUrl: string, remoteDir: string) =>
      `服务器 ${serverUrl} · 同步目录 ${remoteDir}`,
    syncNow: "立即同步",
    syncing: "同步中…",
    upload: "上传本机",
    uploading: "上传中…",
    restore: "从云端恢复",
    restoring: "恢复中…",
    disconnect: "断开连接",
    disconnectConfirmAria: "确认断开坚果云同步",
    disconnectConfirmTitle: "断开坚果云同步？",
    disconnectConfirmBody:
      "本机保存的账号与应用密码会被清除，云端备份会保留，之后可以重新连接。",
    disconnectConfirmButton: "确认断开",
    disconnecting: "断开中…",
    restoreConfirmAria: "确认从云端恢复备份",
    restoreConfirmTitle: "用云端备份覆盖本机内容？",
    restoreConfirmBody:
      "将替换当前的常用网站、全部设置与自定义壁纸，建议先「上传本机」保存当前内容。",
    restoreConfirmButton: "确认恢复",
    pendingAria: "选择云端备份覆盖方向",
    pendingTitle: (time: string) => `云端已有备份（${time}）。`,
    pendingBody:
      "选择覆盖方向：「从云端恢复」会替换本机内容；「上传本机覆盖云端」会用当前内容替换云端备份。",
    pendingUpload: "上传本机覆盖云端",
    lastSync: "上次同步",
    neverSynced: "尚未同步",
    unknownTime: "时间未知",
    syncingSpinner: "正在与坚果云同步",
    autoSync: "自动同步",
    autoSyncHelp:
      "本机改动会在几秒后自动上传；打开新标签页时最多每 10 分钟检查一次云端更新。",
    connectAria: "连接坚果云",
    serverUrl: "服务器地址",
    serverUrlHelp:
      "坚果云固定为 https://dav.jianguoyun.com/dav；网页预览可填本地模拟地址。",
    username: "坚果云账号",
    password: "应用密码",
    passwordPlaceholder: "第三方应用密码，不是登录密码",
    showPassword: "显示应用密码",
    hidePassword: "隐藏应用密码",
    connect: "连接并同步",
    connecting: "连接中…",
    serverUrlRequired: "请填写服务器地址。",
    usernameRequired: "请填写坚果云账号（邮箱）。",
    passwordRequired: "请填写第三方应用密码（不是登录密码）。",
    previewBefore: "真实坚果云在网页预览中受跨域限制，连接会失败。开发期可先用",
    previewAfterMock: "启动本地模拟服务，并把服务器地址填成",
    previewEnd: "。",
    manualSteps:
      "在坚果云网页端 → 右上角账户名 → 账户信息 → 安全选项 → 第三方应用管理 → 添加应用密码，生成后填到上方。",
    manualLink: "查看坚果云接入手册 ↗",
    security:
      "坚果云官方人员不会向您索取应用密码，为了数据安全，请勿把应用密码告诉任何人。",
    privacy:
      "账号与应用密码只保存在本机，不会写进导出备份，也不会上传到任何第三方；远端只使用坚果云 WebDAV 地址。",
  },
  /** Transient success/info messages produced by the sync hook. */
  notices: {
    busy: "上一步同步还在进行，请稍候。",
    connectedUploaded: "已连接坚果云，当前内容已上传。",
    connectedSame: "已连接坚果云，云端与当前内容一致。",
    connectedPending: "已连接坚果云。云端已有备份，请选择覆盖方向。",
    resolvedRestore: "已用云端备份覆盖本机内容。",
    resolvedUpload: "已用本机内容覆盖云端备份。",
    noRemoteUploaded: "云端还没有备份，已上传当前内容。",
    inSync: "本机与云端已一致。",
    uploadedLocalChanges: "本机改动已上传到坚果云。",
    downloaded: "已从坚果云恢复云端备份。",
    uploaded: "已上传到坚果云。",
    restored: "已从坚果云恢复备份。",
    disconnected: "已断开坚果云同步，本机保存的账号与应用密码已清除。",
    remoteUpdate: "已从坚果云同步了云端更新。",
  },
  /**
   * Everything that can be shown as an error: WebDAV transport/config errors,
   * sync-file parsing, and the hook's validation/conflict messages.
   */
  errors: {
    genericFailure: "操作失败，请重试。",
    // WebDAV transport (nutstore.ts).
    auth: "坚果云账号或应用密码不正确。请在坚果云网页端 → 账户信息 → 安全选项 → 第三方应用管理 生成应用密码后重试。",
    forbidden: "坚果云拒绝了这次请求，请确认账号已开通 WebDAV。",
    rateLimit: "坚果云请求过于频繁，请稍后再试。",
    retryAfter: (seconds: number) => `建议等待约 ${seconds} 秒。`,
    conflict: "云端备份已被其他设备修改，请重新同步。",
    quota: "坚果云空间不足，无法上传备份。",
    notFound: "WebDAV 地址不可用，请检查服务器地址与同步目录是否正确。",
    network: "无法连接坚果云，请检查网络或服务器地址。",
    server: (status: number) =>
      `坚果云暂时不可用（HTTP ${status}），请稍后重试。`,
    rejected: (status: number) =>
      `坚果云拒绝了这次请求（HTTP ${status}），请检查服务器地址与同步目录是否正确。`,
    // Server-address validation (nutstore.ts).
    serverUrlEmpty: "服务器地址不能为空，且不超过 2048 个字符。",
    serverUrlInvalid: "服务器地址格式不正确，请填写完整的 WebDAV 地址。",
    serverUrlProtocol: "服务器地址仅支持 HTTP 或 HTTPS。",
    serverUrlCredentials: "服务器地址不能包含账号和密码。",
    serverUrlQuery: "服务器地址不能包含查询参数或锚点。",
    serverUrlInsecure:
      "出于安全考虑，HTTP 地址只允许本机（localhost / 127.0.0.1）测试使用。",
    // Sync-folder validation (nutstore.ts).
    remoteDirEmpty: "同步目录不能为空，例如 nico-newtab。",
    remoteDirTooLong: "同步目录过长，最多 200 个字符。",
    remoteDirSegment: "同步目录的每一级需为 1–64 个字符。",
    remoteDirRelative: "同步目录不能使用 . 或 .. 相对路径。",
    remoteDirControl: "同步目录不能包含控制字符。",
    // Remote backup parsing (sync.ts).
    parseInvalid: "云端备份内容不完整或格式不受支持，未改动本机数据。",
    // Sync orchestration (useNutstoreSync.ts).
    usernameRequired: "请输入坚果云账号（邮箱）。",
    passwordRequired: "请输入第三方应用密码。",
    notConnected: "请先连接坚果云。",
    noRemote: "云端还没有备份。可以先上传本机内容。",
    conflictManual:
      "本机与云端都有改动。请选择「上传本机」或「从云端恢复」来决定保留哪一份。",
    autoUploadPaused: "云端有更新，自动上传已暂停。请到设置 → 同步中手动同步。",
    autoSyncPaused:
      "云端与本机都有改动，自动同步已暂停。请到设置 → 同步中手动处理。",
  },
};

export type SyncMessages = typeof zh;

const en: SyncMessages = {
  panel: {
    heading: "Take your settings to every device",
    service: "Nutstore · WebDAV",
    connected: "Connected to Nutstore",
    account: (username) => `Account ${username}`,
    server: (serverUrl, remoteDir) =>
      `Server ${serverUrl} · Sync folder ${remoteDir}`,
    syncNow: "Sync now",
    syncing: "Syncing…",
    upload: "Upload this device",
    uploading: "Uploading…",
    restore: "Restore from cloud",
    restoring: "Restoring…",
    disconnect: "Disconnect",
    disconnectConfirmAria: "Confirm disconnecting Nutstore sync",
    disconnectConfirmTitle: "Disconnect Nutstore sync?",
    disconnectConfirmBody:
      "The account and app password stored on this device will be removed. Your cloud backup stays, and you can reconnect later.",
    disconnectConfirmButton: "Disconnect",
    disconnecting: "Disconnecting…",
    restoreConfirmAria: "Confirm restoring from the cloud",
    restoreConfirmTitle: "Replace this device's content with the cloud backup?",
    restoreConfirmBody:
      "This replaces your shortcuts, all settings and your custom wallpaper. We recommend Upload this device first to save the current content.",
    restoreConfirmButton: "Restore",
    pendingAria: "Choose which copy to keep",
    pendingTitle: (time) => `A cloud backup already exists (${time}).`,
    pendingBody:
      "Choose which copy to keep: Restore from cloud replaces this device's content, while Upload this device replaces the cloud backup with the current content.",
    pendingUpload: "Upload this device and overwrite cloud",
    lastSync: "Last sync",
    neverSynced: "Not synced yet",
    unknownTime: "Unknown time",
    syncingSpinner: "Syncing with Nutstore",
    autoSync: "Auto sync",
    autoSyncHelp:
      "Changes on this device upload automatically after a few seconds. On each new tab page, the cloud is checked for updates at most once every 10 minutes.",
    connectAria: "Connect to Nutstore",
    serverUrl: "Server address",
    serverUrlHelp:
      "The Nutstore address is always https://dav.jianguoyun.com/dav; in the web preview you can use a local mock address.",
    username: "Nutstore account",
    password: "App password",
    passwordPlaceholder: "App password, not your login password",
    showPassword: "Show app password",
    hidePassword: "Hide app password",
    connect: "Connect and sync",
    connecting: "Connecting…",
    serverUrlRequired: "Enter the server address.",
    usernameRequired: "Enter your Nutstore account (email).",
    passwordRequired: "Enter the app password (not your login password).",
    previewBefore:
      "The real Nutstore service is blocked by CORS in the web preview, so connecting fails. During development, start the local mock server with",
    previewAfterMock: "and set the server address to",
    previewEnd: ".",
    manualSteps:
      "In Nutstore on the web, go to your account name (top right) → Account info → Security options → Third-party app management → Add app password, then paste the generated password above.",
    manualLink: "Open the Nutstore setup guide ↗",
    security:
      "Nutstore staff will never ask for your app password. To keep your data safe, never share your app password with anyone.",
    privacy:
      "The account and app password are stored only on this device. They are never written to exported backups or sent to any third party; the only remote endpoint is Nutstore's WebDAV address.",
  },
  notices: {
    busy: "Another sync is still running. Please wait.",
    connectedUploaded:
      "Connected to Nutstore. Your current content was uploaded.",
    connectedSame:
      "Connected to Nutstore. The cloud and this device already match.",
    connectedPending:
      "Connected to Nutstore. A cloud backup already exists; choose which copy to keep.",
    resolvedRestore: "Replaced this device's content with the cloud backup.",
    resolvedUpload: "Replaced the cloud backup with this device's content.",
    noRemoteUploaded:
      "There's no cloud backup yet, so your current content was uploaded.",
    inSync: "This device and the cloud are in sync.",
    uploadedLocalChanges: "Local changes were uploaded to Nutstore.",
    downloaded: "Restored the cloud backup from Nutstore.",
    uploaded: "Uploaded to Nutstore.",
    restored: "Restored the backup from Nutstore.",
    disconnected:
      "Nutstore sync is disconnected. The account and app password stored on this device were removed.",
    remoteUpdate: "Synced the latest cloud changes from Nutstore.",
  },
  errors: {
    genericFailure: "Something went wrong. Please try again.",
    auth: "The Nutstore account or app password is incorrect. Generate an app password at Nutstore on the web under Account info → Security options → Third-party app management, then try again.",
    forbidden:
      "Nutstore rejected this request. Please make sure WebDAV is enabled for your account.",
    rateLimit: "Too many requests to Nutstore. Please try again later.",
    retryAfter: (seconds) => ` Suggested wait: about ${seconds} seconds.`,
    conflict:
      "The cloud backup was changed on another device. Please sync again.",
    quota: "Not enough Nutstore space to upload the backup.",
    notFound:
      "The WebDAV address is unavailable. Check the server address and sync folder.",
    network:
      "Couldn't reach Nutstore. Check your network connection or server address.",
    server: (status) =>
      `Nutstore is temporarily unavailable (HTTP ${status}). Please try again later.`,
    rejected: (status) =>
      `Nutstore rejected this request (HTTP ${status}). Check the server address and sync folder.`,
    serverUrlEmpty:
      "The server address can't be empty and must be at most 2048 characters.",
    serverUrlInvalid:
      "That doesn't look like a valid server address. Enter the full WebDAV address.",
    serverUrlProtocol: "The server address must use HTTP or HTTPS.",
    serverUrlCredentials:
      "The server address can't include a username or password.",
    serverUrlQuery:
      "The server address can't include query parameters or a fragment.",
    serverUrlInsecure:
      "For security, plain HTTP is only allowed for local testing (localhost / 127.0.0.1).",
    remoteDirEmpty: "The sync folder can't be empty, for example nico-newtab.",
    remoteDirTooLong:
      "The sync folder is too long; it can have at most 200 characters.",
    remoteDirSegment: "Each level of the sync folder must be 1–64 characters.",
    remoteDirRelative:
      "The sync folder can't use relative paths such as . or ..",
    remoteDirControl: "The sync folder can't contain control characters.",
    parseInvalid:
      "The cloud backup is incomplete or in an unsupported format. Your local data was not changed.",
    usernameRequired: "Enter your Nutstore account (email).",
    passwordRequired: "Enter the app password.",
    notConnected: "Connect to Nutstore first.",
    noRemote: "There's no cloud backup yet. You can upload this device first.",
    conflictManual:
      "Both this device and the cloud have changes. Choose Upload this device or Restore from cloud to decide which copy to keep.",
    autoUploadPaused:
      "The cloud has newer changes, so auto upload is paused. Sync manually in Settings → Sync.",
    autoSyncPaused:
      "Both the cloud and this device have changes, so auto sync is paused. Resolve it manually in Settings → Sync.",
  },
};

const ja: SyncMessages = {
  panel: {
    heading: "設定をどの端末でも共有",
    service: "Nutstore · WebDAV",
    connected: "Nutstore に接続済み",
    account: (username) => `アカウント ${username}`,
    server: (serverUrl, remoteDir) =>
      `サーバー ${serverUrl} · 同期フォルダー ${remoteDir}`,
    syncNow: "今すぐ同期",
    syncing: "同期中…",
    upload: "この端末をアップロード",
    uploading: "アップロード中…",
    restore: "クラウドから復元",
    restoring: "復元中…",
    disconnect: "接続を解除",
    disconnectConfirmAria: "Nutstore の同期解除の確認",
    disconnectConfirmTitle: "Nutstore の同期を解除しますか？",
    disconnectConfirmBody:
      "この端末に保存されたアカウントとアプリパスワードは削除されます。クラウドのバックアップは残るため、あとで再接続できます。",
    disconnectConfirmButton: "解除する",
    disconnecting: "解除中…",
    restoreConfirmAria: "クラウドからの復元の確認",
    restoreConfirmTitle:
      "クラウドのバックアップでこの端末の内容を上書きしますか？",
    restoreConfirmBody:
      "現在のよく使うサイト、すべての設定、カスタム壁紙が置き換えられます。先に「この端末をアップロード」で現在の内容を保存することをおすすめします。",
    restoreConfirmButton: "復元する",
    pendingAria: "クラウドバックアップの上書き方向を選択",
    pendingTitle: (time) => `クラウドにバックアップがあります（${time}）。`,
    pendingBody:
      "上書きする方向を選択してください。「クラウドから復元」はこの端末の内容を置き換え、「この端末をアップロード」は現在の内容でクラウドのバックアップを置き換えます。",
    pendingUpload: "この端末でクラウドを上書き",
    lastSync: "前回の同期",
    neverSynced: "まだ同期していません",
    unknownTime: "日時不明",
    syncingSpinner: "Nutstore と同期中",
    autoSync: "自動同期",
    autoSyncHelp:
      "この端末の変更は数秒後に自動でアップロードされます。新しいタブページを開いたときは、最大 10 分に 1 回クラウドの更新を確認します。",
    connectAria: "Nutstore に接続",
    serverUrl: "サーバーアドレス",
    serverUrlHelp:
      "Nutstore のアドレスは https://dav.jianguoyun.com/dav で固定です。ウェブプレビューではローカルのモックアドレスを入力できます。",
    username: "Nutstore アカウント",
    password: "アプリパスワード",
    passwordPlaceholder: "アプリパスワード（ログインパスワードではありません）",
    showPassword: "アプリパスワードを表示",
    hidePassword: "アプリパスワードを隠す",
    connect: "接続して同期",
    connecting: "接続中…",
    serverUrlRequired: "サーバーアドレスを入力してください。",
    usernameRequired:
      "Nutstore のアカウント（メールアドレス）を入力してください。",
    passwordRequired:
      "アプリパスワード（ログインパスワードではありません）を入力してください。",
    previewBefore:
      "ウェブプレビューでは CORS の制限により実際の Nutstore に接続できません。開発中は",
    previewAfterMock: "でローカルモックサーバーを起動し、サーバーアドレスに",
    previewEnd: "を入力してください。",
    manualSteps:
      "Nutstore のウェブで、右上のアカウント名 → アカウント情報 → セキュリティオプション → サードパーティアプリ管理 → アプリパスワードを追加、と進み、生成したパスワードを上に入力してください。",
    manualLink: "Nutstore の接続ガイドを見る ↗",
    security:
      "Nutstore の公式スタッフがアプリパスワードを尋ねることはありません。データの安全のため、アプリパスワードは誰にも教えないでください。",
    privacy:
      "アカウントとアプリパスワードはこの端末にのみ保存され、エクスポートしたバックアップには含まれず、第三者に送信されることもありません。接続先は Nutstore の WebDAV アドレスのみです。",
  },
  notices: {
    busy: "前回の同期がまだ実行中です。しばらくお待ちください。",
    connectedUploaded: "Nutstore に接続し、現在の内容をアップロードしました。",
    connectedSame:
      "Nutstore に接続しました。クラウドと現在の内容は一致しています。",
    connectedPending:
      "Nutstore に接続しました。クラウドにバックアップがあるため、上書きする方向を選択してください。",
    resolvedRestore: "クラウドのバックアップでこの端末の内容を上書きしました。",
    resolvedUpload: "この端末の内容でクラウドのバックアップを上書きしました。",
    noRemoteUploaded:
      "クラウドにバックアップがまだないため、現在の内容をアップロードしました。",
    inSync: "この端末とクラウドは一致しています。",
    uploadedLocalChanges: "この端末の変更を Nutstore にアップロードしました。",
    downloaded: "Nutstore からクラウドのバックアップを復元しました。",
    uploaded: "Nutstore にアップロードしました。",
    restored: "Nutstore からバックアップを復元しました。",
    disconnected:
      "Nutstore の同期を解除しました。この端末に保存されたアカウントとアプリパスワードは削除されました。",
    remoteUpdate: "Nutstore からクラウドの更新を同期しました。",
  },
  errors: {
    genericFailure: "操作に失敗しました。もう一度お試しください。",
    auth: "Nutstore のアカウントまたはアプリパスワードが正しくありません。Nutstore のウェブで「アカウント情報 → セキュリティオプション → サードパーティアプリ管理」からアプリパスワードを生成して、もう一度お試しください。",
    forbidden:
      "Nutstore がこのリクエストを拒否しました。アカウントで WebDAV が有効になっているか確認してください。",
    rateLimit:
      "Nutstore へのリクエストが多すぎます。しばらくしてから再度お試しください。",
    retryAfter: (seconds) => `約 ${seconds} 秒待ってから再度お試しください。`,
    conflict:
      "クラウドのバックアップが別の端末で変更されました。もう一度同期してください。",
    quota:
      "Nutstore の空き容量が不足しているため、バックアップをアップロードできません。",
    notFound:
      "WebDAV アドレスを利用できません。サーバーアドレスと同期フォルダーを確認してください。",
    network:
      "Nutstore に接続できません。ネットワーク接続またはサーバーアドレスを確認してください。",
    server: (status) =>
      `Nutstore は一時的に利用できません（HTTP ${status}）。しばらくしてから再度お試しください。`,
    rejected: (status) =>
      `Nutstore がこのリクエストを拒否しました（HTTP ${status}）。サーバーアドレスと同期フォルダーを確認してください。`,
    serverUrlEmpty: "サーバーアドレスを入力してください（2048 文字以内）。",
    serverUrlInvalid:
      "サーバーアドレスの形式が正しくありません。WebDAV アドレスを完全に入力してください。",
    serverUrlProtocol:
      "サーバーアドレスは HTTP または HTTPS のみに対応しています。",
    serverUrlCredentials:
      "サーバーアドレスにアカウントとパスワードを含めることはできません。",
    serverUrlQuery:
      "サーバーアドレスにクエリパラメーターやフラグメントを含めることはできません。",
    serverUrlInsecure:
      "セキュリティ上の理由から、HTTP アドレスはローカル（localhost / 127.0.0.1）のテストでのみ使用できます。",
    remoteDirEmpty: "同期フォルダーを入力してください（例: nico-newtab）。",
    remoteDirTooLong:
      "同期フォルダーが長すぎます。200 文字以内にしてください。",
    remoteDirSegment: "同期フォルダーの各階層は 1–64 文字にしてください。",
    remoteDirRelative: "同期フォルダーに . や .. の相対パスは使用できません。",
    remoteDirControl: "同期フォルダーに制御文字を含めることはできません。",
    parseInvalid:
      "クラウドのバックアップが不完全か、サポートされていない形式です。この端末のデータは変更されていません。",
    usernameRequired:
      "Nutstore のアカウント（メールアドレス）を入力してください。",
    passwordRequired: "アプリパスワードを入力してください。",
    notConnected: "先に Nutstore に接続してください。",
    noRemote:
      "クラウドにバックアップがありません。先にこの端末の内容をアップロードしてください。",
    conflictManual:
      "この端末とクラウドの両方に変更があります。「この端末をアップロード」または「クラウドから復元」を選んで、残す内容を決めてください。",
    autoUploadPaused:
      "クラウドに更新があるため、自動アップロードを停止しました。設定 → 同期から手動で同期してください。",
    autoSyncPaused:
      "クラウドとこの端末の両方に変更があるため、自動同期を停止しました。設定 → 同期から手動で処理してください。",
  },
};

export const syncMessages: Record<Locale, SyncMessages> = {
  "zh-CN": zh,
  en,
  ja,
};
