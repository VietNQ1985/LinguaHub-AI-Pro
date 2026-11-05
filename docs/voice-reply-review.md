# Voice reply: phạm vi và kiểm tra Windows

Nhánh feature/voice-reply bắt đầu tại 9b465b7; PR nhắm feature/giao-dien-tieng-viet-dich-truc-tiep. Không sửa DOM selector, OAuth, SignalDesk/ActiveSignal/Zalo.

## Đã triển khai
- Nút Win+H đặt focus đúng ô ý định tiếng Việt, hướng dẫn sửa chữ và tự bấm gửi yêu cầu gợi ý. Không tự gửi tin WhatsApp/Teams.
- TTS dùng bộ điều phối chung: không chồng tiếng, Nghe/Dừng, giọng US/UK từ danh sách thực tế, tốc độ 0.85 mặc định, fallback tiếng Anh có thông báo, lắng nghe voiceschanged và dọn khi unmount.
- Gợi ý theo chat gắn conversationId, kiểm tra lại trước/sau inference và trong lúc chờ; hủy khi đổi workspace, sửa ý, đổi model, mở settings hoặc đóng mục gợi ý. Kết quả cũ bị loại.
- Ý định người dùng là chỉ dẫn soạn trả lời; chat chỉ là bằng chứng không tin cậy, không được thay đổi quy tắc ứng dụng. Vẫn ba phong cách, không tự tạo cam kết.
- Tùy chọn trả lời nhanh chỉ áp dụng reply/replyFromChat; chỉ dùng Low/Medium khi model công bố hỗ trợ. Chưa hỗ trợ thì báo rõ, không gửi inference. Không đổi Low/priority của dịch tự động.

## Giới hạn rõ ràng
- CHƯA tích hợp whisper.cpp/native STT. Không tải model, không ghi âm hoặc upload âm thanh. Win+H là công cụ Windows riêng, có thể dùng cloud theo cài đặt Windows. Người dùng tự mở bằng phím tắt và tự duyệt quyền mic.
- Không có recorder, Stop/Cancel hay timeout 60 giây trong LinguaHub; không tuyên bố các chức năng đó đã hoàn tất. Không có test giả để đánh dấu mic denial/transcription đã được hỗ trợ.
- Kiểm thử dùng JSDOM và bridge giả; chưa thử giọng Windows thật, Win+H tiếng Việt, NSIS cài/launch hoặc AI live. Không có số đo tốc độ AI thực tế. Benchmark có sẵn vẫn là mô phỏng.
- Định danh chat phụ thuộc adapter baseline; trường hợp hai chat cùng tiêu đề mà website thiếu ID ổn định vẫn là giới hạn baseline.
- Tùy chọn trả lời nhanh hiện có hiệu lực trong phiên UI, chưa lưu qua khởi động lại.

## Kiểm tra thủ công trên Windows
1. Mở bản build, mở WhatsApp/Teams, bật đọc/dịch với quyền riêng; xác nhận vẫn stream tiếng Việt.
2. Mở Gợi ý trả lời, bấm Nhập giọng nói Windows; chọn bàn phím Tiếng Việt, nhấn Win+H. Từ chối mic ở Windows: app vẫn cho nhập tay. Cấp mic, nói một câu, dừng/đóng Win+H, sửa chữ, xác nhận không có yêu cầu AI trước khi tự bấm tạo gợi ý.
3. Tạo gợi ý; đổi chat/dịch vụ hoặc sửa ý trước khi xong. Kiểm tra không xuất hiện gợi ý chat cũ và nút không mắc trạng thái tải.
4. Bấm Nghe từng thẻ, lặp lại nhanh, chuyển thẻ, đổi US/UK/tốc độ, bấm Dừng, đóng mục gợi ý và mở settings. Không được chồng tiếng. Thử máy chỉ có US hoặc không có giọng Anh: phải thông báo đúng.
5. Thử model công bố Low/Medium và model không công bố mức đó; bật trả lời nhanh không được thay đổi cấu hình dịch hoặc tác vụ khác.
6. Ngắt/đổi tài khoản, xóa dữ liệu: kiểm tra quyền cloud nhập tay, đọc chat và cloud chat vẫn tách biệt.

npm ci đã chạy thành công; môi trường Node 24.14 báo engine warning với jsdom cần >=24.15, và audit có 15 mức moderate từ dependency. Không chạy audit fix --force để tránh đổi dependency ngoài phạm vi.

