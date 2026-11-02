const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createZaloWindowManager, DEFAULT_ZALO_URL, ZALO_PARTITION, isAllowedZaloUrl } = require("../electron/zalo-window.cjs");

class FakeWebContents extends EventEmitter {
  setWindowOpenHandler(handler) { this.openHandler = handler; }
  reload() { this.reloadCount = (this.reloadCount ?? 0) + 1; this.emit("did-start-loading"); }
}

class FakeBrowserWindow extends EventEmitter {
  static created = [];
  constructor(options) {
    super();
    this.options = options;
    this.webContents = new FakeWebContents();
    this.destroyed = false;
    this.minimized = false;
    this.focusCount = 0;
    this.loadedUrls = [];
    FakeBrowserWindow.created.push(this);
  }
  loadURL(url) {
    this.loadedUrls.push(url);
    this.webContents.emit("did-start-loading");
    this.webContents.emit("did-finish-load");
    return Promise.resolve();
  }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return this.minimized; }
  restore() { this.minimized = false; this.restored = true; }
  show() { this.shown = true; }
  focus() { this.focusCount += 1; }
  close() { this.destroyed = true; this.emit("closed"); }
}

function setup(confirmReset = async () => true) {
  FakeBrowserWindow.created = [];
  const cleared = [];
  const session = {
    clearStorageData: async () => cleared.push("storage"),
    clearCache: async () => cleared.push("cache"),
  };
  const external = [];
  const states = [];
  const manager = createZaloWindowManager({
    BrowserWindow: FakeBrowserWindow,
    shell: { openExternal: async (url) => external.push(url) },
    getSession: () => session,
    getParentWindow: () => undefined,
    notifyStatus: (state) => states.push(state),
    confirmReset,
  });
  return { manager, cleared, external, states };
}

test("allows secure Zalo domains and rejects lookalikes, credentials, and insecure URLs", () => {
  assert.equal(isAllowedZaloUrl(DEFAULT_ZALO_URL), true);
  assert.equal(isAllowedZaloUrl("https://chat.zalo.me/path"), true);
  assert.equal(isAllowedZaloUrl("https://zalo.me.evil.example"), false);
  assert.equal(isAllowedZaloUrl("http://zalo.me"), false);
  assert.equal(isAllowedZaloUrl("https://user@zalo.me"), false);
  assert.equal(isAllowedZaloUrl("https://zalo.me:8443"), false);
});

test("opens one isolated persistent window and focuses the existing window", () => {
  const { manager } = setup();
  manager.open();
  const first = manager.getWindow();
  assert.equal(first.options.webPreferences.partition, ZALO_PARTITION);
  assert.equal(first.options.webPreferences.nodeIntegration, false);
  assert.equal(first.options.webPreferences.contextIsolation, true);
  assert.equal(first.options.webPreferences.sandbox, true);
  assert.equal(first.loadedUrls[0], DEFAULT_ZALO_URL);
  assert.equal(manager.getStatus().status, "ready");

  first.minimized = true;
  manager.open("https://chat.zalo.me");
  assert.equal(FakeBrowserWindow.created.length, 1);
  assert.equal(first.restored, true);
  assert.equal(first.shown, true);
  assert.equal(first.focusCount, 1);
});

test("closing keeps the persistent session and reset requires explicit confirmation", async () => {
  const cancelled = setup(async () => false);
  cancelled.manager.open();
  cancelled.manager.getWindow().close();
  assert.deepEqual(cancelled.cleared, []);
  const result = await cancelled.manager.resetSession();
  assert.equal(result.cancelled, true);
  assert.deepEqual(cancelled.cleared, []);

  const approved = setup(async () => true);
  approved.manager.open();
  approved.manager.getWindow().close();
  assert.deepEqual(approved.cleared, []);
  const resetResult = await approved.manager.resetSession();
  assert.equal(resetResult.cancelled, false);
  assert.deepEqual(approved.cleared, ["storage", "cache"]);
  assert.equal(approved.manager.getStatus().status, "closed");
});

test("reports navigation failures and opens non-Zalo HTTPS links externally", () => {
  const { manager, external } = setup();
  manager.open();
  const window = manager.getWindow();
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  window.webContents.emit("will-navigate", event, "https://example.com/help");
  assert.equal(event.prevented, true);
  assert.deepEqual(external, ["https://example.com/help"]);

  window.webContents.emit("did-fail-load", {}, -105, "offline", DEFAULT_ZALO_URL, true);
  assert.equal(manager.getStatus().status, "failed");
  assert.match(manager.getStatus().error, /không tải được/);
});
