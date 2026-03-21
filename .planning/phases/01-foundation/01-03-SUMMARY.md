---
phase: 01-foundation
plan: 03
subsystem: ipc-tray
tags: [electron, contextbridge, ipc, system-tray, login-item, preload]

# Dependency graph
requires:
  - 01-01 (Electron Forge scaffold with preload path in BrowserWindow)
  - 01-02 (DataService and settingsStore for IPC handlers and before-quit)
provides:
  - Typed contextBridge API (window.taskmate) with 9 IPC channels
  - Stub IPC handlers for all channels (tasks, reflections, settings)
  - System tray with hide-to-tray behavior and Open/Quit context menu
  - Login-item registration on startup via settingsStore.openAtLogin
  - Single before-quit handler that sets app.isQuitting and closes DataService
affects:
  - src/main/index.ts (adds tray/IPC wiring, before-quit handler, window-all-closed behavior)

# Tech stack
added:
  - contextBridge API pattern — secure typed IPC bridge between main and renderer
  - Tray API with app.isQuitting pattern — hide-to-tray instead of quit on close
  - app.setLoginItemSettings — OS-level auto-start on boot
patterns:
  - contextBridge.exposeInMainWorld with typeof for DRY type sharing
  - Module-level mainWindow variable for tray access
  - win.hide() + app.dock.hide() (never app.hide() — Pitfall 6)
  - Before-quit handler is the single source of truth for app lifecycle shutdown

# Key files
created:
  - src/preload/preload.ts — contextBridge API with 9 typed IPC channels
  - src/renderer/types/global.d.ts — Window augmentation using typeof taskmateAPI
  - src/main/ipc-handlers.ts — registerIpcHandlers with stub handlers for all channels
  - src/main/tray.ts — initTray and setupWindowCloseHandler with hide-to-tray logic
  - src/assets/tray-icon.png — 22x22 PNG placeholder tray icon
modified:
  - src/main/index.ts — added tray/IPC wiring, before-quit handler, window-all-closed fix
  - forge.config.ts — added extraResource for src/assets in packaged builds

# Decisions
- contextBridge with typeof import keeps Window types DRY — types come from preload source of truth
- app.isQuitting flag pattern (not app.quit() directly in close handler) prevents double-close
- win.hide() only in close handler (never app.hide()) — avoids macOS Pitfall 6 frozen app
- Single before-quit handler in index.ts handles both app.isQuitting flag AND dataService.close() to prevent double-close crash
- IPC handlers registered BEFORE createWindow() so first renderer invokes succeed
- mainWindow promoted to module-level variable so tray's getMainWindow closure always returns current window

# Metrics
duration: ~10 minutes
completed: 2026-03-21
tasks_completed: 2
tasks_total: 2
files_created: 5
files_modified: 2
---

# Phase 1 Plan 3: Typed IPC Bridge, System Tray, and Login Item Summary

**One-liner:** Typed contextBridge exposes window.taskmate with 9 IPC channels; system tray with hide-to-tray uses win.hide+app.isQuitting pattern; login item registered from settingsStore.

## What Was Built

### Task 1: contextBridge preload, global.d.ts typing, and stub IPC handlers

**src/preload/preload.ts** exposes `window.taskmate` via `contextBridge.exposeInMainWorld` with typed methods covering all 9 IPC channels: `getTasks`, `createTask`, `updateTask`, `deleteTask`, `completeTask`, `getReflection`, `saveReflection`, `getSettings`, `updateSettings`, plus `onReflectionPrompt` with cleanup function for the Main-to-Renderer push event.

**src/renderer/types/global.d.ts** augments the `Window` interface using `typeof taskmateAPI` imported from the preload — types stay in sync automatically with no duplication.

**src/main/ipc-handlers.ts** exports `registerIpcHandlers(dataService)` with stub `ipcMain.handle` handlers for all 9 channels. Tasks return empty/stub data, reflections return null, settings:get returns `settingsStore.store`, settings:update calls `settingsStore.set()` per key.

**src/main/index.ts** now calls `registerIpcHandlers(dataService)` before `createWindow()`.

### Task 2: System tray, tray icon, and login-item registration

**src/main/tray.ts** exports:
- `initTray(getMainWindow)` — creates Tray with context menu containing "Open TaskMate" and "Quit TaskMate", handles click (macOS) and double-click (Windows) to show window
- `setupWindowCloseHandler(win)` — intercepts `close` event with `event.preventDefault()` when `!app.isQuitting`, calls `win.hide()` and `app.dock.hide()` (macOS only)

**src/assets/tray-icon.png** — 22x22 pixel dark gray PNG placeholder (real icon to be designed before release).

**src/main/index.ts** updated to:
- Promote `mainWindow` to module scope for tray access
- Call `initTray(() => mainWindow)` and `setupWindowCloseHandler(mainWindow!)` after `createWindow()`
- Call `app.setLoginItemSettings({ openAtLogin })` using value from `settingsStore`
- Replace `window-all-closed` with an empty handler (tray keeps app alive)
- Add the sole `before-quit` handler that sets `app.isQuitting = true` and calls `dataService?.close()`

**forge.config.ts** updated with `extraResource: ['src/assets']` for packaged build icon delivery.

## Deviations from Plan

None — plan executed exactly as written, with one minor addition: a `void dataService;` call in ipc-handlers.ts to suppress the TypeScript unused variable warning since dataService will be used in Phase 2.

## Known Stubs

| File | What is stubbed | Reason |
|------|----------------|--------|
| src/main/ipc-handlers.ts | tasks:getAll returns `[]`, tasks:create returns `{ id: 'stub', ...task }` | Phase 2 will implement real DataService task operations |
| src/main/ipc-handlers.ts | reflections:get returns `null`, reflections:save returns `true` | Phase 4 will implement reflection persistence |

These stubs are intentional — the plan's goal (FOUND-01 security model) is achieved. The stubs will be replaced in Phase 2 (tasks) and Phase 4 (reflections).

## Self-Check: PASSED

**Files verified:**
- FOUND: src/preload/preload.ts
- FOUND: src/renderer/types/global.d.ts
- FOUND: src/main/ipc-handlers.ts
- FOUND: src/main/tray.ts
- FOUND: src/assets/tray-icon.png

**Commits verified:**
- a4e5dc5: feat(01-03): add contextBridge preload, global.d.ts typing, and stub IPC handlers
- 0b025db: feat(01-03): create system tray with hide-to-tray, tray icon, and login-item registration
