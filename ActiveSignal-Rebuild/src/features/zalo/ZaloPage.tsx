import { ExternalLink, Inbox, LoaderCircle, MessageCircle, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import type { ZaloStatus } from "../../types/zalo";
import { PageIntro } from "../../components/ui";

const defaultStatus: ZaloStatus = { status: "closed", error: null };

const stateCopy: Record<ZaloStatus["status"], { label: string; detail: string }> = {
  closed: { label: "Chưa mở Zalo", detail: "Mở Zalo để xem phiên đăng nhập được lưu riêng trong SignalDesk." },
  opening: { label: "Đang mở", detail: "SignalDesk đang tạo cửa sổ Zalo." },
  loading: { label: "Đang tải", detail: "Đang tải Zalo Web. Anh có thể đăng nhập bằng QR hoặc thông tin tài khoản." },
  ready: { label: "Đã tải trang", detail: "Zalo đã tải. Trạng thái đăng nhập do Zalo hiển thị trong cửa sổ riêng." },
  failed: { label: "Không thể tải trang", detail: "Kiểm tra kết nối mạng rồi thử tải lại." },
};

export function ZaloPage({ notify }: { notify: (message: string) => void }) {
  const [status, setStatus] = useState(defaultStatus);
  const [busy, setBusy] = useState(false);
  const desktopApi = window.signalDesk;

  useEffect(() => {
    if (!desktopApi) return;
    let active = true;
    void desktopApi.getZaloStatus().then((next) => { if (active) setStatus(next); }).catch(() => { if (active) setStatus({ status: "failed", error: "Không thể đọc trạng thái Zalo." }); });
    const unsubscribe = desktopApi.onZaloStatus((next) => setStatus(next));
    return () => { active = false; unsubscribe(); };
  }, [desktopApi]);

  async function runAction(action: () => Promise<ZaloStatus | { cancelled: boolean; state?: ZaloStatus; error?: string }>, successMessage: string) {
    if (!desktopApi || busy) return;
    setBusy(true);
    try {
      const result = await action();
      if ("status" in result) setStatus(result);
      else if (result.state) setStatus(result.state);
      if (!("cancelled" in result) || !result.cancelled) notify(successMessage);
      if ("error" in result && result.error) setStatus({ status: "failed", error: result.error });
    } catch {
      setStatus({ status: "failed", error: "Không thể điều khiển cửa sổ Zalo. Hãy thử mở lại ứng dụng." });
    } finally {
      setBusy(false);
    }
  }

  const shown = stateCopy[status.status];
  const statusError = status.error;

  return <div className="standard-page"><PageIntro eyebrow="KÊNH CÁ NHÂN" title="Zalo" subtitle="Đăng nhập tài khoản cá nhân trong cửa sổ riêng của SignalDesk." />
    <section className="integration-hero" aria-labelledby="zalo-card-title"><div className="integration-symbol zalo-symbol"><Smartphone size={25} /></div><div className="integration-copy"><div className="integration-title"><h3 id="zalo-card-title">Zalo Web</h3><span className={`connection-badge ${status.status === "ready" ? "loaded" : status.status === "failed" ? "disconnected" : "disconnected"}`}><i /> {shown.label}</span></div><p>{statusError || shown.detail}</p><div className="zalo-actions"><button className="primary-button" onClick={() => void runAction(() => desktopApi!.openZalo(), "Đã mở cửa sổ Zalo trong SignalDesk.")} disabled={!desktopApi || busy}><ExternalLink size={16} /> Mở Zalo</button><button className="secondary-button" onClick={() => void runAction(() => desktopApi!.reloadZalo(), "Đã tải lại Zalo.")} disabled={!desktopApi || busy}><RefreshCw size={16} /> Tải lại</button><button className="secondary-button" onClick={() => void runAction(() => desktopApi!.focusZalo(), "Đã đưa Zalo lên trước.")} disabled={!desktopApi || busy}><MessageCircle size={16} /> Đưa cửa sổ lên trước</button><button className="text-action danger-text" onClick={() => void runAction(() => desktopApi!.resetZaloSession(), "Đã xóa phiên Zalo trên máy này.")} disabled={!desktopApi || busy}>Xóa phiên đã lưu</button>{busy && <LoaderCircle className="spin" size={18} aria-label="Đang xử lý" />}</div></div><div className="integration-decoration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-core"><MessageCircle size={25} /></div></div></section>
    <div className="integration-cards"><div className="integration-card"><ShieldCheck size={19} /><strong>Đăng nhập trên Zalo</strong><p>Mật khẩu và mã xác thực được nhập trực tiếp trên trang Zalo.</p></div><div className="integration-card"><Smartphone size={19} /><strong>Quét mã QR</strong><p>Dùng ứng dụng Zalo trên điện thoại để quét và xác nhận đăng nhập.</p></div><div className="integration-card"><Inbox size={19} /><strong>Phiên riêng của app</strong><p>Đóng cửa sổ không xóa phiên. Xóa phiên chỉ thực hiện khi anh xác nhận.</p></div></div>
    <div className="notice-banner"><MessageCircle size={17} /><span>SignalDesk chưa đồng bộ tin nhắn Zalo vào Inbox nội bộ. Nếu mở SignalDesk bằng trình duyệt web, các điều khiển desktop sẽ không khả dụng.</span></div>
  </div>;
}
