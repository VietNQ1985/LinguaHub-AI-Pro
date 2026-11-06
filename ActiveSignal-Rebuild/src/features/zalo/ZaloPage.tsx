import { LoaderCircle, MessageCircle, RefreshCw, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ZaloStatus } from "../../types/zalo";
import { PageIntro } from "../../components/ui";

const defaultStatus: ZaloStatus = { status: "closed", error: null };

const stateCopy: Record<ZaloStatus["status"], { label: string; detail: string }> = {
  closed: { label: "Chưa mở Zalo", detail: "Mở Zalo ngay trong trang này. Phiên đăng nhập được lưu riêng trên máy." },
  opening: { label: "Đang mở", detail: "SignalDesk đang tạo khung Zalo." },
  loading: { label: "Đang tải", detail: "Đang tải Zalo Web. Anh có thể đăng nhập bằng QR hoặc phương thức Zalo cung cấp." },
  ready: { label: "Đã tải trang", detail: "Zalo đang hiển thị trong SignalDesk. Trạng thái đăng nhập do Zalo hiển thị." },
  failed: { label: "Không thể tải trang", detail: "Kiểm tra kết nối mạng rồi thử tải lại." },
};

export function ZaloPage({ notify }: { notify: (message: string) => void }) {
  const [status, setStatus] = useState(defaultStatus);
  const [busy, setBusy] = useState(false);
  const viewHost = useRef<HTMLDivElement>(null);
  const desktopApi = window.signalDesk;

  function updateViewBounds() {
    if (!desktopApi) return;
    const rect = viewHost.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      void desktopApi.setZaloViewBounds(null).catch(() => undefined);
      return;
    }
    void desktopApi.setZaloViewBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height }).catch(() => undefined);
  }

  useEffect(() => {
    if (!desktopApi) return;
    let active = true;
    void desktopApi.getZaloStatus().then((next) => { if (active) setStatus(next); }).catch(() => { if (active) setStatus({ status: "failed", error: "Không thể đọc trạng thái Zalo." }); });
    const unsubscribe = desktopApi.onZaloStatus((next) => setStatus(next));

    const syncBounds = () => { if (active) updateViewBounds(); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncBounds);
    if (viewHost.current) observer?.observe(viewHost.current);
    window.addEventListener("resize", syncBounds);
    window.addEventListener("scroll", syncBounds, true);
    syncBounds();

    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", syncBounds);
      window.removeEventListener("scroll", syncBounds, true);
      unsubscribe();
      void desktopApi.setZaloViewBounds(null).catch(() => undefined);
    };
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
      setStatus({ status: "failed", error: "Không thể điều khiển Zalo. Hãy thử mở lại ứng dụng." });
    } finally {
      setBusy(false);
    }
  }

  async function openZalo() {
    await runAction(() => desktopApi!.openZalo(), "Đã mở Zalo ngay trong SignalDesk.");
    updateViewBounds();
  }

  const shown = stateCopy[status.status];
  const statusError = status.error;

  return <div className="standard-page zalo-page">
    <PageIntro eyebrow="KÊNH CÁ NHÂN" title="Zalo" subtitle="Đăng nhập tài khoản cá nhân ngay trong SignalDesk." />
    <section className="zalo-toolbar" aria-labelledby="zalo-card-title">
      <div className="zalo-toolbar-copy">
        <div className="zalo-toolbar-icon"><MessageCircle size={21} /></div>
        <div className="zalo-toolbar-text">
          <div className="integration-title"><h3 id="zalo-card-title">Zalo Web</h3><span className={`connection-badge ${status.status === "ready" ? "loaded" : "disconnected"}`}><i /> {shown.label}</span></div>
          <p>{statusError || shown.detail}</p>
        </div>
      </div>
      <div className="zalo-actions">
        <button className="primary-button" onClick={() => void openZalo()} disabled={!desktopApi || busy}><MessageCircle size={16} /> Mở Zalo</button>
        <button className="secondary-button" onClick={() => void runAction(() => desktopApi!.reloadZalo(), "Đã tải lại Zalo.")} disabled={!desktopApi || busy || status.status === "closed"}><RefreshCw size={15} /> Tải lại</button>
        <button className="secondary-button" onClick={() => void runAction(() => desktopApi!.focusZalo(), "Đã chuyển tiêu điểm vào Zalo.")} disabled={!desktopApi || busy || status.status === "closed"}><Smartphone size={15} /> Tập trung Zalo</button>
        <button className="text-action danger-text" onClick={() => void runAction(() => desktopApi!.resetZaloSession(), "Đã xóa phiên Zalo trên máy này.")} disabled={!desktopApi || busy}>Xóa phiên đã lưu</button>
        {busy && <LoaderCircle className="spin" size={18} aria-label="Đang xử lý" />}
      </div>
    </section>
    <section className="zalo-view-frame" aria-label="Khung Zalo">
      <div className="zalo-view-host" ref={viewHost} />
      {status.status === "closed" && <div className="zalo-view-empty">
        <div><MessageCircle size={24} /></div>
        <strong>{desktopApi ? "Zalo sẽ hiển thị tại đây" : "Mở SignalDesk trên máy tính để dùng Zalo"}</strong>
        <span>{desktopApi ? "Nhấn “Mở Zalo” để tải trang và đăng nhập bằng tài khoản cá nhân." : "Tính năng đăng nhập Zalo cần ứng dụng SignalDesk dành cho Windows."}</span>
      </div>}
    </section>
    <div className="notice-banner zalo-notice"><ShieldCheck size={17} /><span>Phiên đăng nhập Zalo được lưu riêng trên máy này. Chuyển sang mục khác sẽ ẩn khung nhưng không đăng xuất. “Xóa phiên đã lưu” sẽ yêu cầu xác nhận trước khi xóa.</span></div>
  </div>;
}
