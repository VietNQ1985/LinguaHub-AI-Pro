# LinguaHub Native (Tauri 2 + Rust)

A separate **real native Tauri** Windows app lives in `src-tauri/` and `tauri-ui/`.
It does not use Electron at runtime. The current Electron app remains untouched.

## Architecture

- Tauri Rust owns a native window, one local UI WebView2 and isolated, persistent
  child WebView2 sessions for WhatsApp, Teams, Zalo Web and Outlook.
- **Remote chat webviews do not have a Tauri capability**, nor can their page
  JavaScript invoke application commands. Native-side `eval_with_callback`
  reads only visible chat after explicit permission.
- React renders the native control panel. Switching tabs hides/shows the existing
  service webview without logging out. Rust processes clipboard and AI locally.
- Local Ollama is the initial supported provider; no API key, OAuth token
  migration, or automatic sending.
- Tauri's new app identifier isolates its settings and sessions from Electron.

## Build on Windows

```powershell
npm ci
npm install --no-save --package-lock=false @tauri-apps/cli@^2
npx tauri build --ci
```

See the GitHub Actions artifact `LinguaHub-Tauri-Rust-Windows`.

## Currently incomplete / needs validation

The Tauri build proves compilation, **not** login on real Microsoft/Meta/Zalo
sites, Teams microphone/camera behavior, caption selectors, or signed installer.
Do not treat those integrations as verified until real-account testing.
ChatGPT OAuth, Gemini, advanced vocabulary persistence, native Zalo PC embedding,
tray notifications, direct send and full Electron UI feature parity still require
further migration and explicit user permissions. The app never silently sends
a chat message. There is no microphone recording or upload by this Rust process.

Do not overwrite the original Electron installation with this experimental build.
