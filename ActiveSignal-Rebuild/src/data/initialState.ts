import { Bot, MessageCircle, Users, CheckSquare, Smartphone, Inbox } from "lucide-react";
import { addDays, toLocalISODate } from "../lib/dates";
import type { BotItem, Channel, Contact, Conversation, Message, NavItem, Notice, PageKey, Preferences, TaskItem } from "../types/models";

const today = new Date();

export const primaryNav: NavItem[] = [
  { key: "chat", label: "Chat", icon: MessageCircle },
  { key: "contacts", label: "Danh bạ", icon: Users },
  { key: "tasks", label: "Việc", icon: CheckSquare },
  { key: "zalo", label: "Zalo", icon: Smartphone },
  { key: "inbox", label: "Inbox", icon: Inbox },
  { key: "bots", label: "AI Bots", icon: Bot },
];

export const pageTitles: Record<PageKey, string> = {
  chat: "Chat",
  contacts: "Danh bạ",
  tasks: "Việc cần làm",
  zalo: "Zalo",
  inbox: "Inbox",
  bots: "AI Bots",
  notifications: "Thông báo",
  settings: "Cài đặt",
};

export const channels: readonly Channel[] = ["Nội bộ", "Zalo", "WhatsApp", "Teams"];

export const initialConversations: Conversation[] = [
  { id: "conv-01", name: "Hà My Nguyễn", channel: "Nội bộ", lastMessage: "Em đã gửi bản cập nhật mới rồi nhé.", time: "10:42", unread: 2, tone: "mint", online: true },
  { id: "conv-02", name: "Nhóm Sản phẩm", channel: "Nội bộ", lastMessage: "Tuấn: Mình chốt lịch vào chiều thứ Năm.", time: "09:58", unread: 0, tone: "blue" },
  { id: "conv-03", name: "Minh Phạm", channel: "Zalo", lastMessage: "Cảm ơn anh, em sẽ phản hồi trong hôm nay.", time: "Hôm qua", unread: 1, tone: "orange", online: true },
  { id: "conv-04", name: "Linh Trần", channel: "Teams", lastMessage: "Tài liệu đã được chia sẻ trong nhóm.", time: "T2", unread: 0, tone: "purple" },
  { id: "conv-05", name: "CSKH · Ca sáng", channel: "WhatsApp", lastMessage: "Đã tiếp nhận yêu cầu hỗ trợ.", time: "T2", unread: 0, tone: "rose" },
];

export const initialMessages: Message[] = [
  { id: "m-01", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Chào anh, em vừa cập nhật lại bản kế hoạch theo góp ý của nhóm.", time: "10:31" },
  { id: "m-02", conversationId: "conv-01", author: "Tôi", text: "Cảm ơn My. Phần tiến độ tuần này đã có đủ đầu việc chưa em?", time: "10:35", mine: true },
  { id: "m-03", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Dạ đủ rồi ạ. Em cũng đã thêm người phụ trách và ngày dự kiến cho từng mục.", time: "10:38" },
  { id: "m-04", conversationId: "conv-01", author: "Hà My Nguyễn", text: "Em đã gửi bản cập nhật mới rồi nhé.", time: "10:42" },
  { id: "m-05", conversationId: "conv-02", author: "Tuấn Lê", text: "Mình chốt lịch vào chiều thứ Năm nhé.", time: "09:58" },
  { id: "m-06", conversationId: "conv-03", author: "Minh Phạm", text: "Cảm ơn anh, em sẽ phản hồi trong hôm nay.", time: "15:14" },
  { id: "m-07", conversationId: "conv-04", author: "Linh Trần", text: "Tài liệu đã được chia sẻ trong nhóm.", time: "14:20" },
  { id: "m-08", conversationId: "conv-05", author: "CSKH · Ca sáng", text: "Đã tiếp nhận yêu cầu hỗ trợ.", time: "08:42" },
];

export const initialContacts: Contact[] = [
  { id: "contact-01", name: "Hà My Nguyễn", company: "Khối Sản phẩm", email: "hamy@example.com", tone: "mint", initials: "HM" },
  { id: "contact-02", name: "Minh Phạm", company: "Kinh doanh", email: "minh.pham@example.com", tone: "orange", initials: "MP" },
  { id: "contact-03", name: "Linh Trần", company: "Vận hành", email: "linh.tran@example.com", tone: "purple", initials: "LT" },
  { id: "contact-04", name: "Tuấn Lê", company: "Khối Sản phẩm", email: "tuan.le@example.com", tone: "blue", initials: "TL" },
  { id: "contact-05", name: "An Hoàng", company: "Chăm sóc khách hàng", email: "an.hoang@example.com", tone: "rose", initials: "AH" },
  { id: "contact-06", name: "Thảo Võ", company: "Tài chính", email: "thao.vo@example.com", tone: "gold", initials: "TV" },
];

export const initialTasks: TaskItem[] = [
  { id: "task-01", title: "Hoàn thiện kế hoạch tháng 11", details: "Rà soát mốc công việc và cập nhật người phụ trách.", status: "Đang làm", dueDate: toLocalISODate(today), owner: "Hà My", tone: "mint" },
  { id: "task-02", title: "Gửi tài liệu onboarding", details: "Chuẩn bị tài liệu giới thiệu cho thành viên mới.", status: "Mới", dueDate: toLocalISODate(addDays(today, 1)), owner: "Tuấn Lê", tone: "blue" },
  { id: "task-03", title: "Tổng hợp phản hồi khách hàng", details: "Gom các ý kiến nổi bật trong tuần.", status: "Mới", dueDate: toLocalISODate(addDays(today, 2)), owner: "An Hoàng", tone: "rose" },
  { id: "task-04", title: "Cập nhật quy trình tiếp nhận", details: "Đã hoàn tất bản nháp quy trình mới.", status: "Hoàn tất", dueDate: toLocalISODate(addDays(today, -3)), owner: "Linh Trần", tone: "purple" },
];

export const initialBots: BotItem[] = [
  { id: "bot-01", name: "Trợ lý bán hàng", description: "Tóm tắt nhu cầu và gợi ý bước tiếp theo cho đội kinh doanh.", active: true, tone: "blue", iconKey: "sparkles" },
  { id: "bot-02", name: "Phân loại yêu cầu", description: "Gắn nhãn hội thoại theo chủ đề và mức độ ưu tiên.", active: true, tone: "mint", iconKey: "activity" },
  { id: "bot-03", name: "Trợ lý nội bộ", description: "Tra cứu hướng dẫn và quy trình của nhóm.", active: false, tone: "purple", iconKey: "bot" },
];

export const initialNotices: Notice[] = [
  { id: "notice-01", title: "Bạn được nhắc đến", body: "Hà My đã nhắc đến bạn trong Nhóm Sản phẩm.", time: "10 phút trước", read: false, tone: "blue" },
  { id: "notice-02", title: "Có việc mới được giao", body: "Hoàn thiện kế hoạch tháng · hạn hôm nay.", time: "1 giờ trước", read: false, tone: "mint" },
  { id: "notice-03", title: "Bản tin hoạt động", body: "Có 4 cập nhật mới trong không gian làm việc.", time: "Hôm qua", read: true, tone: "purple" },
];

export const defaultPreferences: Preferences = { dark: false, desktopAlerts: true, compact: false };
