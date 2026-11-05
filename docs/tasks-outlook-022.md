# Công việc và Outlook 0.2.3

## Hành vi

Gợi ý công việc nằm ngay đầu panel của WhatsApp, Teams, Zalo Web và Outlook. Bấm **Gợi ý công việc** để phân tích chat/email đang hiển thị; chỉ nội dung đó được gửi đến mô hình đã chọn. Không có yêu cầu AI tự chạy khi có tin mới. Cùng nội dung, cùng mô hình chỉ được phân tích một lần cho mỗi lượt đang mở.

Đề xuất phải có trích dẫn khớp nguồn, được gộp theo tên, có **Thêm/Bỏ** ngay trong panel và nút **＋ Thêm tất cả (N)** để lưu hàng loạt. Chỉ bấm Thêm mới lưu. Không tự đặt hạn từ ngôn ngữ mơ hồ. Đổi ứng dụng, chat hoặc nội dung sẽ hủy tác vụ còn chạy và xóa đề xuất cũ.

Tab **Công việc** là nơi quản lý danh sách đã lưu:
- Thêm nhanh bằng phím Enter, tìm kiếm tức thì, lọc nguồn, sắp xếp linh hoạt (Quan trọng, Hạn chót, Mới nhất, Tên A-Z).
- Bộ lọc thông minh: Tất cả, Hôm nay, Quan trọng, Quá hạn, Đang làm, Đã xong.
- Nút **Sao chép báo cáo** (Standup Report) tự động tạo bản tổng kết việc đã làm / đang làm / cần làm dạng Markdown để gửi Zalo / Teams / Email.
- Nút điều hướng 1-click **Mở [App]** nhảy ngay về ứng dụng nguồn tương ứng.
- Thanh tiến độ KPI trực quan hiển thị tỷ lệ % hoàn thành trong ngày.
- Nút **Dọn việc đã xong** để dọn dẹp các đầu việc hoàn thành.
- Khung chi tiết: ghi chú, checklist tối đa 30 bước (nhập bằng phím Enter), bộ hẹn giờ nhanh (presets) cho cả Hạn hoàn thành và Giờ nhắc.
- Hoàn thành nhanh bằng checkbox và thao tác nhanh Bắt đầu làm / Tạm dừng trên từng hàng; giữ được công việc 0.2.1.

Nhắc hạn tiếp tục dùng SQLite và thông báo chung của 0.2.1: cần app chạy, hoạt động khi ẩn dưới khay; khi mở lại kiểm tra các nhắc chưa phát. Không chứa tiêu đề/trích dẫn công việc trên toast.

## Outlook

Bộ đọc ưu tiên UniqueMessageBody trong ngăn đọc, giữ đoạn và danh sách, loại danh sách thư, thư ẩn và vùng soạn. Nội dung dài chia thành phần nhỏ cho luồng dịch hiện có. Quyền đọc được kiểm tra lại theo dịch vụ; nếu Outlook chưa cấp quyền, nút Bật dịch hiển thị thay cho trạng thái đang dịch cũ. Sự kiện dịch vụ được phát sau khi native workspace đã mở xong để kiểm tra đúng dịch vụ.

## Nguồn tham khảo thiết kế

- [Todoist Inbox](https://www.todoist.com/help/todoist/get-started/use-the-inbox-in-todoist-HwHvYErS): thu thập đầu việc trước khi tổ chức.
- [Todoist filters](https://www.todoist.com/help/todoist/features/introduction-to-filters-V98wIH): tìm và lọc theo nhu cầu.

## Kiểm tra

Typecheck và 85 test frontend đạt; 13 test Rust đạt. Toàn bộ tính năng kiểm tra tự động thành công.
