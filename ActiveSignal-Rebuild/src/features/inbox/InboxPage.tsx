import { CheckCheck, Filter, MessageCircle, Search, Send, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { chooseVisibleConversation, filterConversations, getConversationMessages } from "../../lib/records";
import type { Channel, Conversation, Message } from "../../types/models";
import { Avatar, EmptyState, PageIntro } from "../../components/ui";
import { channels } from "../../data/initialState";

export function InboxPage({ conversations, messages, globalQuery, onSend, onOpenChat, onMarkRead, onReadAll }: {
  conversations: Conversation[];
  messages: Message[];
  globalQuery: string;
  onSend: (text: string, conversationId?: string) => void;
  onOpenChat: (id: string) => void;
  onMarkRead: (id: string) => void;
  onReadAll: () => void;
}) {
  const [selectedId, setSelectedId] = useState(conversations[0]?.id ?? "");
  const [channel, setChannel] = useState<Channel | "Tất cả">("Tất cả");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const filtered = useMemo(() => filterConversations(conversations, messages, { globalQuery, localQuery: query, channel, unreadOnly }), [conversations, messages, globalQuery, query, channel, unreadOnly]);
  const selected = chooseVisibleConversation(filtered, selectedId);
  const currentMessages = useMemo(() => selected ? getConversationMessages(messages, selected.id) : [], [messages, selected]);

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
    if (!selected && selectedId) setSelectedId("");
  }, [selected?.id, selectedId]);

  function selectConversation(id: string) {
    setSelectedId(id);
    onMarkRead(id);
  }

  function reply() {
    if (!draft.trim() || !selected) return;
    onSend(draft, selected.id);
    setDraft("");
  }

  return <div className="standard-page inbox-page"><PageIntro eyebrow="HỘP THƯ CỤC BỘ" title="Inbox" subtitle="Lọc và xem lại các hội thoại đang có trên máy." action={<button className="secondary-button" onClick={onReadAll}><CheckCheck size={16} /> Đánh dấu tất cả đã đọc</button>} />
    <div className="inbox-shell"><aside className="inbox-list-panel"><div className="inbox-search"><label className="search-field"><Search size={15} /><input aria-label="Tìm trong hộp thư" placeholder="Tìm hội thoại" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className={`icon-button ${unreadOnly ? "icon-active" : ""}`} title="Chỉ xem chưa đọc" aria-label="Lọc hội thoại chưa đọc" aria-pressed={unreadOnly} onClick={() => setUnreadOnly((value) => !value)}><Filter size={17} /></button></div><div className="inbox-filters"><button className={channel === "Tất cả" ? "active" : ""} onClick={() => setChannel("Tất cả")}>Tất cả</button>{channels.map((item) => <button className={channel === item ? "active" : ""} key={item} onClick={() => setChannel(item)}>{item}</button>)}</div><div className="inbox-list">{filtered.map((conversation) => <button className={`inbox-row ${selected?.id === conversation.id ? "selected" : ""}`} key={conversation.id} onClick={() => selectConversation(conversation.id)} aria-current={selected?.id === conversation.id ? "true" : undefined}><Avatar name={conversation.name} tone={conversation.tone} size="small" /><span><strong>{conversation.name}</strong><small>{conversation.lastMessage}</small></span><time>{conversation.time}</time>{conversation.unread > 0 && <b className="inbox-unread">{conversation.unread}</b>}</button>)}{filtered.length === 0 && <EmptyState icon={Users} title="Không có hội thoại" detail="Thử đổi kênh, bộ lọc hoặc từ khóa." />}</div></aside>
      <section className="inbox-conversation"><header className="inbox-conversation-head">{selected ? <><Avatar name={selected.name} tone={selected.tone} size="small" /><div><strong>{selected.name}</strong><span>{selected.channel} · lưu trên máy</span></div><button className="secondary-button" onClick={() => onOpenChat(selected.id)}><MessageCircle size={15} /> Mở chat</button></> : <span>Chọn hội thoại</span>}</header><div className="inbox-message-stream" aria-live="polite">{currentMessages.map((message) => <div className={`inbox-bubble ${message.mine ? "outgoing" : ""}`} key={message.id}><span>{message.author} · {message.time}</span><p>{message.text}</p></div>)}{selected && currentMessages.length === 0 && <EmptyState icon={MessageCircle} title="Chưa có tin nhắn" detail="Gửi tin nhắn để lưu vào hội thoại này." />}</div><div className="inbox-reply"><input aria-label="Tin nhắn cục bộ" placeholder="Viết tin nhắn lưu cục bộ..." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); reply(); } }} disabled={!selected} /><button className="send-button" aria-label="Lưu tin nhắn cục bộ" onClick={reply} disabled={!draft.trim() || !selected}><Send size={16} /></button></div></section>
      <aside className="inbox-side"><span className="eyebrow">KÊNH</span><strong>{selected?.channel ?? "Chưa chọn"}</strong><span className="eyebrow">LƯU TRỮ</span><span>Chỉ lưu trên máy này</span></aside>
    </div>
  </div>;
}
