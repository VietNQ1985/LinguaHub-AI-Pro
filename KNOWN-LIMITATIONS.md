# Giới hạn và việc cần xác minh

## Lỗi đăng nhập ChatGPT: 3p_login_workspace_scope_denied (01/11/2026)

- OpenAI từ chối khi tài khoản đang đăng nhập không thuộc workspace gắn với mã đăng ký OAuth client của ứng dụng. Không phải lỗi WhatsApp/Teams hoặc bằng chứng gói Plus đã hết.
- Nút đăng nhập cũ ưu tiên tái sử dụng mã đăng ký đã lưu. Khi chuyển tài khoản hoặc workspace, cách này có thể gây lỗi từ chối phạm vi workspace.
- Nhánh này bổ sung lựa chọn **Đổi tài khoản hoặc không gian làm việc** trong **Cài đặt → Tài khoản ChatGPT**; hành động này chủ động dùng `dynamic_agent_client` để đăng ký mới mà không tái sử dụng mã đăng ký của tài khoản trước.
- Trường hợp đăng ký mới bị từ chối/trả lỗi trước khi lưu phiên thành công, file token cũ và mã đăng ký hiện tại vẫn được giữ. Nếu đăng ký mới thành công, nó thay thế kết nối ChatGPT hiện tại trong LinguaHub (chưa hỗ trợ nhiều tài khoản cùng lúc).
- Không cần xóa thông tin đăng nhập WhatsApp/Teams, không thay đổi gói Plus và không bật API trả phí.
- **Chưa thử thực tế** với tài khoản và workspace bị lỗi. Các kiểm thử mới chỉ mô phỏng callback và lần trao đổi mã bị từ chối; cần Codex chạy test và thử OAuth thật trên Windows.


## Bản cải tiến giao diện tiếng Việt (chưa nghiệm thu)

- Mã nguồn đã thay sidebar lớn bằng thanh WhatsApp/Teams phía trên và panel dịch tiếng Việt phía phải; quyền riêng tư, dữ liệu và thông báo được đưa vào Cài đặt nâng cao.
- Khung LiveTranslation luôn được giữ trong React khi thu gọn panel hoặc mở tab Gợi ý trả lời/Cài đặt. Đây là sửa lỗi dừng OCR do unmount ngoài ý muốn, **không** có nghĩa app tiếp tục OCR khi thu nhỏ cửa sổ Windows.
- Cải tiến nhận diện hai thông điệp có nội dung giống nhau trong một lượt quét bằng thứ tự xuất hiện. Chưa có ID ổn định xuyên cuộn trang; việc ghép tin nhiều dòng và phát hiện đổi cuộc trò chuyện vẫn là heuristic.
- `npm run typecheck`, `npm test` (60/60), `npm run build` và `npm run dist` đều đạt trên Windows. Đã sửa CSP sau khi app báo lỗi OCR, nhưng chưa kiểm tra lại OCR trên hội thoại thật bằng installer mới.
- Chưa có bằng chứng bản dịch tự động chạy tin nhắn thật hoặc SIWC inference thành công trong phiên này. Giữ nguyên giới hạn API và quyền hiện có; không tự sử dụng API trả phí.


Đây là bản phát triển. Mã nguồn và kiểm thử đã tiến thêm, nhưng một số luồng phải được xác minh trên app đóng gói và tài khoản/tin nhắn thật.

## Đã có bằng chứng

- Người dùng xác nhận đăng nhập WhatsApp và Teams trong app.
- TypeScript đạt và 60 kiểm thử tự động đạt. Kiểm thử bao phủ schema AI, callback/PKCE, lưu client ID, refresh token, retry thu hồi, định dạng request Responses, stream, quyền notification và cấu hình shortcut Windows, OCR segmentation/CSP/browser worker/tài nguyên bản cài, cache, SQLite, xóa dữ liệu/thu hồi, tách quyền ChatGPT nhập tay và quyền dịch OCR nền, từ vựng, tiến độ và retention.
- Hồ sơ SIWC thật giải mã được, có quyền `chatgpt.tokens.use.direct` và trả về 8 model. Lượt inference với câu mẫu đến endpoint nhưng nhận lỗi hạn mức ChatGPT dùng chung giữa các ứng dụng; chưa có inference hoàn tất.
- Bộ cài NSIS x64 vừa build; SHA-256 `e02047072c53eecba7aac74cf8ea8cb413834b3069e39d325eb3e76f3942898b` khớp file `.sha256`. Chưa cài installer này hoặc xác minh OCR sau khi cài. Gỡ cài đặt chưa được thử.
- Panel trợ lý có thể đổi chiều rộng, thu gọn/mở lại; chiều rộng được lưu cục bộ.
- Tiến độ học lưu ngày ôn/bài học, thống kê từ đến hạn, chuỗi ngày và lượt AI thành công theo provider; kỳ hạn lưu 30/90/365 ngày có xác nhận trước khi xóa. Thống kê AI không chứa nội dung.
- English Coach nhận trực tiếp câu OCR qua nút **Học câu này**; phân tích cuộc trò chuyện có gợi ý theo dõi nhưng bắt buộc dẫn chứng khớp văn bản nguồn. Cài đặt có thao tác xóa toàn bộ dữ liệu cục bộ kèm xác nhận, ngắt ChatGPT và xóa phiên web.

