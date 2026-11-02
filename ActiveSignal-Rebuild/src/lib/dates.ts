export function toLocalISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

export function formatTaskDue(dueDate: string | null, legacyLabel?: string): string {
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    const [year, month, day] = dueDate.split("-").map(Number);
    return new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
  }
  return legacyLabel?.trim() || "Chưa đặt hạn";
}

export function getCurrentWeekRange(now = new Date()): { start: Date; end: Date; label: string } {
  const day = now.getDay();
  const offsetToMonday = (day + 6) % 7;
  const start = addDays(now, -offsetToMonday);
  const end = addDays(start, 6);
  const format = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "short" });
  const startLabel = format.format(start).replaceAll("tháng", "thg");
  const endLabel = format.format(end).replaceAll("tháng", "thg");
  return { start, end, label: `${startLabel} – ${endLabel}` };
}

export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
