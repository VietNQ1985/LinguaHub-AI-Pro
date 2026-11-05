# Benchmark tốc độ dịch trực tiếp

Ngày chạy: 01/11/2026 trên Windows, nhánh `feature/giao-dien-tieng-viet-dich-truc-tiep`.

Mỗi kịch bản chạy ba lần; bảng dùng trung vị. Bộ đo chạy observer DOM và adapter đọc WhatsApp/Teams thật của ứng dụng trên trang JSDOM tổng hợp. AI được thay bằng responder giả lập có độ trễ khoảng 120 ms để không dùng hạn mức ChatGPT/Ollama. Bản cập nhật giao diện được mô phỏng với một nhịp 16 ms. Vì vậy số mới so sánh được giữa các kịch bản và dùng để đánh giá đường xử lý cục bộ; thời gian ChatGPT/Ollama thật phụ thuộc dịch vụ và mạng.

Mốc cũ được dựng lại từ bộ quét trước tối ưu: khi chat ổn định, app tăng khoảng quét lên 10 giây; trong chat liên tục, khoảng quét trở về 2,2 giây. Tin mới phải được nhìn thấy trong hai lượt quét, nên lượt xác nhận thêm một khoảng tương ứng. Cột cũ là giới hạn chờ xấu theo cấu hình cũ, không phải phép đo chạy lại phiên bản cũ. Tổng cũ bên dưới cộng thêm cùng AI giả lập 120 ms và cập nhật giao diện 16 ms.

| Kịch bản | Cũ: phát hiện + xác nhận; tổng ước tính | Mới: phát hiện | Xác nhận | Chờ hàng đợi | AI giả lập | Giao diện | Tổng đến bản dịch đầu tiên |
|---|---:|---:|---:|---:|---:|---:|---:|
| Tin nhắn ngắn | 10.000 + 2.200 ms; 12.336 ms | 128 ms | 0 ms | 0 ms | 137 ms | 17 ms | **281 ms** |
| Tin dài, không có ID | 10.000 + 2.200 ms; 12.336 ms | 141 ms | 165 ms | 0 ms | 132 ms | 32 ms | **465 ms** |
| Chat liên tục, 12 tin | 2.200 + 2.200 ms; 4.536 ms | 213 ms | 0 ms | 370 ms | 132 ms | 19 ms | **732 ms** |
| Chuyển hội thoại | 10.000 + 2.200 ms; 12.336 ms | 127 ms | 0 ms | 0 ms | 133 ms | 20 ms | **282 ms** |
| Cuộn lên xuống, nạp tin mới | 10.000 + 2.200 ms; 12.336 ms | 123 ms | 0 ms | 0 ms | 127 ms | 18 ms | **268 ms** |

Các phép đo mới là trung vị của ba lượt và được làm tròn tới mili giây. Với chat liên tục, mô phỏng có một yêu cầu AI đang chạy trước khi 12 tin mới tới; hàng đợi dịch tối đa 8 tin mỗi lượt, ưu tiên tin mới nhất. Tổng thời gian xử lý hết cả đợt là 658 ms; thời gian 732 ms trong bảng chỉ tới bản dịch đầu tiên. Có ba lần gọi responder tính cả công việc đang chạy trước đó và hai lô mới. Khi đổi hội thoại, phép thử hủy một yêu cầu cũ và chỉ nhận kết quả của hội thoại mới. Khi cuộn nạp thêm tin, tin cũ đã có cache nên chỉ tin mới cần dịch; cuộn lại nội dung đó không phát sinh yêu cầu bổ sung.

Độ trễ của đường xử lý mới trong benchmark giả lập là 0,28–0,74 giây tới bản dịch đầu tiên, so với giới hạn xấu 4,54–12,34 giây dựng lại từ lịch quét cũ. Các số này **không phải** benchmark gọi ChatGPT thật và không dự đoán độ trễ model; xem mục **Chẩn đoán tốc độ** trong panel để đo trên máy khi dịch thực tế.

Kiểm tra chức năng đi kèm:

- `npm run typecheck` — đạt.
- `npm test` — 18 tệp, 70 kiểm thử đạt, bao gồm WhatsApp/Teams DOM, thay vùng chat, hủy khi đổi hội thoại, cache và benchmark.
- `npm run build` — tạo thành công main, hai preload và renderer.
