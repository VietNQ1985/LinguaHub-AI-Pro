# SignalDesk

SignalDesk is a standalone Windows desktop workspace prototype with internal chat, contacts, tasks, Zalo, unified inbox, AI bots, notifications, and settings.

## Start

This folder uses the React, Vite, Electron, and Lucide packages already installed in the parent workspace.

```powershell
npm run build
npm run desktop
```

For web development, run `npm run dev`. In a second terminal, start Electron with the development URL:

```powershell
$env:SIGNALDESK_DEV_URL = 'http://127.0.0.1:5173'
npm run desktop
```

To create a Windows installer, run `npm run dist`.

## Prototype behavior

- Navigation between the eight workspace areas is active.
- Chat, contacts, tasks, AI bot toggles, notices, and appearance preferences are stored in the local application profile.
- New contacts, conversations, tasks, and bots can be added from the interface.
- Messages typed in Chat or Inbox stay in this local prototype.
- Zalo Web opens in a separate SignalDesk window with a persistent app session for personal-account login.
- Zalo messages are not synchronized into SignalDesk's internal Inbox.
- Zalo chat synchronization, calls, file upload, server data, and AI services are not connected.

This prototype uses fictional sample data and a separate SignalDesk identity. It does not connect to any organization's live services or reuse account data.
