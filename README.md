# LinguaHub AI Pro

Ứng dụng Windows gom WhatsApp Web và Microsoft Teams Web vào một cửa sổ, kèm dịch OCR cục bộ, trợ lý viết tiếng Anh và công cụ học từ vựng. Nội dung chat không tự lưu vào cơ sở dữ liệu học; app không tự gửi tin nhắn.

## Mở ứng dụng

Chạy `release/LinguaHub-AI-Pro-Setup.exe`, chọn thư mục cài và mở **LinguaHub AI Pro** từ Start hoặc shortcut Desktop. Đăng nhập WhatsApp/Teams ngay trên website chính thức trong app. Hai phiên đăng nhập được tách riêng và giữ khi chuyển dịch vụ.

Nếu đang mở bản `release/win-unpacked`, thoát hẳn LinguaHub rồi chạy bộ cài để cập nhật. Sau cài đặt, mở app từ Start Menu để Windows dùng shortcut đã đăng ký cho toast.

SHA-256 của bộ cài hiện tại: `0bb2c377aca0c9a987d1bbf7268d93be575ee8adf891cd3c7283a25942b32ab7`.

Mã nguồn có thể chạy bằng `Mo-LinguaHub.cmd` khi máy đã cài Node.js và dependencies. Đây là cách dành cho phát triển.

## Sử dụng

- **Tổng quan** ẩn vùng chat mà vẫn giữ các phiên đăng nhập. Phím tắt: `Ctrl+0` Tổng quan, `Ctrl+1` WhatsApp, `Ctrl+2` Teams, `Ctrl+R` tải lại dịch vụ đang mở.

1. Mở **Cài đặt** ở thanh bên, chọn Ollama nếu muốn xử lý trên máy; cài Ollama và tải model trước. Bấm **Kết nối Ollama** rồi chọn model.
2. Để dùng ChatGPT, mở **Tài khoản ChatGPT** → **Continue with ChatGPT**. Đăng nhập trong trình duyệt OpenAI và xem kỹ quyền sử dụng gói. Sau đó bấm **Dùng model ChatGPT**. App có nút mở **Hạn mức và mức sử dụng ChatGPT**; hạn mức 5 giờ của Plus được chia sẻ với các app khác.
3. Nhập nội dung để dịch, tạo ba phương án trả lời (đơn giản, chuyên nghiệp, thân thiện), dùng English Coach, tóm tắt hoặc rà soát rủi ro. Mỗi câu trả lời có nghĩa tiếng Việt, sao chép, nghe giọng US/UK và giải thích. Anh tự duyệt rồi gửi; app không tự gửi.
4. Tự dịch tin đang hiển thị: mở cuộc trò chuyện, chỉnh thanh vùng OCR để bỏ danh sách liên hệ, bấm **Cho phép và bật OCR** và xác nhận. Chọn Ollama để giữ phần dịch trên máy; nếu chọn ChatGPT, xác nhận thêm quyền riêng để gửi chữ OCR đến OpenAI. Ảnh luôn xử lý cục bộ, không tải lên. OCR chờ nội dung ổn định qua hai lần đọc; tin nhận dạng dưới 65% không gửi đi dịch. Bấm **Dừng OCR** để dừng gửi và ngừng theo dõi. Nút **Học câu này** đưa câu OCR đã xác nhận sang English Coach.

## Học và quyền riêng tư

- Bài học ERP mẫu, lưu từ vựng do anh chọn, lịch ôn lặp lại, số từ đến hạn, chuỗi ngày học và số lượt AI thành công theo provider được lưu cục bộ. App chỉ lưu provider/task, không lưu nội dung vào thống kê.
- Ở **Cài đặt**, chọn giữ dữ liệu học đến khi tự xóa hoặc tự xóa nội dung cũ hơn 30/90/365 ngày. App hỏi xác nhận trước khi áp dụng kỳ hạn xóa. Nút xóa từ vựng cũng xóa lịch sử học.
- Mục **Xóa toàn bộ dữ liệu cục bộ** trong Cài đặt sẽ hỏi xác nhận, thử thu hồi ChatGPT, đăng xuất WhatsApp/Teams, rồi xóa cài đặt và dữ liệu học. Anh cần đăng nhập lại sau đó.
- Bật quyền thông báo WhatsApp/Teams trong **Cài đặt**, rồi bật thông báo Desktop trong từng dịch vụ. Bản cài Windows tạo/sửa shortcut Start Menu với AppUserModelID và ToastActivatorCLSID cho toast. Nút **Thử thông báo Windows** chờ Windows xác nhận yêu cầu toast; tin nhắn thật vẫn cần xác minh.
- OCR chỉ đọc vùng website đang mở sau khi anh cho phép. Ảnh không lưu và không gửi cloud. Chữ OCR chỉ gửi đến ChatGPT sau một xác nhận cloud riêng; Ollama xử lý trên máy. Khi cửa sổ app thu nhỏ hoặc ẩn, OCR tạm dừng; đóng hẳn app thì thông báo web cũng dừng.
- Token ChatGPT được mã hóa bằng Windows safeStorage. Nội dung chat, mật khẩu và cookie ChatGPT không được ghi vào log hoặc cơ sở dữ liệu app. Chế độ che email/số điện thoại là heuristic và có thể bỏ sót.

