const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");

let zaloWindow = null;

function isZaloUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "zalo.me" || url.hostname.endsWith(".zalo.me"));
  } catch {
    return false;
  }
}

function openZaloWindow(url) {
  if (zaloWindow && !zaloWindow.isDestroyed()) {
    zaloWindow.focus();
    return;
  }

  zaloWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "Zalo",
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      partition: "persist:signaldesk-zalo",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const window = zaloWindow;
  window.on("closed", () => {
    if (zaloWindow === window) zaloWindow = null;
  });

  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isZaloUrl(targetUrl)) {
      if (zaloWindow && !zaloWindow.isDestroyed()) void zaloWindow.loadURL(targetUrl);
    } else if (targetUrl.startsWith("https://")) {
      void shell.openExternal(targetUrl);
    }
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (isZaloUrl(targetUrl)) return;
    event.preventDefault();
    if (targetUrl.startsWith("https://")) void shell.openExternal(targetUrl);
  });

  void window.loadURL(url);
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    title: "SignalDesk",
    backgroundColor: "#f6f8fb",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged && process.env.SIGNALDESK_DEV_URL) {
    window.loadURL(process.env.SIGNALDESK_DEV_URL);
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isZaloUrl(url)) openZaloWindow(url);
    else if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("local.signaldesk.workspace");
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
