import test from "node:test";
import assert from "node:assert/strict";
import { loadPersistedValue, savePersistedValue, STORAGE_SCHEMA_VERSION } from "../src/lib/persistence.ts";
import { decodeBots, decodeContacts, decodePreferences, decodeTasks } from "../src/lib/validation.ts";

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, value); },
  };
}

test("migrates legacy keys into a versioned envelope without deleting originals", () => {
  const oldValue = [{ id: "bot-01", name: "Trợ lý", description: "Lưu cục bộ", active: true, tone: "blue" }];
  const rawLegacy = JSON.stringify(oldValue);
  const storage = memoryStorage({ "signaldesk.bots": rawLegacy });

  const loaded = loadPersistedValue(storage, "bots", [], decodeBots);
  assert.equal(loaded.source, "legacy");
  assert.equal(loaded.needsMigration, true);
  assert.equal(loaded.value[0].iconKey, "sparkles");
  assert.equal(loaded.value[0].active, true);

  assert.deepEqual(savePersistedValue(storage, "bots", loaded.value), { ok: true });
  const saved = JSON.parse(storage.getItem("signaldesk.v2.bots"));
  assert.equal(saved.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.deepEqual(saved.data, loaded.value);
  assert.equal(storage.getItem("signaldesk.bots"), rawLegacy);
});

test("repairs partial contact and task records and reports that recovery is needed", () => {
  const rawValue = [
    { id: "contact-1", name: "  Hà My  ", email: 42, tone: "unknown" },
    { id: "", name: "Bản ghi lỗi" },
  ];
  const storage = memoryStorage({ "signaldesk.v2.contacts": JSON.stringify({ schemaVersion: 2, data: rawValue }) });
  const loaded = loadPersistedValue(storage, "contacts", [], decodeContacts);
  assert.equal(loaded.source, "current");
  assert.match(loaded.warning, /1 mục lỗi được bỏ qua/);
  assert.match(loaded.warning, /1 mục được sửa/);
  assert.equal(loaded.value[0].name, "Hà My");
  assert.equal(loaded.value[0].email, "");
  assert.equal(loaded.value[0].tone, "blue");

  const oldTask = decodeTasks([{ id: "task-1", title: "Việc", due: "Tuần sau" }]);
  assert.equal(oldTask.value[0].legacyDueLabel, "Tuần sau");
  assert.equal(oldTask.value[0].dueDate, null);
});

test("keeps corrupt JSON intact on load and creates a recovery copy before the next save", () => {
  const brokenRaw = "{broken-json";
  const storage = memoryStorage({ "signaldesk.v2.contacts": brokenRaw });
  const loaded = loadPersistedValue(storage, "contacts", [], decodeContacts);
  assert.equal(loaded.source, "invalid");
  assert.equal(loaded.rawToPreserve, brokenRaw);
  assert.equal(storage.getItem("signaldesk.v2.contacts"), brokenRaw);

  const saved = savePersistedValue(storage, "contacts", [], loaded.rawToPreserve);
  assert.deepEqual(saved, { ok: true });
  assert.equal(storage.getItem("signaldesk.recovery.contacts"), brokenRaw);
  assert.deepEqual(JSON.parse(storage.getItem("signaldesk.v2.contacts")).data, []);
});

test("loads saved preferences and uses safe defaults for missing values", () => {
  const fallback = { dark: false, desktopAlerts: true, compact: false };
  const decoded = decodePreferences({ dark: true }, fallback);
  assert.deepEqual(decoded.value, { dark: true, desktopAlerts: true, compact: false });
  assert.equal(decoded.repaired, 1);
});

test("does not overwrite storage when saving fails", () => {
  const storage = {
    getItem: () => null,
    setItem: () => { throw new Error("quota"); },
  };
  const result = savePersistedValue(storage, "tasks", [{ id: "1" }]);
  assert.equal(result.ok, false);
  assert.match(result.message, /Không đủ chỗ/);
});
