# Khay hệ thống và thông báo

LinguaHub giữ một icon ở khay hệ thống. Đóng cửa sổ sẽ thu gọn ứng dụng; menu icon có thể mở LinguaHub, chọn từng workspace hoặc thoát hoàn toàn.

## Thông báo riêng tư

- Thông báo Windows từ WhatsApp, Teams và Zalo Web chỉ hiện `LinguaHub AI Pro` và `Có thông báo mới.`
- Tên người gửi, nội dung chat, tên cuộc trò chuyện và số chưa đọc không được đưa vào toast.
- LinguaHub từ chối Notification API của các website và Service Worker để tránh toast có nội dung; cài đặt riêng của từng website không thể làm lộ nội dung qua hệ thống này.
- Cài đặt nâng cao bật/tắt toast chung của LinguaHub độc lập cho từng dịch vụ.
- Toast phát khi bộ đếm/huy hiệu chưa đọc tăng sau lần nhận diện đầu tiên. Bộ đếm ban đầu chỉ làm mốc, không phát thông báo cũ.
- Cú bấm mở/khôi phục LinguaHub rồi chọn đúng tab nguồn. Toast Windows lưu activation argument giới hạn ở ba mã workspace; preload giữ sự kiện nếu renderer chưa sẵn sàng.

Thông báo dựa trên dấu chưa đọc mà website để lộ. Nếu website không cập nhật badge/count khi có tin mới, LinguaHub không phát hiện được tin đó từ notification gốc vì nội dung của notification gốc bị chặn.

## Kiểm chứng

`workspace-notifications.test.ts` kiểm tra nội dung toast cố định, mốc ban đầu, tăng bộ đếm, đóng/mở lại dot, định tuyến click và kiểm tra activation argument. Các test này không thay cho xác nhận banner/cú click thật trong Windows Action Center.
