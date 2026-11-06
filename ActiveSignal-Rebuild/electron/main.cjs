const { app, BrowserWindow, WebContentsView, dialog, ipcMain, session, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { createZaloWindowManager, isAllowedZaloUrl, ZALO_PARTITION } = require("./zalo-window.cjs");

let mainWindow = null;
let zaloManager = null;

function isMainAppUrl(value) {
  try {
    const target = new URL(value);
    if (!app.isPackaged && process.env.SIGNALDESK_DEV_URL) {
      return target.origin === new URL(process.env.SIGNALDESK_DEV_URL).origin;
    }
    const appFile = pathToFileURL(path.join(__dirname, "..", "dist", "index.html")).href;
    return target.href === appFile;
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "SignalDesk",
    backgroundColor: "#f6f8fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;
  window.on("closed", () => {
    if (mainWindow === window) {
      zaloManager?.detach();
      mainWindow = null;
    }
  });

  if (!app.isPackaged && process.env.SIGNALDESK_DEV_URL) {
    void window.loadURL(process.env.SIGNALDESK_DEV_URL);
  } else {
    void window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedZaloUrl(url)) zaloManager?.open(url);
    else if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isMainAppUrl(url)) return;
    event.preventDefault();
    if (url.startsWith("https://")) void shell.openExternal(url);
  });
}

function createZaloManager() {
  const zaloSession = session.fromPartition(ZALO_PARTITION);
  zaloSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  zaloManager = createZaloWindowManager({
    WebContentsView,
    shell,
    getParentWindow: () => mainWindow,
    getSession: () => zaloSession,
    notifyStatus: (state) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("zalo:status", state);
    },
    confirmReset: async () => {
      const parent = mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
      const options = {
        type: "warning",
        buttons: ["Hủy", "Xóa phiên Zalo"],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        message: "Xóa phiên đăng nhập Zalo trên SignalDesk?",
        detail: "Anh sẽ cần đăng nhập lại trên máy này. Việc này không đăng xuất tài khoản trên điện thoại hoặc thiết bị khác.",
      };
      const { response } = parent
        ? await dialog.showMessageBox(parent, options)
        : await dialog.showMessageBox(options);
      return response === 1;
    },
  });
}

function registerIpc() {
  const isTrustedRenderer = (event) => Boolean(mainWindow && !mainWindow.isDestroyed()
    && event.sender === mainWindow.webContents
    && event.senderFrame === mainWindow.webContents.mainFrame);
  ipcMain.handle("zalo:get-status", (event) => isTrustedRenderer(event) ? zaloManager?.getStatus() ?? { status: "closed", error: null } : { status: "closed", error: "Nguồn yêu cầu không hợp lệ." });
  ipcMain.handle("zalo:open", (event) => isTrustedRenderer(event) ? zaloManager?.open() ?? { status: "closed", error: null } : { status: "closed", error: "Nguồn yêu cầu không hợp lệ." });
  ipcMain.handle("zalo:focus", (event) => isTrustedRenderer(event) ? zaloManager?.focus() ?? { status: "closed", error: null } : { status: "closed", error: "Nguồn yêu cầu không hợp lệ." });
  ipcMain.handle("zalo:reload", (event) => isTrustedRenderer(event) ? zaloManager?.reload() ?? { status: "closed", error: null } : { status: "closed", error: "Nguồn yêu cầu không hợp lệ." });
  ipcMain.handle("zalo:set-bounds", (event, bounds) => isTrustedRenderer(event) ? zaloManager?.setBounds(bounds) ?? false : false);
  ipcMain.handle("zalo:reset-session", (event) => isTrustedRenderer(event) ? zaloManager?.resetSession() ?? { cancelled: true, state: { status: "closed", error: null } } : { cancelled: true, state: { status: "closed", error: "Nguồn yêu cầu không hợp lệ." } });
}

app.whenReady().then(() => {
  app.setAppUserModelId("local.signaldesk.workspace");
  createWindow();
  createZaloManager();
  registerIpc();

  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
