# Zalo PC cùng LinguaHub

Nút **Zalo PC** mở ứng dụng Zalo đã cài trên Windows và thử bố trí Zalo bên trái, LinguaHub bên phải. Đây là hai cửa sổ độc lập, không nhúng bằng SetParent, không sửa Zalo và không thay Zalo Web. Zalo tự quản lý đăng nhập, gọi điện, gửi file và các tính năng của họ.

## Sử dụng

1. Bấm **Zalo PC**. LinguaHub tìm Zalo.exe trong thư mục cài đặt thông dụng; nếu không có, anh tự chọn file Zalo.exe đã cài. Không tự tải/cài Zalo.
2. Nếu cần, anh đăng nhập trực tiếp trong Zalo. LinguaHub không thao tác xác thực.
3. **Sắp xếp cạnh nhau** thử lại bố trí cửa sổ. Màn hình nhỏ hơn 1240 × 600 DIP, Zalo chưa có cửa sổ chính hoặc Windows từ chối điều khiển: giữ hai cửa sổ riêng, hiển thị trạng thái chưa sắp xếp được.
4. **Dùng Zalo riêng**, **Trở về LinguaHub**, chuyển WhatsApp/Teams/Web hoặc đóng LinguaHub: ngừng quản lý vị trí. Không thoát tiến trình Zalo. Vị trí Zalo được khôi phục nếu anh chưa tự di chuyển nó sau khi bố trí; nếu đã tự di chuyển thì giữ ý anh.
5. Panel có ô dán chữ để dịch thủ công bằng model hiện tại. Chỉ gửi khi bấm **Dịch nội dung tôi nhập**; ChatGPT vẫn dùng quyền cloud nhập tay, Ollama xử lý cục bộ. Đổi model, sửa chữ hoặc rời panel hủy yêu cầu và bỏ kết quả muộn. Không tự sao chép clipboard, đọc chat, nhận diện màn hình, ghi âm, tải model hoặc gửi tin nhắn.

## Kỹ thuật và giới hạn

- Helper C# dùng Win32 EnumWindows/GetWindowPlacement/SetWindowPos/SetWindowPlacement, chỉ thao tác cửa sổ thuộc đúng đường dẫn Zalo.exe được chọn. Xác minh PID và đường dẫn lại trước mỗi thao tác; không nhận HWND/path/command tùy ý từ renderer.
- Main IPC chỉ nhận từ renderer chính. Helper chỉ đọc lệnh JSON cố định qua stdin và trả id/bool; không ghi tên liên hệ, nội dung hay thông tin đăng nhập. Không có mạng trong helper.
- Chỉ dò cửa sổ có giới hạn khi anh chủ động mở. Không polling liên tục khi nhàn rỗi, không always-on-top. Bố trí lại do anh bấm nút, không tự kéo Zalo theo mọi thao tác cửa sổ.
- Dùng work area màn hình của LinguaHub, đổi DIP sang pixel trên Windows; helper dùng DPI awareness theo thread. Lưu bố cục bình thường trước khi thu gọn LinguaHub. Chưa xác minh mọi cấu hình DPI/màn hình hay phiên bản Zalo có launcher khác đường dẫn tiến trình; khi không khớp, không đụng tới cửa sổ khác.
- Build Windows biên dịch native/ZaloCompanion.cs bằng csc .NET Framework có sẵn; không thêm dependency runtime Node. `npm run build` tạo out/native/ZaloCompanion.exe; NSIS đưa helper vào resources. Khi chạy dev lần đầu, build trước để có helper. Chưa ký số installer/helper.

## Kiểm thử

Typecheck và toàn bộ 29 file/108 test đạt. Sau bổ sung xử lý mở lại Zalo đã đóng và khôi phục bố cục khi không sắp xếp được, 7 test liên quan và build đạt. Các test có kiểm tra màn hình nhỏ/âm tọa độ, chỉ thu gọn sau native placement thành công, khôi phục bố cục, hủy khi đổi workspace trong lúc dò, không khởi chạy lỗi thời, không gửi AI trước consent, bỏ kết quả dịch nhập tay lỗi thời.

Helper đã biên dịch trên Windows và smoke test giao thức find/release khi Zalo chưa chạy (không di chuyển cửa sổ). Kiểm tra bố trí cửa sổ Zalo thật, quay về, giữ phiên và installer sẽ được ghi sau khi thực hiện. Chưa kiểm tra gọi điện, gửi file, DPI hỗn hợp hoặc dịch AI thật; không coi mock là end-to-end.

Đóng gói Windows NSIS x64 thành công. SHA-256 installer: 47ea8bf6f73babeea9f8d5a4e012f232eb956bf73de4a7a14758d3c880b37800. Archive main/preload/renderer HTML và helper resources được đối chiếu với build đã kiểm thử. Chưa cập nhật bản đang cài: Computer Use phát hiện người dùng đang thao tác, đã dừng input và chờ đóng LinguaHub. Chưa xác nhận bố trí Zalo thật hoặc UI nhập tay trên app thật. Dữ liệu và phiên của Zalo PC do Zalo quản lý; xóa dữ liệu LinguaHub không xóa dữ liệu ứng dụng Zalo PC.
