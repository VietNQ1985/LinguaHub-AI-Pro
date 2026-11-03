# Zalo Web trong LinguaHub

Tab Zalo Web mở https://chat.zalo.me/ với session persist:linguahub-zalo riêng. Đăng nhập do Zalo quản lý, chỉ cho điều hướng HTTPS tới chat.zalo.me, id.zalo.me, jr.zaloapp.com và jr.chat.zalo.me (các bước chuyển tiếp xác thực ghi nhận thực tế). Không cấp quyền media hoặc notifications cho Zalo trong bản này.

Chưa có adapter đọc/dịch chat Zalo. Chưa kiểm chứng đăng nhập QR, lưu phiên và tương thích website thực tế. Không sửa ActiveSignal hoặc ứng dụng khác.

Sau phản hồi quét QR hiện avatar rồi đứng: popup xác thực được giữ là cửa sổ con cùng session và giữ opener, thay vì ép loadURL vào trang chính. Cho storage-access/top-level-storage-access chỉ giữa chat.zalo.me và id.zalo.me, đúng WebContents chính hoặc popup do nó tạo, sau xác nhận người dùng. Media/notifications vẫn từ chối. Chưa tái hiện đăng nhập QR thật, nên đây là sửa luồng có căn cứ từ code, chưa phải kết luận nguyên nhân cuối cùng.

Kiểm tra Windows: mở Zalo Web, đăng nhập trực tiếp trong app, chuyển WhatsApp/Teams rồi quay lại; khởi động lại để xác nhận phiên còn. Thử tải lại Zalo và đăng xuất bằng giao diện Zalo. Xóa dữ liệu LinguaHub phải xóa session Zalo cùng các workspace khác.

Với Teams: ảnh phản hồi người dùng đang ở chế độ Dịch tin nhắn khi họp, chưa chứng minh adapter caption thất bại sau Start. Nút mode được làm rõ và có hướng dẫn: chọn Dịch cuộc họp, bật phụ đề English trong Teams rồi Bắt đầu dịch. Selector phụ đề vẫn cần kiểm chứng website thật.

Người dùng xác nhận đã chấp thuận trên điện thoại nhưng trang vẫn chờ. Kiểm tra bản đã cài có popup/storage policy mới, chưa giải quyết lỗi. Bổ sung application.log: zalo-loaded, zalo-navigation-blocked, zalo-network-failed (tối đa 100 lỗi mạng mỗi workspace) và zalo-renderer-gone. Chỉ ghi hostname thuộc zalo.me/zdn.vn hoặc nhãn other, mã net::ERR_*, không ghi đường dẫn/query/header/body/cookie/token. Log dùng xoay vòng hiện có. Cần tái hiện trên bản chẩn đoán; chưa khẳng định nguyên nhân hoặc sửa xong đăng nhập.

Lần tái hiện lúc 13:32 ngày 03/11/2026 (UTC+7): tải chat.zalo.me rồi id.zalo.me; sau xác nhận có zalo-navigation-blocked followed by net::ERR_ABORTED. Chẩn đoán cũ chỉ ghi other nên chưa xác định được đích. Bổ sung diagnostic hostname/protocol cho navigation bị chặn (không path/query/credentials/fragment), giữ nguyên allowlist; dùng event.url theo API Electron hiện tại. Typecheck, 6 test liên quan và build đạt. Đã cập nhật app.asar cục bộ có backup, không sửa profile. Installer release hiện vẫn là e6b342f; cần build lại sau khi xác định và sửa lỗi.

Nguyên nhân xác nhận bằng log tái hiện 13:36 ngày 03/11/2026 (UTC+7): sau xác nhận trên điện thoại, trang đăng nhập điều hướng HTTPS tới jr.zaloapp.com. Allowlist trước đó chặn đích này, gây ERR_ABORTED. Bổ sung chính xác hostname jr.zaloapp.com, không wildcard zaloapp.com; từ chối HTTP, credentials, port khác 443 và tên miền giả mạo. Không mở rộng storage-access sang jr; media/notifications vẫn từ chối. TLS kiểm tra đúng chứng chỉ *.zaloapp.com hợp lệ; chưa khẳng định đăng nhập end-to-end cho đến khi thử lại bản sửa. Typecheck, toàn bộ 26 file/100 test và build đạt.

Bản sửa e57f1c5 đã được áp dụng cục bộ vào app.asar và mở lại LinguaHub; backup app.asar.before-zalo-diagnostic-20261103 vẫn giữ nguyên. Giao diện app sẵn sàng, tab Zalo tải lại id.zalo.me; đang chờ người dùng hoàn tất xác thực lại để xác nhận end-to-end. npm run dist thành công. Installer SHA-256: 4aa73479159ab5e94cb81976c03be731b8e779a8d9bcf700330435e76542c319.

Lần thử tiếp theo lúc 13:43 ngày 03/11/2026 (UTC+7) xác nhận chuỗi chuyển tiếp còn qua jr.chat.zalo.me; allowlist trước đó tiếp tục chặn bước thứ hai, ERR_ABORTED xảy ra ở jr.zaloapp.com. Bổ sung chính xác jr.chat.zalo.me, vẫn HTTPS/không credentials/không port lạ; không mở rộng storage permissions. Regression test từ chối lookalike/subdomain khác/HTTP/credentials/port cho bước thứ hai. Typecheck, toàn bộ 26 file/101 test và build đạt. End-to-end chưa xác nhận lại.
