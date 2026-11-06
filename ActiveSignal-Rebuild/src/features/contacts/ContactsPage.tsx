import { Building2, Mail, MessageCircle, MoreHorizontal, Plus, UserRound, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { filterContacts } from "../../lib/records";
import type { Contact } from "../../types/models";
import { Avatar, EmptyState, InfoRow, PageIntro } from "../../components/ui";

export function ContactsPage({ contacts, query, onAdd, onEdit, onDelete, onOpenChat }: {
  contacts: Contact[];
  query: string;
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onOpenChat: (contact: Contact) => void;
}) {
  const [filter, setFilter] = useState("");
  const [selectedId, setSelectedId] = useState(contacts[0]?.id ?? "");
  const filtered = useMemo(() => filterContacts(contacts, query, filter), [contacts, query, filter]);
  const selected = filtered.find((contact) => contact.id === selectedId) ?? filtered[0];

  function confirmDelete(contact: Contact) {
    if (window.confirm(`Xóa liên hệ “${contact.name}” khỏi danh bạ cục bộ?`)) onDelete(contact.id);
  }

  return <div className="standard-page">
    <PageIntro eyebrow="DANH BẠ CỤC BỘ" title="Danh bạ" subtitle="Tạo và quản lý liên hệ được lưu trên máy này." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Thêm liên hệ</button>} />
    <div className="toolbar-card"><label className="search-field wide-search"><Users size={16} /><input aria-label="Tìm liên hệ" placeholder="Tìm theo tên, nhóm hoặc email" value={filter} onChange={(event) => setFilter(event.target.value)} /></label><span className="secondary-button count-display"><Users size={16} /> {contacts.length} liên hệ</span></div>
    <div className="directory-layout"><section className="directory-card"><div className="table-head"><span>LIÊN HỆ</span><span>NHÓM</span><span>EMAIL</span><span>NƠI LƯU</span></div>{filtered.map((contact) => <button className={`directory-row ${selected?.id === contact.id ? "selected" : ""}`} key={contact.id} onClick={() => setSelectedId(contact.id)} aria-current={selected?.id === contact.id ? "true" : undefined}><span className="directory-person"><Avatar name={contact.name} tone={contact.tone} size="small" /><strong>{contact.name}</strong></span><span>{contact.company}</span><span className="muted-cell">{contact.email || "Chưa có email"}</span><span><i className="status-dot blue" /> Trên máy này</span></button>)}{filtered.length === 0 && <EmptyState icon={Users} title="Không có liên hệ phù hợp" detail="Thử đổi từ khóa hoặc thêm liên hệ mới." />}</section><aside className="detail-card"><div className="detail-card-top"><span>CHI TIẾT LIÊN HỆ</span>{selected && <button className="icon-button" title="Tùy chọn liên hệ" aria-label="Xóa liên hệ" onClick={() => confirmDelete(selected)}><MoreHorizontal size={18} /></button>}</div>{selected ? <><div className="contact-profile"><Avatar name={selected.name} tone={selected.tone} size="large" /><h3>{selected.name}</h3><p>{selected.company}</p><div className="contact-actions"><button className="secondary-button" onClick={() => onOpenChat(selected)}><MessageCircle size={15} /> Tạo chat cục bộ</button><button className="text-action" onClick={() => onEdit(selected)}>Sửa</button><button className="text-action danger-text" onClick={() => confirmDelete(selected)}>Xóa</button></div></div><div className="detail-list"><InfoRow icon={Mail} label="Email" value={selected.email || "Chưa có"} /><InfoRow icon={Building2} label="Nhóm" value={selected.company} /><InfoRow icon={UserRound} label="Nguồn" value="Lưu trên máy" /></div></> : <EmptyState icon={UserRound} title="Chọn liên hệ" detail="Chi tiết liên hệ sẽ hiển thị tại đây." />}</aside></div>
  </div>;
}
