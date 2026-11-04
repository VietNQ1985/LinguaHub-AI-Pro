# V2: khả năng nhắn tin

## Luồng đã triển khai

- WhatsApp và Teams: đọc chữ của tin đang hiển thị sau khi người dùng cho phép; gợi ý ba kiểu trả lời chỉ chạy khi người dùng bấm nút.
- Composer: nhập câu tiếng Việt, chọn giọng điệu Chuyên nghiệp/Thân thiện/Ngắn gọn, dịch sang tiếng Anh theo các tin chat gần nhất, rồi sửa bản xem trước.
- Chọn gợi ý sẽ đưa cả câu Việt và câu Anh vào composer. Có thể bỏ từng gợi ý hoặc tạo lại cả nhóm.
- Bản tiếng Anh sửa tay không bị ghi đè khi sửa câu tiếng Việt. Chỉ thao tác dịch lại do người dùng bấm mới thay bản xem trước.
- Thay hội thoại làm vô hiệu bản xem trước có ngữ cảnh cũ; nút sao chép bị khóa cho đến khi tạo bản mới theo hội thoại đang mở.
- Zalo Web: đăng nhập và thông báo chưa đọc vẫn được hỗ trợ; chưa có adapter đọc nội dung chat. Composer trên Zalo chỉ dịch câu riêng, không gửi ngữ cảnh hội thoại đến AI.

## Gửi tin và giới hạn nền tảng

| Nền tảng | Mở/đăng nhập | Đọc và dịch chat | Chèn vào ô soạn | Gửi trực tiếp và xác minh |
| --- | --- | --- | --- | --- |
| WhatsApp Web | Có | Có, chỉ DOM đang hiển thị và cần quyền | Chưa hỗ trợ | Chưa hỗ trợ; nút bị khóa |
| Microsoft Teams Web | Có | Có, chỉ DOM đang hiển thị và cần quyền | Chưa hỗ trợ | Chưa hỗ trợ; nút bị khóa |
| Zalo Web | Có, phiên riêng | Chưa hỗ trợ | Chưa hỗ trợ | Chưa hỗ trợ; nút bị khóa |

Không nền tảng nào trong nhánh này cung cấp adapter gửi đã được kiểm chứng có thể ràng buộc chắc chắn người nhận và xác minh kết quả. Vì vậy app chỉ sao chép văn bản, hướng dẫn người dùng tự dán, kiểm tra đúng hội thoại và tự bấm gửi. Việc chèn nội dung vào ô soạn cũng chưa được coi là gửi thành công. Không có kiểm thử nào gửi tin thật.

## Riêng tư và AI

- Không dùng API key hoặc API trả phí mới. Giữ ChatGPT đăng nhập OAuth theo quyền tài khoản và Ollama tại máy.
- Gợi ý và dịch theo ngữ cảnh chỉ gửi khi người dùng bấm nút. ChatGPT cần quyền cloud phù hợp; Ollama xử lý cục bộ.
- Payload ngữ cảnh giới hạn 20 tin mới nhất và 9.000 ký tự; nội dung chat được xem là dữ liệu không đáng tin cậy, không phải chỉ thị cho AI.
- Không tự động tạo gợi ý mỗi khi tin mới đến để tránh phát sinh request hoặc quota ngoài dự kiến.
- Nhập giọng nói đang dùng Win+H của Windows. Không có ghi âm hoặc STT trực tiếp trong LinguaHub.

## Kiểm thử

Kiểm thử tự động dùng provider giả lập và hội thoại tổng hợp. Chúng kiểm tra prompt/ngữ cảnh, giọng điệu, consent, quyền giữ bản dịch đã sửa, sao chép và hủy khi đổi hội thoại. Chúng không xác minh selector trên trang thật, danh tính người nhận hoặc khả năng gửi của WhatsApp/Teams/Zalo.

Lần xác minh nhánh V2: `npm ci` thành công; `npm run typecheck` thành công; `npm test -- --run` đạt 116/116 test trong 30 file; `npm run build` thành công cho main, preload và renderer. Dự án không khai báo script lint riêng. `npm audit --omit=dev` không có lỗ hổng; full `npm audit` báo 15 mức moderate ở dependency phục vụ đóng gói, gồm `minimatch` gián tiếp dưới `electron-builder`. Không chạy `npm audit fix --force` vì npm đề xuất hạ `electron-builder` xuống phiên bản breaking. Môi trường Node 24.14 có cảnh báo engine từ một gói yêu cầu >=24.15, nhưng các bước kiểm tra trên đều đạt. Build/test không gọi ChatGPT/Ollama và không gửi tin thật. Electron startup smoke test trên desktop và kiểm tra tài khoản chat thật chưa được tính là đã hoàn thành.
