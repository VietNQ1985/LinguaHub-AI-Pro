# LinguaHub AI Pro

LinguaHub mở WhatsApp Web hoặc Microsoft Teams Web trong cửa sổ riêng và hiển thị bản dịch tiếng Việt ở panel bên phải. Ứng dụng không tự gửi tin nhắn.

## Dịch tin nhắn đang hiển thị

1. Mở WhatsApp hoặc Microsoft Teams trong LinguaHub và đăng nhập.
2. Chọn ChatGPT trong **Cài đặt** (đăng nhập bằng tài khoản ChatGPT đã liên kết) hoặc chọn Ollama chạy trên máy.
3. Mở **Dịch tự động** → **Bật dịch** và cho phép LinguaHub đọc chữ trong chat.
4. Nếu dùng ChatGPT, xác nhận thêm việc gửi chữ tin nhắn hiển thị đến OpenAI. Ollama không gửi nội dung ra khỏi máy.
5. LinguaHub đọc các bong bóng tin nhắn đang hiển thị qua DOM của trang, tự phát hiện tiếng Anh, dịch sang tiếng Việt và bỏ qua tin không phải tiếng Anh. **Không chụp màn hình, không dùng OCR và không đọc chat đang ẩn.** Có thể mở mục “Cách đọc tin nhắn” để xem chữ đã đọc hoặc nhấn **Tạm dừng**.

Bản cài Windows x64 vừa build: `release/LinguaHub-AI-Pro-Setup.exe`; SHA-256 `f13c34ddb8565048aeb4bda7573209429cfc5a307ad41e448207454694fb8e3b`.

Trang web có thể thay đổi cấu trúc DOM; tin nhắn đang tải lười hoặc chưa được dựng trong giao diện không được đọc. Hiện chưa xác nhận end-to-end trên trang WhatsApp/Teams trực tiếp sau thay đổi adapter.

## Ứng dụng và quyền riêng tư

- Thanh trên cùng chuyển giữa WhatsApp và Microsoft Teams; panel bên phải có **Dịch tự động** và **Gợi ý trả lời**. Khung dịch vẫn được giữ khi đổi tab hoặc thu gọn panel.
- Quyền đọc chữ trong chat và quyền gửi chữ đến ChatGPT là hai xác nhận độc lập. Dừng dịch sẽ ngừng đọc và thu hồi quyền gửi nền trong phiên.
- Chế độ che email/số điện thoại có thể bật trước khi gửi cloud nhưng chỉ là heuristic. Không lưu nội dung chat, mật khẩu hoặc cookie ChatGPT vào cơ sở dữ liệu ứng dụng/log.
- Thông báo Windows do WhatsApp/Teams phát cần được bật trong từng website và vẫn phải kiểm tra với tin nhắn thật.
- Có từ vựng, lịch ôn, bài học mẫu, English Coach, cài đặt lưu trữ và xóa dữ liệu cục bộ.

## Kiểm tra

- `npm run typecheck` — kiểm tra kiểu TypeScript.
- `npm test` — kiểm thử logic AI, quyền consent, đọc DOM mô phỏng cho WhatsApp/Teams, OAuth, thông báo, cơ sở dữ liệu và học tập.
- `npm run build` — tạo ứng dụng.
- `npm run dist` — build và đóng gói installer Windows NSIS x64.

Kiểm thử DOM dùng trang HTML tổng hợp; nó không chứng minh bộ chọn vẫn khớp mọi phiên bản WhatsApp/Teams. Bản dịch thật cũng phụ thuộc quyền/quota tài khoản ChatGPT hoặc model Ollama đã cài. LinguaHub không tự bật API trả phí và không tự gửi tin nhắn.

## Phát triển

`npm run dev` mở ứng dụng ở chế độ phát triển. Tích hợp ChatGPT dùng đăng nhập SIWC/OAuth PKCE và kết nối model theo quyền tài khoản; app không điều khiển giao diện Codex/ChatGPT và không dùng API key. Tin nhắn chỉ gửi tới model sau xác nhận cloud riêng. Tài liệu tham khảo: [đăng nhập SIWC](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [phiên và refresh](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions), [model/inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference).
