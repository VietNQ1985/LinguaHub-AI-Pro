const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("signalDesk", {
  getZaloStatus: () => ipcRenderer.invoke("zalo:get-status"),
  openZalo: () => ipcRenderer.invoke("zalo:open"),
  focusZalo: () => ipcRenderer.invoke("zalo:focus"),
  reloadZalo: () => ipcRenderer.invoke("zalo:reload"),
  setZaloViewBounds: (bounds) => ipcRenderer.invoke("zalo:set-bounds", bounds),
  resetZaloSession: () => ipcRenderer.invoke("zalo:reset-session"),
  onZaloStatus: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("zalo:status", listener);
    return () => ipcRenderer.removeListener("zalo:status", listener);
  },
});
