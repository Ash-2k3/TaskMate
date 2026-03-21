---
status: partial
phase: 01-foundation
source: [01-VERIFICATION.md]
started: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. App launches without white screen
expected: Run `npm run start` — Electron window opens showing React UI (not blank). DevTools console shows "IPC bridge: connected".
result: [pending]

### 2. System tray hide-to-tray
expected: Click the window close button — app does NOT quit. A tray icon appears in the OS menu bar / system tray. The process is still running.
result: [pending]

### 3. Tray quit works cleanly
expected: Right-click tray icon → "Quit TaskMate" — app exits without crash. No SqliteError in console.
result: [pending]

### 4. Login item registration
expected: Open System Settings → General → Login Items (macOS) or Task Manager → Startup (Windows) — TaskMate appears in the list.
result: [pending]

### 5. UI response under 200ms (FOUND-06)
expected: Open DevTools Performance tab, click UI elements — all interactions complete in under 200ms.
result: [pending]

### 6. Packaged build works
expected: Run `npm run make` — build completes without errors. Launch the packaged app — window opens without white screen.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
