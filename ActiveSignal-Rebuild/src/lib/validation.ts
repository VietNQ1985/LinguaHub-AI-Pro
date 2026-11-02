import { isISODate } from "./dates.ts";
import type { BotIconKey, BotItem, Channel, Contact, Conversation, Message, Notice, Preferences, TaskItem, TaskStatus, Tone } from "../types/models";

export interface DecodeResult<T> {
  value: T;
  dropped: number;
  repaired: number;
}

type ItemDecoder<T> = (value: unknown) => { value: T; repaired: boolean } | null;

const tones: readonly Tone[] = ["blue", "mint", "orange", "purple", "rose", "gold"];
const validChannels: readonly Channel[] = ["Nội bộ", "Zalo", "WhatsApp", "Teams"];
const validStatuses: readonly TaskStatus[] = ["Mới", "Đang làm", "Hoàn tất"];
const validBotIcons: readonly BotIconKey[] = ["sparkles", "activity", "bot"];

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function tone(value: unknown): { value: Tone; repaired: boolean } {
  return tones.includes(value as Tone) ? { value: value as Tone, repaired: false } : { value: "blue", repaired: true };
}

function decodeList<T>(raw: unknown, decoder: ItemDecoder<T>): DecodeResult<T[]> | null {
  if (!Array.isArray(raw)) return null;
  const value: T[] = [];
  let dropped = 0;
  let repaired = 0;
  for (const item of raw) {
    const decoded = decoder(item);
    if (!decoded) {
      dropped += 1;
      continue;
    }
    value.push(decoded.value);
    if (decoded.repaired) repaired += 1;
  }
  return { value, dropped, repaired };
}

function decodeConversation(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()) return null;
  const selectedTone = tone(item.tone);
  const channel = validChannels.includes(item.channel as Channel) ? item.channel as Channel : "Nội bộ";
  const unread = Number.isFinite(item.unread) ? Math.max(0, Math.floor(Number(item.unread))) : 0;
  const online = typeof item.online === "boolean" ? item.online : undefined;
  return {
    value: {
      id: item.id.trim(),
      name: item.name.trim(),
      channel,
      lastMessage: text(item.lastMessage),
      time: text(item.time),
      unread,
      tone: selectedTone.value,
      ...(online === undefined ? {} : { online }),
    } satisfies Conversation,
    repaired: selectedTone.repaired || channel !== item.channel || unread !== item.unread || (item.online !== undefined && online === undefined) || typeof item.lastMessage !== "string" || typeof item.time !== "string",
  };
}

function decodeMessage(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.conversationId !== "string" || !item.conversationId.trim() || typeof item.text !== "string") return null;
  const author = typeof item.author === "string" && item.author.trim() ? item.author.trim() : "Người dùng";
  const time = text(item.time, "");
  const sentAt = typeof item.sentAt === "string" && !Number.isNaN(Date.parse(item.sentAt)) ? item.sentAt : undefined;
  const mine = typeof item.mine === "boolean" ? item.mine : undefined;
  return {
    value: {
      id: item.id.trim(),
      conversationId: item.conversationId.trim(),
      author,
      text: item.text,
      time,
      ...(sentAt ? { sentAt } : {}),
      ...(mine === undefined ? {} : { mine }),
    } satisfies Message,
    repaired: author !== item.author || typeof item.time !== "string" || (item.sentAt !== undefined && sentAt === undefined) || (item.mine !== undefined && mine === undefined),
  };
}

function decodeContact(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()) return null;
  const selectedTone = tone(item.tone);
  const name = item.name.trim();
  const initials = typeof item.initials === "string" && item.initials.trim() ? item.initials.trim() : name.split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase("vi-VN") ?? "").join("");
  const email = text(item.email).trim();
  const company = text(item.company, "Chưa phân loại").trim() || "Chưa phân loại";
  return {
    value: { id: item.id.trim(), name, company, email, tone: selectedTone.value, initials } satisfies Contact,
    repaired: selectedTone.repaired || initials !== item.initials || email !== item.email || company !== item.company,
  };
}

