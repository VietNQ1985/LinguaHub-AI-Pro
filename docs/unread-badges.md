# Huy hiệu chưa đọc trên thanh tab

WhatsApp, Microsoft Teams và Zalo Web có huy hiệu đỏ cạnh tên tab. Main process nghe sự kiện page-title-updated và did-finish-load của từng workspace, kể cả workspace đã mở nhưng đang ẩn. Không polling, không đọc nội dung hội thoại, không dùng AI. Renderer nhận bộ số đếm qua IPC chỉ từ main; lấy snapshot ban đầu không ghi đè sự kiện mới hơn.

Nguồn hiện tại là số đầu tiêu đề website, như `(2) WhatsApp` hoặc `[12] Microsoft Teams`. Khi website bỏ số, huy hiệu tắt; trên 99 hiển thị 99+. Không tự xóa chỉ vì chuyển tab: trang quản lý trạng thái đã đọc. Website có thể báo số cuộc trò chuyện thay vì số tin nhắn. Chỉ hoạt động sau khi workspace đã được mở và website có cung cấp số trong tiêu đề; chưa có fallback cho trang không công bố số, chưa kiểm chứng sự kiện tin nhắn thật trên cả ba dịch vụ. Không coi số 0 là bằng chứng không có tin mới nếu website không cung cấp badge.

Zalo PC là ứng dụng độc lập, chưa hỗ trợ badge trên thanh tab LinguaHub. Không bật quyền thông báo Windows hay cấp quyền đọc chat mới để chạy huy hiệu.
