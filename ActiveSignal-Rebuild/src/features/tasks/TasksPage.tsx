import { CalendarDays, Check, ChevronRight, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { getCurrentWeekRange, formatTaskDue } from "../../lib/dates";
import { normalizeSearchText, searchTerms } from "../../lib/records";
import type { TaskItem, TaskStatus } from "../../types/models";
import { Avatar, EmptyState, PageIntro } from "../../components/ui";

const columns: TaskStatus[] = ["Mới", "Đang làm", "Hoàn tất"];

export function TasksPage({ tasks, query, onAdd, onEdit, onDelete, onChangeStatus }: {
  tasks: TaskItem[];
  query: string;
  onAdd: () => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onChangeStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const terms = searchTerms(query);
  const matching = useMemo(() => tasks.filter((task) => {
    const searchable = normalizeSearchText(`${task.title} ${task.details} ${task.owner} ${formatTaskDue(task.dueDate, task.legacyDueLabel)}`);
    return terms.every((term) => searchable.includes(term));
  }), [tasks, terms.join(" ")]);
  const week = getCurrentWeekRange();

  function advance(task: TaskItem) {
    const next: TaskStatus = task.status === "Mới" ? "Đang làm" : task.status === "Đang làm" ? "Hoàn tất" : "Mới";
    onChangeStatus(task.id, next);
  }

  return <div className="standard-page"><PageIntro eyebrow="CÔNG VIỆC CỤC BỘ" title="Việc cần làm" subtitle="Tạo, cập nhật và theo dõi đầu việc trên máy này." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Tạo việc</button>} />
    <div className="task-summary"><div className="summary-stat"><span>Tổng công việc</span><strong>{matching.length}</strong><small>Đang hiển thị</small></div><div className="summary-stat"><span>Đang thực hiện</span><strong>{matching.filter((task) => task.status === "Đang làm").length}</strong><small>Chưa hoàn tất</small></div><div className="summary-stat"><span>Đã hoàn tất</span><strong>{matching.filter((task) => task.status === "Hoàn tất").length}</strong><small>Đã xong</small></div><div className="summary-stat summary-date"><CalendarDays size={18} /><span>Tuần này</span><strong>{week.label}</strong><small>Thứ Hai – Chủ Nhật</small></div></div>
    <div className="task-board">{columns.map((column) => {const items = matching.filter((task) => task.status === column);return <section className="task-column" key={column} aria-label={`Công việc ${column}`}><div className="task-column-head"><span className={`task-state-dot state-${column === "Mới" ? "new" : column === "Đang làm" ? "progress" : "done"}`} /><strong>{column}</strong><small>{items.length}</small></div><div className="task-list">{items.map((task) => <article className="task-card" key={task.id}><div className="task-card-top"><span className={`priority-pill priority-${task.tone}`}>{formatTaskDue(task.dueDate, task.legacyDueLabel)}</span><div className="task-actions"><button className="icon-button" title={`Sửa ${task.title}`} aria-label={`Sửa ${task.title}`} onClick={() => onEdit(task)}><MoreHorizontal size={17} /></button><button className="icon-button danger-button" title={`Xóa ${task.title}`} aria-label={`Xóa ${task.title}`} onClick={() => onDelete(task)}><Trash2 size={16} /></button></div></div><h3>{task.title}</h3><p>{task.details}</p><div className="task-card-footer"><span className="task-owner"><Avatar name={task.owner} tone={task.tone} size="small" />{task.owner}</span><button className="task-advance" onClick={() => advance(task)} title={`Chuyển trạng thái công việc ${task.title}`}>{task.status === "Hoàn tất" ? <Check size={14} /> : <ChevronRight size={15} />}</button></div></article>)}{items.length === 0 && <div className="task-empty">{terms.length > 0 ? "Không có việc phù hợp" : "Chưa có việc"}</div>}</div><button className="add-task-inline" onClick={onAdd}><Plus size={15} /> Thêm việc</button></section>})}</div>
    {matching.length === 0 && tasks.length > 0 && <EmptyState icon={CalendarDays} title="Không tìm thấy công việc" detail="Thử từ khóa khác." />}
  </div>;
}
