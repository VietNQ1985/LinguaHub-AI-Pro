# LinguaHub AI Pro

LinguaHub mở WhatsApp Web hoặc Microsoft Teams Web trong cửa sổ riêng và hiển thị bản dịch tiếng Việt ở panel bên phải. Ứng dụng không tự gửi tin nhắn.

## Dịch tin nhắn đang hiển thị

1. Mở WhatsApp hoặc Microsoft Teams trong LinguaHub và đăng nhập.
2. Chọn ChatGPT trong **Cài đặt** (đăng nhập bằng tài khoản ChatGPT đã liên kết) hoặc chọn Ollama chạy trên máy.
3. Mở **Dịch tự động** → **Bật dịch** và cho phép LinguaHub đọc chữ trong chat.
4. Nếu dùng ChatGPT, xác nhận thêm việc gửi chữ tin nhắn hiển thị đến OpenAI. Ollama không gửi nội dung ra khỏi máy.
5. LinguaHub đọc các bong bóng tin nhắn đang hiển thị qua DOM của trang, tự phát hiện tiếng Anh, dịch sang tiếng Việt và bỏ qua tin không phải tiếng Anh. **Không chụp màn hình, không dùng OCR và không đọc chat đang ẩn.** Có thể mở mục “Cách đọc tin nhắn” để xem chữ đã đọc hoặc nhấn **Tạm dừng**.

## Gợi ý trả lời theo cuộc trò chuyện

Trong **Gợi ý trả lời**, nhấn **Đọc chat & gợi ý trả lời** để tạo ba cách trả lời dựa trên các tin đang hiển thị. Có thể thêm ý muốn nói bằng tiếng Việt hoặc để trống để AI tự đề xuất theo ngữ cảnh. LinguaHub chỉ đưa bản nháp, không tự gửi. ChatGPT cần quyền đọc cục bộ và quyền gửi chữ chat hiển thị riêng; Ollama xử lý trên máy.

Trong Cài đặt, model mặc định là **GPT-6 Luna**. Mức suy luận mặc định **Max** áp dụng cho gợi ý trả lời và tác vụ AI khác; dịch có mức riêng mặc định **Low**. **Ưu tiên tốc độ khi dịch** cũng chỉ áp dụng cho dịch và dùng Low. Anh có thể chọn mức dịch riêng mà không đổi mức của tác vụ khác.

Kết quả benchmark theo kịch bản, gồm giới hạn cũ và số đo mới với AI giả lập, nằm trong [docs/translation-speed-benchmark.md](docs/translation-speed-benchmark.md).

Trang web có thể thay đổi cấu trúc DOM; tin nhắn đang tải lười hoặc chưa được dựng trong giao diện không được đọc. Hiện chưa xác nhận end-to-end trên trang WhatsApp/Teams trực tiếp sau thay đổi adapter.

## Ứng dụng và quyền riêng tư

- Thanh trên cùng chuyển giữa WhatsApp và Microsoft Teams; panel bên phải có **Dịch tự động** và **Gợi ý trả lời**. Khung dịch vẫn được giữ khi đổi tab hoặc thu gọn panel.
- Quyền đọc chữ trong chat và quyền gửi chữ đến ChatGPT là hai xác nhận độc lập. Dừng dịch sẽ ngừng đọc và thu hồi quyền gửi nền trong phiên.
- Bộ theo dõi thay đổi chỉ khởi động sau khi anh cho phép đọc chat; nó theo dõi vùng tin nhắn và tiêu đề rồi báo cho bộ đọc cục bộ. Nếu trang thay đổi mà không phát sự kiện phù hợp, bộ quét dự phòng kiểm tra lại sau tối đa 1,8 giây.
- Mở **Cách đọc tin nhắn → Chẩn đoán tốc độ** để xem thời gian phát hiện, xác nhận, chờ lượt AI, AI xử lý/trả kết quả và cập nhật panel. Phần này mặc định được thu gọn.
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


## Dịch cuộc họp Teams (thử nghiệm)
Nhánh meeting thêm quyền thiết bị Teams và mục **Dịch cuộc họp**. Anh tự bật phụ đề tiếng Anh trong Teams, bấm **Bắt đầu dịch** rồi xác nhận quyền riêng cho caption/cloud. Không thu âm hay tự lưu transcript. Tạm dừng/Dừng chỉ dừng dịch, không chủ động ngắt cuộc gọi.

**Chưa xác minh trong cuộc họp Teams thật.** Nếu không tìm được phụ đề thì app báo rõ và dừng; chưa có audio/STT fallback. Xem [hướng dẫn và giới hạn Windows](docs/teams-meeting.md).
