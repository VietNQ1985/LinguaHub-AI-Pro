import {
  Activity,
  Bell,
  Bot,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  Hash,
  Inbox,
  Info,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Smile,
  Sparkles,
  Sun,
  Moon,
  UserRound,
  Users,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

type PageKey = "chat" | "contacts" | "tasks" | "zalo" | "inbox" | "bots" | "notifications" | "settings";
type Channel = "Nội bộ" | "Zalo" | "WhatsApp" | "Teams";
type TaskStatus = "Mới" | "Đang làm" | "Hoàn tất";
type ModalKind = "chat" | "group" | "contact" | "task" | "bot";

interface NavItem {
  key: PageKey;
  label: string;
  icon: LucideIcon;
}

interface Conversation {
  id: string;
  name: string;
  channel: Channel;
  lastMessage: string;
  time: string;
  unread: number;
  tone: string;
  online?: boolean;
}

interface Message {
  id: string;
  conversationId: string;
  author: string;
  text: string;
  time: string;
  mine?: boolean;
}

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  tone: string;
  initials: string;
}

interface TaskItem {
  id: string;
  title: string;
  details: string;
  status: TaskStatus;
  due: string;
  owner: string;
  tone: string;
}

interface BotItem {
  id: string;
  name: string;
  description: string;
  active: boolean;
  tone: string;
  icon: LucideIcon;
}

interface Notice {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  tone: string;
}

interface Preferences {
  dark: boolean;
  desktopAlerts: boolean;
  compact: boolean;
}

const primaryNav: NavItem[] = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "contacts", label: "Danh bạ", icon: Users },
  { key: "tasks", label: "Việc", icon: CheckSquare },
  { key: "zalo", label: "Zalo", icon: Smartphone },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "bots", label: "AI Bots", icon: Bot },
];

const pageTitles: Record<PageKey, string> = {
  chat: "Chat",
  contacts: "Danh bạ",
  tasks: "Việc cần làm",
  zalo: "Zalo",
  inbox: "Inbox",
  bots: "AI Bots",
  notifications: "Thông báo",
  settings: "Cài đặt",
};

const initialConversations: Conversation[] = [
  { id: "conv-01", name: "Hà My Nguyễn", channel: "Nội bộ", lastMessage: "Em đã gửi bản cập nhật mới rồi nhé.", time: "10:42", unread: 2, tone: "mint", online: true },
  { id: "conv-02", name: "Nhóm Sản phẩm", channel: "Nội bộ", lastMessage: "Tuấn: Mình chốt lịch vào chiều thứ Năm.", time: "09:58", unread: 0, tone: "blue" },
  { id: "conv-03", name: "Minh Phạm", channel: "Zalo", lastMessage: "Cảm ơn anh, em sẽ phản hồi trong hôm nay.", time: "Hôm qua", unread: 1, tone: "orange", online: true },
  { id: "conv-04", name: "Linh Trần", channel: "Teams", lastMessage: "Tài liệu đã được chia sẻ trong nhóm.", time: "T2", unread: 0, tone: "purple" },
  { id: "conv-05", name: "CSKH · Ca sáng", channel: "WhatsApp", lastMessage: "Đã tiếp nhận yêu cầu hỗ trợ.", time: "T2", unread: 0, tone: "rose" },
];

