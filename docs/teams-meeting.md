# Teams meeting: trạng thái triển khai

Nhánh từ c8b6e25, draft PR nhắm feature/voice-reply. Không merge tự động.

## Quyền thiết bị
Session Teams trước đây chỉ cho notifications. Module teams-meeting-permissions dùng cả permission check/request: audio, video, tổ hợp audio/video và speaker-selection sau xác nhận. Chỉ WebContents sở hữu, top/frame HTTPS teams.microsoft.com hoặc teams.cloud.microsoft và subdomain đúng ranh giới. Navigation xóa grants; media không cấp cho null/foreign contents. Notifications worker vẫn theo quyền thông báo riêng.

Screen sharing dùng setDisplayMediaRequestHandler, kiểm tra frame.top/origin/userGesture và dialog chọn screen/window cụ thể. Hủy trả null. Không cấp loopback audio. Không thay đổi mute hoặc stream của Teams. Electron/Teams giải phóng stream khi page đóng. API đối chiếu Electron 45.2.1 electron.d.ts và https://www.electronjs.org/docs/latest/api/session . Chưa xác minh thiết bị/cuộc họp thật, không khẳng định đã hoạt động end-to-end.

## Phụ đề và dịch (thử nghiệm)
Có Dịch tin nhắn/Dịch cuộc họp, Start/Pause/Stop, transcript song ngữ, timestamp/speaker fallback và cuộn theo đoạn mới khi ở cuối. Đọc phụ đề 500ms chỉ sau Start. Quyền đọc caption và gửi chữ họp lên ChatGPT hỏi riêng, không tái sử dụng quyền chat/nhập tay. Ollama xử lý cục bộ. Không thu âm, lưu transcript hoặc log nội dung.

Adapter riêng chỉ đọc các data-tid caption cụ thể đang nhìn thấy, không đọc chat/internal API. Đoạn ổn định 900ms được coi là ứng viên hoàn tất (heuristic, không phải cờ finalized chính thức). Cùng DOM row giữ ID, revision loại kết quả cũ khi sửa. Transcript tối đa 100 đoạn, hàng đợi 8, một inference mỗi lúc, ưu tiên đoạn mới. Pause/Stop/đổi workspace/reload/navigation hủy phiên và AI. Root caption đổi dừng an toàn. Không có caption 15 giây dừng và báo kiểm tra; không xác định chắc chắn meeting-ended.

Dùng translateLatest/glossary ERP và Low riêng cho họp; không đổi cấu hình tự dịch chat. Không tự retry vô hạn hoặc chuyển paid API. Đoạn vượt hàng đợi đánh dấu chưa dịch.

## Giới hạn chưa kiểm chứng
Selector CHƯA được xác minh trên Teams thật; test JSDOM không chứng minh khả năng đọc website thật. Nếu không khớp thì báo không tìm thấy phụ đề, không lấy UI/chat thay thế. Chưa hỗ trợ caption trong iframe ngoài DOM main page. Teams tái sử dụng DOM row có thể làm mất lịch sử đoạn cũ; root replacement cần Start lại. Speaker/correction/virtualization chưa xác minh thật. Chống trùng trong 3 đoạn cuối có thể bỏ câu lặp hợp lệ. Start lại xóa transcript panel.

Không capture âm thanh WebContents/Windows, không STT/whisper.cpp, không tải model hoặc recorder giả. Audio fallback cần opt-in riêng và xác minh toàn bộ pipeline trước. Chưa export/save/summary/action-items; tiếp tục sau khi caption được xác minh. Không có số p50/p95 thật; benchmark cũ là mô phỏng.

## Acceptance Windows (chưa thực hiện)
1. Vào họp thử với người tham gia đồng ý; cấp/từ chối mic/camera trong LinguaHub và Windows. Kiểm tra audio+video, mute/unmute, camera on/off, đổi mic/camera/loa, nghe/nói hai chiều.
2. Share screen/window: chọn đúng nguồn, Hủy không chia sẻ, Stop trong Teams hoạt động. Chưa share audio hệ thống. Origin/frame ngoài allowlist phải bị từ chối.
3. Bật captions English trong Teams. Start dịch, từ chối quyền đọc/cloud: không được inference. Cho phép và nói câu ERP có số/tên; kiểm tra English/Vietnamese/speaker/time, correction không nhân bản.
4. Nói nhanh, im lặng, tắt captions, kết thúc họp, đổi workspace/reload: dịch dừng/hủy nhưng không chủ động tắt mic/camera. Kiểm tra quota và Ollama offline: lỗi tiếng Việt, không retry vô hạn.
5. Stop không còn đọc DOM hoặc AI mới. Mở lại app không tự bật quyền họp. Chat WhatsApp/Teams, streaming, reply/TTS không hồi quy.
6. Cài/mở NSIS trên Windows, kiểm tra thiết bị thật. Đo ít nhất 20 đoạn từ caption đến bản dịch, tính p50/p95; hiện chưa có số thật.

## Test tự động
Test policy audio/video/deny/untrusted/navigation/screen frame/source/cancel; caption-only/visibility/speaker/correction ID; renderer ổn định đoạn/chống inference trùng/correction hủy/workspace loại kết quả muộn. Test mock không thay thế hardware, website hoặc IPC Electron thật. Chưa có coverage đầy đủ cho reconnect/meeting-ended/AI error thực tế.

## Validation lượt triển khai
- npm ci --no-audit --prefer-offline thành công: 449 package; Node 24.14 còn engine warning jsdom >=24.15.
- npm run typecheck đạt, npm test 25 file/94 test đạt, npm run build đạt trong npm run dist.
- Chưa tham gia cuộc họp thực tế, không có screenshot Teams/live caption thật. Chưa cài/launch NSIS trên Windows.

- npm run dist thành công, NSIS Windows x64 được tạo, chưa ký số và chưa cài/launch. SHA-256: 822972f66d0ad0282e6f38a73a41186cfa531f8425abd30beba12aa1d2c39f17.
