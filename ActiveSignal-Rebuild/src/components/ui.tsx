import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { initials } from "../lib/text";
import type { NavItem } from "../types/models";
import type { RecordDialogDraft } from "../types/record-dialog";

export type { RecordDialogDraft } from "../types/record-dialog";

export function NavButton({ item, active, badge, onClick }: { item: NavItem; active: boolean; badge?: number; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button className={`nav-button ${active ? "active" : ""}`} onClick={onClick} aria-label={item.label} title={item.label} aria-current={active ? "page" : undefined}>
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      <span>{item.label}</span>
      {badge ? <span className="nav-badge">{badge > 99 ? "99+" : badge}</span> : null}
    </button>
  );
}

export function Avatar({ name, tone = "blue", size = "normal", online = false }: { name: string; tone?: string; size?: "small" | "normal" | "large"; online?: boolean }) {
  return <span className={`avatar avatar-${tone} avatar-${size}`} aria-hidden="true">{initials(name)}{online ? <i className="online-dot" /> : null}</span>;
}

export function PageIntro({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-intro"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2><p>{subtitle}</p></div>{action}</div>;
}

export function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="info-row"><Icon size={15} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>;
}

export function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail: string }) {
  return <div className="empty-state" role="status"><div><Icon size={21} /></div><strong>{title}</strong><span>{detail}</span></div>;
}

export function PreferenceRow({ icon: Icon, title, description, checked, onChange }: { icon: LucideIcon; title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="preference-row"><div className="preference-icon"><Icon size={17} /></div><div className="preference-copy"><strong>{title}</strong><span>{description}</span></div><button className={`switch ${checked ? "on" : ""}`} type="button" role="switch" aria-checked={checked} aria-label={title} onClick={onChange}><span /></button></div>;
}

export function RecordDialog({
  kind,
  initial,
  onClose,
  onSave,
}: {
  kind: "chat" | "group" | "contact" | "task" | "bot";
  initial?: { name: string; detail: string; extra?: string; hint?: string; iconKey?: "sparkles" | "activity" | "bot" };
  onClose: () => void;
  onSave: (draft: RecordDialogDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [detail, setDetail] = useState(initial?.detail ?? "");
  const [extra, setExtra] = useState(initial?.extra ?? "");
  const [iconKey, setIconKey] = useState(initial?.iconKey ?? "bot");
  const dialogRef = useRef<HTMLElement>(null);
  const labels = {
    chat: { title: initial ? "Đổi tên cuộc trò chuyện" : "Chat mới", name: "Tên người nhận", detail: "Lời nhắn mở đầu (không bắt buộc)", submit: initial ? "Lưu" : "Tạo chat" },
    group: { title: initial ? "Chỉnh sửa nhóm" : "Tạo nhóm", name: "Tên nhóm", detail: "Mô tả nhóm (không bắt buộc)", submit: initial ? "Lưu" : "Tạo nhóm" },
    contact: { title: initial ? "Sửa liên hệ" : "Thêm liên hệ", name: "Tên liên hệ", detail: "Nhóm hoặc đơn vị", extra: "Email (không bắt buộc)", submit: initial ? "Lưu thay đổi" : "Thêm liên hệ" },
    task: { title: initial ? "Sửa công việc" : "Tạo việc mới", name: "Tên công việc", detail: "Mô tả công việc", extra: "Ngày đến hạn", submit: initial ? "Lưu thay đổi" : "Tạo việc" },
    bot: { title: initial ? "Sửa hồ sơ bot" : "Tạo hồ sơ bot", name: "Tên bot", detail: "Mô tả bot", extra: "Biểu tượng", submit: initial ? "Lưu thay đổi" : "Tạo bot" },
  }[kind];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex='0']")];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), detail: detail.trim(), extra: extra.trim(), iconKey });
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title" tabIndex={-1}><header className="dialog-header"><div><span className="dialog-kicker">LƯU TRÊN MÁY NÀY</span><h2 id="dialog-title">{labels.title}</h2></div><button className="icon-button" type="button" aria-label="Đóng hộp thoại" title="Đóng" onClick={onClose}><X size={18} /></button></header><form onSubmit={submit}><label className="form-label">{labels.name}<input autoFocus value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} placeholder="Nhập nội dung..." /></label><label className="form-label">{labels.detail}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} rows={3} maxLength={1000} placeholder="Nhập thêm thông tin..." /></label>{kind === "task" && <label className="form-label">{labels.extra}<input type="date" value={extra} onChange={(event) => setExtra(event.target.value)} />{initial?.hint && <small className="field-hint">Hạn cũ được giữ nguyên: {initial.hint}</small>}</label>}{kind === "contact" && <label className="form-label">{labels.extra}<input type="email" value={extra} onChange={(event) => setExtra(event.target.value)} maxLength={254} placeholder="ten@congty.vn" /></label>}{kind === "bot" && <label className="form-label">{labels.extra}<select value={iconKey} onChange={(event) => setIconKey(event.target.value as typeof iconKey)}><option value="bot">Bot</option><option value="sparkles">Lấp lánh</option><option value="activity">Phân loại</option></select></label>}<div className="dialog-footer"><span>SignalDesk không gửi nội dung ra ngoài.</span><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" type="submit">{labels.submit}</button></div></form></section></div>;
}
