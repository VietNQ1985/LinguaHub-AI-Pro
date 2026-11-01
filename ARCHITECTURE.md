# Kiến trúc hiện tại

## Ranh giới tiến trình

Main process quản lý `BrowserWindow`, `WebContentsView`, IPC, SQLite và kết nối AI. Renderer React không có Node integration; preload chỉ công bố các thao tác cụ thể. WhatsApp và Teams dùng hai profile Chromium riêng, persistent, sandbox và context isolation; website không nhận preload của app. Main process kiểm tra IPC theo sender/frame và giới hạn điều hướng theo HTTPS/domain.

## Website

Hai `WebContentsView` giữ sống khi chuyển dịch vụ hoặc ẩn ở màn hình **Tổng quan**; profile đăng nhập không bị hủy. Về Tổng quan sẽ dừng OCR và thu hồi đồng ý cloud OCR trong phiên. Chiều rộng panel trợ lý được lưu, kéo giãn và thu gọn; main process cập nhật bounds view theo layout. Reload giữ đúng dịch vụ đang mở. Notification permission chỉ được hỏi riêng cho origin WhatsApp/Teams và chỉ được cấp theo lựa chọn người dùng. Chromium Web Notifications là đường gửi toast; app đặt AppUserModelID/ToastActivatorCLSID ổn định và sửa shortcut Start Menu khi chạy bản đóng gói; vẫn cần phép thử bằng tin nhắn thật. Liên kết popup HTTPS công khai phải được người dùng xác nhận trước khi mở ngoài app. Không có tray nên đóng hẳn app sẽ dừng notification web.

## AI

Ollama gọi endpoint cố định `127.0.0.1:11434`. ChatGPT dùng OAuth PKCE qua system browser và callback loopback, ID token được xác minh bằng JWKS/issuer/audience/nonce. `ext_agent_host_id` ổn định; issued client ID được lưu trước khi đổi authorization code và tái sử dụng. Access token gần hết hạn được làm mới theo form OAuth; refresh được serialize trong một tiến trình, ID token mới (nếu có) được xác minh cùng subject, token xoay được ghi mã hóa bằng Electron safeStorage. Thu hồi refresh token được thử trước khi xóa local token và retry khi lỗi mạng/5xx. Dùng model catalog theo tài khoản; Responses API chạy `store=false`, `stream=true` và chỉ chấp nhận `response.completed`.

Kết quả AI được kiểm tra bằng Zod. Reply yêu cầu đủ ba kiểu riêng biệt; tóm tắt/cảnh báo và gợi ý theo dõi phải có dẫn chứng khớp nguyên văn. Câu OCR có thể chuyển sang English Coach. Đây chỉ là kiểm tra cấu trúc và dẫn chứng, không chứng minh mọi suy luận AI chính xác. Nội dung nhập tay dùng ChatGPT sau một xác nhận; dịch OCR nền cần quyền riêng trong phiên app. Gói Plus chia sẻ hạn mức với các app khác. Hồ sơ SIWC và model catalog đã được xác minh thật; inference hiện dừng vì quota chia sẻ, refresh/thu hồi thật vẫn chưa kiểm chứng. Che email/số điện thoại là heuristic và có thể bỏ sót hoặc che nhầm số nghiệp vụ.

## OCR

Sau xác nhận, main dùng `capturePage` lấy ảnh vùng `WebContentsView` đang hiển thị rồi cắt theo vùng người dùng chỉnh. Renderer chạy Tesseract trong Chromium Web Worker; worker và core lấy từ tài nguyên cục bộ của bản cài. Ảnh không lưu/gửi cloud. Chữ OCR được dịch bằng Ollama cục bộ; nếu chọn ChatGPT, app hiện hộp thoại đồng ý riêng trước khi gửi chữ nhận dạng đến OpenAI. Mỗi yêu cầu ChatGPT dạng `translateMessages` bị chặn nếu chưa có quyền nền; dừng OCR sẽ thu hồi quyền nền trong phiên và hủy worker. Kết quả Tesseract được nhóm theo tọa độ dòng, vùng đầu dùng làm nhãn hội thoại để tạo fingerprint cục bộ; tin mới phải ổn định hai lần. Có cache theo model/nội dung, giới hạn kích thước batch, hủy khi đổi workspace/hội thoại và dừng khi cửa sổ ẩn/thu nhỏ. Worker/core đã chạy trên ảnh tổng hợp trong tài nguyên bản cài; dấu sender và segmentation vẫn heuristic, chưa đo độ chính xác trên UI thật.

## Dữ liệu

SQLite qua sql.js/Drizzle lưu từ vựng, lịch ôn, event tiến độ, số lượt AI thành công theo provider/task, notification preferences, theme/model, chiều rộng panel và kỳ hạn lưu. Thống kê AI không chứa prompt hoặc nội dung chat. Mặc định giữ dữ liệu học đến khi người dùng xóa; chọn 30/90/365 ngày sẽ hỏi xác nhận, rồi tự dọn dữ liệu cũ hơn. Nút xóa từ vựng xóa cả lịch sử học. Thao tác xóa toàn bộ cũng thử thu hồi ChatGPT, xóa thông tin đăng ký cục bộ và xóa dữ liệu hai profile web sau xác nhận. Nội dung chat không tự lưu. Bản thu luyện nói chỉ là Blob trong bộ nhớ renderer. Log chỉ dùng mã sự kiện cố định, không ghi URL/chat/token. Cookie website đăng nhập do Chromium quản lý trong từng profile.

## Phát hành

Script đóng gói sao chép out vào thư mục snapshot riêng trước khi electron-builder đọc. Bộ cài NSIS chưa có chữ ký số. SHA-256 được tạo sau khi đóng gói thành công. Các bản snapshot và release bị loại khỏi Git. Build thành công không thay thế kiểm thử cài đặt/gỡ và chạy thực tế.
