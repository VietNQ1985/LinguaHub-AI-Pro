# LinguaHub: Rust migration plan (starting from PR #5)

## Current status

This branch is based on the head of PR #5 (feature/linguahub-v2-messaging).
It adds the first real Rust crate, **not** a finished Tauri application.
The shipping application remains Electron + React + TypeScript.
No existing integrations, installed app, data, authentication, or behavior are replaced.

Rust code is under rust/linguahub-core. The library implements:
- Bounded recent chat context (20 messages, 2,000 Unicode characters each, 9,000 UTF-8 bytes total).
- Snapshot-scoped message identity and duplicate disambiguation.
- Priority/backlog translation batches (at most four messages).
- Separate consent checks for manual and background cloud requests.
- Composer request validation and English-preview stale-state guard.

The JSON Lines executable is an optional integration boundary for a future
Tauri command adapter. It does **not** read chats, call AI or send messages.
Run it with 'cargo run -p linguahub-core' from rust/, one JSON command per line.
Example input:

    {"op":"recent_context","messages":[{"side":"left","text":"Please verify the UOM."}]}

Expected JSON response has 'ok: true' and 'result' containing the bounded message list.

## Why not a blind Electron-to-Tauri replacement?

The current application depends on Electron BrowserWindow/WebContentsView,
isolated persistent Chromium sessions, Electron safeStorage, notifications,
IPC sender/frame verification, fixed page-read scripts, Windows Zalo-PC window
embedding, Teams meeting captions and Windows-specific shortcuts.
Tauri uses a different WebView2/window/permission model. A simple framework
swap would break working behavior and could expand data-access permissions.

## Migration stages

1. **Rust core, this branch.** Make policy functions and contract tests
   independent of UI and browser privileges. Existing TypeScript remains
   authoritative at runtime. No duplicate network, chat or AI requests.
2. **Tauri app shell, separate PR.** Reuse React layout. Introduce explicitly
   scoped Tauri commands, per-service session profiles and strict navigation
   rules. Port authentication with OS-backed secret protection. Require a
   per-command permission review and avoid broad filesystem/network plugins.
3. **Windows feature parity.** Prove WebView2 embedding, Teams captions,
   WhatsApp/Teams/Zalo read-only capture, notifications, Zalo PC focus/embedding,
   OAuth callback and cancellation with signed installer test builds.
4. **Data and compatibility.** Migrate sql.js/Drizzle learning data with
   backup/restore and schema-version tests. Preserve sessions where supported;
   otherwise warn before login is required.
5. **Cutover only after parity.** Verify cloud consent, session separation,
   no stale previews, duplicate identity, no wrong-recipient sends, install,
   upgrade, uninstall and Windows 10/11 performance. Roll back to Electron on
   failures.

## Compatibility and security notes

- JavaScript counts UTF-16 code units while Rust counts Unicode characters
  and UTF-8 bytes. Context limits are intentionally conservative; compare
  boundary cases before swapping the runtime implementation.
- Rust NFKC + Unicode lowercase is similar to JavaScript NFKC +
  toLocaleLowerCase(), but locale-specific casing can differ. Run contract
  fixtures before enabling new identity keys at runtime.
- The preview guard is a pure state check, not proof of recipient identity.
  Direct send must remain disabled unless a verified, human-confirmed recipient
  adapter has passed end-to-end tests.
- Do not print chat contents, OAuth tokens, prompts or personal information in
  CLI errors or logs. The executable currently emits only structured results.
- No benchmark or full Tauri UI test has been executed by this branch.

## CI and local verification

CI: Rust Core Checks runs format, Clippy and tests on Linux and Windows.
To run locally with a Rust toolchain:

    cd rust
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets -- -D warnings
    cargo test --workspace --all-targets

The existing npm checks remain responsible for the Electron app until cutover.