## Chưa được chứng minh

- Tự làm mới token/thu hồi thật; hiện mới có kiểm thử với phản hồi HTTP giả lập. Kết nối và model catalog đã được xác minh bằng hồ sơ thật, nhưng inference hoàn tất vẫn chờ hạn mức dùng chung được làm mới. Tài liệu OpenAI nêu điều kiện eligibility cho ChatGPT plan usage; trạng thái quota hiện tại không chứng minh mọi lần dùng sau đều được chấp nhận.
- Tesseract worker/core đã được smoke-test với ảnh tiếng Anh tổng hợp, nhưng lần chạy UI thật báo lỗi OCR. Nguyên nhân là CSP thiếu quyền cho worker `blob:`, ảnh `data:`, WASM/tài nguyên cục bộ và model CDN. CSP hiện đã sửa, worker được tạo lại sau lỗi và thông báo mạng dễ hiểu hơn; bản sửa chưa được xác nhận bằng OCR trên hội thoại thật. Lần đầu cần Internet để tải model từ jsDelivr; ảnh và nội dung OCR không gửi đến CDN.
- Hồ sơ app có quyền notification cho WhatsApp và Teams (`true`). Nút thử trong app đã phát sự kiện Electron `show`, và giao diện báo Windows đã nhận yêu cầu toast. Thông báo do WhatsApp/Teams phát khi có tin mới vẫn chưa được xác minh; còn phụ thuộc cài đặt Desktop notification trong từng dịch vụ.

## Chưa hoàn thiện

- Luồng OAuth tự triển khai theo tài liệu SIWC, chưa dùng `@siwc/local`: DevKit chính thức mô tả app desktop mẫu trên macOS và cấp license noncommercial cho code/docs; dùng SDK đó cho ERP công việc chưa phù hợp nếu chưa có quyền thương mại. Tài khoản thật và quyền token trên Windows vẫn cần test.
- Chỉ lưu một hồ sơ ChatGPT hiện tại. Dữ liệu đăng ký client ID riêng với token; file token mã hóa bằng Windows safeStorage. Nếu OpenAI thu hồi token, app yêu cầu đăng nhập lại.
- Dịch OCR có thể dùng Ollama cục bộ hoặc chữ OCR qua ChatGPT sau xác nhận cloud riêng. Gửi chữ nền ChatGPT chưa được thử với tin nhắn thật; ảnh OCR không được gửi.
- OCR phân đoạn theo hình học dòng, đợi tin ổn định hai lần và dùng dấu vân tay tiêu đề hội thoại cục bộ. Đây là heuristic; có thể ghép/tách sai, bỏ tin không phải tiếng Anh hoặc đoán sai người gửi.
- Dịch nền liên tục hiện chỉ dùng Ollama cục bộ; muốn dịch tự động phải bật OCR cho vùng đang hiển thị và chọn model. App dừng chụp khi thu nhỏ hoặc không hiển thị.
- Panel có điều hướng theo mục, co giãn/thu gọn; chưa có router trang riêng, nhiều cửa sổ workspace, tray, kiểm thử call/camera Teams hoặc chấm điểm phát âm.
- Bài học hằng ngày hiện là nội dung ERP mẫu; cá nhân hóa chủ yếu đến từ từ vựng anh lưu và lịch ôn.
- ChatGPT xử lý nội dung nhập tay sau xác nhận trong phiên app; chữ OCR nền chỉ gửi sau xác nhận riêng. Không có OpenAI API key hoặc Gemini provider.
- Bộ cài NSIS không ký số. Build/đóng gói thành công không chứng minh cài đặt hoặc chạy đủ chức năng trên mọi máy Windows.
- Inference ChatGPT hoàn tất bằng tài khoản thật; hiện API báo hạn mức gói dùng chung đã đạt. Cần đợi quota làm mới để xác nhận đầu ra dịch thành công.

App không tự gửi tin nhắn, không đọc cookie ChatGPT, không lưu ảnh OCR và không tự bật API trả phí.
