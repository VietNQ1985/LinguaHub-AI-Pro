# Electron gọn hơn và Outlook

Ngày 05/11/2026. Dựa trên source ZIP 04/11/2026 trùng bản Electron đang cài (renderer index-CdDzUGMf.js).

Đã bỏ tab, điều hướng và bộ đọc Zoom/Google Meet; bỏ luồng gọi Ollama, chọn model Ollama, tải model và nạp Whisper, worker giọng nói, bắt âm thanh hệ thống và tài nguyên ONNX. Không gỡ phần mềm Ollama độc lập nếu người dùng có cài. Không xóa thư mục dữ liệu/model cũ trên máy; chúng không được nạp bởi bản này.

Giữ WhatsApp, Teams, Zalo Web/PC, ChatGPT đã đăng nhập, đọc DOM, dịch tiếng Việt, gợi ý trả lời, TTS, khay hệ thống và thông báo chung không chứa nội dung. Dịch cuộc họp Teams vẫn đọc chữ phụ đề của Teams, không thu âm. Windows Win+H có thể dùng trong ô nhập theo cấu hình Windows.

Outlook Web mặc định mở https://outlook.office.com/mail/ với partition persist:linguahub-outlook riêng. Outlook chỉ khởi tạo khi người dùng chọn tab. Đọc email giới hạn phần thư đang mở, loại bản nháp và hộp thư liệt kê; xin quyền đọc Outlook riêng trước khi đọc/dịch. Các nút gửi email tự động bị chặn; sao chép câu trả lời và tự kiểm tra người nhận trong Outlook. Đăng nhập Microsoft và tương thích DOM tài khoản thật cần người dùng kiểm tra; các selector được kiểm thử trên fixture, không khẳng định mọi phiên bản Outlook đều đã được xác minh.

Thông báo Outlook được bật riêng trong Cài đặt, nội dung vẫn chỉ là Có thông báo mới. Huy hiệu lấy số từ navigation/tree hoặc tiêu đề được website công bố, không lấy nội dung thư.

Giữ appId, productName và tên các partition cũ để cập nhật bình thường giữ phiên đăng nhập. Không đóng gói userData hoặc credential. Bản gốc và source ZIP không bị sửa.

RAM còn phụ thuộc số tab chat/email thực sự mở. Việc loại thư viện/model giúp tránh RAM Whisper; kích thước bộ cài không tự chứng minh mức RAM sau đăng nhập. Chưa có benchmark cùng trạng thái tài khoản thật trước/sau.

Kiểm tra cuối: typecheck đạt; 127/127 tests đạt; smoke preload Electron 4 dịch vụ đạt (huy hiệu 2→5→0 trong tab ẩn); smoke đọc email bằng Chromium thật đạt trên fixture. Build NSIS x64 đạt. Xác minh ASAR/preload/SQL resource và không có thư viện Whisper/ONNX đạt. Installer 136826113 bytes; ASAR 85315513 bytes. Chưa đăng nhập Outlook tài khoản thật và chưa đo RAM so sánh cùng phiên chat.