## Kết quả tự động
- npm ci thành công (cảnh báo engine/audit như trên).
- npm run typecheck đạt.
- npm test: 22 file, 85 test đạt.
- Test renderer/playback mới: 3/3 đạt sau thay đổi cuối.
- npm run build đạt. Chưa đóng gói/cài NSIS.

## Review tiếp theo: P0/P1/P2
- Gợi ý hoàn tất giữ conversationId cho đến khi bị xóa. Dùng sự kiện visible-chat-changed và quét dự phòng 1 giây CHỈ khi có yêu cầu/kết quả gắn chat; idle không quét. Đổi chat/xem không còn hợp lệ/lỗi đọc: xóa kết quả, hủy yêu cầu và dừng TTS.
- Mọi bước đọc context/permission đều kiểm tra lại generation và request ID. Kiểm tra hội thoại ngay trước inference và trước khi hiện kết quả; finally chỉ xóa request ref thuộc chính yêu cầu đó. Không để finally của yêu cầu cũ xóa yêu cầu mới.
- Cả chế độ chỉ nhập ý cũng cần quyền đọc cục bộ để gắn identity chat; chỉ văn bản nhập được gửi cloud trong chế độ đó. Nếu không có identity thì không tạo gợi ý.
- TTS có callback dừng theo từng component. Unmount/đổi rate/accent chỉ dừng playback component sở hữu; đổi chat vẫn có chủ ý dừng playback gợi ý chung.
- UI ghi rõ Low/Medium chỉ áp dụng ChatGPT nếu catalog công bố; Ollama dùng cấu hình model và checkbox bị vô hiệu hóa. Không thay đổi tự dịch.

### STT cục bộ: đề xuất, chưa triển khai
Không thấy whisper-cli trong PATH. Chưa có runtime/model được xác minh trong worktree, chưa có kiểm thử âm thanh tiếng Việt trên Windows; không tải binary/model hoặc dùng API trả phí.
Đường triển khai tiếp theo: màn opt-in riêng nêu model đa ngôn ngữ, dung lượng thực và nguồn/checksum; chỉ tải sau đồng ý. Runtime whisper.cpp chạy process riêng không shell, nhận WAV mono có giới hạn dung lượng, bắt đầu sau quyền mic riêng. UI Start/Stop/Cancel và đồng hồ tối đa 60 giây. Hủy/timeout/unmount phải dừng recorder, kill process do app sở hữu, xóa WAV trong finally và dọn file mồ côi khi khởi động. Kết quả chỉ chèn vào ô để người dùng sửa rồi tự gửi; không tự gọi AI. Cần kiểm thử thật mic-denied, thiết bị mất, lỗi model, hủy, timeout và chất lượng tiếng Việt trước khi ghi hoàn tất.
Hiện tại vẫn chỉ là hướng dẫn Windows Win+H, không phải microphone recorder trong app. Windows có chính sách xử lý riêng và có thể dùng dịch vụ trực tuyến. Chưa kiểm chứng thực tế Win+H/TTS Windows/NSIS trong lượt này.

### Giới hạn identity
Adapter baseline có thể tạo cùng conversationId cho hai chat trùng tên nếu website không cung cấp ID ổn định. Bộ giám sát không thể phân biệt hai ID giống hệt; không tuyên bố loại bỏ được giới hạn đó. Không sửa selector hay PR #1 trong lượt này.

### Kết quả validation lượt sửa này
- npm ci nguyên lệnh đã được khởi chạy nhưng dừng khi chờ mạng/audit quá lâu. Chạy lại npm ci --no-audit --prefer-offline thành công: 449 package, khoảng 3 phút; không thay lockfile. Vẫn có cảnh báo Node 24.14 thấp hơn yêu cầu >=24.15 của jsdom.
- npm run typecheck đạt; full npm test: 22 file, 89 test đạt; npm run build đạt. Sau thay đổi hủy đồng bộ khi mở settings/đổi model, typecheck và 7 test renderer/TTS chạy lại đạt.
- Test mới: gợi ý hoàn tất bị xóa khi đổi chat; idle không tiếp tục đọc; hủy trong initial/final context read không gọi inference; thẻ idle unmount không dừng thẻ đang đọc. Test cũ giữ unavailable voice, lỗi, rapid click, stop.
- Chưa chạy app/giọng Windows thực tế, microphone/Win+H thật, AI live hoặc NSIS; không có số đo tăng tốc thực tế cho lượt sửa này.
