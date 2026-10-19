import { useEffect, useState, type FormEvent, type JSX } from "react";
import {
  GlassAlert,
  GlassButton,
  GlassInput,
  GlassSpinner,
  GlassSurface,
  GlassSwitch,
} from "nico-glass-kit";
import {
  Cloud,
  CloudDownload,
  CloudUpload,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  Server,
  Unplug,
  UserRound,
} from "lucide-react";
import type { SyncSettings } from "../lib/sync";
import { isExtension } from "../lib/platform";
import { useGlassMaterial } from "../lib/glass";
import "./nutstore-sync.css";

/** 坚果云帮助中心：如何生成第三方应用密码。 */
const MANUAL_URL = "https://help.jianguoyun.com/?p=2064";

const TIME_FORMAT = new Intl.DateTimeFormat("zh-CN", {
  // `month: "long"` is what yields 10月19日 in zh-CN; numeric would give 10/19.
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Localized `10月19日 18:30`; null when the stored timestamp is unusable. */
function formatTime(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? TIME_FORMAT.format(time) : null;
}

interface ConnectDraft {
  serverUrl: string;
  username: string;
  password: string;
}

type SyncAction =
  | "connect"
  | "sync"
  | "upload"
  | "restore"
  | "resolve"
  | "disconnect";

type ConfirmAction = "disconnect" | "restore";

export interface NutstoreSyncProps {
  settings: SyncSettings;
  busy: boolean;
  error: string;
  notice: string;
  /** 首次连接时云端已有备份，等待用户选择覆盖方向。 */
  pending: { exportedAt: string } | null;
  onConnect: (input: {
    serverUrl: string;
    username: string;
    password: string;
  }) => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  onUpload: () => Promise<void>;
  onRestore: () => Promise<void>;
  onResolvePending: (choice: "upload" | "restore") => Promise<void>;
  onAutoSyncChange: (enabled: boolean) => Promise<void>;
  onClearFeedback: () => void;
}

/**
 * 设置 → 同步 panel: connect form for 坚果云 WebDAV, the connected account card,
 * manual sync actions, the first-connect conflict decision and the auto-sync
 * preference. All copy is Chinese; the two files this lives in are owned by
 * the sync UI task (see `.cache/nutstore-sync-contract.md`).
 */
export function NutstoreSync({
  settings,
  busy,
  error,
  notice,
  pending,
  onConnect,
  onDisconnect,
  onSyncNow,
  onUpload,
  onRestore,
  onResolvePending,
  onAutoSyncChange,
  onClearFeedback,
}: NutstoreSyncProps): JSX.Element {
  const { base } = useGlassMaterial();
  // `null` means "follow the stored settings". Once the user types, the draft
  // owns the fields so a settings refresh never wipes the input; the draft is
  // dropped only when the connection state flips (successful connect or
  // disconnect).
  const [draft, setDraft] = useState<ConnectDraft | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(
    null,
  );
  const [activeAction, setActiveAction] = useState<SyncAction | null>(null);
  const [pendingChoice, setPendingChoice] = useState<
    "upload" | "restore" | null
  >(null);
  const [localError, setLocalError] = useState("");

  const hasPending = pending !== null;
  const actionLocked = busy || hasPending;
  const form = draft ?? {
    serverUrl: settings.serverUrl,
    username: settings.username,
    password: settings.password,
  };
  const lastSynced = formatTime(settings.lastSyncedAt);
  const pendingTime = pending
    ? (formatTime(pending.exportedAt) ?? "时间未知")
    : "";
  const danger = localError || error;

  useEffect(() => {
    // Connecting and disconnecting both flip `enabled` — the only two moments
    // the form may be reset to match what is actually stored.
    setDraft(null);
    setShowPassword(false);
    setConfirmAction(null);
    setActiveAction(null);
    setPendingChoice(null);
    setLocalError("");
  }, [settings.enabled]);

  function dismissFeedback() {
    setLocalError("");
    onClearFeedback();
  }

  function editDraft(patch: Partial<ConnectDraft>) {
    setDraft({ ...form, ...patch });
    setLocalError("");
    if (error || notice) onClearFeedback();
  }

  async function runAction(action: SyncAction, operation: () => Promise<void>) {
    if (busy) return;
    setLocalError("");
    setActiveAction(action);
    onClearFeedback();
    try {
      await operation();
    } catch (caught) {
      setLocalError(
        caught instanceof Error ? caught.message : "操作失败，请重试。",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function submitConnect(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const serverUrl = form.serverUrl.trim();
    const username = form.username.trim();
    const password = form.password;
    if (!serverUrl) return setLocalError("请填写服务器地址。");
    if (!username) return setLocalError("请填写坚果云账号（邮箱）。");
    if (!password)
      return setLocalError("请填写第三方应用密码（不是登录密码）。");
    await runAction("connect", () =>
      onConnect({ serverUrl, username, password }),
    );
  }

  async function choosePending(choice: "upload" | "restore") {
    if (busy) return;
    setPendingChoice(choice);
    try {
      await runAction("resolve", () => onResolvePending(choice));
    } finally {
      setPendingChoice(null);
    }
  }

  async function confirmDisconnect() {
    await runAction("disconnect", onDisconnect);
    setConfirmAction(null);
  }

  async function confirmRestore() {
    await runAction("restore", onRestore);
    setConfirmAction(null);
  }

  const spinner = <LoaderCircle size={14} className="spinning" />;

  return (
    <div className="nutstore-sync" aria-busy={busy}>
      <div className="section-heading">
        <h3>把设置带到每台设备</h3>
        <span>坚果云 · WebDAV</span>
      </div>
      {settings.enabled ? (
        <>
          <GlassSurface
            className="backup-card nutstore-account"
            cornerRadius={26}
            data-testid="nutstore-account"
            {...base}
          >
            <span className="backup-icon">
              <Cloud size={23} />
            </span>
            <div className="nutstore-account-text">
              <strong>已连接坚果云</strong>
              <p>账号 {settings.username}</p>
              <p>
                服务器 {settings.serverUrl} · 同步目录 {settings.remoteDir}
              </p>
            </div>
            <GlassButton
              size="sm"
              className="primary-button"
              icon={activeAction === "sync" ? spinner : <RefreshCw size={14} />}
              disabled={actionLocked}
              onClick={() => void runAction("sync", onSyncNow)}
              data-testid="nutstore-sync-now"
              {...base}
            >
              {activeAction === "sync" ? "同步中…" : "立即同步"}
            </GlassButton>
          </GlassSurface>
          <div className="nutstore-actions">
            <GlassButton
              size="sm"
              icon={
                activeAction === "upload" ? spinner : <CloudUpload size={14} />
              }
              disabled={actionLocked}
              onClick={() => void runAction("upload", onUpload)}
              data-testid="nutstore-upload"
              {...base}
            >
              {activeAction === "upload" ? "上传中…" : "上传本机"}
            </GlassButton>
            <GlassButton
              size="sm"
              icon={
                activeAction === "restore" ? (
                  spinner
                ) : (
                  <CloudDownload size={14} />
                )
              }
              disabled={actionLocked}
              onClick={() => {
                setLocalError("");
                setConfirmAction("restore");
              }}
              data-testid="nutstore-restore"
              {...base}
            >
              {activeAction === "restore" ? "恢复中…" : "从云端恢复"}
            </GlassButton>
            <GlassButton
              size="sm"
              className="text-glass-button nutstore-disconnect"
              icon={<Unplug size={14} />}
              disabled={busy}
              onClick={() => {
                setLocalError("");
                setConfirmAction("disconnect");
              }}
              data-testid="nutstore-disconnect"
              {...base}
            >
              断开连接
            </GlassButton>
          </div>
          {confirmAction === "disconnect" && (
            <GlassSurface
              className="import-confirm nutstore-confirm"
              role="region"
              aria-label="确认断开坚果云同步"
              cornerRadius={26}
              data-testid="nutstore-confirm-disconnect"
              {...base}
            >
              <strong>断开坚果云同步？</strong>
              <p>
                本机保存的账号与应用密码会被清除，云端备份会保留，之后可以重新连接。
              </p>
              <div className="button-pair">
                <GlassButton
                  size="sm"
                  className="text-glass-button"
                  disabled={busy}
                  onClick={() => setConfirmAction(null)}
                  data-testid="nutstore-cancel-disconnect"
                  {...base}
                >
                  取消
                </GlassButton>
                <GlassButton
                  size="sm"
                  className="danger"
                  disabled={busy}
                  onClick={() => void confirmDisconnect()}
                  data-testid="nutstore-confirm-disconnect-button"
                  {...base}
                >
                  {activeAction === "disconnect" ? "断开中…" : "确认断开"}
                </GlassButton>
              </div>
            </GlassSurface>
          )}
          {confirmAction === "restore" && (
            <GlassSurface
              className="import-confirm nutstore-confirm"
              role="region"
              aria-label="确认从云端恢复备份"
              cornerRadius={26}
              data-testid="nutstore-confirm-restore"
              {...base}
            >
              <strong>用云端备份覆盖本机内容？</strong>
              <p>
                将替换当前的常用网站、全部设置与自定义壁纸，建议先「上传本机」保存当前内容。
              </p>
              <div className="button-pair">
                <GlassButton
                  size="sm"
                  className="text-glass-button"
                  disabled={busy}
                  onClick={() => setConfirmAction(null)}
                  data-testid="nutstore-cancel-restore"
                  {...base}
                >
                  取消
                </GlassButton>
                <GlassButton
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void confirmRestore()}
                  data-testid="nutstore-confirm-restore-button"
                  {...base}
                >
                  {activeAction === "restore" ? "恢复中…" : "确认恢复"}
                </GlassButton>
              </div>
            </GlassSurface>
          )}
          {pending && (
            <GlassSurface
              className="import-confirm nutstore-pending"
              role="region"
              aria-label="选择云端备份覆盖方向"
              cornerRadius={26}
              data-testid="nutstore-pending"
              {...base}
            >
              <strong>云端已有备份（{pendingTime}）。</strong>
              <p>
                选择覆盖方向：「从云端恢复」会替换本机内容；「上传本机覆盖云端」会用当前内容替换云端备份。
              </p>
              <div className="button-pair">
                <GlassButton
                  size="sm"
                  className="text-glass-button"
                  disabled={busy}
                  onClick={() => void choosePending("restore")}
                  data-testid="nutstore-pending-restore"
                  {...base}
                >
                  {activeAction === "resolve" && pendingChoice === "restore"
                    ? "恢复中…"
                    : "从云端恢复"}
                </GlassButton>
                <GlassButton
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void choosePending("upload")}
                  data-testid="nutstore-pending-upload"
                  {...base}
                >
                  {activeAction === "resolve" && pendingChoice === "upload"
                    ? "上传中…"
                    : "上传本机覆盖云端"}
                </GlassButton>
              </div>
            </GlassSurface>
          )}
          {danger && (
            <GlassAlert
              className="inline-feedback"
              tone="danger"
              role="alert"
              onClose={dismissFeedback}
              data-testid="nutstore-error"
              {...base}
            >
              {danger}
            </GlassAlert>
          )}
          {notice && (
            <GlassAlert
              className="inline-feedback"
              tone="success"
              role="status"
              onClose={onClearFeedback}
              data-testid="nutstore-notice"
              {...base}
            >
              {notice}
            </GlassAlert>
          )}
          <div className="nutstore-info">
            <div className="setting-row nutstore-last-sync">
              <div>
                <label>上次同步</label>
                <p data-testid="nutstore-last-sync">
                  {lastSynced ?? "尚未同步"}
                </p>
              </div>
              {busy && (
                <GlassSpinner size="sm" label="正在与坚果云同步" {...base} />
              )}
            </div>
            <div className="setting-row">
              <div>
                <label id="nutstore-auto-sync-label">自动同步</label>
                <p id="nutstore-auto-sync-help">
                  本机改动会在几秒后自动上传；打开新标签页时最多每 10
                  分钟检查一次云端更新。
                </p>
              </div>
              <GlassSwitch
                size="sm"
                checked={settings.autoSync}
                onChange={(checked) => void onAutoSyncChange(checked)}
                disabled={busy}
                aria-labelledby="nutstore-auto-sync-label"
                aria-describedby="nutstore-auto-sync-help"
                data-testid="nutstore-auto-sync"
                {...base}
              />
            </div>
          </div>
          {settings.lastError && (
            <GlassAlert
              className="inline-feedback nutstore-last-error"
              tone="warning"
              role="status"
              onClose={onClearFeedback}
              data-testid="nutstore-last-error"
              {...base}
            >
              {settings.lastError}
            </GlassAlert>
          )}
        </>
      ) : (
        <>
          <GlassSurface
            className="nutstore-form"
            cornerRadius={26}
            data-testid="nutstore-form"
            {...base}
          >
            <form
              className="nutstore-connect-form"
              aria-label="连接坚果云"
              onSubmit={(event) => void submitConnect(event)}
            >
              <label htmlFor="nutstore-server-url">服务器地址</label>
              <GlassInput
                id="nutstore-server-url"
                aria-label="服务器地址"
                aria-describedby="nutstore-server-url-help"
                value={form.serverUrl}
                onChange={(event) =>
                  editDraft({ serverUrl: event.target.value })
                }
                placeholder="https://dav.jianguoyun.com/dav"
                autoComplete="url"
                spellCheck={false}
                leading={<Server size={16} />}
                disabled={busy}
                data-testid="nutstore-server-url"
                {...base}
              />
              <p className="nutstore-help" id="nutstore-server-url-help">
                坚果云固定为
                https://dav.jianguoyun.com/dav；网页预览可填本地模拟地址。
              </p>
              <label htmlFor="nutstore-username">坚果云账号</label>
              <GlassInput
                id="nutstore-username"
                aria-label="坚果云账号"
                value={form.username}
                onChange={(event) =>
                  editDraft({ username: event.target.value })
                }
                placeholder="you@example.com"
                autoComplete="username"
                spellCheck={false}
                leading={<UserRound size={16} />}
                disabled={busy}
                data-testid="nutstore-username"
                {...base}
              />
              <label htmlFor="nutstore-password">应用密码</label>
              <GlassInput
                id="nutstore-password"
                aria-label="应用密码"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  editDraft({ password: event.target.value })
                }
                placeholder="第三方应用密码，不是登录密码"
                autoComplete="current-password"
                spellCheck={false}
                leading={<KeyRound size={16} />}
                invalid={Boolean(danger)}
                disabled={busy}
                data-testid="nutstore-password"
                trailing={
                  <button
                    type="button"
                    className="nutstore-password-toggle"
                    aria-label={showPassword ? "隐藏应用密码" : "显示应用密码"}
                    aria-pressed={showPassword}
                    title={showPassword ? "隐藏应用密码" : "显示应用密码"}
                    disabled={busy}
                    data-testid="nutstore-password-toggle"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
                {...base}
              />
              {danger && (
                <GlassAlert
                  className="inline-feedback"
                  tone="danger"
                  role="alert"
                  onClose={dismissFeedback}
                  data-testid="nutstore-error"
                  {...base}
                >
                  {danger}
                </GlassAlert>
              )}
              {notice && (
                <GlassAlert
                  className="inline-feedback"
                  tone="success"
                  role="status"
                  onClose={onClearFeedback}
                  data-testid="nutstore-notice"
                  {...base}
                >
                  {notice}
                </GlassAlert>
              )}
              <div className="nutstore-form-actions">
                <GlassButton
                  type="submit"
                  className="primary-button"
                  icon={
                    activeAction === "connect" ? spinner : <Cloud size={15} />
                  }
                  disabled={busy}
                  data-testid="nutstore-connect"
                  {...base}
                >
                  {activeAction === "connect" ? "连接中…" : "连接并同步"}
                </GlassButton>
              </div>
            </form>
          </GlassSurface>
          {!isExtension && (
            <GlassSurface
              className="settings-note nutstore-preview"
              cornerRadius={26}
              data-testid="nutstore-preview-hint"
              {...base}
            >
              真实坚果云在网页预览中受跨域限制，连接会失败。开发期可先用{" "}
              <code>npm run mock:webdav</code>{" "}
              启动本地模拟服务，并把服务器地址填成{" "}
              <code>http://127.0.0.1:8787/dav</code>。
            </GlassSurface>
          )}
          <GlassSurface
            className="settings-note nutstore-manual"
            cornerRadius={26}
            data-testid="nutstore-manual"
            {...base}
          >
            <p>
              在坚果云网页端 → 右上角账户名 → 账户信息 → 安全选项 →
              第三方应用管理 → 添加应用密码，生成后填到上方。
            </p>
            <p>
              <a href={MANUAL_URL} target="_blank" rel="noreferrer">
                查看坚果云接入手册 ↗
              </a>
            </p>
            <p className="nutstore-security">
              坚果云官方人员不会向您索取应用密码，为了数据安全，请勿把应用密码告诉任何人。
            </p>
            <p>
              账号与应用密码只保存在本机，不会写进导出备份，也不会上传到任何第三方；远端只使用坚果云
              WebDAV 地址。
            </p>
          </GlassSurface>
        </>
      )}
    </div>
  );
}
