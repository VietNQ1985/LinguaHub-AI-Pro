# LinguaHub AI Pro

LinguaHub là ứng dụng Windows hiển thị WhatsApp Web hoặc Microsoft Teams Web thật, với **khung bản dịch tiếng Việt bên cạnh**. Giao diện LinguaHub ưu tiên tiếng Việt, tối giản và dễ đọc. Ứng dụng không tự gửi tin nhắn.

## Giao diện tinh gọn (nhánh cải tiến)

- Thanh trên cùng chỉ có **WhatsApp**, **Microsoft Teams**, nút tải lại, **Cài đặt** và nút thu gọn bản dịch.
- Bên trái hiển thị website chính thức; bên phải là **Dịch tự động** và **Gợi ý trả lời**.
- Khi thu gọn khung dịch, component nhận diện và dịch không còn bị tháo khỏi React; người dùng vẫn có thể tạm dừng dịch bằng nút **Tạm dừng**.
- Những tính năng phụ không còn chiếm diện tích màn hình. Quản lý thông báo, thời hạn giữ dữ liệu và xóa dữ liệu cục bộ nằm trong **Cài đặt nâng cao**.
- Giao diện tiếng Việt mặc định dùng chế độ sáng cho hồ sơ mới; hồ sơ cũ giữ tùy chọn đã lưu.

**Bản cài Windows x64 mới** nằm trong `release/LinguaHub-AI-Pro-Setup.exe`; SHA-256: `e02047072c53eecba7aac74cf8ea8cb413834b3069e39d325eb3e76f3942898b`. Bản mới sửa CSP đang chặn Tesseract Web Worker, ảnh OCR dạng data URL và tải model ngôn ngữ.

## Sử dụng hằng ngày

1. Mở LinguaHub, app sẽ mở **WhatsApp**. Chọn **Microsoft Teams** trên thanh trên cùng khi muốn chuyển dịch vụ. Mỗi website có phiên đăng nhập riêng.
2. Nhấn biểu tượng **Cài đặt** (⚙), đăng nhập ChatGPT, sau đó nhấn **Chọn ChatGPT** để lấy mô hình được tài khoản cấp quyền; hoặc nhấn **Chọn Ollama** nếu đã cài Ollama và mô hình chạy cục bộ.
3. Quay lại **Dịch tự động**, nhấn **Bật dịch** và xác nhận quyền đọc vùng chat hiển thị. Nếu dùng ChatGPT, ứng dụng hỏi riêng trước khi gửi văn bản được nhận diện lên cloud.
4. Mở cuộc trò chuyện cần đọc; bản dịch sẽ được hiển thị bên phải khi hệ thống nhận diện và AI xử lý thành công. Nút **Tạm dừng** sẽ ngừng nhận diện.
5. Để chỉnh vùng nhận diện, tạm dừng dịch rồi mở **Tùy chỉnh vùng nhận diện** ở cuối khung dịch.
6. Khi cần soạn tin, chọn **Gợi ý trả lời**, nhập tiếng Việt và yêu cầu AI tạo câu tiếng Anh. Anh tự xem, sao chép và gửi trên website thật.

Lối tắt: Ctrl+1 WhatsApp, Ctrl+2 Teams, Ctrl+R tải lại trang. Ctrl+0 hiện chuyển về WhatsApp để tương thích với phím tắt cũ.

## Mức độ kiểm chứng

Đợt kiểm tra nhánh PR #1 đạt `npm run typecheck`, `npm test` (60/60), `npm run build` và `npm run dist`. Ảnh giao diện hiện tại cho thấy OCR đang lỗi; nguyên nhân trong source là CSP chặn worker/blob/data và CDN model. Đã sửa CSP và thêm kiểm thử hồi phục worker, nhưng cần khởi chạy bản cài mới để xác nhận OCR hoạt động trên app thực tế. Chưa xác nhận dịch end-to-end trên hội thoại thật.

## Học và quyền riêng tư

