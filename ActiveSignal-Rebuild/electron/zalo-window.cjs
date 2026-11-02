const ZALO_PARTITION = "persist:signaldesk-zalo";
const DEFAULT_ZALO_URL = "https://id.zalo.me";

function isAllowedZaloUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (!url.port || url.port === "443")
      && (url.hostname === "zalo.me" || url.hostname.endsWith(".zalo.me"));
  } catch {
    return false;
  }
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function createZaloWindowManager({ BrowserWindow, shell, getSession, getParentWindow, notifyStatus, confirmReset, startUrl = DEFAULT_ZALO_URL }) {
  let zaloWindow = null;
  let state = { status: "closed", error: null };

  function publish(status, error = null) {
    state = { status, error };
    notifyStatus?.(state);
    return state;
  }

  function focus() {
    if (!zaloWindow || zaloWindow.isDestroyed()) return open();
    if (zaloWindow.isMinimized()) zaloWindow.restore();
    zaloWindow.show();
    zaloWindow.focus();
    return state;
  }

  function routeExternal(event, destination) {
    if (isAllowedZaloUrl(destination)) return false;
    event.preventDefault();
    if (isHttpsUrl(destination)) void shell.openExternal(destination);
    return true;
  }

  function open(destination = startUrl) {
    if (!isAllowedZaloUrl(destination)) return publish("failed", "Địa chỉ Zalo không hợp lệ.");
    if (zaloWindow && !zaloWindow.isDestroyed()) return focus();

    publish("opening");
    zaloWindow = new BrowserWindow({
      parent: getParentWindow?.(),
      width: 1280,
      height: 860,
      minWidth: 800,
      minHeight: 600,
      title: "Zalo",
      backgroundColor: "#ffffff",
      autoHideMenuBar: true,
      webPreferences: {
        partition: ZALO_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const currentWindow = zaloWindow;
    currentWindow.webContents.on("did-start-loading", () => publish("loading"));
    currentWindow.webContents.on("did-finish-load", () => publish("ready"));
    currentWindow.webContents.on("did-fail-load", (_event, errorCode, _description, _validatedUrl, isMainFrame) => {
      if (isMainFrame && errorCode !== -3) publish("failed", "Zalo không tải được. Kiểm tra mạng rồi thử tải lại.");
    });
    currentWindow.webContents.on("render-process-gone", () => publish("failed", "Cửa sổ Zalo gặp lỗi. Hãy tải lại trang."));
    currentWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (isAllowedZaloUrl(url) && zaloWindow && !zaloWindow.isDestroyed()) {
        void zaloWindow.loadURL(url).catch(() => publish("failed", "Zalo không mở được địa chỉ này."));
      } else if (isHttpsUrl(url)) {
        void shell.openExternal(url);
      }
      return { action: "deny" };
    });
    currentWindow.webContents.on("will-navigate", routeExternal);
    currentWindow.webContents.on("will-redirect", routeExternal);
    currentWindow.on("closed", () => {
      if (zaloWindow === currentWindow) {
        zaloWindow = null;
        publish("closed");
      }
    });

    void currentWindow.loadURL(destination).catch(() => publish("failed", "Zalo không tải được. Kiểm tra mạng rồi thử lại."));
    return state;
  }

  function reload() {
    if (!zaloWindow || zaloWindow.isDestroyed()) return open();
    publish("loading");
    zaloWindow.webContents.reload();
    return state;
  }

  async function resetSession() {
    const approved = await confirmReset?.();
    if (!approved) return { cancelled: true, state };

    if (zaloWindow && !zaloWindow.isDestroyed()) zaloWindow.close();
    const session = getSession?.();
    if (!session) return { cancelled: false, error: "Không thể mở phiên lưu Zalo." };

    try {
      await session.clearStorageData();
      await session.clearCache();
      publish("closed");
      return { cancelled: false, state };
    } catch {
      publish("failed", "Không thể xóa phiên Zalo trên máy này.");
      return { cancelled: false, error: state.error };
    }
  }

  return {
    open,
    focus,
    reload,
    resetSession,
    getStatus: () => state,
    getWindow: () => zaloWindow,
    partition: ZALO_PARTITION,
    startUrl: DEFAULT_ZALO_URL,
  };
}

module.exports = { DEFAULT_ZALO_URL, ZALO_PARTITION, createZaloWindowManager, isAllowedZaloUrl };
