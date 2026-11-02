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

function createZaloWindowManager({ WebContentsView, shell, getSession, getParentWindow, notifyStatus, confirmReset, startUrl = DEFAULT_ZALO_URL }) {
  let zaloView = null;
  let state = { status: "closed", error: null };

  function publish(status, error = null) {
    state = { status, error };
    notifyStatus?.(state);
    return state;
  }

  function currentView() {
    return zaloView && !zaloView.webContents.isDestroyed() ? zaloView : null;
  }

  function setBounds(bounds) {
    const view = currentView();
    if (!view) return false;

    if (bounds === null) {
      view.setVisible(false);
      return true;
    }

    const parent = getParentWindow?.();
    if (!parent || parent.isDestroyed() || !bounds || typeof bounds !== "object") {
      view.setVisible(false);
      return false;
    }

    const values = [bounds.x, bounds.y, bounds.width, bounds.height];
    if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) {
      view.setVisible(false);
      return false;
    }

    const [contentWidth, contentHeight] = parent.getContentSize();
    if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth <= 0 || contentHeight <= 0) {
      view.setVisible(false);
      return false;
    }

    const x = Math.max(0, Math.min(contentWidth, Math.floor(bounds.x)));
    const y = Math.max(0, Math.min(contentHeight, Math.floor(bounds.y)));
    const right = Math.max(x, Math.min(contentWidth, Math.ceil(bounds.x + bounds.width)));
    const bottom = Math.max(y, Math.min(contentHeight, Math.ceil(bounds.y + bounds.height)));
    const width = right - x;
    const height = bottom - y;
    const visible = width > 0 && height > 0;

    if (visible) view.setBounds({ x, y, width, height });
    view.setVisible(visible);
    return visible;
  }

  function disposeView() {
    const view = zaloView;
    zaloView = null;
    if (!view) return;

    view.setVisible(false);
    const parent = getParentWindow?.();
    if (parent && !parent.isDestroyed()) parent.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close({ waitForBeforeUnload: false });
  }

  function focus() {
    const view = currentView();
    if (!view) return open();
    view.webContents.focus();
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
    const existing = currentView();
    if (existing) return focus();

    const parent = getParentWindow?.();
    if (!WebContentsView || !parent || parent.isDestroyed()) {
      return publish("failed", "Không thể gắn Zalo vào cửa sổ SignalDesk.");
    }

    publish("opening");
    try {
      const view = new WebContentsView({
        webPreferences: {
          partition: ZALO_PARTITION,
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      });
      zaloView = view;
      parent.contentView.addChildView(view);
      view.setBorderRadius(9);
      view.setVisible(false);

      const isCurrent = () => zaloView === view && !view.webContents.isDestroyed();
      view.webContents.on("did-start-loading", () => { if (isCurrent()) publish("loading"); });
      view.webContents.on("did-finish-load", () => { if (isCurrent()) publish("ready"); });
      view.webContents.on("did-fail-load", (_event, errorCode, _description, _validatedUrl, isMainFrame) => {
        if (isCurrent() && isMainFrame && errorCode !== -3) publish("failed", "Zalo không tải được. Kiểm tra mạng rồi thử tải lại.");
      });
      view.webContents.on("render-process-gone", () => {
        if (isCurrent()) publish("failed", "Khung Zalo gặp lỗi. Hãy tải lại trang.");
      });
      view.webContents.once("destroyed", () => {
        if (zaloView !== view) return;
        parent.contentView.removeChildView(view);
        zaloView = null;
        publish("closed");
      });
      view.webContents.setWindowOpenHandler(({ url }) => {
        if (isAllowedZaloUrl(url) && isCurrent()) {
          void view.webContents.loadURL(url).catch(() => publish("failed", "Zalo không mở được địa chỉ này."));
        } else if (isHttpsUrl(url)) {
          void shell.openExternal(url);
        }
        return { action: "deny" };
      });
      view.webContents.on("will-navigate", routeExternal);
      view.webContents.on("will-redirect", routeExternal);

      void view.webContents.loadURL(destination).catch(() => {
        if (isCurrent()) publish("failed", "Zalo không tải được. Kiểm tra mạng rồi thử lại.");
      });
    } catch {
      disposeView();
      return publish("failed", "Không thể mở khung Zalo trong SignalDesk.");
    }

    return state;
  }

  function reload() {
    const view = currentView();
    if (!view) return open();
    publish("loading");
    try {
      view.webContents.reload();
    } catch {
      return publish("failed", "Không thể tải lại Zalo.");
    }
    return state;
  }

  async function resetSession() {
    const session = getSession?.();
    if (!session) {
      publish("failed", "Không thể mở phiên lưu Zalo.");
      return { cancelled: false, error: state.error };
    }

    const approved = await confirmReset?.();
    if (!approved) return { cancelled: true, state };

    disposeView();
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

  function detach() {
    disposeView();
    publish("closed");
  }

  return {
    open,
    focus,
    reload,
    setBounds,
    resetSession,
    detach,
    getStatus: () => state,
    getView: () => zaloView,
    partition: ZALO_PARTITION,
    startUrl: DEFAULT_ZALO_URL,
  };
}

module.exports = { DEFAULT_ZALO_URL, ZALO_PARTITION, createZaloWindowManager, isAllowedZaloUrl };
