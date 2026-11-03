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
