import { Activity, Bell, Building2, ChevronDown, ChevronRight, Search, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordDialog, NavButton } from "./components/ui";
import { defaultPreferences, initialBots, initialContacts, initialConversations, initialMessages, initialNotices, initialTasks, pageTitles, primaryNav } from "./data/initialState";
import { BotsPage } from "./features/bots/BotsPage";
import { ChatPage } from "./features/chat/ChatPage";
import { ContactsPage } from "./features/contacts/ContactsPage";
import { InboxPage } from "./features/inbox/InboxPage";
import { NotificationsPage } from "./features/notifications/NotificationsPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { TasksPage } from "./features/tasks/TasksPage";
import { ZaloPage } from "./features/zalo/ZaloPage";
import { makeId } from "./lib/ids";
import { deleteBot, deleteContact, deleteTask, markAllConversationsRead, markConversationRead, totalUnread, updateTaskStatus, upsertBot, upsertContact, upsertTask } from "./lib/records";
import { usePersistentState } from "./hooks/usePersistentState";
import { decodeBots, decodeContacts, decodeConversations, decodeMessages, decodeNotices, decodePreferences, decodeSelectedConversation, decodeTasks } from "./lib/validation";
import type { BotItem, Contact, Conversation, Message, ModalKind, PageKey, TaskItem } from "./types/models";
import type { RecordDialogDraft } from "./types/record-dialog";

interface EditorState {
  kind: ModalKind;
  id?: string;
}

