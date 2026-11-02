# Ghi chú phân tích ActiveSignal bằng REA

## Kết quả đã xác nhận

- Dùng REA 6.8.0 đã có trong npm cache để phân tích tĩnh `C:\Program Files\ARITO ActiveSignal PC\resources\app.asar`.
- SHA-256 của `app.asar`: `bcd9ac3cb5bf28933a5e54b6e5618232a122f46b9f1694183a161e159b8f1135`.
- Package tự khai báo là `arito-mobile-app` phiên bản `1.1.0`, chạy Electron với React và có các thành phần Capacitor/SignalR.
- REA hoàn tất phân tích 18 tệp Electron và chunk nhỏ. Tóm tắt tĩnh ghi nhận 2 cửa sổ Electron, 1 API preload, 14 thành viên được expose, 13 IPC channel literal và 11 main handler.
- Cây trợ năng của ứng dụng đang mở cho thấy các mục Chat, Danh bạ, Việc, Zalo, Inbox, AI Bots, Thông báo và Cài đặt. Màn hình Chat có danh sách hội thoại, vùng tin nhắn và panel thông tin.
- Cây trợ năng hiển thị trang Chat trong renderer tại `https://form.arito.net/chat/157?hidden-navbar=true`; do đó gói cài đặt không cung cấp mã nguồn đầy đủ của dịch vụ phía máy chủ.
- Rà soát chuỗi trong chunk renderer chính cho thấy các route `/chat/zalo` và `/chat/oa` được tách riêng. Client gọi `/api/zalo/sources`, `/api/zalo/{infra_source_id}/unread-count` và `/api/zalo/{infra_source_id}/conversations/read-all`; nó lưu `account_id` và `source_id` trong localStorage.
- Các request Zalo trên đi qua backend của sản phẩm, không phải lời gọi trực tiếp tới Zalo OA OpenAPI. Đây là bằng chứng client-side; cách tài khoản Zalo cá nhân được liên kết và xử lý ở backend chưa được xác minh.

## Giới hạn

- ASAR có 2.021 tệp JavaScript được REA lập inventory. Lượt phân tích lõi chỉ chọn 18 tệp; còn 2.003 tệp nằm ngoài phạm vi.
- Chunk giao diện chính `dist/assets/index-Dhb7-dh3.js` có kích thước 910.837 byte và vượt giới hạn phân tích 10 phút của REA trong lượt thử có chọn tệp này.
- Các quan hệ REA báo cáo là suy luận tĩnh từ gói phát hành; chúng không chứng minh code chạy tại runtime. Nội dung máy chủ, xác thực, API nghiệp vụ và quyền truy cập tài khoản chưa được xác minh.
- SignalDesk vì vậy dùng dữ liệu hư cấu lưu cục bộ. Zalo, chat trực tiếp, cuộc gọi, AI và backend của sản phẩm nguồn chưa được kết nối.