- Bài học ERP mẫu, lưu từ vựng do anh chọn, lịch ôn lặp lại, số từ đến hạn, chuỗi ngày học và số lượt AI thành công theo provider được lưu cục bộ. App chỉ lưu provider/task, không lưu nội dung vào thống kê.
- Ở **Cài đặt**, chọn giữ dữ liệu học đến khi tự xóa hoặc tự xóa nội dung cũ hơn 30/90/365 ngày. App hỏi xác nhận trước khi áp dụng kỳ hạn xóa. Nút xóa từ vựng cũng xóa lịch sử học.
- Mục **Xóa toàn bộ dữ liệu cục bộ** trong Cài đặt sẽ hỏi xác nhận, thử thu hồi ChatGPT, đăng xuất WhatsApp/Teams, rồi xóa cài đặt và dữ liệu học. Anh cần đăng nhập lại sau đó.
- Bật quyền thông báo WhatsApp/Teams trong **Cài đặt**, rồi bật thông báo Desktop trong từng dịch vụ. Bản cài Windows tạo/sửa shortcut Start Menu với AppUserModelID và ToastActivatorCLSID cho toast. Nút **Thử thông báo Windows** chờ Windows xác nhận yêu cầu toast; tin nhắn thật vẫn cần xác minh.
- OCR chỉ đọc vùng website đang mở sau khi anh cho phép. Ảnh không lưu và không gửi cloud. Lần đầu OCR cần Internet để tải model tiếng Anh từ jsDelivr; model được cache cục bộ, không gửi ảnh hay nội dung nhận diện đến CDN. Chữ OCR chỉ gửi đến ChatGPT sau một xác nhận cloud riêng; Ollama xử lý trên máy. Khi cửa sổ app thu nhỏ hoặc ẩn, OCR tạm dừng; đóng hẳn app thì thông báo web cũng dừng.
- Token ChatGPT được mã hóa bằng Windows safeStorage. Nội dung chat, mật khẩu và cookie ChatGPT không được ghi vào log hoặc cơ sở dữ liệu app. Chế độ che email/số điện thoại là heuristic và có thể bỏ sót.

## Kiểm tra và tình trạng

- `npm run typecheck` — đạt.
- `npm test` — 60 kiểm thử tự động đạt; gồm logic OAuth/refresh/revoke giả lập, định dạng request Responses, AI schema, OCR segmentation, CSP và hồi phục browser worker, đường dẫn tài nguyên OCR dev/bản cài, chính sách notification/shortcut Windows, tách quyền ChatGPT nhập tay và quyền dịch OCR nền, trạng thái thu hồi khi xóa hồ sơ và dữ liệu học.
- OCR dùng Chromium Web Worker với worker/core được đóng gói cục bộ. Bài smoke test trước đây nhận dạng đúng ảnh tiếng Anh tổng hợp với confidence 95%, nhưng không bao phủ CSP của renderer — đó là lý do có thể dẫn đến lỗi trên app trong ảnh. CSP đã sửa trong bản cài mới; chưa xác nhận lại trên hội thoại thật.
- Đã cài và khởi chạy bản NSIS x64 từ `C:\Program Files\LinguaHub AI Pro`; hash `app.asar` trùng gói build. Shortcut Start Menu ghi `notification-shortcut-ready`; thử toast trong app trả sự kiện `show` của Electron.
- Người dùng xác nhận WhatsApp và Teams đã mở/đăng nhập trong app. Em giải mã được hồ sơ SIWC hiện tại, xác nhận quyền `chatgpt.tokens.use.direct` và lấy 8 model thật. Lượt inference kiểm tra bằng câu mẫu đã tới endpoint nhưng bị từ chối bởi hạn mức ChatGPT dùng chung giữa các ứng dụng; chưa có bản dịch hoàn tất để xác nhận kết quả AI thật.
- Đã sửa request Responses theo hợp đồng hiện hành: `input` là danh sách `{role, content}`. Khi hạn mức được làm mới, có thể thử lại ngay trong app; app không chuyển sang API trả phí.
- Chưa xác minh tin nhắn thật đi qua dịch OCR hoặc toast WhatsApp/Teams. Nút thử toast chỉ chứng minh thông báo của LinguaHub, không chứng minh website gửi notification thật.
- Bộ cài Windows NSIS x64 mới được tạo thành công; OCR worker/model trên app sau khi sửa CSP, gỡ cài đặt và OCR trên hội thoại thật vẫn cần xác minh.
- Không tự bật hoặc gọi API trả phí. Không tự động hóa website ChatGPT để lấy câu trả lời.

## Dành cho phát triển

`npm run dev` khởi chạy, `npm run typecheck` kiểm tra kiểu, `npm test` chạy kiểm thử, `npm run build` tạo output, `npm run dist` thử đóng gói Windows.

Tích hợp ChatGPT bám theo [tài liệu SIWC đăng nhập](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [quản lý phiên và refresh](https://developers.openai.com/siwc/token-sharing-open-source/profiles-and-sessions) và [model/inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference). Luồng dùng PKCE, callback loopback, token mã hóa cục bộ, refresh khi gần hết hạn và Responses API với `store=false`, `stream=true`, `input` dạng danh sách. Hồ sơ Windows thật và 8 model đã xác nhận; lần inference hiện bị chặn bởi quota dùng chung. Không nhúng `@siwc/local`: [DevKit chính thức](https://github.com/openai/sign-in-with-chatgpt-devkit) cung cấp SDK local và ví dụ desktop chỉ cho macOS; license của code/docs giới hạn ở mục đích phi thương mại, không phù hợp để đưa code đó vào workflow ERP công việc. Luồng của app là phần tự triển khai theo giao thức công khai, không sao chép DevKit; eligibility của app cho plan usage và inference thành công vẫn cần xác minh tiếp khi quota được làm mới.