function formatTime(date = new Date()): string {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function App() {
  const [page, setPage] = useState<PageKey>("chat");
  const [conversations, setConversations, conversationsWarning] = usePersistentState("conversations", initialConversations, decodeConversations);
  const [messages, setMessages, messagesWarning] = usePersistentState("messages", initialMessages, decodeMessages);
  const [contacts, setContacts, contactsWarning] = usePersistentState("contacts", initialContacts, decodeContacts);
  const [tasks, setTasks, tasksWarning] = usePersistentState("tasks", initialTasks, decodeTasks);
  const [bots, setBots, botsWarning] = usePersistentState("bots", initialBots, decodeBots);
  const [notices, setNotices, noticesWarning] = usePersistentState("notices", initialNotices, decodeNotices);
  const [preferences, setPreferences, preferencesWarning] = usePersistentState("preferences", defaultPreferences, (value) => decodePreferences(value, defaultPreferences));
  const [selectedConversationId, setSelectedConversationId] = usePersistentState("selectedConversation", "conv-01", decodeSelectedConversation);
  const [globalQuery, setGlobalQuery] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [toast, setToast] = useState("");
  const [infoOpen, setInfoOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const globalSearchRef = useRef<HTMLInputElement>(null);

  const storageWarnings = useMemo(() => [...new Set([conversationsWarning, messagesWarning, contactsWarning, tasksWarning, botsWarning, noticesWarning, preferencesWarning].filter((item): item is string => Boolean(item)))], [conversationsWarning, messagesWarning, contactsWarning, tasksWarning, botsWarning, noticesWarning, preferencesWarning]);
  const unreadNotices = notices.filter((notice) => !notice.read).length;
  const unreadMessages = totalUnread(conversations);

  const notify = useCallback((message: string, system = true) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3200);
    if (system && preferences.desktopAlerts && "Notification" in window && window.Notification.permission === "granted") {
      try { new window.Notification("SignalDesk", { body: message }); } catch { /* The in-app toast remains available. */ }
    }
  }, [preferences.desktopAlerts]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (conversations.length === 0) {
      if (selectedConversationId) setSelectedConversationId("");
      return;
    }
    if (!conversations.some((conversation) => conversation.id === selectedConversationId)) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId, setSelectedConversationId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        globalSearchRef.current?.focus();
      } else if (key === "f") {
        event.preventDefault();
        const localSearch = page === "chat" ? document.querySelector<HTMLInputElement>("[data-chat-search]") : page === "inbox" ? document.querySelector<HTMLInputElement>("[aria-label='Tìm trong hộp thư']") : null;
        (localSearch ?? globalSearchRef.current)?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [page]);

  function openPage(nextPage: PageKey) {
    setPage(nextPage);
    setGlobalQuery("");
  }

  function selectConversation(id: string, markRead = true) {
    setSelectedConversationId(id);
    if (markRead) setConversations((current) => markConversationRead(current, id));
  }

  function sendMessage(text: string, conversationId = selectedConversationId) {
    const content = text.trim();
    if (!content || !conversationId) return;
    const now = new Date();
    const message: Message = { id: makeId("message"), conversationId, author: "Tôi", text: content, time: formatTime(now), sentAt: now.toISOString(), mine: true };
    setMessages((current) => [...current, message]);
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, lastMessage: content, time: "Vừa xong", unread: 0 } : conversation));
  }

  function openContactChat(contact: Contact) {
    const found = conversations.find((conversation) => conversation.name.toLocaleLowerCase("vi-VN") === contact.name.toLocaleLowerCase("vi-VN"));
    if (found) selectConversation(found.id);
    else {
      const created: Conversation = { id: makeId("conversation"), name: contact.name, channel: "Nội bộ", lastMessage: "Bắt đầu cuộc trò chuyện mới.", time: "Vừa xong", unread: 0, tone: contact.tone };
      setConversations((current) => [created, ...current]);
      setSelectedConversationId(created.id);
    }
    openPage("chat");
  }

  function editorInitial() {
    if (!editor) return undefined;
    if (editor.kind === "contact") {
      const contact = contacts.find((item) => item.id === editor.id);
      return contact ? { name: contact.name, detail: contact.company, extra: contact.email } : undefined;
    }
    if (editor.kind === "task") {
      const task = tasks.find((item) => item.id === editor.id);
      return task ? { name: task.title, detail: task.details, extra: task.dueDate ?? "", hint: task.legacyDueLabel } : undefined;
    }
    if (editor.kind === "bot") {
      const bot = bots.find((item) => item.id === editor.id);
      return bot ? { name: bot.name, detail: bot.description, iconKey: bot.iconKey } : undefined;
    }
    if (editor.id) {
      const conversation = conversations.find((item) => item.id === editor.id);
      return conversation ? { name: conversation.name, detail: "" } : undefined;
    }
    return undefined;
  }

  function saveEditor(draft: RecordDialogDraft) {
    if (!editor) return;
    const id = editor.id ?? makeId(editor.kind);
    if (editor.kind === "contact") {
      const old = contacts.find((contact) => contact.id === editor.id);
      const next: Contact = { id, name: draft.name, company: draft.detail || "Chưa phân loại", email: draft.extra, tone: old?.tone ?? "blue", initials: draft.name.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toLocaleUpperCase("vi-VN") ?? "").join("") };
      setContacts((current) => upsertContact(current, next));
      openPage("contacts");
      notify(editor.id ? "Đã cập nhật liên hệ." : "Đã thêm liên hệ vào danh bạ cục bộ.");
    } else if (editor.kind === "task") {
      const old = tasks.find((task) => task.id === editor.id);
      const next: TaskItem = { id, title: draft.name, details: draft.detail || "Chưa có mô tả.", status: old?.status ?? "Mới", dueDate: draft.extra || null, ...(draft.extra ? {} : old?.legacyDueLabel ? { legacyDueLabel: old.legacyDueLabel } : {}), owner: old?.owner ?? "Tôi", tone: old?.tone ?? "blue" };
      setTasks((current) => upsertTask(current, next));
      openPage("tasks");
      notify(editor.id ? "Đã cập nhật công việc." : "Đã tạo việc mới.");
    } else if (editor.kind === "bot") {
      const old = bots.find((bot) => bot.id === editor.id);
      const next: BotItem = { id, name: draft.name, description: draft.detail || "Chưa có mô tả.", active: old?.active ?? false, tone: old?.tone ?? "purple", iconKey: draft.iconKey };
      setBots((current) => upsertBot(current, next));
      openPage("bots");
      notify(editor.id ? "Đã cập nhật hồ sơ bot." : "Đã lưu hồ sơ bot cục bộ.");
    } else if (editor.id) {
      setConversations((current) => current.map((conversation) => conversation.id === editor.id ? { ...conversation, name: draft.name } : conversation));
      openPage("chat");
      notify("Đã cập nhật tên hội thoại.");
    } else {
      const group = editor.kind === "group";
      const created: Conversation = { id: makeId("conversation"), name: draft.name, channel: "Nội bộ", lastMessage: draft.detail || (group ? "Nhóm cục bộ đã tạo." : "Bắt đầu cuộc trò chuyện mới."), time: "Vừa xong", unread: 0, tone: "blue" };
      setConversations((current) => [created, ...current]);
      if (draft.detail && !group) {
        const now = new Date();
        setMessages((current) => [...current, { id: makeId("message"), conversationId: created.id, author: "Tôi", text: draft.detail, time: formatTime(now), sentAt: now.toISOString(), mine: true }]);
      }
      setSelectedConversationId(created.id);
      openPage("chat");
      notify(group ? "Đã tạo nhóm cục bộ." : "Đã tạo hội thoại cục bộ.");
    }
    setEditor(null);
  }

  async function toggleDesktopAlerts() {
    if (!("Notification" in window)) {
      setPreferences((current) => ({ ...current, desktopAlerts: false }));
      notify("Thông báo Windows không khả dụng trong môi trường này.", false);
      return;
    }
    const currentPermission = window.Notification.permission;
    if (preferences.desktopAlerts && currentPermission === "granted") {
      setPreferences((current) => ({ ...current, desktopAlerts: false }));
      notify("Đã tắt thông báo trên màn hình.", false);
      return;
    }
    const permission = currentPermission === "default" ? await window.Notification.requestPermission() : currentPermission;
    if (permission !== "granted") {
      setPreferences((current) => ({ ...current, desktopAlerts: false }));
      notify("Windows chưa cấp quyền thông báo cho SignalDesk.", false);
      return;
    }
    setPreferences((current) => ({ ...current, desktopAlerts: true }));
    notify("Đã bật thông báo trên màn hình.", false);
  }

  function renderContent() {
    switch (page) {
      case "chat":
        return <ChatPage conversations={conversations} messages={messages} selectedConversationId={selectedConversationId} query={globalQuery} infoOpen={infoOpen} onSelectConversation={selectConversation} onSend={sendMessage} onNewChat={() => setEditor({ kind: "chat" })} onNewGroup={() => setEditor({ kind: "group" })} onToggleInfo={() => setInfoOpen((value) => !value)} />;
      case "contacts":
        return <ContactsPage contacts={contacts} query={globalQuery} onAdd={() => setEditor({ kind: "contact" })} onEdit={(contact) => setEditor({ kind: "contact", id: contact.id })} onDelete={(id) => { setContacts((current) => deleteContact(current, id)); notify("Đã xóa liên hệ."); }} onOpenChat={openContactChat} />;
      case "tasks":
        return <TasksPage tasks={tasks} query={globalQuery} onAdd={() => setEditor({ kind: "task" })} onEdit={(task) => setEditor({ kind: "task", id: task.id })} onDelete={(task) => { if (window.confirm(`Xóa công việc “${task.title}”?`)) { setTasks((current) => deleteTask(current, task.id)); notify("Đã xóa công việc."); } }} onChangeStatus={(id, status) => setTasks((current) => updateTaskStatus(current, id, status))} />;
      case "zalo":
        return <ZaloPage notify={notify} />;
      case "inbox":
        return <InboxPage conversations={conversations} messages={messages} globalQuery={globalQuery} onSend={sendMessage} onOpenChat={(id) => { selectConversation(id); openPage("chat"); }} onMarkRead={(id) => setConversations((current) => markConversationRead(current, id))} onReadAll={() => { setConversations((current) => markAllConversationsRead(current)); notify("Đã đánh dấu các hội thoại là đã đọc."); }} />;
      case "bots":
        return <BotsPage bots={bots} onCreate={() => setEditor({ kind: "bot" })} onEdit={(bot) => setEditor({ kind: "bot", id: bot.id })} onDelete={(bot) => { if (window.confirm(`Xóa hồ sơ bot “${bot.name}”?`)) { setBots((current) => deleteBot(current, bot.id)); notify("Đã xóa hồ sơ bot."); } }} onToggle={(id) => setBots((current) => current.map((bot) => bot.id === id ? { ...bot, active: !bot.active } : bot))} />;
      case "notifications":
        return <NotificationsPage notices={notices} onRead={(id) => setNotices((current) => current.map((notice) => notice.id === id ? { ...notice, read: true } : notice))} onReadAll={() => setNotices((current) => current.map((notice) => ({ ...notice, read: true })))} />;
      case "settings":
        return <SettingsPage preferences={preferences} alertsEnabled={preferences.desktopAlerts && "Notification" in window && window.Notification.permission === "granted"} onChange={(key, value) => setPreferences((current) => ({ ...current, [key]: value }))} onAlertsChange={() => void toggleDesktopAlerts()} />;
    }
  }

  return <div className={`app-shell ${preferences.dark ? "theme-dark" : ""} ${preferences.compact ? "compact-mode" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
    <aside className="sidebar"><div className="brand-row"><div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div><div className="brand-copy"><strong>SignalDesk</strong><span>Workspace cục bộ</span></div><button className="icon-button collapse-button" title={collapsed ? "Mở rộng menu" : "Thu gọn menu"} aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}><ChevronDown size={16} /></button></div>
      <div className="workspace-picker" aria-label="Không gian làm việc cục bộ"><div className="workspace-logo"><Building2 size={16} /></div><span><strong>Không gian cá nhân</strong><small>Dữ liệu trên thiết bị</small></span></div>
      <div className="nav-label">KHÔNG GIAN</div><nav className="primary-nav" aria-label="Điều hướng chính">{primaryNav.map((item) => <NavButton key={item.key} item={item} active={page === item.key} badge={item.key === "chat" && unreadMessages ? unreadMessages : undefined} onClick={() => openPage(item.key)} />)}</nav>
      <div className="sidebar-spacer" /><div className="nav-label">CÁ NHÂN</div><NavButton item={{ key: "notifications", label: "Thông báo", icon: Bell }} active={page === "notifications"} badge={unreadNotices || undefined} onClick={() => openPage("notifications")} /><NavButton item={{ key: "settings", label: "Cài đặt", icon: Settings }} active={page === "settings"} onClick={() => openPage("settings")} />
      <div className="sidebar-footer"><div className="user-avatar">SD</div><div className="user-copy"><strong>Hồ sơ cục bộ</strong><small>Chỉ trên thiết bị</small></div></div>
    </aside>
    <main className="workspace-main"><header className="topbar"><div className="page-heading"><span className="breadcrumb">SignalDesk</span><ChevronRight size={14} /><h1>{pageTitles[page]}</h1></div><div className="topbar-actions"><label className="global-search"><Search size={16} /><input ref={globalSearchRef} aria-label="Tìm trong workspace" placeholder="Tìm kiếm..." value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} /><kbd>Ctrl+K</kbd></label><span className="prototype-pill"><span /> Dữ liệu trên máy</span><button className="top-avatar" title="Mở cài đặt" aria-label="Mở cài đặt" onClick={() => openPage("settings")}>SD</button></div></header>
      {storageWarnings.length > 0 && <div className="storage-warning" role="alert"><div><strong>Một số dữ liệu cần được kiểm tra</strong><span>{storageWarnings.join(" ")}</span></div></div>}
      <div className="page-content" key={page}>{renderContent()}</div>
    </main>
    {editor && <RecordDialog key={`${editor.kind}-${editor.id ?? "new"}`} kind={editor.kind} initial={editorInitial()} onClose={() => setEditor(null)} onSave={saveEditor} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

export default App;