## Kiểm tra và tình trạng

- `npm run typecheck` — đạt.
- `npm test` — 53 kiểm thử tự động đạt; gồm logic OAuth/refresh/revoke giả lập, định dạng request Responses, AI schema, OCR segmentation và worker browser, đường dẫn tài nguyên OCR dev/bản cài, chính sách notification/shortcut Windows, tách quyền ChatGPT nhập tay và quyền dịch OCR nền, trạng thái thu hồi khi xóa hồ sơ và dữ liệu học.
- OCR dùng Chromium Web Worker với worker/core được đóng gói cục bộ. Worker/core lấy từ đúng thư mục tài nguyên của bản cài đã nhận dạng đúng ảnh thử tiếng Anh với confidence 95%; đây chưa phải kiểm tra trên tin nhắn WhatsApp/Teams thật.
- Đã cài và khởi chạy bản NSIS x64 từ `C:\Program Files\LinguaHub AI Pro`; hash `app.asar` trùng gói build. Shortcut Start Menu ghi `notification-shortcut-ready`; thử toast trong app trả sự kiện `show` của Electron.
- Người dùng xác nhận WhatsApp và Teams đã mở/đăng nhập trong app. Em giải mã được hồ sơ SIWC hiện tại, xác nhận quyền `chatgpt.tokens.use.direct` và lấy 8 model thật. Lượt inference kiểm tra bằng câu mẫu đã tới endpoint nhưng bị từ chối bởi hạn mức ChatGPT dùng chung giữa các ứng dụng; chưa có bản dịch hoàn tất để xác nhận kết quả AI thật.
- Đã sửa request Responses theo hợp đồng hiện hành: `input` là danh sách `{role, content}`. Khi hạn mức được làm mới, có thể thử lại ngay trong app; app không chuyển sang API trả phí.
- Chưa xác minh tin nhắn thật đi qua dịch OCR hoặc toast WhatsApp/Teams. Nút thử toast chỉ chứng minh thông báo của LinguaHub, không chứng minh website gửi notification thật.
- Bộ cài Windows được tạo bằng NSIS. OCR Web Worker và core trong tài nguyên bộ cài nhận dạng ảnh mẫu thành công; gỡ cài đặt và OCR trên hội thoại thật vẫn cần xác minh.
- Không tự bật hoặc gọi API trả phí. Không tự động hóa website ChatGPT để lấy câu trả lời.

## Dành cho phát triển

`npm run dev` khởi chạy, `npm run typecheck` kiểm tra kiểu, `npm test` chạy kiểm thử, `npm run build` tạo output, `npm run dist` thử đóng gói Windows.

Tích hợp ChatGPT bám theo [tài liệu SIWC đăng nhập](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [quản lý phiên và refresh](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) và [model/inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference). Luồng dùng PKCE, callback loopback, token mã hóa cục bộ, refresh khi gần hết hạn và Responses API với `store=false`, `stream=true`, `input` dạng danh sách. Hồ sơ Windows thật và 8 model đã xác nhận; lần inference hiện bị chặn bởi quota dùng chung. Không nhúng `@siwc/local`: [DevKit chính thức](https://github.com/openai/sign-in-with-chatgpt-devkit) cung cấp SDK local và ví dụ desktop chỉ cho macOS; license của code/docs giới hạn ở mục đích phi thương mại, không phù hợp để đưa code đó vào workflow ERP công việc. Luồng của app là phần tự triển khai theo giao thức công khai, không sao chép DevKit; eligibility của app cho plan usage và inference thành công vẫn cần xác minh tiếp khi quota được làm mới.
