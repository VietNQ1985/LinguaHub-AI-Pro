# Huy hiệu chưa đọc trên thanh tab

WhatsApp, Teams và Zalo Web có số đỏ hoặc chấm đỏ cạnh tên tab. Bản sửa đọc metadata huy hiệu trong DOM của mỗi trang bằng MutationObserver (gộp thay đổi 120ms), kể cả WebContentsView đang ẩn; dùng số ở tiêu đề làm dự phòng khi chưa nhận diện được nguồn DOM. Chỉ IPC số, chấm hoặc trạng thái chưa có nguồn; không gửi tên liên hệ, bản xem trước hay nội dung chat và không dùng AI.

Main kiểm tra WebContents thuộc workspace, frame chính, URL hợp lệ và kiểu/giới hạn dữ liệu trước khi cập nhật React. Chấm đỏ dùng khi chỉ biết có chưa đọc, không bịa số 1. Tổng trên thanh điều hướng được ưu tiên để tránh cộng lại cùng số từ danh sách chat. Bỏ node lồng trùng và node ẩn; bỏ vùng tin nhắn/editor và lệnh đánh dấu chưa đọc. Khi nguồn DOM đã nhận diện mất huy hiệu, báo 0 để xóa badge. Navigation xóa nguồn cũ; xóa dữ liệu LinguaHub cũng xóa bộ đếm. Không tự xóa chỉ vì người dùng chuyển tab.

Trang phải được mở ít nhất một lần trong lượt chạy app. Selector DOM có thể thay đổi theo website; danh sách chat ảo hóa có thể chỉ render một phần nên số không được coi là tổng tin tuyệt đối. Nếu website không có marker phù hợp hoặc không cập nhật DOM khi nền, chưa thể bảo đảm có badge. Không tự bật quyền thông báo Windows hoặc quyền đọc/dịch chat. Zalo PC đã được gỡ.

Log chẩn đoán workspace-unread chỉ ghi tên dịch vụ cố định, nguồn dom/title và số/dot, không có nội dung chat hay URL. Giữ cơ chế xoay vòng log hiện có.

Validation ngày 04/11/2026: typecheck đạt, toàn bộ 29 file/109 test đạt (bao gồm số, chấm, xóa badge, cộng trùng, node ẩn và cleanup). Build đạt. Chạy scripts/smoke-unread-electron.cjs bằng Electron 45 với HTTPS fixture trong session riêng: cả WhatsApp/Teams/Zalo đều nhận 2 → 5 → 0 qua preload sandbox/contextIsolation và IPC frame chính khi view ẩn, title không đổi. Fixture không tải website hoặc tài khoản thật. Chưa xác minh marker và nhận tin thật trên phiên đang đăng nhập của người dùng; cần cập nhật app rồi kiểm tra.
