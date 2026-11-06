import { Building2, CheckCheck, ChevronDown, ChevronRight, FileText, Hash, Info, Mail, MessageCircle, MoreHorizontal, Paperclip, Phone, Plus, Search, Send, Smile, Users, Video, X } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { getConversationMessages, filterConversations } from "../../lib/records";
import type { Channel, Conversation, Message } from "../../types/models";
import { Avatar, EmptyState, InfoRow } from "../../components/ui";
import { channels } from "../../data/initialState";

export function ChatPage({
  conversations,
  messages,
  selectedConversationId,
  query,
  infoOpen,
  onSelectConversation,
  onSend,
  onNewChat,
  onNewGroup,
  onToggleInfo,
}: {
  conversations: Conversation[];
  messages: Message[];
  selectedConversationId: string;
  query: string;
  infoOpen: boolean;
  onSelectConversation: (id: string, markRead?: boolean) => void;
  onSend: (text: string, conversationId?: string) => void;
  onNewChat: () => void;
  onNewGroup: () => void;
  onToggleInfo: () => void;
}) {
  const [localQuery, setLocalQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [channel, setChannel] = useState<Channel | "Tất cả">("Tất cả");
  const [draft, setDraft] = useState("");
  const filtered = useMemo(() => filterConversations(conversations, messages, { globalQuery: query, localQuery, channel, unreadOnly }), [conversations, messages, query, localQuery, channel, unreadOnly]);
  const activeConversation = filtered.find((item) => item.id === selectedConversationId) ?? filtered[0];
  const activeMessages = useMemo(() => activeConversation ? getConversationMessages(messages, activeConversation.id) : [], [messages, activeConversation]);

  useEffect(() => {
    if (activeConversation && activeConversation.id !== selectedConversationId) onSelectConversation(activeConversation.id, false);
  }, [activeConversation?.id, onSelectConversation, selectedConversationId]);

  function submit() {
    if (!draft.trim() || !activeConversation) return;
    onSend(draft, activeConversation.id);
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
      <section className="conversation-panel" aria-label="Danh sách hội thoại">
        <div className="panel-heading"><div><h2>Tin nhắn</h2><span>{conversations.length} hội thoại cục bộ</span></div><div className="heading-actions"><button className="icon-button" title="Chat mới" aria-label="Chat mới" onClick={onNewChat}><Plus size={18} /></button><button className="icon-button" title="Tạo nhóm" aria-label="Tạo nhóm" onClick={onNewGroup}><Users size={17} /></button></div></div>
        <label className="search-field"><Search size={16} aria-hidden="true" /><input data-chat-search aria-label="Tìm hội thoại và tin nhắn" placeholder="Tìm hội thoại hoặc tin nhắn" value={localQuery} onChange={(event) => setLocalQuery(event.target.value)} /><kbd>Ctrl+F</kbd></label>
        <div className="filter-chips">
          <button className={`chip ${!unreadOnly ? "selected" : ""}`} onClick={() => setUnreadOnly(false)} aria-pressed={!unreadOnly}>Tất cả</button>
          <button className={`chip ${unreadOnly ? "selected" : ""}`} onClick={() => setUnreadOnly((value) => !value)} aria-pressed={unreadOnly}>Chưa đọc</button>
          <label className="chip channel-chip">Kênh <ChevronDown size={13} /><select aria-label="Lọc theo kênh" value={channel} onChange={(event) => setChannel(event.target.value as Channel | "Tất cả")}><option value="Tất cả">Tất cả kênh</option>{channels.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        </div>
        <div className="conversation-list">
          {filtered.map((conversation) => (
            <button className={`conversation-row ${activeConversation?.id === conversation.id ? "selected" : ""}`} key={conversation.id} onClick={() => onSelectConversation(conversation.id, true)} aria-current={activeConversation?.id === conversation.id ? "true" : undefined}>
              <Avatar name={conversation.name} tone={conversation.tone} online={conversation.online} />
              <span className="conversation-copy"><span className="conversation-name">{conversation.name}<small>{conversation.channel}</small></span><span className="conversation-preview">{conversation.lastMessage}</span></span>
              <span className="conversation-meta"><time>{conversation.time}</time>{conversation.unread > 0 && <b>{conversation.unread}</b>}</span>
            </button>
          ))}
          {filtered.length === 0 && <EmptyState icon={Search} title="Không tìm thấy hội thoại" detail="Thử đổi bộ lọc hoặc từ khóa." />}
        </div>
      </section>

      {activeConversation ? (
        <section className="message-panel" aria-label={`Hội thoại với ${activeConversation.name}`}>
          <header className="message-header"><div className="message-person"><Avatar name={activeConversation.name} tone={activeConversation.tone} online={activeConversation.online} /><div><strong>{activeConversation.name}</strong><span>{activeConversation.channel} · dữ liệu cục bộ</span></div></div><div className="message-header-actions"><button className="icon-button" title="Tìm trong chat" aria-label="Tìm trong hội thoại" onClick={() => document.querySelector<HTMLInputElement>("[data-chat-search]")?.focus()}><Search size={17} /></button><button className="icon-button" title="Cuộc gọi chưa hỗ trợ" aria-label="Cuộc gọi chưa hỗ trợ" disabled><Phone size={17} /></button><button className="icon-button" title="Họp video chưa hỗ trợ" aria-label="Họp video chưa hỗ trợ" disabled><Video size={18} /></button><span className="header-divider" /><button className={`icon-button ${infoOpen ? "icon-active" : ""}`} title="Thông tin" aria-label="Bật tắt thông tin hội thoại" onClick={onToggleInfo}><Info size={18} /></button><button className="icon-button" title="Tùy chọn chưa hỗ trợ" aria-label="Tùy chọn hội thoại chưa hỗ trợ" disabled><MoreHorizontal size={18} /></button></div></header>
          <div className="message-stream" aria-live="polite">
            <div className="date-divider"><span>Tin nhắn gần đây</span></div>
            {activeMessages.map((message, index) => {
              const previous = activeMessages[index - 1];
              const showAuthor = !message.mine && (!previous || previous.author !== message.author);
              return <div className={`message-line ${message.mine ? "mine" : ""}`} key={message.id}>{!message.mine && <span className="message-avatar-space">{showAuthor && <Avatar name={message.author} tone={activeConversation.tone} size="small" />}</span>}<div className="message-body">{showAuthor && <span className="message-author">{message.author}</span>}<div className={`bubble ${message.mine ? "bubble-mine" : ""}`}>{message.text}</div><div className="message-time">{message.time}{message.mine && <CheckCheck size={13} />}</div></div></div>;
            })}
            {activeMessages.length === 0 && <EmptyState icon={MessageCircle} title="Chưa có tin nhắn" detail="Tin nhắn mới sẽ được lưu trên máy này." />}
          </div>
          <div className="composer-wrap"><div className="composer-tools"><button className="icon-button" title="Đính kèm chưa hỗ trợ" aria-label="Đính kèm chưa hỗ trợ" disabled><Paperclip size={17} /></button><button className="icon-button" title="Chèn biểu cảm" aria-label="Chèn biểu cảm" onClick={() => setDraft((current) => `${current}${current ? " " : ""}🙂`)}><Smile size={17} /></button><span className="composer-hint"><span>Enter</span> để lưu · <span>Shift+Enter</span> xuống dòng</span></div><div className="composer-box"><textarea aria-label="Nội dung tin nhắn cục bộ" placeholder="Nhập tin nhắn..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} rows={1} /><button className="send-button" aria-label="Lưu tin nhắn cục bộ" onClick={submit} disabled={!draft.trim()}><Send size={17} /></button></div><p className="local-note">Tin nhắn chỉ lưu trong SignalDesk, không được gửi qua kênh bên ngoài.</p></div>
        </section>
      ) : <section className="message-panel"><EmptyState icon={MessageCircle} title="Chọn một hội thoại" detail="Tạo hội thoại hoặc đổi bộ lọc để tiếp tục." /></section>}

      {infoOpen && activeConversation && <aside className="conversation-info"><div className="info-heading"><span>Thông tin</span><button className="icon-button" title="Đóng thông tin" aria-label="Đóng thông tin" onClick={onToggleInfo}><X size={16} /></button></div><div className="profile-card"><Avatar name={activeConversation.name} tone={activeConversation.tone} size="large" online={activeConversation.online} /><h3>{activeConversation.name}</h3><p>{activeConversation.channel === "Nội bộ" ? "Thành viên · dữ liệu cục bộ" : `Kênh ${activeConversation.channel} · bản ghi mẫu`}</p></div><div className="info-section"><div className="info-section-title"><span>Chi tiết</span></div><InfoRow icon={Mail} label="Email" value="Chưa có" /><InfoRow icon={Building2} label="Nhóm" value="Không gian cục bộ" /><InfoRow icon={Hash} label="Kênh" value={activeConversation.channel} /></div><div className="info-section"><div className="info-section-title"><span>Tệp đã chia sẻ</span></div><div className="shared-file" aria-disabled="true"><div className="file-icon"><FileText size={17} /></div><span><strong>Tệp minh họa</strong><small>Tải tệp chưa hỗ trợ</small></span><ChevronRight size={15} /></div></div></aside>}
    </div>
  );
}
