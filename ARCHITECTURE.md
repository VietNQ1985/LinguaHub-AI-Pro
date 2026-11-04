# Kiến trúc hiện tại

## Ranh giới tiến trình

Main process quản lý `BrowserWindow`, hai `WebContentsView`, IPC, SQLite và AI. Renderer React không có Node integration; preload chỉ công bố các hàm cụ thể. WhatsApp và Teams dùng profile Chromium riêng, persistent, sandbox và context isolation. Main xác thực sender/frame của IPC và giới hạn điều hướng theo HTTPS/domain.

## Đọc chat hiển thị

Khi người dùng bật dịch và chấp thuận, main process chạy một script đọc cố định trong `WebContentsView` đang hoạt động bằng `webContents.executeJavaScript`. Script chỉ truy vấn các selector của vùng chat, lọc bong bóng nhìn thấy trong viewport, lấy chữ và hướng trái/phải; nó không chụp ảnh, sửa DOM, đọc cookie hay gửi tin nhắn. Mỗi lần quét giới hạn tối đa 60 tin và 4.000 ký tự/tin. Tên hội thoại chỉ được dùng cục bộ để băm thành tín hiệu đổi cuộc trò chuyện; không đưa vào payload AI.

Renderer đợi chữ ổn định qua hai lần đọc, chống trùng, hủy batch khi đổi hội thoại, giới hạn kích thước request và cache bản dịch theo model/nội dung trong bộ nhớ. AI tự nhận diện ngôn ngữ; dịch tiếng Anh sang tiếng Việt và trả kết quả rỗng với ngôn ngữ khác. Selector WhatsApp/Teams không phải API ổn định; kiểm thử tự động dùng DOM tổng hợp, chưa kiểm chứng trên trang thật sau thay đổi.

Đọc cục bộ cần một xác nhận riêng. Gửi tin nhắn hiển thị qua ChatGPT cần xác nhận cloud thứ hai; Ollama dùng endpoint cố định `127.0.0.1:11434`. Dừng dịch thu hồi hai quyền trong phiên và hủy yêu cầu đang chạy. Khi cửa sổ bị ẩn/thu nhỏ hoặc view không hoạt động, main không đọc. Che email/số điện thoại là heuristic, có thể bỏ sót hoặc che nhầm.

## Website và thông báo

Hai `WebContentsView` giữ sống khi chuyển dịch vụ hoặc ẩn ở màn hình **Tổng quan**; profile đăng nhập không bị hủy. Chiều rộng panel được lưu, kéo giãn và thu gọn; main cập nhật bounds view theo layout. Notification permission chỉ được hỏi riêng cho origin WhatsApp/Teams và chỉ được cấp theo lựa chọn người dùng. Chromium Web Notifications là đường gửi toast; app đặt AppUserModelID/ToastActivatorCLSID và sửa shortcut Start Menu khi chạy bản đóng gói. Chưa xác nhận thông báo do website phát bằng tin nhắn thật. Không có tray nên đóng app sẽ dừng thông báo web.

## AI

ChatGPT dùng OAuth PKCE qua trình duyệt hệ thống và callback loopback, ID token được xác minh bằng JWKS/issuer/audience/nonce. Token được mã hóa bằng Electron safeStorage, làm mới theo hạn và thu hồi khi người dùng ngắt kết nối. Model catalog theo quyền tài khoản; Responses API chạy `store=false`, `stream=true`. Ollama gọi endpoint cục bộ. Không dùng API key.

Kết quả AI được kiểm tra bằng Zod. Gợi ý trả lời yêu cầu đủ ba kiểu; tóm tắt/cảnh báo và gợi ý theo dõi phải có dẫn chứng khớp nguyên văn. Kiểm tra cấu trúc không chứng minh mọi kết luận AI chính xác. Tình trạng inference ChatGPT phụ thuộc quota dùng chung của tài khoản.

Composer giữ riêng câu tiếng Việt, bản xem trước tiếng Anh, nguồn ngữ cảnh và trạng thái sửa tay. Tác vụ dịch câu trả lời truyền tối đa 20 tin gần nhất, giọng điệu và bản nháp; reasoning dùng cấu hình dành riêng cho dịch. Thay hội thoại hủy request đang chờ và khóa sao chép bản xem trước gắn với hội thoại cũ. UI chỉ cung cấp sao chép; không có IPC chèn/gửi tin vì adapter hiện chưa thể ràng buộc người nhận và xác minh kết quả.

## Dữ liệu và phát hành

SQLite qua sql.js/Drizzle lưu từ vựng, lịch ôn, tiến độ, lượt AI theo provider/task, tùy chọn thông báo, theme/model, chiều rộng panel và kỳ hạn lưu. Thống kê không chứa prompt/nội dung chat. Chat không tự lưu. Log chỉ dùng mã sự kiện cố định, không ghi URL/chat/token. Cookie đăng nhập website do Chromium quản lý trong từng profile.

Script phát hành sao chép output vào thư mục snapshot trước khi electron-builder đọc. Bộ cài NSIS chưa ký số; SHA-256 được tạo sau khi đóng gói. Build thành công không thay thế kiểm thử cài đặt/gỡ và chạy thực tế.
