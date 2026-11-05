# Công việc và Outlook 0.2.3

## Hành vi

Gợi ý công việc nằm ngay đầu panel của WhatsApp, Teams, Zalo Web và Outlook. Bấm **Gợi ý công việc** để phân tích chat/email đang hiển thị; chỉ nội dung đó được gửi đến mô hình đã chọn. Không có yêu cầu AI tự chạy khi có tin mới. Cùng nội dung, cùng mô hình chỉ được phân tích một lần cho mỗi lượt đang mở.

Đề xuất phải có trích dẫn khớp nguồn, được gộp theo tên, có **Thêm/Bỏ** ngay trong panel và nút **＋ Thêm tất cả (N)** để lưu hàng loạt. Chỉ bấm Thêm mới lưu. Không tự đặt hạn từ ngôn ngữ mơ hồ. Đổi ứng dụng, chat hoặc nội dung sẽ hủy tác vụ còn chạy và xóa đề xuất cũ.

Tab **Công việc** là nơi quản lý danh sách đã lưu với giao diện hiện đại:
- **Chế độ xem linh hoạt (List & Kanban Board)**: Nút chuyển đổi chế độ xem danh sách hoặc bảng Kanban 3 cột trực quan (Chưa làm, Đang làm, Đã xong) cho phép điều chuyển trạng thái công việc chỉ bằng một cú nhấp.
- **Phím tắt nhanh (Keyboard Shortcuts)**: Phím `N` để mở nhanh ô nhập việc mới, `Esc` để đóng khung chi tiết hoặc hủy bỏ, `?` để hiển thị hướng dẫn phím tắt.
- **Xuất dữ liệu đa định dạng (Export & Backup)**:
  - Nút **Sao chép báo cáo** (Standup Report) tạo bản tổng kết việc đã làm / đang làm / cần làm dạng Markdown gửi Zalo / Teams / Email.
  - Nút **JSON** sao chép toàn bộ dữ liệu cấu trúc phục vụ sao lưu/chuyển đổi.
  - Nút **CSV** định dạng bảng tính mở trực tiếp trên Excel/Google Sheets.
- **Hỗ trợ Dark Mode chuẩn mực**: Đồng bộ giao diện sáng/tối qua hệ thống biến CSS chuyên biệt, đảm bảo các thẻ trạng thái, mức độ ưu tiên và nhãn thời gian hiển thị sắc nét, dịu mắt.
- **Tìm kiếm tức thì & Lọc đa chiều**: Tìm theo tên, ghi chú hoặc trích dẫn nguồn; lọc theo ứng dụng gốc; sắp xếp theo Quan trọng, Hạn chót, Cập nhật mới nhất, Tên A-Z.
- **Bộ lọc thông minh**: Tất cả, Hôm nay, Quan trọng, Quá hạn, Đang làm, Đã xong.
- **Điều hướng 1-click**: Nút **Mở [App]** nhảy ngay về ứng dụng nguồn tương ứng.
- **Tiến độ trực quan**: Thanh KPI hiển thị tiến độ và tỷ lệ % hoàn thành trong ngày.
- **Dọn dẹp công việc**: Nút **Dọn việc đã xong** để xóa sạch các đầu việc đã hoàn thành.
- **Khung chi tiết & Checklist**: ghi chú chi tiết, checklist tối đa 30 bước (nhập nhanh bằng Enter), bộ hẹn giờ nhanh (presets) cho cả Hạn hoàn thành và Giờ nhắc.
- **Thao tác nhanh**: Checkbox hoàn thành, gắn sao ưu tiên, bắt đầu/tạm dừng việc trên từng thẻ.

Nhắc hạn tiếp tục dùng SQLite và thông báo chung của 0.2.1: cần app chạy, hoạt động khi ẩn dưới khay; khi mở lại kiểm tra các nhắc chưa phát. Không chứa tiêu đề/trích dẫn công việc trên toast.

## Outlook

Bộ đọc ưu tiên UniqueMessageBody trong ngăn đọc, giữ đoạn và danh sách, loại danh sách thư, thư ẩn và vùng soạn. Nội dung dài chia thành phần nhỏ cho luồng dịch hiện có. Quyền đọc được kiểm tra lại theo dịch vụ; nếu Outlook chưa cấp quyền, nút Bật dịch hiển thị thay cho trạng thái đang dịch cũ. Sự kiện dịch vụ được phát sau khi native workspace đã mở xong để kiểm tra đúng dịch vụ.

## Nguồn tham khảo thiết kế

- [Todoist Inbox](https://www.todoist.com/help/todoist/get-started/use-the-inbox-in-todoist-HwHvYErS): thu thập đầu việc trước khi tổ chức.
- [Todoist filters](https://www.todoist.com/help/todoist/features/introduction-to-filters-V98wIH): tìm và lọc theo nhu cầu.
- [Kanban Board Best Practices](https://www.atlassian.com/agile/kanban/boards): quy trình làm việc luồng liên tục 3 trạng thái.

## Kiểm tra

- Typecheck TypeScript (`tsc --noEmit`) đạt 100% (0 lỗi).
- 87 test frontend đạt tuyệt đối trên 20 tệp kiểm thử.
- Build client production (`npm run build`) hoàn tất trơn tru.