const initialMessages: Message[] = [
  { id: "m-01", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Chào anh, em vừa cập nhật lại bản kế hoạch theo góp ý của nhóm.", time: "10:31" },
  { id: "m-02", conversationId: "conv-01", author: "Tôi", text: "Cảm ơn My. Phần tiến độ tuần này đã có đủ đầu việc chưa em?", time: "10:35", mine: true },
  { id: "m-03", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Dạ đủ rồi ạ. Em cũng đã thêm người phụ trách và ngày dự kiến cho từng mục.", time: "10:38" },
  { id: "m-04", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Em đã gửi bản cập nhật mới rồi nhé.", time: "10:42" },
  { id: "m-05", conversationId: "conv-02", author: "Tuấn Lê", text: "Mình chốt lịch vào chiều thứ Năm nhé.", time: "09:58" },
  { id: "m-06", conversationId: "conv-03", author: "Minh Phạm", text: "Cảm ơn anh, em sẽ phản hồi trong hôm nay.", time: "15:14" },
  { id: "m-07", conversationId: "conv-04", author: "Linh Trần", text: "Tài liệu đã được chia sẻ trong nhóm.", time: "14:20" },
  { id: "m-08", conversationId: "conv-05", author: "CSKH · Ca sáng", text: "Đã tiếp nhận yêu cầu hỗ trợ.", time: "08:42" },
];

const initialContacts: Contact[] = [
  { id: "contact-01", name: "Hà My Nguyễn", company: "Khối Sản phẩm", email: "hamy@example.com", tone: "mint", initials: "HM" },
  { id: "contact-02", name: "Minh Phạm", company: "Kinh doanh", email: "minh.pham@example.com", tone: "orange", initials: "MP" },
  { id: "contact-03", name: "Linh Trần", company: "Vận hành", email: "linh.tran@example.com", tone: "purple", initials: "LT" },
  { id: "contact-04", name: "Tuấn Lê", company: "Khối Sản phẩm", email: "tuan.le@example.com", tone: "blue", initials: "TL" },
  { id: "contact-05", name: "An Hoàng", company: "Chăm sóc khách hàng", email: "an.hoang@example.com", tone: "rose", initials: "AH" },
  { id: "contact-06", name: "Thảo Võ", company: "Tài chính", email: "thao.vo@example.com", tone: "gold", initials: "TV" },
];

const initialTasks: TaskItem[] = [
  { id: "task-01", title: "Hoàn thiện kế hoạch tháng 11", details: "Rà soát mốc công việc và cập nhật người phụ trách.", status: "Đang làm", due: "Hôm nay", owner: "Hà My", tone: "mint" },
  { id: "task-02", title: "Gửi tài liệu onboarding", details: "Chuẩn bị tài liệu giới thiệu cho thành viên mới.", status: "Mới", due: "03 Thg 11", owner: "Tuấn Lê", tone: "blue" },
  { id: "task-03", title: "Tổng hợp phản hồi khách hàng", details: "Gom các ý kiến nổi bật trong tuần.", status: "Mới", due: "04 Thg 11", owner: "An Hoàng", tone: "rose" },
  { id: "task-04", title: "Cập nhật quy trình tiếp nhận", details: "Đã hoàn tất bản nháp quy trình mới.", status: "Hoàn tất", due: "30 Thg 10", owner: "Linh Trần", tone: "purple" },
];

const initialBots: BotItem[] = [
  { id: "bot-01", name: "Trợ lý bán hàng", description: "Tóm tắt nhu cầu và gợi ý bước tiếp theo cho đội kinh doanh.", active: true, tone: "blue", icon: Sparkles },
  { id: "bot-02", name: "Phân loại yêu cầu", description: "Gắn nhãn hội thoại theo chủ đề và mức độ ưu tiên.", active: true, tone: "mint", icon: Activity },
  { id: "bot-03", name: "Trợ lý nội bộ", description: "Tra cứu hướng dẫn và quy trình của nhóm.", active: false, tone: "purple", icon: Bot },
];

const initialNotices: Notice[] = [
  { id: "notice-01", title: "Bạn được nhắc đến", body: "Hà My đã nhắc đến bạn trong Nhóm Sản phẩm.", time: "10 phút trước", read: false, tone: "blue" },
  { id: "notice-02", title: "Có việc mới được giao", body: "Hoàn thiện kế hoạch tháng 11 · hạn hôm nay.", time: "1 giờ trước", read: false, tone: "mint" },
  { id: "notice-03", title: "Bản tin hoạt động", body: "Có 4 cập nhật mới trong không gian làm việc.", time: "Hôm qua", read: true, tone: "purple" },
];

const defaultPreferences: Preferences = { dark: false, desktopAlerts: true, compact: false };

function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? (JSON.parse(saved) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // The application remains usable when local browser storage is unavailable.
    }
  }, [key, value]);

  return [value, setValue];
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function App() {
  const [page, setPage] = useState<PageKey>("chat");
  const [conversations, setConversations] = usePersistentState("signaldesk.conversations", initialConversations);
  const [messages, setMessages] = usePersistentState("signaldesk.messages", initialMessages);
  const [contacts, setContacts] = usePersistentState("signaldesk.contacts", initialContacts);
  const [tasks, setTasks] = usePersistentState("signaldesk.tasks", initialTasks);
  const [bots, setBots] = usePersistentState("signaldesk.bots", initialBots);
  const [notices, setNotices] = usePersistentState("signaldesk.notices", initialNotices);
  const [preferences, setPreferences] = usePersistentState("signaldesk.preferences", defaultPreferences);
  const [selectedConversationId, setSelectedConversationId] = usePersistentState("signaldesk.selectedConversation", "conv-01");
  const [globalQuery, setGlobalQuery] = useState("");
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [toast, setToast] = useState("");
  const [infoOpen, setInfoOpen] = useState(true);

  const activeConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0];
  const unreadNotices = notices.filter((notice) => !notice.read).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function openPage(nextPage: PageKey) {
    setPage(nextPage);
    setGlobalQuery("");
  }

  function sendMessage(text: string, conversationId = activeConversation?.id) {
    const value = text.trim();
    if (!value || !conversationId) return;
    const time = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    const message: Message = { id: makeId("message"), conversationId, author: "Tôi", text: value, time, mine: true };
    setMessages((current) => [...current, message]);
    setConversations((current) => current.map((conversation) => conversation.id === conversationId ? { ...conversation, lastMessage: value, time: "Vừa xong", unread: 0 } : conversation));
  }

  function createRecord(kind: ModalKind, nameValue: string, detailValue: string, extraValue: string) {
    const name = nameValue.trim();
    if (!name) return;

    if (kind === "contact") {
      setContacts((current) => [{ id: makeId("contact"), name, company: detailValue.trim() || "Chưa phân loại", email: extraValue.trim() || "", tone: "blue", initials: initials(name) }, ...current]);
      openPage("contacts");
      notify("Đã thêm liên hệ vào danh bạ cục bộ.");
    } else if (kind === "task") {
      setTasks((current) => [{ id: makeId("task"), title: name, details: detailValue.trim() || "Chưa có mô tả.", status: "Mới", due: extraValue.trim() || "Chưa đặt hạn", owner: "Tôi", tone: "blue" }, ...current]);
      openPage("tasks");
      notify("Đã tạo việc mới.");
    } else if (kind === "bot") {
      setBots((current) => [{ id: makeId("bot"), name, description: detailValue.trim() || "Bot mới trong không gian mẫu.", active: false, tone: "purple", icon: Bot }, ...current]);
      openPage("bots");
      notify("Đã thêm bot vào danh sách mẫu.");
    } else {
      const newConversation: Conversation = {
        id: makeId("conversation"),
        name: kind === "group" ? name : name,
        channel: "Nội bộ",
        lastMessage: kind === "group" ? "Nhóm mới đã được tạo." : "Bắt đầu cuộc trò chuyện mới.",
        time: "Vừa xong",
        unread: 0,
        tone: "blue",
      };
      setConversations((current) => [newConversation, ...current]);
      setSelectedConversationId(newConversation.id);
      openPage("chat");
      notify(kind === "group" ? "Đã tạo nhóm mẫu." : "Đã mở cuộc trò chuyện mẫu.");
    }
    setModal(null);
  }

  function renderContent() {
    switch (page) {
      case "chat":
        return (
          <ChatPage
            conversations={conversations}
            messages={messages}
            activeConversation={activeConversation}
            selectedConversationId={selectedConversationId}
            query={globalQuery}
            infoOpen={infoOpen}
            onSelectConversation={setSelectedConversationId}
            onSend={sendMessage}
            onNewChat={() => setModal("chat")}
            onNewGroup={() => setModal("group")}
            onToggleInfo={() => setInfoOpen((current) => !current)}
            notify={notify}
          />
        );
      case "contacts":
        return <ContactsPage contacts={contacts} query={globalQuery} onAdd={() => setModal("contact")} notify={notify} />;
      case "tasks":
        return <TasksPage tasks={tasks} query={globalQuery} onAdd={() => setModal("task")} onUpdate={setTasks} />;
      case "zalo":
        return <ZaloPage notify={notify} />;
      case "inbox":
        return <InboxPage conversations={conversations} messages={messages} onSend={sendMessage} onSelect={(id) => { setSelectedConversationId(id); openPage("chat"); }} notify={notify} />;
      case "bots":
        return <BotsPage bots={bots} onCreate={() => setModal("bot")} onToggle={(id) => setBots((current) => current.map((bot) => bot.id === id ? { ...bot, active: !bot.active } : bot))} notify={notify} />;
      case "notifications":
        return <NotificationsPage notices={notices} onRead={(id) => setNotices((current) => current.map((notice) => notice.id === id ? { ...notice, read: true } : notice))} onReadAll={() => setNotices((current) => current.map((notice) => ({ ...notice, read: true })))} />;
      case "settings":
        return <SettingsPage preferences={preferences} onChange={setPreferences} notify={notify} />;
    }
  }

  return (
    <div className={`app-shell ${preferences.dark ? "theme-dark" : ""} ${preferences.compact ? "compact-mode" : ""}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Activity size={19} strokeWidth={2.5} /></div>
          <div className="brand-copy"><strong>SignalDesk</strong><span>Workspace</span></div>
          <button className="icon-button collapse-button" title="Thu menu" onClick={() => notify("Menu trái luôn sẵn sàng trong bản mẫu.")}><ChevronDown size={16} /></button>
        </div>

        <button className="workspace-picker" onClick={() => notify("Đang dùng không gian mẫu.")}>
          <div className="workspace-logo"><Building2 size={16} /></div>
          <span><strong>Công ty mẫu</strong><small>Không gian làm việc</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </button>

        <div className="nav-label">KHÔNG GIAN</div>
        <nav className="primary-nav" aria-label="Điều hướng chính">
          {primaryNav.map((item) => <NavButton key={item.key} item={item} active={page === item.key} onClick={() => openPage(item.key)} />)}
        </nav>

        <div className="sidebar-spacer" />
        <div className="nav-label">CÁ NHÂN</div>
        <NavButton item={{ key: "notifications", label: "Thông báo", icon: Bell }} active={page === "notifications"} badge={unreadNotices || undefined} onClick={() => openPage("notifications")} />
        <NavButton item={{ key: "settings", label: "Cài đặt", icon: Settings }} active={page === "settings"} onClick={() => openPage("settings")} />

        <div className="sidebar-footer">
          <div className="user-avatar">NV</div>
          <div className="user-copy"><strong>Người dùng</strong><small>Thành viên</small></div>
          <button className="icon-button" title="Tùy chọn tài khoản" onClick={() => notify("Tài khoản chỉ được mô phỏng.")}><MoreHorizontal size={18} /></button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <div className="page-heading"><span className="breadcrumb">Workspace</span><ChevronRight size={14} /><h1>{pageTitles[page]}</h1></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input aria-label="Tìm trong workspace" placeholder="Tìm kiếm..." value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
            <span className="prototype-pill"><span /> Bản mẫu cục bộ</span>
            <button className="top-avatar" title="Tài khoản" onClick={() => notify("Tài khoản chỉ được mô phỏng.")}>NV</button>
          </div>
        </header>
        <div className="page-content" key={page}>{renderContent()}</div>
      </main>

      {modal && <CreateDialog kind={modal} onClose={() => setModal(null)} onCreate={(name, detail, extra) => createRecord(modal, name, detail, extra)} />}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function NavButton({ item, active, badge, onClick }: { item: NavItem; active: boolean; badge?: number; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} aria-current={active ? "page" : undefined}>
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} /><span>{item.label}</span>{badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}

function Avatar({ name, tone = "blue", size = "normal", online = false }: { name: string; tone?: string; size?: "small" | "normal" | "large"; online?: boolean }) {
  return <span className={`avatar avatar-${tone} avatar-${size}`}>{initials(name)}{online ? <i className="online-dot" /> : null}</span>;
}

function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

function ChatPage({
  conversations,
  messages,
  activeConversation,
  selectedConversationId,
  query,
  infoOpen,
  onSelectConversation,
  onSend,
  onNewChat,
  onNewGroup,
  onToggleInfo,
  notify,
}: {
  conversations: Conversation[];
  messages: Message[];
  activeConversation?: Conversation;
  selectedConversationId: string;
  query: string;
  infoOpen: boolean;
  onSelectConversation: (id: string) => void;
  onSend: (text: string, conversationId?: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onToggleInfo: () => void;
  notify: (text: string) => void;
}) {
  const [conversationQuery, setConversationQuery] = useState("");
  const [draft, setDraft] = useState("");
  const filtered = conversations.filter((conversation) => `${conversation.name} ${conversation.lastMessage}`.toLowerCase().includes(`${query} ${conversationQuery}`.trim().toLowerCase()));
  const activeMessages = activeConversation ? messages.filter((message) => message.conversationId === activeConversation.id) : [];

  function submit() {
    if (!draft.trim()) return;
    onSend(draft, activeConversation?.id);
    setDraft("");
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className={`chat-layout ${infoOpen ? "with-info" : ""}`}>
      <section className="conversation-panel">
        <div className="panel-heading"><div><h2>Tin nhắn</h2><span>{conversations.length} hội thoại</span></div><div className="heading-actions"><button className="icon-button" title="Chat mới" onClick={onNewChat}><Plus size={18} /></button><button className="icon-button" title="Tạo nhóm" onClick={onNewGroup}><Users size={17} /></button></div></div>
        <label className="search-field"><Search size={16} /><input placeholder="Tìm hội thoại" value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} /><kbd>⌘ F</kbd></label>
        <div className="filter-chips"><button className="chip selected">Tất cả</button><button className="chip" onClick={() => setConversationQuery("")}>Chưa đọc</button><button className="chip" onClick={() => notify("Bộ lọc kênh sẵn sàng khi kết nối dữ liệu.")}>Kênh <ChevronDown size={13} /></button></div>
        <div className="conversation-list">
          {filtered.map((conversation) => (
            <button className={`conversation-row ${selectedConversationId === conversation.id ? "selected" : ""}`} key={conversation.id} onClick={() => onSelectConversation(conversation.id)}>
              <Avatar name={conversation.name} tone={conversation.tone} online={conversation.online} />
              <span className="conversation-copy"><span className="conversation-name">{conversation.name}<small>{conversation.channel}</small></span><span className="conversation-preview">{conversation.lastMessage}</span></span>
              <span className="conversation-meta"><time>{conversation.time}</time>{conversation.unread > 0 && <b>{conversation.unread}</b>}</span>
            </button>
          ))}
          {filtered.length === 0 && <EmptyState icon={Search} title="Không tìm thấy hội thoại" detail="Thử từ khóa khác." />}
        </div>
      </section>

      {activeConversation ? (
        <section className="message-panel">
          <header className="message-header"><div className="message-person"><Avatar name={activeConversation.name} tone={activeConversation.tone} online={activeConversation.online} /><div><strong>{activeConversation.name}</strong><span>{activeConversation.online ? "Đang hoạt động" : activeConversation.channel}</span></div></div><div className="message-header-actions"><button className="icon-button" title="Tìm trong chat" onClick={() => notify("Tìm kiếm trong chat mẫu.")}><Search size={17} /></button><button className="icon-button" title="Gọi" onClick={() => notify("Cuộc gọi chưa được kết nối trong bản mẫu.")}><Phone size={17} /></button><button className="icon-button" title="Họp video" onClick={() => notify("Cuộc họp chưa được kết nối trong bản mẫu.")}><Video size={18} /></button><span className="header-divider" /><button className={`icon-button ${infoOpen ? "icon-active" : ""}`} title="Thông tin" onClick={onToggleInfo}><Info size={18} /></button><button className="icon-button" title="Tùy chọn" onClick={() => notify("Tùy chọn hội thoại mẫu.")}><MoreHorizontal size={18} /></button></div></header>
          <div className="message-stream">
            <div className="date-divider"><span>Hôm nay</span></div>
            {activeMessages.map((message, index) => {
              const previous = activeMessages[index - 1];
              const showAuthor = !message.mine && (!previous || previous.author !== message.author);
              return (
                <div className={`message-line ${message.mine ? "mine" : ""}`} key={message.id}>
                  {!message.mine && <span className="message-avatar-space">{showAuthor && <Avatar name={message.author} tone={activeConversation.tone} size="small" />}</span>}
                  <div className="message-body">{showAuthor && <span className="message-author">{message.author}</span>}<div className={`bubble ${message.mine ? "bubble-mine" : ""}`}>{message.text}</div><div className="message-time">{message.time}{message.mine && <CheckCheck size={13} />}</div></div>
                </div>
              );
            })}
            {activeMessages.length === 0 && <EmptyState icon={MessageCircle} title="Chưa có tin nhắn" detail="Gửi lời chào đầu tiên để bắt đầu." />}
          </div>
          <div className="composer-wrap"><div className="composer-tools"><button className="icon-button" title="Đính kèm" onClick={() => notify("Đính kèm tệp chưa bật trong bản mẫu.")}><Paperclip size={17} /></button><button className="icon-button" title="Biểu cảm" onClick={() => setDraft((current) => `${current}${current ? " " : ""}🙂`)}><Smile size={17} /></button><button className="composer-hint" onClick={() => notify("Phím Enter gửi tin nhắn mẫu.")}><span>Enter</span> để gửi · <span>Shift + Enter</span> xuống dòng</button></div><div className="composer-box"><textarea aria-label="Nội dung tin nhắn" placeholder="Nhập tin nhắn..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} rows={1} /><button className="send-button" aria-label="Gửi" onClick={submit} disabled={!draft.trim()}><Send size={17} /></button></div><p className="local-note">Tin nhắn trong bản mẫu chỉ lưu trên máy này.</p></div>
        </section>
      ) : <section className="message-panel"><EmptyState icon={MessageCircle} title="Chọn một hội thoại" detail="Chọn cuộc trò chuyện ở danh sách bên trái." /></section>}

      {infoOpen && activeConversation && <aside className="conversation-info"><div className="info-heading"><span>Thông tin</span><button className="icon-button" title="Đóng thông tin" onClick={onToggleInfo}><X size={16} /></button></div><div className="profile-card"><Avatar name={activeConversation.name} tone={activeConversation.tone} size="large" online={activeConversation.online} /><h3>{activeConversation.name}</h3><p>{activeConversation.channel === "Nội bộ" ? "Thành viên nội bộ" : `Kênh ${activeConversation.channel}`}</p><div className="profile-actions"><button title="Nhắn tin"><MessageCircle size={16} /></button><button title="Gọi" onClick={() => notify("Cuộc gọi chưa được kết nối.")}><Phone size={16} /></button><button title="Email" onClick={() => notify("Email chưa được kết nối.")}><Mail size={16} /></button></div></div><div className="info-section"><div className="info-section-title"><span>Thông tin liên hệ</span><button className="text-action" onClick={() => notify("Chỉnh sửa thông tin mẫu.")}>Sửa</button></div><InfoRow icon={Mail} label="Email" value="thanhvien@example.com" /><InfoRow icon={Building2} label="Nhóm" value="Không gian mẫu" /><InfoRow icon={Hash} label="Kênh" value={activeConversation.channel} /></div><div className="info-section"><div className="info-section-title"><span>Tệp đã chia sẻ</span><button className="text-action">Xem tất cả</button></div><div className="shared-file"><div className="file-icon"><FileText size={17} /></div><span><strong>Ke_hoach_nhom.pdf</strong><small>PDF · 2,4 MB</small></span><ChevronRight size={15} /></div><div className="shared-file"><div className="file-icon file-spreadsheet"><FileText size={17} /></div><span><strong>Tien_do_thang.xlsx</strong><small>XLSX · 860 KB</small></span><ChevronRight size={15} /></div></div></aside>}
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="info-row"><Icon size={15} /><span>{label}</span><strong>{value}</strong></div>;
}

function ContactsPage({ contacts, query, onAdd, notify }: { contacts: Contact[]; query: string; onAdd: () => void; notify: (text: string) => void }) {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState(contacts[0]?.id ?? "");
  const filtered = contacts.filter((contact) => `${contact.name} ${contact.company} ${contact.email}`.toLowerCase().includes(`${query} ${filter}`.trim().toLowerCase()));
  const selected = contacts.find((contact) => contact.id === selectedId) ?? filtered[0];

  return (
    <div className="standard-page">
      <PageIntro eyebrow="MỌI NGƯỜI" title="Danh bạ" subtitle="Quản lý liên hệ trong không gian làm việc." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Thêm liên hệ</button>} />
      <div className="toolbar-card"><label className="search-field wide-search"><Search size={16} /><input placeholder="Tìm theo tên, nhóm hoặc email" value={filter} onChange={(event) => setFilter(event.target.value)} /></label><button className="secondary-button" onClick={() => notify("Bộ lọc danh bạ mẫu.")}><Filter size={16} /> Bộ lọc</button><button className="secondary-button" onClick={() => notify("Danh bạ đang ở dạng dữ liệu cục bộ.")}><Users size={16} /> {contacts.length} liên hệ</button></div>
      <div className="directory-layout"><section className="directory-card"><div className="table-head"><span>LIÊN HỆ</span><span>NHÓM</span><span>EMAIL</span><span>TRẠNG THÁI</span></div>{filtered.map((contact) => <button className={`directory-row ${selected?.id === contact.id ? "selected" : ""}`} key={contact.id} onClick={() => setSelectedId(contact.id)}><span className="directory-person"><Avatar name={contact.name} tone={contact.tone} size="small" /><strong>{contact.name}</strong></span><span>{contact.company}</span><span className="muted-cell">{contact.email || "Chưa có email"}</span><span><i className="status-dot green" /> Đang hoạt động</span></button>)}{filtered.length === 0 && <EmptyState icon={Users} title="Không có liên hệ phù hợp" detail="Thử đổi từ khóa tìm kiếm." />}</section><aside className="detail-card"><div className="detail-card-top"><span>HỒ SƠ LIÊN HỆ</span><button className="icon-button" onClick={() => notify("Tùy chọn liên hệ mẫu.")}><MoreHorizontal size={18} /></button></div>{selected ? <><div className="contact-profile"><Avatar name={selected.name} tone={selected.tone} size="large" /><h3>{selected.name}</h3><p>{selected.company}</p><button className="secondary-button" onClick={() => notify("Mở hội thoại mẫu.")}><MessageCircle size={15} /> Nhắn tin</button></div><div className="detail-list"><InfoRow icon={Mail} label="Email" value={selected.email || "Chưa có"} /><InfoRow icon={Building2} label="Đơn vị" value={selected.company} /><InfoRow icon={UserRound} label="Nguồn" value="Workspace" /></div></> : <EmptyState icon={UserRound} title="Chọn liên hệ" detail="Thông tin sẽ hiển thị tại đây." />}</aside></div>
    </div>
  );
}

function TasksPage({ tasks, query, onAdd, onUpdate }: { tasks: TaskItem[]; query: string; onAdd: () => void; onUpdate: Dispatch<SetStateAction<TaskItem[]>> }) {
  const columns: TaskStatus[] = ["Mới", "Đang làm", "Hoàn tất"];
  const matching = tasks.filter((task) => `${task.title} ${task.details} ${task.owner}`.toLowerCase().includes(query.toLowerCase()));

  function advance(taskId: string, current: TaskStatus) {
    const next: TaskStatus = current === "Mới" ? "Đang làm" : current === "Đang làm" ? "Hoàn tất" : "Mới";
    onUpdate((items) => items.map((task) => task.id === taskId ? { ...task, status: next } : task));
  }

  return <div className="standard-page"><PageIntro eyebrow="CÔNG VIỆC" title="Việc cần làm" subtitle="Theo dõi đầu việc và tiến độ của nhóm." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo việc</button>} /><div className="task-summary"><div className="summary-stat"><span>Tổng công việc</span><strong>{matching.length}</strong><small>Trong không gian mẫu</small></div><div className="summary-stat"><span>Đang thực hiện</span><strong>{matching.filter((task) => task.status === "Đang làm").length}</strong><small><i className="status-dot blue" /> Cần theo dõi</small></div><div className="summary-stat"><span>Đã hoàn tất</span><strong>{matching.filter((task) => task.status === "Hoàn tất").length}</strong><small><i className="status-dot green" /> Đã xong</small></div><div className="summary-stat summary-date"><CalendarDays size={18} /><span>Tuần này</span><strong>01 — 07 Thg 11</strong><small>Chế độ xem danh sách</small></div></div><div className="task-board">{columns.map((column) => {const items = matching.filter((task) => task.status === column);return <section className="task-column" key={column}><div className="task-column-head"><span className={`task-state-dot state-${column === "Mới" ? "new" : column === "Đang làm" ? "progress" : "done"}`} /><strong>{column}</strong><small>{items.length}</small><button className="icon-button" title="Tùy chọn cột"><MoreHorizontal size={17} /></button></div><div className="task-list">{items.map((task) => <article className="task-card" key={task.id}><div className="task-card-top"><span className={`priority-pill priority-${task.tone}`}>{task.status === "Hoàn tất" ? "Đã xong" : task.due}</span><button className="icon-button" title="Chuyển trạng thái" onClick={() => advance(task.id, task.status)}><MoreHorizontal size={17} /></button></div><h3>{task.title}</h3><p>{task.details}</p><div className="task-card-footer"><span className="task-owner"><Avatar name={task.owner} tone={task.tone} size="small" />{task.owner}</span><button className="task-advance" onClick={() => advance(task.id, task.status)} title="Chuyển sang trạng thái tiếp theo">{task.status === "Hoàn tất" ? <Check size={14} /> : <ChevronRight size={15} />}</button></div></article>)}{items.length === 0 && <div className="task-empty">Chưa có việc</div>}</div><button className="add-task-inline" onClick={onAdd}><Plus size={15} /> Thêm việc</button></section>})}</div></div>;
}

function ZaloPage({ notify }: { notify: (text: string) => void }) {
  function openZaloLogin() {
    window.open("https://id.zalo.me", "_blank", "noopener,noreferrer");
    notify("Đã mở Zalo trong SignalDesk. Đăng nhập tại cửa sổ Zalo.");
  }

  return <div className="standard-page"><PageIntro eyebrow="KÊNH KẾT NỐI" title="Zalo" subtitle="Đăng nhập Zalo cá nhân ngay trong SignalDesk." /><div className="integration-hero"><div className="integration-symbol zalo-symbol"><Smartphone size={25} /></div><div className="integration-copy"><div className="integration-title"><h3>Zalo cá nhân</h3><span className="connection-badge disconnected"><i /> Cửa sổ ứng dụng</span></div><p>Zalo sẽ mở trong cửa sổ riêng của SignalDesk và lưu phiên đăng nhập trên ứng dụng này.</p><button className="primary-button" onClick={openZaloLogin}><ExternalLink size={16} /> Mở Zalo</button></div><div className="integration-decoration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><MessageCircle size={25} /></div></div></div><div className="integration-cards"><div className="integration-card"><ShieldCheck size={19} /><strong>Đăng nhập tại Zalo</strong><p>Thông tin tài khoản được nhập trực tiếp trên trang Zalo.</p></div><div className="integration-card"><Smartphone size={19} /><strong>Quét mã QR</strong><p>Dùng Zalo trên điện thoại để quét và xác nhận đăng nhập.</p></div><div className="integration-card"><Inbox size={19} /><strong>Phiên riêng của app</strong><p>Phiên đăng nhập được lưu để mở lại Zalo trong SignalDesk.</p></div></div><div className="notice-banner"><Info size={17} /><span>Phiên đã đăng nhập trong trình duyệt web không tự chuyển sang SignalDesk. Đăng nhập một lần tại cửa sổ Zalo của app; tin nhắn chưa đồng bộ vào Inbox nội bộ.</span></div></div>;
}

function InboxPage({ conversations, messages, onSend, onSelect, notify }: { conversations: Conversation[]; messages: Message[]; onSend: (text: string, conversationId?: string) => void; onSelect: (id: string) => void; notify: (text: string) => void }) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [channel, setChannel] = useState("Tất cả");
  const [draft, setDraft] = useState("");
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0];
  const filtered = conversations.filter((conversation) => channel === "Tất cả" || conversation.channel === channel);
  const currentMessages = selected ? messages.filter((message) => message.conversationId === selected.id) : [];

  function reply() {
    if (!draft.trim() || !selected) return;
    onSend(draft, selected.id);
    setDraft("");
  }

  return <div className="standard-page inbox-page"><PageIntro eyebrow="HỘP THƯ CHUNG" title="Inbox" subtitle="Tiếp nhận và phân loại hội thoại từ các kênh." action={<button className="secondary-button" onClick={() => notify("Hộp thư mẫu đã đồng bộ cục bộ.")}><CheckCheck size={16} /> Đánh dấu đã đọc</button>} /><div className="inbox-shell"><aside className="inbox-list-panel"><div className="inbox-search"><label className="search-field"><Search size={15} /><input placeholder="Tìm hội thoại" /></label><button className="icon-button" title="Bộ lọc"><Filter size={17} /></button></div><div className="inbox-filters">{["Tất cả", "Nội bộ", "Zalo", "Teams", "WhatsApp"].map((item) => <button className={channel === item ? "active" : ""} key={item} onClick={() => setChannel(item)}>{item}</button>)}</div><div className="inbox-list">{filtered.map((conversation) => <button className={`inbox-row ${selected?.id === conversation.id ? "selected" : ""}`} key={conversation.id} onClick={() => setSelectedId(conversation.id)}><Avatar name={conversation.name} tone={conversation.tone} size="small" /><span><strong>{conversation.name}</strong><small>{conversation.lastMessage}</small></span><time>{conversation.time}</time></button>)}</div></aside><section className="inbox-conversation"><header className="inbox-conversation-head">{selected && <><Avatar name={selected.name} tone={selected.tone} size="small" /><div><strong>{selected.name}</strong><span>{selected.channel} · hội thoại mẫu</span></div></>}<button className="secondary-button" onClick={() => selected && onSelect(selected.id)}><MessageCircle size={15} /> Mở chat</button></header><div className="inbox-message-stream">{currentMessages.map((message) => <div className={`inbox-bubble ${message.mine ? "outgoing" : ""}`} key={message.id}><span>{message.author} · {message.time}</span><p>{message.text}</p></div>)}</div><div className="inbox-reply"><input placeholder="Viết câu trả lời..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") reply(); }} /><button className="send-button" onClick={reply} disabled={!draft.trim()}><Send size={16} /></button></div></section><aside className="inbox-side"><span className="eyebrow">TÌNH TRẠNG</span><div className="status-select"><i className="status-dot blue" /> Đang mở <ChevronDown size={14} /></div><span className="eyebrow">NGƯỜI PHỤ TRÁCH</span><button className="assignee-button"><Avatar name="Người dùng" tone="blue" size="small" /> Người dùng <ChevronDown size={14} /></button><button className="outline-full" onClick={() => notify("Ghi chú nội bộ chỉ lưu trong bản mẫu.")}><Plus size={15} /> Thêm ghi chú</button></aside></div></div>;
}

function BotsPage({ bots, onCreate, onToggle, notify }: { bots: BotItem[]; onCreate: () => void; onToggle: (id: string) => void; notify: (text: string) => void }) {
  return <div className="standard-page"><PageIntro eyebrow="TỰ ĐỘNG HÓA" title="AI Bots" subtitle="Trợ lý hỗ trợ công việc và xử lý yêu cầu lặp lại." action={<button className="primary-button" onClick={onCreate}><Plus size={17} /> Tạo bot</button>} /><div className="bot-summary-row"><div className="bot-summary-icon"><Sparkles size={23} /></div><div><strong>{bots.filter((bot) => bot.active).length} bot đang bật</strong><p>Chọn bot để xem cấu hình hoặc bật, tắt trong workspace mẫu.</p></div><button className="secondary-button" onClick={() => notify("Thư viện mẫu chưa được kết nối.")}>Thư viện bot <ChevronRight size={15} /></button></div><div className="bot-grid">{bots.map((bot) => {const Icon = bot.icon;return <article className="bot-card" key={bot.id}><div className="bot-card-head"><div className={`bot-icon bot-${bot.tone}`}><Icon size={20} /></div><button className={`switch ${bot.active ? "on" : ""}`} role="switch" aria-checked={bot.active} aria-label={`${bot.active ? "Tắt" : "Bật"} ${bot.name}`} onClick={() => onToggle(bot.id)}><span /></button></div><h3>{bot.name}</h3><p>{bot.description}</p><div className="bot-card-footer"><span className={`connection-badge ${bot.active ? "connected" : "disconnected"}`}><i /> {bot.active ? "Đang bật" : "Đang tắt"}</span><button className="text-action" onClick={() => notify("Cấu hình bot là dữ liệu mẫu.")}>Cấu hình <ChevronRight size={14} /></button></div></article>})}<button className="bot-add-card" onClick={onCreate}><span><Plus size={21} /></span><strong>Tạo bot mới</strong><small>Thiết lập trợ lý cho nhóm</small></button></div></div>;
}

function NotificationsPage({ notices, onRead, onReadAll }: { notices: Notice[]; onRead: (id: string) => void; onReadAll: () => void }) {
  const [filter, setFilter] = useState("Tất cả");
  const shown = notices.filter((notice) => filter === "Tất cả" || (filter === "Chưa đọc" && !notice.read));
  return <div className="standard-page"><PageIntro eyebrow="CẬP NHẬT" title="Thông báo" subtitle="Theo dõi những việc mới trong không gian làm việc." action={<button className="secondary-button" onClick={onReadAll}><CheckCheck size={16} /> Đánh dấu tất cả đã đọc</button>} /><div className="notice-tabs">{["Tất cả", "Chưa đọc"].map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item}{item === "Chưa đọc" && <span>{notices.filter((notice) => !notice.read).length}</span>}</button>)}</div><div className="notification-list">{shown.map((notice) => <article className={`notification-card ${notice.read ? "read" : ""}`} key={notice.id}><div className={`notification-icon note-${notice.tone}`}><Bell size={17} /></div><div className="notification-copy"><strong>{notice.title}</strong><p>{notice.body}</p><time>{notice.time}</time></div>{!notice.read && <button className="mark-read" onClick={() => onRead(notice.id)}>Đánh dấu đã đọc</button>}</article>)}{shown.length === 0 && <EmptyState icon={Bell} title="Đã xem hết thông báo" detail="Thông báo mới sẽ xuất hiện tại đây." />}</div></div>;
}

function SettingsPage({ preferences, onChange, notify }: { preferences: Preferences; onChange: Dispatch<SetStateAction<Preferences>>; notify: (text: string) => void }) {
  return <div className="standard-page settings-page"><PageIntro eyebrow="TÙY CHỈNH" title="Cài đặt" subtitle="Điều chỉnh trải nghiệm trong SignalDesk." /><div className="settings-layout"><nav className="settings-nav"><button className="active"><UserRound size={16} /> Tài khoản</button><button onClick={() => notify("Mục thông báo đang hiển thị bên dưới.")}><Bell size={16} /> Thông báo</button><button onClick={() => notify("Mục giao diện đang hiển thị bên dưới.")}><Sun size={16} /> Giao diện</button><button onClick={() => notify("Thông tin quyền riêng tư ở phần cuối trang.")}><ShieldCheck size={16} /> Quyền riêng tư</button></nav><div className="settings-content"><section className="settings-card"><div className="settings-card-heading"><div><h3>Tài khoản</h3><p>Thông tin hồ sơ mẫu trên thiết bị này.</p></div><button className="text-action" onClick={() => notify("Hồ sơ chưa kết nối tài khoản thật.")}>Chỉnh sửa</button></div><div className="settings-profile"><div className="user-avatar settings-avatar">NV</div><div><strong>Người dùng</strong><span>user@example.com</span></div><span className="connection-badge disconnected"><i /> Cục bộ</span></div></section><section className="settings-card"><div className="settings-card-heading"><div><h3>Giao diện</h3><p>Chọn kiểu hiển thị phù hợp với bạn.</p></div></div><PreferenceRow icon={preferences.dark ? Moon : Sun} title="Chế độ tối" description="Giảm độ sáng giao diện." checked={preferences.dark} onChange={() => onChange((current) => ({ ...current, dark: !current.dark }))} /><PreferenceRow icon={SlidersIcon} title="Bố cục gọn" description="Thu nhỏ khoảng cách giữa các mục." checked={preferences.compact} onChange={() => onChange((current) => ({ ...current, compact: !current.compact }))} /></section><section className="settings-card"><div className="settings-card-heading"><div><h3>Thông báo</h3><p>Chọn cách nhận cập nhật trên thiết bị này.</p></div></div><PreferenceRow icon={Bell} title="Thông báo trên màn hình" description="Hiển thị nhắc việc trong ứng dụng." checked={preferences.desktopAlerts} onChange={() => onChange((current) => ({ ...current, desktopAlerts: !current.desktopAlerts }))} /></section><div className="notice-banner"><ShieldCheck size={17} /><span>Dữ liệu mẫu được lưu trong bộ nhớ cục bộ của ứng dụng. Không có dịch vụ bên ngoài nào được kết nối.</span></div></div></div></div>;
}

const SlidersIcon = Filter;

function PreferenceRow({ icon: Icon, title, description, checked, onChange }: { icon: LucideIcon; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="preference-row"><div className="preference-icon"><Icon size={17} /></div><div className="preference-copy"><strong>{title}</strong><span>{description}</span></div><button className={`switch ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><span /></button></div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="empty-state"><div><Icon size={21} /></div><strong>{title}</strong><span>{detail}</span></div>;
}

function CreateDialog({ kind, onClose, onCreate }: { kind: ModalKind; onClose: () => void; onCreate: (name: string, detail: string, extra: string) => void }) {
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [extra, setExtra] = useState("");
  const labels: Record<ModalKind, { title: string; name: string; detail: string; extra?: string; submit: string }> = {
    chat: { title: "Chat mới", name: "Tên người nhận", detail: "Lời nhắn mở đầu (không bắt buộc)", submit: "Tạo chat" },
    group: { title: "Tạo nhóm", name: "Tên nhóm", detail: "Mô tả nhóm (không bắt buộc)", submit: "Tạo nhóm" },
    contact: { title: "Thêm liên hệ", name: "Tên liên hệ", detail: "Nhóm hoặc đơn vị", extra: "Email (không bắt buộc)", submit: "Thêm liên hệ" },
    task: { title: "Tạo việc mới", name: "Tên công việc", detail: "Mô tả công việc", extra: "Ngày đến hạn (ví dụ: 05 Thg 11)", submit: "Tạo việc" },
    bot: { title: "Tạo AI Bot", name: "Tên bot", detail: "Bot sẽ hỗ trợ công việc gì?", submit: "Tạo bot" },
  };
  const config = labels[kind];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onCreate(name, detail, extra);
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><header className="dialog-header"><div><span className="dialog-kicker">WORKSPACE MẪU</span><h2 id="dialog-title">{config.title}</h2></div><button className="icon-button" title="Đóng" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit}><label className="form-label">{config.name}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nhập nội dung..." /></label><label className="form-label">{config.detail}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} placeholder="Nhập thêm thông tin..." /></label>{config.extra && <label className="form-label">{config.extra}<input type={kind === "contact" ? "email" : "text"} value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="" /></label>}<div className="dialog-footer"><span>Thông tin chỉ lưu cục bộ.</span><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit"><Plus size={16} />{config.submit}</button></div></form></section></div>;
}

export default App;
