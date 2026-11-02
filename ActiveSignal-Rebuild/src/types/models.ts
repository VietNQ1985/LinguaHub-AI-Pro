import type { LucideIcon } from "lucide-react";

export type PageKey = "chat" | "contacts" | "tasks" | "zalo" | "inbox" | "bots" | "notifications" | "settings";
export type Channel = "Nội bộ" | "Zalo" | "WhatsApp" | "Teams";
export type TaskStatus = "Mới" | "Đang làm" | "Hoàn tất";
export type ModalKind = "chat" | "group" | "contact" | "task" | "bot";
export type BotIconKey = "sparkles" | "activity" | "bot";
export type Tone = "blue" | "mint" | "orange" | "purple" | "rose" | "gold";

export interface NavItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
}

export interface Conversation {
  id: string;
  name: string;
  channel: Channel;
  lastMessage: string;
  time: string;
  unread: number;
  tone: Tone;
  online?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  author: string;
  text: string;
  time: string;
  sentAt?: string;
  mine?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  tone: Tone;
  initials: string;
}

export interface TaskItem {
  id: string;
  title: string;
  details: string;
  status: TaskStatus;
  dueDate: string | null;
  legacyDueLabel?: string;
  owner: string;
  tone: Tone;
}

export interface BotItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  tone: Tone;
  iconKey: BotIconKey;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  tone: Tone;
}

export interface Preferences {
  dark: boolean;
  desktopAlerts: boolean;
  compact: boolean;
}

export type RecordUpdate<T> = (records: T[]) => T[];
