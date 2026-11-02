import { Bell, Moon, ShieldCheck, Sun, UserRound } from "lucide-react";
import type { Preferences } from "../../types/models";
import { PageIntro, PreferenceRow } from "../../components/ui";

export function SettingsPage({ preferences, alertsEnabled, onChange, onAlertsChange }: {
  preferences: Preferences;
  alertsEnabled: boolean;
  onChange: (key: "dark" | "compact", value: boolean) => void;
  onAlertsChange: () => void;
}) {
  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="standard-page settings-page"><PageIntro eyebrow="TÙY CHỈNH" title="Cài đặt" subtitle="Tùy chỉnh giao diện và quyền riêng tư trên thiết bị này." /><div className="settings-layout"><nav className="settings-nav" aria-label="Mục cài đặt"><button onClick={() => jumpTo("settings-account")}><UserRound size={16} /> Tài khoản cục bộ</button><button onClick={() => jumpTo("settings-notifications")}><Bell size={16} /> Thông báo</button><button onClick={() => jumpTo("settings-appearance")}><Sun size={16} /> Giao diện</button><button onClick={() => jumpTo("settings-privacy")}><ShieldCheck size={16} /> Quyền riêng tư</button></nav><div className="settings-content"><section className="settings-card" id="settings-account"><div className="settings-card-heading"><div><h3>Tài khoản</h3><p>SignalDesk chưa có hồ sơ đăng nhập riêng.</p></div></div><div className="settings-profile"><div className="user-avatar settings-avatar">SD</div><div><strong>Hồ sơ cục bộ</strong><span>Không có tài khoản dịch vụ</span></div><span className="connection-badge disconnected"><i /> Trên thiết bị</span></div></section><section className="settings-card" id="settings-appearance"><div className="settings-card-heading"><div><h3>Giao diện</h3><p>Thay đổi được lưu trong hồ sơ SignalDesk.</p></div></div><PreferenceRow icon={preferences.dark ? Moon : Sun} title="Chế độ tối" description="Giảm độ sáng giao diện." checked={preferences.dark} onChange={() => onChange("dark", !preferences.dark)} /><PreferenceRow icon={Sun} title="Bố cục gọn" description="Thu nhỏ khoảng cách giữa các mục." checked={preferences.compact} onChange={() => onChange("compact", !preferences.compact)} /></section><section className="settings-card" id="settings-notifications"><div className="settings-card-heading"><div><h3>Thông báo</h3><p>Cho phép SignalDesk hiển thị thông báo trên Windows.</p></div></div><PreferenceRow icon={Bell} title="Thông báo trên màn hình" description={alertsEnabled ? "SignalDesk được Windows cấp quyền hiển thị thông báo." : "Bật để xin quyền hiển thị thông báo trên Windows."} checked={alertsEnabled} onChange={onAlertsChange} /></section><section className="settings-card" id="settings-privacy"><div className="settings-card-heading"><div><h3>Quyền riêng tư và dữ liệu</h3><p>Dữ liệu hội thoại mẫu và cài đặt được lưu cục bộ trong hồ sơ ứng dụng. Phiên Zalo nằm trong vùng lưu trữ riêng của cửa sổ Zalo. Không có dịch vụ đồng bộ của SignalDesk.</p></div></div></section></div></div></div>;
}
