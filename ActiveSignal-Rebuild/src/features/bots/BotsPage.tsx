import { ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { botIconRegistry } from "./icons";
import type { BotItem } from "../../types/models";
import { PageIntro } from "../../components/ui";

export function BotsPage({ bots, onCreate, onEdit, onDelete, onToggle }: {
  bots: BotItem[];
  onCreate: () => void;
  onEdit: (bot: BotItem) => void;
  onDelete: (bot: BotItem) => void;
  onToggle: (id: string) => void;
}) {
  const enabled = bots.filter((bot) => bot.active).length;
  return <div className="standard-page"><PageIntro eyebrow="HỒ SƠ CỤC BỘ" title="AI Bots" subtitle="Tạo hồ sơ và lưu cấu hình bot trên máy. SignalDesk chưa chạy AI." action={<button className="primary-button" onClick={onCreate}><Plus size={17} /> Tạo hồ sơ bot</button>} />
    <div className="bot-summary-row"><div className="bot-summary-icon"><Sparkles size={23} /></div><div><strong>{enabled} hồ sơ bot đang bật</strong><p>Bật/tắt chỉ thay đổi cấu hình cục bộ, không khởi chạy dịch vụ AI.</p></div></div>
    <div className="bot-grid">{bots.map((bot) => {const Icon = botIconRegistry[bot.iconKey];return <article className="bot-card" key={bot.id}><div className="bot-card-head"><div className={`bot-icon bot-${bot.tone}`}><Icon size={20} /></div><button className={`switch ${bot.active ? "on" : ""}`} type="button" role="switch" aria-checked={bot.active} aria-label={`${bot.active ? "Tắt" : "Bật"} hồ sơ ${bot.name}`} onClick={() => onToggle(bot.id)}><span /></button></div><h3>{bot.name}</h3><p>{bot.description}</p><div className="bot-card-footer"><span className={`connection-badge ${bot.active ? "connected" : "disconnected"}`}><i /> {bot.active ? "Hồ sơ đang bật" : "Hồ sơ đang tắt"}</span><div className="task-actions"><button className="text-action" onClick={() => onEdit(bot)}>Sửa <ChevronRight size={14} /></button><button className="icon-button danger-button" title={`Xóa ${bot.name}`} aria-label={`Xóa ${bot.name}`} onClick={() => onDelete(bot)}><Trash2 size={16} /></button></div></div></article>})}<button className="bot-add-card" onClick={onCreate}><span><Plus size={21} /></span><strong>Tạo hồ sơ mới</strong><small>Lưu cấu hình trên máy</small></button></div>
  </div>;
}
