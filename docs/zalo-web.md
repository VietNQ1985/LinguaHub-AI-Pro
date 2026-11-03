# Zalo Web trong LinguaHub

Tab Zalo Web mở https://chat.zalo.me/ với session persist:linguahub-zalo riêng. Đăng nhập do Zalo quản lý, chỉ cho điều hướng tới chat.zalo.me và id.zalo.me. Không cấp quyền media hoặc notifications cho Zalo trong bản này.

Chưa có adapter đọc/dịch chat Zalo. Chưa kiểm chứng đăng nhập QR, lưu phiên và tương thích website thực tế. Không sửa ActiveSignal hoặc ứng dụng khác.

Kiểm tra Windows: mở Zalo Web, đăng nhập trực tiếp trong app, chuyển WhatsApp/Teams rồi quay lại; khởi động lại để xác nhận phiên còn. Thử tải lại Zalo và đăng xuất bằng giao diện Zalo. Xóa dữ liệu LinguaHub phải xóa session Zalo cùng các workspace khác.

Với Teams: ảnh phản hồi người dùng đang ở chế độ Dịch tin nhắn khi họp, chưa chứng minh adapter caption thất bại sau Start. Nút mode được làm rõ và có hướng dẫn: chọn Dịch cuộc họp, bật phụ đề English trong Teams rồi Bắt đầu dịch. Selector phụ đề vẫn cần kiểm chứng website thật.