function decodeTask(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.title !== "string" || !item.title.trim()) return null;
  const selectedTone = tone(item.tone);
  const status = validStatuses.includes(item.status as TaskStatus) ? item.status as TaskStatus : "Mới";
  const oldDue = typeof item.due === "string" ? item.due.trim() : "";
  const dateCandidate = isISODate(item.dueDate) ? item.dueDate : isISODate(oldDue) ? oldDue : null;
  const legacyDueLabel = typeof item.legacyDueLabel === "string" && item.legacyDueLabel.trim()
    ? item.legacyDueLabel.trim()
    : (!dateCandidate && oldDue ? oldDue : undefined);
  const value: TaskItem = {
    id: item.id.trim(),
    title: item.title.trim(),
    details: text(item.details, "Chưa có mô tả."),
    status,
    dueDate: dateCandidate,
    ...(legacyDueLabel ? { legacyDueLabel } : {}),
    owner: text(item.owner, "Tôi").trim() || "Tôi",
    tone: selectedTone.value,
  };
  return {
    value,
    repaired: selectedTone.repaired || status !== item.status || item.dueDate !== dateCandidate || oldDue !== "" || typeof item.details !== "string" || typeof item.owner !== "string",
  };
}

function decodeBot(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.name !== "string" || !item.name.trim()) return null;
  const selectedTone = tone(item.tone);
  const iconKey = validBotIcons.includes(item.iconKey as BotIconKey)
    ? item.iconKey as BotIconKey
    : item.id === "bot-01" ? "sparkles" : item.id === "bot-02" ? "activity" : "bot";
  const value: BotItem = {
    id: item.id.trim(),
    name: item.name.trim(),
    description: text(item.description, "Chưa có mô tả."),
    active: typeof item.active === "boolean" ? item.active : false,
    tone: selectedTone.value,
    iconKey,
  };
  return { value, repaired: selectedTone.repaired || iconKey !== item.iconKey || typeof item.active !== "boolean" || typeof item.description !== "string" };
}

function decodeNotice(raw: unknown) {
  const item = objectValue(raw);
  if (!item || typeof item.id !== "string" || !item.id.trim() || typeof item.title !== "string" || !item.title.trim()) return null;
  const selectedTone = tone(item.tone);
  const value: Notice = {
    id: item.id.trim(),
    title: item.title.trim(),
    body: text(item.body),
    time: text(item.time),
    read: typeof item.read === "boolean" ? item.read : false,
    tone: selectedTone.value,
  };
  return { value, repaired: selectedTone.repaired || typeof item.body !== "string" || typeof item.time !== "string" || typeof item.read !== "boolean" };
}

export const decodeConversations = (raw: unknown) => decodeList(raw, decodeConversation);
export const decodeMessages = (raw: unknown) => decodeList(raw, decodeMessage);
export const decodeContacts = (raw: unknown) => decodeList(raw, decodeContact);
export const decodeTasks = (raw: unknown) => decodeList(raw, decodeTask);
export const decodeBots = (raw: unknown) => decodeList(raw, decodeBot);
export const decodeNotices = (raw: unknown) => decodeList(raw, decodeNotice);

export function decodePreferences(raw: unknown, fallback: Preferences): DecodeResult<Preferences> | null {
  const item = objectValue(raw);
  if (!item) return null;
  const value: Preferences = {
    dark: typeof item.dark === "boolean" ? item.dark : fallback.dark,
    desktopAlerts: typeof item.desktopAlerts === "boolean" ? item.desktopAlerts : fallback.desktopAlerts,
    compact: typeof item.compact === "boolean" ? item.compact : fallback.compact,
  };
  const repaired = typeof item.dark !== "boolean" || typeof item.desktopAlerts !== "boolean" || typeof item.compact !== "boolean";
  return { value, dropped: 0, repaired: repaired ? 1 : 0 };
}

export function decodeSelectedConversation(raw: unknown): DecodeResult<string> | null {
  if (typeof raw !== "string") return null;
  return { value: raw, dropped: 0, repaired: 0 };
}
