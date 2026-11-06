# LinguaHub (Tauri v2 / Rust)

Bản port đầy đủ của LinguaHub-AI-Pro (Electron) sang Tauri v2 + WebView2. Hướng dẫn sử dụng: [HUONG-DAN.md](HUONG-DAN.md).

## Cần cài trước (Windows)

- Node.js 22+ và npm
- Rust (rustup, toolchain `stable-x86_64-pc-windows-msvc`) + Visual Studio Build Tools (C++)
- **CMake** (`C:\Program Files\CMake\bin`) và **LLVM** (`C:\Program Files\LLVM\bin`) — để build whisper.cpp (whisper-rs)
- WebView2 Runtime (có sẵn trên Windows 11)
- Tuỳ chọn: Ollama (`ollama pull qwen2.5:7b`), Zalo PC (cho nút gọi Zalo)

## Chạy / build

```powershell
$env:Path = "C:\Program Files\CMake\bin;C:\Program Files\LLVM\bin;" + $env:Path
$env:LIBCLANG_PATH = "C:\Program Files\LLVM\bin"
npm install
npm run app      # chạy dev (sinh page-scripts rồi tauri dev)
npm run dist     # build bộ cài (src-tauri/target/release/bundle)
npm test         # test UI (vitest)
cd src-tauri; cargo test   # test Rust
```

GPU cho whisper.cpp (tuỳ chọn): `cargo build --features gpu-vulkan` (cần Vulkan SDK) hoặc `gpu-cuda` (cần CUDA toolkit).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/renderer/src` | Giao diện React (khung phải, cài đặt). `bridge.ts` ánh xạ `window.lingua` → lệnh Tauri |
| `src/page-scripts` | Script chạy trong trang WhatsApp/Telegram/Teams/… (đọc chat, gửi tin, phụ đề) — biên dịch bằng `scripts/gen-page-scripts.ts` ra `src-tauri/page-scripts/*.js` |
| `src/shared` | Logic dùng chung với bản Electron (điều hướng, chính sách dịch, che dữ liệu…) |
| `src-tauri/src` | Rust: `lib.rs` (khởi động, tray), `commands.rs` (lệnh IPC), `workspace.rs` (webview con cho từng app), `wv.rs` (eval/CDP WebView2), `ai.rs`/`chatgpt.rs`/`providers.rs` (AI), `stt.rs` (whisper.cpp), `audio.rs` (thu âm hệ thống WASAPI), `db.rs` (SQLite), `secrets.rs` (DPAPI), `notify.rs`, `zalo_pc.rs`, `urls.rs` (danh sách trang được phép) |

## Ghi chú

- Dữ liệu: `%APPDATA%\com.linguahub.tauri` (SQLite, mô hình giọng nói ở `stt\`). Lần đầu tự nhập dữ liệu học từ bản Electron nếu có.
- Chỉ webview giao diện (`ui`) được gọi lệnh Tauri; các trang chat bên thứ ba không có IPC.
- Khi chạy từ phiên Claude desktop (MSIX), AppData\Roaming bị ảo hoá vào `Packages\Claude_*\LocalCache`.
