# Zalo Web trong LinguaHub

Tab Zalo Web mở https://chat.zalo.me/ với session persist:linguahub-zalo riêng. Đăng nhập do Zalo quản lý, chỉ cho điều hướng tới chat.zalo.me và id.zalo.me. Không cấp quyền media hoặc notifications cho Zalo trong bản này.

Chưa có adapter đọc/dịch chat Zalo. Chưa kiểm chứng đăng nhập QR, lưu phiên và tương thích website thực tế. Không sửa ActiveSignal hoặc ứng dụng khác.

Sau phản hồi quét QR hiện avatar rồi đứng: popup xác thực được giữ là cửa sổ con cùng session và giữ opener, thay vì ép loadURL vào trang chính. Cho storage-access/top-level-storage-access chỉ giữa chat.zalo.me và id.zalo.me, đúng WebContents chính hoặc popup do nó tạo, sau xác nhận người dùng. Media/notifications vẫn từ chối. Chưa tái hiện đăng nhập QR thật, nên đây là sửa luồng có căn cứ từ code, chưa phải kết luận nguyên nhân cuối cùng.

Kiểm tra Windows: mở Zalo Web, đăng nhập trực tiếp trong app, chuyển WhatsApp/Teams rồi quay lại; khởi động lại để xác nhận phiên còn. Thử tải lại Zalo và đăng xuất bằng giao diện Zalo. Xóa dữ liệu LinguaHub phải xóa session Zalo cùng các workspace khác.

Với Teams: ảnh phản hồi người dùng đang ở chế độ Dịch tin nhắn khi họp, chưa chứng minh adapter caption thất bại sau Start. Nút mode được làm rõ và có hướng dẫn: chọn Dịch cuộc họp, bật phụ đề English trong Teams rồi Bắt đầu dịch. Selector phụ đề vẫn cần kiểm chứng website thật.

Người dùng xác nhận đã chấp thuận trên điện thoại nhưng trang vẫn chờ. Kiểm tra bản đã cài có popup/storage policy mới, chưa giải quyết lỗi. Bổ sung application.log: zalo-loaded, zalo-navigation-blocked, zalo-network-failed (tối đa 100 lỗi mạng mỗi workspace) và zalo-renderer-gone. Chỉ ghi hostname thuộc zalo.me/zdn.vn hoặc nhãn other, mã net::ERR_*, không ghi đường dẫn/query/header/body/cookie/token. Log dùng xoay vòng hiện có. Cần tái hiện trên bản chẩn đoán; chưa khẳng định nguyên nhân hoặc sửa xong đăng nhập.
