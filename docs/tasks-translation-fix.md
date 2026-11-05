# Công việc độc lập và sửa lỗi dịch — 05/11/2026

Đã khảo sát read-only app.asar AritoActive tại Program Files: package arito-mobile-app; UI đóng gói trong dist/assets/index-Dhb7-dh3.js; route /chat/task có nhãn Công việc. Chưa khảo sát đầy đủ trường dữ liệu và hành vi trên server Arito. Không chép mã, tài nguyên, credential hoặc dữ liệu công việc của Arito.

Module TasksPanel/tasks.ts mới viết riêng cho LinguaHub. Lưu file linguaHub-tasks.json (tên thực tế linguahub-tasks.json) tại userData, không dùng server Arito. Có tạo/sửa, trạng thái, ưu tiên, người phụ trách dạng văn bản, hạn ngày, ghi chú và lọc/tìm. Chưa hỗ trợ giao việc nhiều người qua mạng, đính kèm, đồng bộ hoặc nhập dữ liệu Arito. Ghi tuần tự và thay file sau khi hoàn tất; đọc file lỗi giữ nguyên dữ liệu.

Sửa lỗi dịch: bộ parse JSON giữ nguyên escape hợp lệ, chỉ bổ sung escape cho dấu backslash không hợp lệ trong chuỗi, tiếp tục kiểm tra schema và mã tin. JSON cắt cụt/sai cấu trúc vẫn báo lỗi rõ. Không gọi thêm AI để sửa định dạng.

Typecheck đạt trước khi thêm bài test lưu công việc; 132/132 tests đạt; build NSIS đạt và xác minh gói không có Whisper/ONNX đạt. Chưa smoke UI tạo/sửa việc trên app đóng gói hoặc kiểm chứng dịch thực tế trên email của người dùng. Bộ cài có trong Downloads, tên LinguaHub-AI-Pro-Tasks-Translation-Fix-2026-11-05.exe.
