import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import type { Notice } from "../../types/models";
import { EmptyState, PageIntro } from "../../components/ui";

export function NotificationsPage({ notices, onRead, onReadAll }: { notices: Notice[]; onRead: (id: string) => void; onReadAll: () => void }) {
  const [filter, setFilter] = useState<"Tất cả" | "Chưa đọc">("Tất cả");
  const shown = notices.filter((notice) => filter === "Tất cả" || !notice.read);
  return <div className="standard-page"><PageIntro eyebrow="CẬP NHẬT CỤC BỘ" title="Thông báo" subtitle="Quản lý các thông báo mẫu được lưu trên máy." action={<button className="secondary-button" onClick={onReadAll}><CheckCheck size={16} /> Đánh dấu tất cả đã đọc</button>} /><div className="notice-tabs">{(["Tất cả", "Chưa đọc"] as const).map((item) => <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)} aria-pressed={filter === item}>{item}{item === "Chưa đọc" && <span>{notices.filter((notice) => !notice.read).length}</span>}</button>)}</div><div className="notification-list">{shown.map((notice) => <article className={`notification-card ${notice.read ? "read" : ""}`} key={notice.id}><div className={`notification-icon note-${notice.tone}`}><Bell size={17} /></div><div className="notification-copy"><strong>{notice.title}</strong><p>{notice.body}</p><time>{notice.time}</time></div>{!notice.read && <button className="mark-read" onClick={() => onRead(notice.id)}>Đánh dấu đã đọc</button>}</article>)}{shown.length === 0 && <EmptyState icon={Bell} title="Đã xem hết thông báo" detail="Không còn thông báo chưa đọc." />}</div></div>;
}
