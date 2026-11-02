# SignalDesk

SignalDesk is a standalone Windows desktop workspace prototype. Its current data model supports local conversations, contacts, tasks, bot profiles, notices, preferences, and Zalo Web embedded in the main app window.

## Install and run

Use Node.js 24 or later, then run these commands from this directory:

```powershell
npm ci
npm run typecheck
npm test
npm run build
npm run desktop
```

For Vite development, keep the server and Electron in separate terminals:

```powershell
npm run dev
```

```powershell
$env:SIGNALDESK_DEV_URL = 'http://127.0.0.1:5173'
npm run desktop
```

Build the Windows x64 NSIS installer with:

```powershell
npm run dist
```

The installer is written to `release/`. Electron Builder packages the renderer and both Electron files. Uninstall is configured to keep the application's user data.

## Local data and migration

- Existing `signaldesk.*` local-storage entries are read without removal and migrated to versioned `signaldesk.v2.*` entries.
- Stored collections are checked and repaired record by record. If a saved value is invalid, it remains untouched until the user makes a change; before replacing it, SignalDesk stores a recovery copy under `signaldesk.recovery.*`.
- Storage and quota errors are shown in the workspace instead of being ignored.
- Zalo uses the persistent Electron partition `persist:signaldesk-zalo`. Its embedded view stays loaded when switching to another SignalDesk page, and closing the app does not clear its cookies or site data. The explicit reset action asks for confirmation before clearing the partition.
- The local app shell has a restrictive Content Security Policy and blocks navigation away from its own page. Zalo runs without Node integration, with context isolation and renderer sandboxing; its web session is denied camera, microphone, and notification permissions.
- The installed app keeps its `local.signaldesk.workspace` app identity and configures uninstall not to delete app data, preserving the existing profile location.
- The build pins `minimatch` to patched version `11.0.1`; `npm audit` reports no known vulnerabilities in the lockfile.

Back up the app's user-data folder before replacing an installed build if local records or the Zalo session are important. A damaged local-storage value is copied to a recovery key before its next successful save.

## Current behavior and limits

- Chat and Inbox store messages locally; they do not send messages through Zalo, Teams, or WhatsApp.
- Zalo appears in an embedded, sandboxed Electron view inside the SignalDesk window. Switching to another page hides the view while keeping its login session. “Đã tải trang” means the page finished loading; it does not confirm account authentication.
- Zalo messages are not synchronized into SignalDesk Inbox.
- Bot cards are editable local profiles and do not run AI services.
- Contacts and tasks support local create, edit, delete, filtering, and status updates.
- Calls, video, attachments, account sync, and remote backend services are not connected.
- Opening Zalo requires a network connection and a user-controlled login. A live account login has not been used as an automated test.

## Automated checks

`npm test` uses Node's built-in test runner. It covers versioned storage and recovery behavior, legacy bot/task migration, search/filter/CRUD helpers, and the embedded Zalo view's URL restrictions, persistent partition, bounds and visibility, explicit reset, and load errors.

## Manual Windows QA checklist

1. Install over an existing SignalDesk build, open it, and confirm existing conversations, preferences, and bot profiles still appear.
2. Create, edit, and delete a contact, a task, and a bot profile; restart and confirm the resulting data remains.
3. Search Chat and Inbox with Vietnamese accents, multiple terms, channel filters, and unread-only filters. Open an unread conversation and confirm its unread count clears.
4. Change task status, set and clear a due date, and confirm tasks remain in their correct status columns after restart.
5. Open Zalo inside SignalDesk, sign in by QR or the method shown by Zalo, switch to another page and return, and confirm the embedded view and session remain.
6. Select “Xóa phiên đã lưu”, cancel once, and confirm the session remains. Confirm the action on a second attempt and verify Zalo requests a new login.
7. Resize the app to its minimum supported size, confirm the Zalo view stays within its frame, collapse and expand the sidebar, switch dark and compact appearance, and confirm controls remain reachable.
8. Turn Windows notifications on and off, then verify the permission result is reflected in SignalDesk settings.
9. Uninstall the app and confirm its user-data directory remains. Reinstall and confirm local records and the Zalo session are still available.

This checklist requires a Windows desktop and, for steps 5–6, a Zalo account controlled by the tester. Automated checks do not sign in to a live account.

The generated installer uses Electron Builder's default application icon and is not code signed in this environment.
