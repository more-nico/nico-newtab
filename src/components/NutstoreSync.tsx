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
import { formatDateTime, t } from "../lib/i18n";
import { isExtension } from "../lib/platform";
import { useGlassMaterial } from "../lib/glass";
import "./nutstore-sync.css";

/** Nutstore help center: how to generate a third-party app password. */
const MANUAL_URL = "https://help.jianguoyun.com/?p=2064";

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
  /** The first connection found a remote backup; waiting for the overwrite direction. */
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
 * Settings → Sync panel: connect form for Nutstore WebDAV, the connected
 * account card, manual sync actions, the first-connect conflict decision and
 * the auto-sync preference.
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
  const m = t();
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
  const lastSynced = formatDateTime(settings.lastSyncedAt);
  const pendingTime = pending
    ? (formatDateTime(pending.exportedAt) ?? m.sync.panel.unknownTime)
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
        caught instanceof Error
          ? caught.message
          : t().sync.errors.genericFailure,
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
    if (!serverUrl) return setLocalError(m.sync.panel.serverUrlRequired);
    if (!username) return setLocalError(m.sync.panel.usernameRequired);
    if (!password) return setLocalError(m.sync.panel.passwordRequired);
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
        <h3>{m.sync.panel.heading}</h3>
        <span>{m.sync.panel.service}</span>
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
              <strong>{m.sync.panel.connected}</strong>
              <p>{m.sync.panel.account(settings.username)}</p>
              <p>
                {m.sync.panel.server(settings.serverUrl, settings.remoteDir)}
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
              {activeAction === "sync"
                ? m.sync.panel.syncing
                : m.sync.panel.syncNow}
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
              {activeAction === "upload"
                ? m.sync.panel.uploading
                : m.sync.panel.upload}
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
              {activeAction === "restore"
                ? m.sync.panel.restoring
                : m.sync.panel.restore}
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
              {m.sync.panel.disconnect}
            </GlassButton>
          </div>
          {confirmAction === "disconnect" && (
            <GlassSurface
              className="import-confirm nutstore-confirm"
              role="region"
              aria-label={m.sync.panel.disconnectConfirmAria}
              cornerRadius={26}
              data-testid="nutstore-confirm-disconnect"
              {...base}
            >
              <strong>{m.sync.panel.disconnectConfirmTitle}</strong>
              <p>{m.sync.panel.disconnectConfirmBody}</p>
              <div className="button-pair">
                <GlassButton
                  size="sm"
                  className="text-glass-button"
                  disabled={busy}
                  onClick={() => setConfirmAction(null)}
                  data-testid="nutstore-cancel-disconnect"
                  {...base}
                >
                  {m.common.actions.cancel}
                </GlassButton>
                <GlassButton
                  size="sm"
                  className="danger"
                  disabled={busy}
                  onClick={() => void confirmDisconnect()}
                  data-testid="nutstore-confirm-disconnect-button"
                  {...base}
                >
                  {activeAction === "disconnect"
                    ? m.sync.panel.disconnecting
                    : m.sync.panel.disconnectConfirmButton}
                </GlassButton>
              </div>
            </GlassSurface>
          )}
          {confirmAction === "restore" && (
            <GlassSurface
              className="import-confirm nutstore-confirm"
              role="region"
              aria-label={m.sync.panel.restoreConfirmAria}
              cornerRadius={26}
              data-testid="nutstore-confirm-restore"
              {...base}
            >
              <strong>{m.sync.panel.restoreConfirmTitle}</strong>
              <p>{m.sync.panel.restoreConfirmBody}</p>
              <div className="button-pair">
                <GlassButton
                  size="sm"
                  className="text-glass-button"
                  disabled={busy}
                  onClick={() => setConfirmAction(null)}
                  data-testid="nutstore-cancel-restore"
                  {...base}
                >
                  {m.common.actions.cancel}
                </GlassButton>
                <GlassButton
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void confirmRestore()}
                  data-testid="nutstore-confirm-restore-button"
                  {...base}
                >
                  {activeAction === "restore"
                    ? m.sync.panel.restoring
                    : m.sync.panel.restoreConfirmButton}
                </GlassButton>
              </div>
            </GlassSurface>
          )}
          {pending && (
            <GlassSurface
              className="import-confirm nutstore-pending"
              role="region"
              aria-label={m.sync.panel.pendingAria}
              cornerRadius={26}
              data-testid="nutstore-pending"
              {...base}
            >
              <strong>{m.sync.panel.pendingTitle(pendingTime)}</strong>
              <p>{m.sync.panel.pendingBody}</p>
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
                    ? m.sync.panel.restoring
                    : m.sync.panel.restore}
                </GlassButton>
                <GlassButton
                  className="primary-button"
                  disabled={busy}
                  onClick={() => void choosePending("upload")}
                  data-testid="nutstore-pending-upload"
                  {...base}
                >
                  {activeAction === "resolve" && pendingChoice === "upload"
                    ? m.sync.panel.uploading
                    : m.sync.panel.pendingUpload}
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
                <label>{m.sync.panel.lastSync}</label>
                <p data-testid="nutstore-last-sync">
                  {lastSynced ?? m.sync.panel.neverSynced}
                </p>
              </div>
              {busy && (
                <GlassSpinner
                  size="sm"
                  label={m.sync.panel.syncingSpinner}
                  {...base}
                />
              )}
            </div>
            <div className="setting-row">
              <div>
                <label id="nutstore-auto-sync-label">
                  {m.sync.panel.autoSync}
                </label>
                <p id="nutstore-auto-sync-help">{m.sync.panel.autoSyncHelp}</p>
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
              aria-label={m.sync.panel.connectAria}
              onSubmit={(event) => void submitConnect(event)}
            >
              <label htmlFor="nutstore-server-url">
                {m.sync.panel.serverUrl}
              </label>
              <GlassInput
                id="nutstore-server-url"
                aria-label={m.sync.panel.serverUrl}
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
                {m.sync.panel.serverUrlHelp}
              </p>
              <label htmlFor="nutstore-username">{m.sync.panel.username}</label>
              <GlassInput
                id="nutstore-username"
                aria-label={m.sync.panel.username}
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
              <label htmlFor="nutstore-password">{m.sync.panel.password}</label>
              <GlassInput
                id="nutstore-password"
                aria-label={m.sync.panel.password}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  editDraft({ password: event.target.value })
                }
                placeholder={m.sync.panel.passwordPlaceholder}
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
                    aria-label={
                      showPassword
                        ? m.sync.panel.hidePassword
                        : m.sync.panel.showPassword
                    }
                    aria-pressed={showPassword}
                    title={
                      showPassword
                        ? m.sync.panel.hidePassword
                        : m.sync.panel.showPassword
                    }
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
                  {activeAction === "connect"
                    ? m.sync.panel.connecting
                    : m.sync.panel.connect}
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
              {m.sync.panel.previewBefore} <code>npm run mock:webdav</code>{" "}
              {m.sync.panel.previewAfterMock}{" "}
              <code>http://127.0.0.1:8787/dav</code>
              {m.sync.panel.previewEnd}
            </GlassSurface>
          )}
          <GlassSurface
            className="settings-note nutstore-manual"
            cornerRadius={26}
            data-testid="nutstore-manual"
            {...base}
          >
            <p>{m.sync.panel.manualSteps}</p>
            <p>
              <a href={MANUAL_URL} target="_blank" rel="noreferrer">
                {m.sync.panel.manualLink}
              </a>
            </p>
            <p className="nutstore-security">{m.sync.panel.security}</p>
            <p>{m.sync.panel.privacy}</p>
          </GlassSurface>
        </>
      )}
    </div>
  );
}
