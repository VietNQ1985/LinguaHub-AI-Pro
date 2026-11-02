import type { BotItem, Channel, Contact, Conversation, Message, TaskItem, TaskStatus } from "../types/models";

export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi-VN");
}

export function searchTerms(...queries: string[]): string[] {
  return queries.flatMap((query) => normalizeSearchText(query).trim().split(/\s+/).filter(Boolean));
}

export function filterConversations(
  conversations: Conversation[],
  messages: Message[],
  options: { globalQuery?: string; localQuery?: string; channel?: Channel | "Tất cả"; unreadOnly?: boolean } = {},
): Conversation[] {
  const terms = searchTerms(options.globalQuery ?? "", options.localQuery ?? "");
  return conversations.filter((conversation) => {
    if (options.unreadOnly && conversation.unread <= 0) return false;
    if (options.channel && options.channel !== "Tất cả" && conversation.channel !== options.channel) return false;
    if (terms.length === 0) return true;
    const messageText = messages.filter((message) => message.conversationId === conversation.id).map((message) => message.text).join(" ");
    const searchable = normalizeSearchText(`${conversation.name} ${conversation.lastMessage} ${conversation.channel} ${messageText}`);
    return terms.every((term) => searchable.includes(term));
  });
}

export function filterContacts(contacts: Contact[], ...queries: string[]): Contact[] {
  const terms = searchTerms(...queries);
  if (terms.length === 0) return contacts;
  return contacts.filter((contact) => {
    const searchable = normalizeSearchText(`${contact.name} ${contact.company} ${contact.email}`);
    return terms.every((term) => searchable.includes(term));
  });
}

export function totalUnread(conversations: Conversation[]): number {
  return conversations.reduce((total, conversation) => total + Math.max(0, conversation.unread), 0);
}

export function markConversationRead(conversations: Conversation[], conversationId: string): Conversation[] {
  if (!conversations.some((conversation) => conversation.id === conversationId && conversation.unread > 0)) return conversations;
  return conversations.map((conversation) => conversation.id === conversationId && conversation.unread > 0 ? { ...conversation, unread: 0 } : conversation);
}

export function markAllConversationsRead(conversations: Conversation[]): Conversation[] {
  return conversations.some((conversation) => conversation.unread > 0)
    ? conversations.map((conversation) => conversation.unread > 0 ? { ...conversation, unread: 0 } : conversation)
    : conversations;
}

export function chooseVisibleConversation(filtered: Conversation[], selectedId: string): Conversation | undefined {
  return filtered.find((conversation) => conversation.id === selectedId) ?? filtered[0];
}

export function upsertContact(contacts: Contact[], contact: Contact): Contact[] {
  const exists = contacts.some((item) => item.id === contact.id);
  return exists ? contacts.map((item) => item.id === contact.id ? contact : item) : [contact, ...contacts];
}

export function deleteContact(contacts: Contact[], contactId: string): Contact[] {
  return contacts.filter((contact) => contact.id !== contactId);
}

export function upsertTask(tasks: TaskItem[], task: TaskItem): TaskItem[] {
  const exists = tasks.some((item) => item.id === task.id);
  return exists ? tasks.map((item) => item.id === task.id ? task : item) : [task, ...tasks];
}

export function updateTaskStatus(tasks: TaskItem[], taskId: string, status: TaskStatus): TaskItem[] {
  return tasks.map((task) => task.id === taskId ? { ...task, status } : task);
}

export function deleteTask(tasks: TaskItem[], taskId: string): TaskItem[] {
  return tasks.filter((task) => task.id !== taskId);
}

export function upsertBot(bots: BotItem[], bot: BotItem): BotItem[] {
  const exists = bots.some((item) => item.id === bot.id);
  return exists ? bots.map((item) => item.id === bot.id ? bot : item) : [bot, ...bots];
}

export function deleteBot(bots: BotItem[], botId: string): BotItem[] {
  return bots.filter((bot) => bot.id !== botId);
}

export function getConversationMessages(messages: Message[], conversationId: string): Message[] {
  return messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.conversationId === conversationId)
    .sort((left, right) => {
      if (!left.message.sentAt || !right.message.sentAt) return left.index - right.index;
      return Date.parse(left.message.sentAt) - Date.parse(right.message.sentAt) || left.index - right.index;
    })
    .map(({ message }) => message);
}
