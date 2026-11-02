# Kiểm tra PR #1: streaming và CI

## Thay đổi đã thực hiện
- Giữ phần tiếng Việt đang stream khi DOM được quét lại; đối chiếu cả khóa và nội dung.
- Giữ bộ đệm stream cho tin đang xử lý khi danh sách ảo tạm đưa tin ra khỏi viewport.
- Xóa bộ đệm khi hủy yêu cầu/đổi model/hội thoại; không tạo thêm yêu cầu cho khóa đang xử lý.
- CI Windows chạy npm ci, typecheck, toàn bộ test và build.

## Kết quả kiểm tra
- Typecheck đạt.
- 19 file test, 81 test đạt trong lượt full suite; test tích hợp renderer mới chạy riêng đạt 1/1; gồm 2 regression test mới về giữ partial text và từ chối nội dung/identity khác.
- Build Electron production đạt. Chưa đóng gói, cài đặt hoặc mở NSIS cho commit này.
- Benchmark hiện có là mô phỏng provider: không phải tốc độ ChatGPT/Ollama thật, cũng chưa phải phép đo renderer/IPC end-to-end.

## Phần còn cần kiểm chứng/triển khai
- Chưa chạy thử trực tiếp WhatsApp/Teams và tài khoản ChatGPT/Ollama cho commit này.
- Đã thêm test mount React thật, mô phỏng cầu IPC: phát stream, báo DOM đổi, kiểm tra tiếng Việt còn hiển thị và chỉ có một yêu cầu AI. Chưa chạy IPC Electron thật.
- Chưa có số p50/p95 thực tế qua toàn bộ renderer và IPC; không dùng số benchmark giả lập làm số thực tế.
- Nhận diện hai hội thoại có tiêu đề giống nhau khi website không cung cấp ID ổn định vẫn cần cải thiện và kiểm thử trực tiếp.
- Chưa xác nhận đầy đủ group chat, edited messages, virtualization, reload và đổi dịch vụ trong phiên thực tế.
- Chưa benchmark chất lượng dịch ERP/tài chính bằng bộ dữ liệu được duyệt.
- Consent nhập tay vẫn tách khỏi quyền đọc chat và gửi chat cloud. Cloud tự động vẫn khởi tạo false khi mở app; chưa có test tích hợp đầy đủ các hộp thoại tài khoản.

Không merge trước khi hoàn tất các phần kiểm chứng còn lại.
