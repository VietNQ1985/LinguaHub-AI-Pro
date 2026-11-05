# Giới hạn hiện tại

## Đọc và dịch chat

- LinguaHub đọc chữ từ DOM của bong bóng tin nhắn đang hiện trong WebContentsView. Nội dung ảnh, âm thanh, file, chữ trong chat đã cuộn khỏi vùng dựng và các trang khác không được đọc.
- WhatsApp/Teams có thể thay đổi DOM hoặc cách ảo hóa danh sách tin; khi đó selector có thể bỏ sót hoặc lấy thiếu tin. Kiểm thử hiện dùng DOM tổng hợp, chưa xác minh trực tiếp adapter mới trên trang thật.
- AI được yêu cầu nhận diện ngôn ngữ từng tin, dịch tiếng Anh sang tiếng Việt và bỏ qua ngôn ngữ khác. Chất lượng và thời gian phản hồi tùy model.
- Đọc chữ cục bộ và gửi chữ tới ChatGPT cần hai xác nhận riêng. ChatGPT dùng quota tài khoản chia sẻ; một lượt trước đây bị từ chối do quota, nên inference thành công chưa được chứng minh trong lần sửa DOM này.
- Không tự gửi tin nhắn, không đọc cookie ChatGPT, không lưu ảnh hoặc nội dung hội thoại, không dùng OCR và không dùng API key.
- Composer V2 dịch câu Việt sang Anh theo ngữ cảnh WhatsApp/Teams, cho sửa bản xem trước và chỉ sao chép. Gửi trực tiếp/chèn vào ô chat bị khóa vì chưa có adapter xác thực người nhận và xác nhận gửi đáng tin cậy. Zalo Web hiện chưa đọc/dịch hội thoại; câu trong composer trên Zalo được dịch riêng không kèm ngữ cảnh. Xem `docs/v2-messaging-capabilities.md`.
- Gợi ý trả lời chỉ chạy khi người dùng bấm; không tự phát sinh thêm yêu cầu AI mỗi khi có tin mới. Nhập giọng nói dùng Win+H của Windows; chưa có microphone/STT tích hợp trong app.

## Xác minh kỹ thuật

- Có kiểm thử tự động cho luồng OAuth/PKCE, refresh/thu hồi giả lập, Responses API, AI schema, quyền consent, selector DOM mô phỏng cho WhatsApp/Teams, thông báo, SQLite và học tập.
- Kiểm thử DOM tổng hợp không thể bảo đảm bộ chọn khớp phiên bản website đang chạy. Chưa có kiểm tra dịch end-to-end trên tin nhắn thật sau thay đổi adapter.
- Thông báo thử của LinguaHub chứng minh Windows nhận toast từ app; thông báo WhatsApp/Teams với tin nhắn thật vẫn cần xác minh trong từng dịch vụ.
- Bộ cài Windows NSIS chưa ký số. Build không thay thế việc cài đặt và chạy kiểm thử trên máy người dùng.

## Tài khoản ChatGPT

- Chỉ hỗ trợ một hồ sơ ChatGPT hiện tại. Token lưu mã hóa bằng Windows safeStorage; nếu token bị thu hồi, cần đăng nhập lại.
- Nhánh có lựa chọn đổi tài khoản/không gian làm việc để khắc phục lỗi `3p_login_workspace_scope_denied`. Kiểm thử callback và lỗi OAuth là mô phỏng; chưa kiểm chứng lại bằng tài khoản/workspace đã gặp lỗi.
- Tích hợp dùng đăng nhập SIWC và quyền gói tài khoản, không dùng API key. Quota và điều kiện inference có thể thay đổi theo tài khoản/thời điểm.

## Sản phẩm

- Không có tray; đóng app sẽ dừng notification web. Chưa hỗ trợ nhiều cửa sổ workspace, gọi/camera Teams hoặc chấm điểm phát âm.
- Bài học hằng ngày hiện là nội dung ERP mẫu; cá nhân hóa chủ yếu từ từ vựng và lịch ôn.
