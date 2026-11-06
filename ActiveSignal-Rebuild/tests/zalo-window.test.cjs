const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createZaloWindowManager, DEFAULT_ZALO_URL, ZALO_PARTITION, isAllowedZaloUrl } = require("../electron/zalo-window.cjs");

class FakeWebContents extends EventEmitter {
  setWindowOpenHandler(handler) { this.openHandler = handler; }
  loadURL(url) {
    this.loadedUrls ??= [];
    this.loadedUrls.push(url);
    this.emit("did-start-loading");
    this.emit("did-finish-load");
    return Promise.resolve();
  }
  reload() { this.reloadCount = (this.reloadCount ?? 0) + 1; this.emit("did-start-loading"); }
  focus() { this.focusCount = (this.focusCount ?? 0) + 1; }
  isDestroyed() { return this.destroyed === true; }
  close(options) {
    this.closeOptions = options;
    this.destroyed = true;
    this.emit("destroyed");
  }
}

class FakeWebContentsView {
  static created = [];
  constructor(options) {
    this.options = options;
    this.webContents = new FakeWebContents();
    this.visible = true;
    FakeWebContentsView.created.push(this);
  }
  setBounds(bounds) { this.bounds = bounds; }
  setVisible(visible) { this.visible = visible; }
  getVisible() { return this.visible; }
  setBorderRadius(radius) { this.borderRadius = radius; }
}

class FakeContentView {
  constructor() { this.children = []; }
  addChildView(view) { this.children.push(view); }
  removeChildView(view) { this.children = this.children.filter((child) => child !== view); }
}

class FakeParentWindow {
  constructor() {
    this.contentView = new FakeContentView();
    this.contentSize = [1200, 800];
  }
  getContentSize() { return this.contentSize; }
  isDestroyed() { return false; }
}

function setup(confirmReset = async () => true) {
  FakeWebContentsView.created = [];
  const parent = new FakeParentWindow();
  const cleared = [];
  const session = {
    clearStorageData: async () => cleared.push("storage"),
    clearCache: async () => cleared.push("cache"),
  };
  const external = [];
  const states = [];
  const manager = createZaloWindowManager({
    WebContentsView: FakeWebContentsView,
    shell: { openExternal: async (url) => external.push(url) },
    getSession: () => session,
    getParentWindow: () => parent,
    notifyStatus: (state) => states.push(state),
    confirmReset,
  });
  return { manager, parent, cleared, external, states };
}

test("allows secure Zalo domains and rejects lookalikes, credentials, and insecure URLs", () => {
  assert.equal(isAllowedZaloUrl(DEFAULT_ZALO_URL), true);
  assert.equal(isAllowedZaloUrl("https://chat.zalo.me/path"), true);
  assert.equal(isAllowedZaloUrl("https://zalo.me.evil.example"), false);
  assert.equal(isAllowedZaloUrl("http://zalo.me"), false);
  assert.equal(isAllowedZaloUrl("https://user@zalo.me"), false);
  assert.equal(isAllowedZaloUrl("https://zalo.me:8443"), false);
});

test("attaches one isolated persistent Zalo view to the main app window", () => {
  const { manager, parent } = setup();
  manager.open();
  const view = manager.getView();

  assert.equal(FakeWebContentsView.created.length, 1);
  assert.equal(parent.contentView.children[0], view);
  assert.equal(view.options.webPreferences.partition, ZALO_PARTITION);
  assert.equal(view.options.webPreferences.nodeIntegration, false);
  assert.equal(view.options.webPreferences.contextIsolation, true);
  assert.equal(view.options.webPreferences.sandbox, true);
  assert.equal(view.webContents.loadedUrls[0], DEFAULT_ZALO_URL);
  assert.equal(view.borderRadius, 9);
  assert.equal(view.getVisible(), false);
  assert.equal(manager.getStatus().status, "ready");

  manager.open("https://chat.zalo.me");
  assert.equal(FakeWebContentsView.created.length, 1);
  assert.equal(parent.contentView.children.length, 1);
});

test("clips the embedded view to the main window and hides it when the Zalo page is left", () => {
  const { manager, parent, cleared } = setup();
  manager.open();
  const view = manager.getView();

  assert.equal(manager.setBounds({ x: -20, y: 30, width: 300, height: 900 }), true);
  assert.deepEqual(view.bounds, { x: 0, y: 30, width: 280, height: 770 });
  assert.equal(view.getVisible(), true);

  assert.equal(manager.setBounds(null), true);
  assert.equal(view.getVisible(), false);
  assert.equal(manager.getView(), view);
  assert.equal(parent.contentView.children[0], view);
  assert.deepEqual(cleared, []);

  manager.setBounds({ x: 80, y: 60, width: 500, height: 400 });
  assert.equal(view.getVisible(), true);
  assert.deepEqual(view.bounds, { x: 80, y: 60, width: 500, height: 400 });
});

test("focus and reload operate on the existing embedded view", () => {
  const { manager } = setup();
  manager.open();
  const view = manager.getView();
  manager.focus();
  manager.reload();

  assert.equal(view.webContents.focusCount, 1);
  assert.equal(view.webContents.reloadCount, 1);
  assert.equal(manager.getStatus().status, "loading");
});

test("reset requires confirmation and only then destroys the view and clears its partition", async () => {
  const cancelled = setup(async () => false);
  cancelled.manager.open();
  const retainedView = cancelled.manager.getView();
  const cancelledResult = await cancelled.manager.resetSession();
  assert.equal(cancelledResult.cancelled, true);
  assert.equal(cancelled.manager.getView(), retainedView);
  assert.equal(cancelled.parent.contentView.children[0], retainedView);
  assert.deepEqual(cancelled.cleared, []);

  const approved = setup(async () => true);
  approved.manager.open();
  const removedView = approved.manager.getView();
  const result = await approved.manager.resetSession();
  assert.equal(result.cancelled, false);
  assert.equal(approved.manager.getView(), null);
  assert.deepEqual(approved.parent.contentView.children, []);
  assert.deepEqual(removedView.webContents.closeOptions, { waitForBeforeUnload: false });
  assert.deepEqual(approved.cleared, ["storage", "cache"]);
  assert.equal(approved.manager.getStatus().status, "closed");
});

test("blocks non-Zalo navigation and opens other HTTPS links externally", () => {
  const { manager, external } = setup();
  manager.open();
  const view = manager.getView();
  const event = { prevented: false, preventDefault() { this.prevented = true; } };
  view.webContents.emit("will-navigate", event, "https://example.com/help");
  assert.equal(event.prevented, true);
  assert.deepEqual(external, ["https://example.com/help"]);

  const popup = view.webContents.openHandler({ url: "https://chat.zalo.me/messages" });
  assert.deepEqual(popup, { action: "deny" });
  assert.equal(view.webContents.loadedUrls.at(-1), "https://chat.zalo.me/messages");

  view.webContents.emit("did-fail-load", {}, -105, "offline", DEFAULT_ZALO_URL, true);
  assert.equal(manager.getStatus().status, "failed");
  assert.match(manager.getStatus().error, /không tải được/);
});

test("rejects invalid destinations and detaches cleanly when the app closes", () => {
  const { manager, parent } = setup();
  manager.open("https://zalo.me.evil.example");
  assert.equal(manager.getStatus().status, "failed");
  assert.equal(manager.getView(), null);

  manager.open();
  const view = manager.getView();
  manager.detach();
  assert.equal(manager.getView(), null);
  assert.deepEqual(parent.contentView.children, []);
  assert.equal(view.webContents.isDestroyed(), true);
  assert.equal(manager.getStatus().status, "closed");
});
