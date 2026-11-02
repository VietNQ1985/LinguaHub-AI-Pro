import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseVisibleConversation,
  deleteBot,
  deleteContact,
  deleteTask,
  filterContacts,
  filterConversations,
  getConversationMessages,
  markAllConversationsRead,
  markConversationRead,
  totalUnread,
  updateTaskStatus,
  upsertBot,
  upsertContact,
  upsertTask,
} from "../src/lib/records.ts";

const conversations = [
  { id: "c1", name: "Hà My Nguyễn", channel: "Nội bộ", lastMessage: "Đã cập nhật", time: "10:00", unread: 2, tone: "blue" },
  { id: "c2", name: "Minh Phạm", channel: "Zalo", lastMessage: "Xin chào", time: "09:00", unread: 0, tone: "mint" },
  { id: "c3", name: "Nhóm Kế hoạch", channel: "Teams", lastMessage: "Chuẩn bị tài liệu", time: "08:00", unread: 1, tone: "orange" },
];
const messages = [
  { id: "m1", conversationId: "c1", author: "Hà My", text: "Kế hoạch tuần đã xong", time: "10:00" },
  { id: "m2", conversationId: "c1", author: "Tôi", text: "Cảm ơn em", time: "10:01", sentAt: "2026-10-10T10:01:00.000Z", mine: true },
  { id: "m3", conversationId: "c2", author: "Minh", text: "Xin chào", time: "09:00" },
];

test("combined searches match all words across conversation metadata and message history", () => {
  const shown = filterConversations(conversations, messages, { globalQuery: "ha", localQuery: "ke hoach" });
  assert.deepEqual(shown.map((item) => item.id), ["c1"]);
  assert.deepEqual(filterConversations(conversations, messages, { globalQuery: "ke hoach", channel: "Zalo" }), []);
});

test("filters by unread state and channel; read counts update", () => {
  assert.deepEqual(filterConversations(conversations, messages, { unreadOnly: true }).map((item) => item.id), ["c1", "c3"]);
  assert.deepEqual(filterConversations(conversations, messages, { channel: "Zalo" }).map((item) => item.id), ["c2"]);
  assert.equal(totalUnread(conversations), 3);
  const next = markConversationRead(conversations, "c1");
  assert.equal(next[0].unread, 0);
  assert.equal(totalUnread(next), 1);
  assert.equal(markConversationRead(next, "missing"), next);
  assert.deepEqual(markAllConversationsRead(next).map((item) => item.unread), [0, 0, 0]);
});

test("visible selection falls back to the first filtered row", () => {
  assert.equal(chooseVisibleConversation(conversations.slice(1), "c1").id, "c2");
  assert.equal(chooseVisibleConversation([], "c1"), undefined);
});

test("contact, task, and bot operations support upsert and delete", () => {
  const contact = { id: "p1", name: "Mai", company: "Nhóm A", email: "mai@example.com", tone: "blue", initials: "M" };
  const contacts = upsertContact([], contact);
  assert.equal(filterContacts(contacts, "mai example").length, 1);
  assert.deepEqual(deleteContact(contacts, "p1"), []);

  const task = { id: "t1", title: "Gọi lại khách hàng", details: "", status: "Mới", dueDate: null, owner: "Tôi", tone: "blue" };
  const tasks = upsertTask([], task);
  assert.equal(updateTaskStatus(tasks, "t1", "Đang làm")[0].status, "Đang làm");
  assert.deepEqual(deleteTask(tasks, "t1"), []);

  const bot = { id: "b1", name: "Bot", description: "", active: false, tone: "blue", iconKey: "bot" };
  assert.deepEqual(deleteBot(upsertBot([], bot), "b1"), []);
});

test("orders timestamped messages while preserving original order for legacy messages", () => {
  const timestamped = [
    { id: "new", conversationId: "c1", author: "Tôi", text: "Mới", time: "10:05", sentAt: "2026-10-10T10:05:00.000Z" },
    { id: "old", conversationId: "c1", author: "Tôi", text: "Cũ", time: "10:01", sentAt: "2026-10-10T10:01:00.000Z" },
  ];
  assert.deepEqual(getConversationMessages(timestamped, "c1").map((item) => item.id), ["old", "new"]);
  const legacy = [messages[1], messages[0]];
  assert.deepEqual(getConversationMessages(legacy, "c1").map((item) => item.id), ["m2", "m1"]);
  assert.deepEqual(getConversationMessages(messages, "missing"), []);
});
