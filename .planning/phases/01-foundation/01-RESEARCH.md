# Phase 1: Foundation - Research

**Researched:** 2026-03-21
**Domain:** Electron Forge + Vite + React + TypeScript scaffold, better-sqlite3, contextBridge IPC, system tray, login-item registration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | App launches as Electron desktop app with contextIsolation enabled and typed preload/IPC bridge | Plan 01-01 (scaffold + webPreferences), Plan 01-03 (contextBridge preload) |
| FOUND-02 | App minimizes to system tray (does not fully quit on window close) so background scheduling survives | Plan 01-03 (Tray API, close event intercept, app.isQuitting pattern) |
| FOUND-03 | App registers as a login item so it starts on system boot | Plan 01-03 (app.setLoginItemSettings, platform differences) |
| FOUND-04 | All data persists to local storage (better-sqlite3 + electron-store) and survives restart | Plan 01-02 (WAL mode, DataService, electron-store schema) |
| FOUND-05 | App works fully offline with zero network access required | Plan 01-01 (CSP blocks network, no remote resources) |
| FOUND-06 | All UI interactions respond under 200ms | Plan 01-01 (Vite HMR scaffold speed), Plan 01-02 (synchronous better-sqlite3 API) |
</phase_requirements>

---

## Summary

Phase 1 establishes the non-negotiable foundation for TaskMate: a correctly configured Electron shell that will never require a retroactive rewrite. The three plans map directly to three distinct technical concerns — (1) the Electron Forge scaffold with routing, CSP, and devtools configuration; (2) the persistence layer with better-sqlite3 in WAL mode and electron-store v8.x for settings; and (3) the contextBridge preload surface, system tray behavior, and login-item registration.

The stack is locked and unambiguous from prior research. The only decisions remaining for the planner are implementation specifics: the exact Vite config structure for native module externals, the `global.d.ts` pattern for typing `window.taskmate`, the `app.isQuitting` augmentation for TypeScript, and the macOS vs Windows differences in `setLoginItemSettings`. All of these have verified answers documented below.

The single highest-risk item in this phase is native module setup for better-sqlite3 — it must be marked as external in Vite's rollup config AND unpacked from ASAR in the packagerConfig AND rebuilt against Electron's Node via `electron-rebuild`. Missing any one of these three steps produces a packaged app that crashes silently on the first database call.

**Primary recommendation:** Use `npm create electron-app@latest taskmate -- --template=vite-typescript`, add React manually per the official guide, then wire better-sqlite3 with the three-part external/asarUnpack/rebuild configuration before writing any application code.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| electron | 35.x (latest stable — verify `npm view electron version`) | App runtime | Official runtime |
| @electron-forge/cli | 7.11.1 | Build, dev, packaging toolchain | Official Electron toolchain |
| @electron-forge/plugin-vite | 7.11.1 | Vite integration for main/preload/renderer | Official Forge plugin |
| vite | 5.x (pulled by plugin) | Bundler for renderer | HMR, fast dev cycle |
| @vitejs/plugin-react | 4.x | React JSX transform for renderer | Standard React+Vite pairing |
| react | 18.x | Renderer UI | Project decision |
| react-dom | 18.x | React DOM renderer | Paired with React |
| react-router-dom | 6.x | Client-side routing | HashRouter for packaged build |
| typescript | 5.x | Type safety across all three processes | Project decision |
| better-sqlite3 | 12.8.0 | SQLite persistence for tasks/reflections | Synchronous API, WAL mode, crash resilient |
| @electron/rebuild | latest | Recompile native modules for Electron's Node | Required for better-sqlite3 |
| electron-store | 8.2.0 (pinned — see note) | Settings/preferences persistence | Zero-config key-value store |

**electron-store version note (CRITICAL):** As of 2026, `electron-store` v10+ and v11 are ESM-only. The Electron Forge Vite template uses a CommonJS main process by default. Pin `electron-store` to `"8.2.0"` exactly. If the project later migrates the main process to ESM (Electron 28+ supports ESM in main process), this pin can be relaxed, but that migration is out of scope for Phase 1.

**Alternative option:** `electron-conf` is an actively maintained CJS/ESM dual-mode alternative to electron-store. It avoids the version-pinning problem entirely. Either is acceptable; the plan should use `electron-store@8.2.0` as the locked decision.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react | 18.x | React TypeScript types | Always with React + TS |
| @types/react-dom | 18.x | React DOM TypeScript types | Always with React + TS |
| @types/better-sqlite3 | 7.x | SQLite TypeScript types | Always with better-sqlite3 |
| @types/node-cron | 3.x | node-cron types (stub only in Phase 1) | For IPC channel stubs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| electron-store@8.2.0 | electron-conf | electron-conf is CJS/ESM dual-mode; either works; electron-store is the locked decision |
| better-sqlite3 | sql.js (WASM) | sql.js needs no rebuild but is 3-5x slower and uses more memory; not appropriate |
| HashRouter | BrowserRouter | BrowserRouter breaks in packaged build; HashRouter is mandatory |
| @electron-forge/plugin-vite | electron-builder + vite | electron-builder is valid but Forge is the locked decision |

**Installation (scaffold first, then add):**
```bash
# Step 1: Scaffold
npm create electron-app@latest taskmate -- --template=vite-typescript

# Step 2: Add React
npm install --save react react-dom react-router-dom
npm install --save-dev @types/react @types/react-dom @vitejs/plugin-react

# Step 3: Add SQLite
npm install --save better-sqlite3
npm install --save-dev @types/better-sqlite3 @electron/rebuild

# Step 4: Add settings store (pinned)
npm install --save electron-store@8.2.0
```

**Version verification:**
```bash
npm view electron version          # confirm latest stable
npm view better-sqlite3 version    # currently 12.8.0
npm view electron-store versions --json | tail -20  # confirm v8.2.0 exists
npm view @electron-forge/cli version  # currently 7.11.1
```

---

## Architecture Patterns

### Recommended Project Structure

```
taskmate/
├── forge.config.ts              # Electron Forge configuration
├── vite.main.config.ts          # Main process Vite config (externals: better-sqlite3, electron-store)
├── vite.preload.config.ts       # Preload Vite config (externals: electron)
├── vite.renderer.config.ts      # Renderer Vite config (base: './', React plugin)
├── package.json
├── tsconfig.json                # Base: strict, target ESNext
├── src/
│   ├── main/
│   │   ├── index.ts             # App entry: createWindow, registerIpcHandlers, initTray, setLoginItemSettings
│   │   ├── data-service.ts      # DataService class wrapping better-sqlite3
│   │   ├── ipc-handlers.ts      # All ipcMain.handle() registrations
│   │   ├── tray.ts              # Tray setup, context menu, window hide-to-tray
│   │   └── settings-store.ts    # electron-store v8 instance with schema
│   ├── preload/
│   │   └── preload.ts           # contextBridge.exposeInMainWorld('taskmate', {...})
│   ├── renderer/
│   │   ├── index.html           # CSP meta tag here
│   │   ├── main.tsx             # React entry: createRoot, HashRouter, App
│   │   ├── App.tsx              # Route definitions
│   │   └── types/
│   │       └── global.d.ts      # Window interface augmentation for window.taskmate
│   └── assets/
│       └── tray-icon.png        # 16x16 (Windows) and 22x22 (macOS) — BOTH needed
```

### Pattern 1: Forge + Vite Config Structure

**What:** Three Vite config files — one per process type. Main and preload mark native modules as external so Vite's rollup does not attempt to bundle them. Renderer uses `base: './'` and the React plugin.

**forge.config.ts:**
```typescript
// Source: https://www.electronforge.io/config/plugins/vite
import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    extraResource: [],
    // CRITICAL: unpack native binaries from ASAR so they can be loaded
    asarUnpack: ['**/*.node', '**/better-sqlite3/**'],
  },
  rebuildConfig: {
    onlyModules: ['better-sqlite3'],
  },
  makers: [
    { name: '@electron-forge/maker-squirrel', config: {} },  // Windows
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },  // macOS
    { name: '@electron-forge/maker-deb', config: {} },  // Linux
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: 'src/main/index.ts', config: 'vite.main.config.ts' },
        { entry: 'src/preload/preload.ts', config: 'vite.preload.config.ts' },
      ],
      renderer: [
        { name: 'main_window', config: 'vite.renderer.config.ts' },
      ],
    }),
  ],
};

export default config;
```

**vite.main.config.ts:**
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      // CRITICAL: do not bundle native modules — they must be loaded at runtime
      external: ['better-sqlite3', 'electron-store', 'electron'],
    },
  },
});
```

**vite.preload.config.ts:**
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
```

**vite.renderer.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // CRITICAL: base './' makes all asset paths relative — required for packaged build
  base: './',
  plugins: [react()],
});
```

### Pattern 2: contextBridge Preload with TypeScript Typing

**What:** Expose a typed `window.taskmate` API via `contextBridge.exposeInMainWorld`. Type it with a `global.d.ts` augmentation in the renderer so TypeScript knows the shape.

**src/preload/preload.ts:**
```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
import { contextBridge, ipcRenderer } from 'electron';

// Export type for use in global.d.ts
export const taskmateAPI = {
  // Tasks — stubbed in Phase 1, implemented in Phase 2
  getTasks: () => ipcRenderer.invoke('tasks:getAll'),
  createTask: (task: unknown) => ipcRenderer.invoke('tasks:create', task),
  updateTask: (id: string, updates: unknown) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  completeTask: (id: string) => ipcRenderer.invoke('tasks:complete', id),

  // Reflections — stubbed in Phase 1
  getReflection: (date: string) => ipcRenderer.invoke('reflections:get', date),
  saveReflection: (date: string, answers: unknown) => ipcRenderer.invoke('reflections:save', date, answers),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: unknown) => ipcRenderer.invoke('settings:update', updates),

  // Main → Renderer push events (listeners)
  onReflectionPrompt: (cb: () => void) => {
    ipcRenderer.on('prompt:reflection', cb);
    // Return cleanup function
    return () => ipcRenderer.removeListener('prompt:reflection', cb);
  },
};

contextBridge.exposeInMainWorld('taskmate', taskmateAPI);
```

**src/renderer/types/global.d.ts:**
```typescript
// Source: https://www.electronjs.org/docs/latest/tutorial/context-isolation
import type { taskmateAPI } from '../../preload/preload';

declare global {
  interface Window {
    taskmate: typeof taskmateAPI;
  }
}

export {};
```

**Key rule:** The `typeof taskmateAPI` approach keeps the renderer types in sync with the preload — no duplicated interface definition. If the preload changes, TypeScript errors surface in the renderer automatically.

### Pattern 3: BrowserWindow Setup with Security Baseline

```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // CRITICAL: these three settings are the security baseline (Electron 12+ defaults)
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../preload/preload.js'),
      // sandbox: true is ideal but may require additional IPC setup — evaluate
    },
    show: false, // show only after ready-to-show for faster perceived startup
  });

  // Dev: load from Vite dev server; prod: load packaged file
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Show window only when ready (avoids blank flash)
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Gate devtools on dev builds only
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}
```

### Pattern 4: better-sqlite3 Initialization with WAL Mode

```typescript
// src/main/data-service.ts
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';

export class DataService {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'taskmate.db');

    this.db = new Database(dbPath);

    // CRITICAL: enable WAL mode immediately after open, before any other operation
    this.db.pragma('journal_mode = WAL');
    // NORMAL: safe balance between performance and crash resilience for desktop
    this.db.pragma('synchronous = NORMAL');
    // Enable foreign key enforcement
    this.db.pragma('foreign_keys = ON');

    this.initSchema();
  }

  private initSchema() {
    // Run schema creation in a transaction — atomic: all or nothing
    this.db.transaction(() => {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          due_date TEXT,
          priority TEXT NOT NULL DEFAULT 'medium',
          completed INTEGER NOT NULL DEFAULT 0,
          completed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          notified_at TEXT,
          renotified INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS reflections (
          date TEXT PRIMARY KEY,
          q1 TEXT,
          q2 TEXT,
          q3 TEXT,
          completed_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS weekly_summaries (
          week_of TEXT PRIMARY KEY,
          generated_at TEXT NOT NULL,
          data TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
      `);
    })();
  }

  close() {
    this.db.close();
  }
}
```

**Close on quit (CRITICAL):**
```typescript
// src/main/index.ts
app.on('before-quit', () => {
  dataService.close(); // flush WAL buffer before process exits
});
```

### Pattern 5: electron-store v8 Schema Validation

```typescript
// src/main/settings-store.ts
import Store from 'electron-store';

interface Settings {
  reflectionTime: string;
  minimizeToTray: boolean;
  openAtLogin: boolean;
  theme: 'system' | 'light' | 'dark';
  windowBounds: { x: number; y: number; width: number; height: number } | null;
  timezone: string;
  lastSeenReflectionDate: string | null;
}

// Source: https://github.com/sindresorhus/electron-store
export const settingsStore = new Store<Settings>({
  name: 'settings',  // creates settings.json in userData
  schema: {
    reflectionTime: { type: 'string', default: '21:00' },
    minimizeToTray: { type: 'boolean', default: true },
    openAtLogin: { type: 'boolean', default: true },
    theme: { type: 'string', enum: ['system', 'light', 'dark'], default: 'system' },
    windowBounds: { default: null },
    timezone: { type: 'string', default: Intl.DateTimeFormat().resolvedOptions().timeZone },
    lastSeenReflectionDate: { default: null },
  },
  // Migrations — handles schema changes between versions without data loss
  migrations: {
    '0.1.0': (store) => {
      // Initial schema — no migration needed but establishes the pattern
    },
  },
});
```

### Pattern 6: System Tray with Hide-to-Tray

```typescript
// src/main/tray.ts
// Source: https://www.electronjs.org/docs/latest/api/tray (official Electron docs)
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function initTray(getMainWindow: () => BrowserWindow | null): void {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
    : path.join(__dirname, '../../assets', 'tray-icon.png');

  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('TaskMate');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TaskMate',
      click: () => {
        const win = getMainWindow();
        if (win) {
          if (process.platform === 'darwin') app.dock.show();
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit TaskMate',
      click: () => {
        (app as typeof app & { isQuitting: boolean }).isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // macOS: single click opens window (standard tray behavior)
  tray.on('click', () => {
    const win = getMainWindow();
    if (win) { win.show(); win.focus(); }
  });

  // Windows: double-click opens window
  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) { win.show(); win.focus(); }
  });
}

// CRITICAL: intercept window close to hide instead of quit
export function setupWindowCloseHandler(win: BrowserWindow): void {
  win.on('close', (event) => {
    const isQuitting = (app as typeof app & { isQuitting?: boolean }).isQuitting;
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
      // macOS: hide dock icon when app is in tray-only mode
      if (process.platform === 'darwin') {
        app.dock.hide();
      }
    }
  });
}
```

**TypeScript augmentation for app.isQuitting:**
```typescript
// src/types/electron-extensions.d.ts
declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}
```

### Pattern 7: Login Item Registration

```typescript
// src/main/index.ts — call during app.whenReady()
// Source: https://www.electronjs.org/docs/latest/api/app (setLoginItemSettings)
function registerLoginItem(): void {
  // Windows: set AUMID first (required for notifications too)
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.taskmate.app');
  }

  // Read current setting from electron-store (user may have toggled it)
  const openAtLogin = settingsStore.get('openAtLogin');

  app.setLoginItemSettings({
    openAtLogin,
    // macOS 13+: 'mainAppService' is the default — opens the main app
    // No type parameter needed for standard behavior
  });
}
```

**Platform differences (HIGH confidence, from official Electron docs):**

| Property | macOS | Windows |
|----------|-------|---------|
| `openAtLogin` | Works via LaunchServices | Works via registry `HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` |
| `openAsHidden` | Deprecated on macOS 13+ — do not use | N/A |
| `type` parameter | macOS 13+ only: `mainAppService`, `agentService`, etc. | Ignored |
| `name` parameter | N/A | Registry value name (default: AppUserModelId) |
| `enabled` parameter | N/A | Controls Task Manager startup entry |
| MAS/APPX builds | Does NOT work in Mac App Store builds | Does NOT work in APPX builds |
| Task Manager override | N/A | User can disable in Task Manager — OS uses separate `StartupApproved` key; `getLoginItemSettings()` may return stale value |

**Do not** use `openAsHidden` — deprecated macOS 13+. For "open hidden" behavior on all platforms, detect `app.getLoginItemSettings().wasOpenedAtLogin` on startup and skip creating a visible window.

### Pattern 8: CSP in index.html

```html
<!-- src/renderer/index.html -->
<!-- Source: https://www.electronjs.org/docs/latest/tutorial/security -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
```

**Why meta tag (not HTTP headers):** Electron loads `file://` URLs in the renderer. HTTP response headers are only set for network responses. For local file loads, the `<meta>` tag is the only reliable CSP mechanism.

**Why `'unsafe-inline'` for style:** React-rendered inline styles and CSS-in-JS require it. Do NOT add `'unsafe-inline'` for scripts — Vite's production output is fully external files.

**For development only** — Vite injects a small inline script for HMR. A strict script-src will break the dev server. Gate with environment:
```html
<!-- In dev: allows Vite HMR inline scripts (never in prod) -->
<!-- Vite dev server must also be added: script-src 'self' http://localhost:5173 -->
```
Use separate CSP per environment. Forge's Vite plugin sets `MAIN_WINDOW_VITE_DEV_SERVER_URL` in dev mode — use this to conditionally load the right CSP via a preload hook or environment variable injection.

### Pattern 9: CSP + App Entry Bootstrap

```typescript
// src/main/index.ts — complete startup sequence
import { app, BrowserWindow } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { initTray, setupWindowCloseHandler } from './tray';
import { DataService } from './data-service';
import { settingsStore } from './settings-store';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let dataService: DataService;

app.whenReady().then(() => {
  // Platform setup — Windows AUMID must be set before ANY notification or login item
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.taskmate.app');
  }

  // Initialize persistence layer
  dataService = new DataService();

  // Register all IPC handlers before creating the window
  registerIpcHandlers(dataService, settingsStore);

  // Create main window
  createWindow();

  // Initialize system tray
  initTray(() => mainWindow);
  setupWindowCloseHandler(mainWindow!);

  // Register login item
  registerLoginItem();

  // macOS: re-open window when dock icon clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else { mainWindow?.show(); mainWindow?.focus(); }
  });
});

// CRITICAL: do not quit when all windows closed — tray keeps app alive
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // On non-macOS, window-all-closed fires even with tray active
    // Do NOT call app.quit() here — the tray handles quitting
  }
});

app.on('before-quit', () => {
  dataService?.close();
});
```

### Pattern 10: Renderer Entry with HashRouter

```tsx
// src/renderer/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';

// CRITICAL: HashRouter is required for Electron packaged builds
// BrowserRouter generates paths like /tasks that file:// cannot resolve
const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
```

### Anti-Patterns to Avoid

- **Exposing raw ipcRenderer:** `contextBridge.exposeInMainWorld('electron', { ipcRenderer })` gives the renderer unmediated IPC access. Expose only specific methods.
- **nodeIntegration: true:** Never enable. Opens full Node.js access from renderer.
- **BrowserRouter in Electron:** Generates absolute paths that fail on `file://`. Always HashRouter.
- **Forgetting `base: './'` in Vite renderer config:** Vite defaults to `/` for asset paths. In packaged builds, `/assets/index.js` does not exist at the filesystem root.
- **Writing to `__dirname` in main process:** In packaged builds, `__dirname` points inside the ASAR archive (read-only on macOS/Windows signed apps). Use `app.getPath('userData')` for all writable files.
- **better-sqlite3 inside ASAR:** Native `.node` binaries cannot be loaded from inside ASAR. The `asarUnpack` config is mandatory.
- **Missing `db.close()` on before-quit:** SQLite WAL buffer may not flush. Data written in the last session could be lost.
- **electron-store v9+ with CJS main process:** ESM-only package causes `require()` to fail. Pin to `8.2.0`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes for settings | Custom write-temp-then-rename | electron-store (backed by conf with write-file-atomic) | Handles race conditions, partial writes, and file locking correctly |
| Native module rebuild | Custom node-gyp invocation | `@electron/rebuild` via `"postinstall": "electron-rebuild"` | Handles Electron ABI, platform targets, and ARM/x64 cross-compile |
| ASAR extraction for native binaries | Custom unpack script | `asarUnpack` in forge.config.ts | Forge handles path remapping so `require()` finds the unpacked path automatically |
| Schema validation for settings JSON | Manual `if (typeof x !== ...)` guards | electron-store `schema` option (ajv under the hood) | Validates on read and write; throws on load if existing data is corrupt |
| TypeScript types for window.taskmate | Duplicated interface in every file | Single `global.d.ts` with `typeof taskmateAPI` | DRY; preload changes propagate to renderer automatically |
| Window close → quit prevention | Custom event queue | `event.preventDefault()` in `win.on('close')` + `app.isQuitting` flag | Standard Electron pattern; edge cases (force quit, menu bar quit) handled correctly |

**Key insight:** Every item in this list has subtle edge cases (race conditions, platform differences, ABI mismatch) that take days to debug correctly. Each existing solution has already solved them.

---

## Common Pitfalls

### Pitfall 1: White Screen on Packaged Build
**What goes wrong:** App loads perfectly in dev (`npm run dev`) but shows a blank white screen after `npm run make`. Root cause is always file path resolution: BrowserRouter generates `/tasks` which `file://` cannot resolve, OR Vite generates absolute asset paths like `/assets/index.js` that don't exist at the filesystem root.
**Why it happens:** Vite dev server serves from localhost (relative paths work). Packaged builds load from `file://` (only relative paths work).
**How to avoid:** Set `base: './'` in vite.renderer.config.ts on day one. Use HashRouter unconditionally (no environment toggle needed — HashRouter works in both dev and prod).
**Warning signs:** Works in `npm run dev`, breaks in `npm run make`. Console shows 404 for `/assets/*.js`.

### Pitfall 2: better-sqlite3 Crash in Packaged Build
**What goes wrong:** App runs fine in dev. After `npm run make`, database operations crash with `Error: The module was compiled against a different Node.js version`. System Node (e.g., 22.x) != Electron's bundled Node (varies per Electron version).
**Why it happens:** better-sqlite3 is a native addon. It must be compiled against the exact Node ABI version that Electron embeds.
**How to avoid:** Add `"postinstall": "electron-rebuild"` to package.json scripts. Add `rebuildConfig: { onlyModules: ['better-sqlite3'] }` in forge.config.ts. Add `asarUnpack: ['**/*.node']` to packagerConfig.
**Warning signs:** Works in dev, crashes immediately in packaged build with Node version mismatch error.

### Pitfall 3: electron-store v9+ ESM Import Error
**What goes wrong:** `require('electron-store')` fails with `Error [ERR_REQUIRE_ESM]: require() of ES Module node_modules/electron-store/index.js not supported`.
**Why it happens:** electron-store v9+ is ESM-only. The Forge Vite template uses CJS for the main process by default.
**How to avoid:** `npm install electron-store@8.2.0` — pin exactly. Do not `npm update` without checking.
**Warning signs:** Error message explicitly mentions `ERR_REQUIRE_ESM`.

### Pitfall 4: IPC Listener Memory Leak
**What goes wrong:** After 50+ renders of a component that registers `window.taskmate.onReflectionPrompt(cb)`, there are 50 duplicate handlers. One trigger causes 50 callbacks to fire.
**Why it happens:** `ipcRenderer.on()` registers a new listener on every call. React effects run on every mount/update unless the dependency array is managed correctly.
**How to avoid:** The `onReflectionPrompt` exposed via contextBridge returns a cleanup function (see preload pattern above). Call it in the `useEffect` return.
**Warning signs:** Events fire multiple times; memory usage grows with app usage.

### Pitfall 5: Preload Path Fails Silently in Packaged Build
**What goes wrong:** `window.taskmate` is `undefined` in the renderer. All IPC calls throw `TypeError: Cannot read properties of undefined`.
**Why it happens:** The preload path in BrowserWindow options is relative to `__dirname`. In dev, the dist structure is flat. In packaged builds, it changes. The BrowserWindow silently ignores an invalid preload path — no error is thrown.
**How to avoid:** Use the Forge-injected constants: `MAIN_WINDOW_VITE_NAME` and `MAIN_WINDOW_VITE_DEV_SERVER_URL` to construct paths. Test with a packaged build (not just dev) before calling Phase 1 done. Add a health check: `if (!window.taskmate) throw new Error('Preload failed to load')` in App.tsx.
**Warning signs:** `window.taskmate` is undefined only in packaged builds.

### Pitfall 6: app.dock.hide() + app.hide() Conflict on macOS
**What goes wrong:** Calling both `app.dock.hide()` and `app.hide()` on macOS causes the window to become permanently inaccessible — it cannot be shown again from the tray.
**Why it happens:** Documented Electron macOS bug (GitHub issue #16093). The two hide mechanisms conflict.
**How to avoid:** Call only `win.hide()` to hide the window. Call only `app.dock.hide()` to hide the dock icon. Never call `app.hide()` in a tray-based app.
**Warning signs:** App disappears to tray but clicking tray icon does nothing; window never reappears.

### Pitfall 7: Login Item Reporting Stale Status on Windows
**What goes wrong:** `app.getLoginItemSettings().openAtLogin` returns `true` even after the user disabled startup in Windows Task Manager.
**Why it happens:** Windows uses two separate registry keys — `Run` (set by `setLoginItemSettings`) and `StartupApproved\Run` (set by Task Manager). Electron only reads the `Run` key.
**How to avoid:** Do not rely on `getLoginItemSettings().openAtLogin` to determine actual startup state on Windows. Use it only for setting the value programmatically. Treat the electron-store setting as the source of truth for your own toggle UI.
**Warning signs:** UI shows "Start on login: ON" but Windows Task Manager shows it disabled.

---

## Code Examples

### electron-rebuild postinstall in package.json
```json
{
  "scripts": {
    "start": "electron-forge start",
    "package": "electron-forge package",
    "make": "electron-forge make",
    "publish": "electron-forge publish",
    "lint": "eslint --ext .ts,.tsx .",
    "postinstall": "electron-rebuild"
  }
}
```

### DataService backup on startup
```typescript
// src/main/data-service.ts — add to constructor, before initSchema
private createBackup(): void {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'taskmate.db');
  const backupPath = path.join(userDataPath, 'taskmate.db.backup');
  try {
    if (fs.existsSync(dbPath)) {
      // better-sqlite3 native backup API — safe even while DB is open
      this.db.backup(backupPath);
    }
  } catch (err) {
    console.error('Backup failed (non-fatal):', err);
  }
}
```

### tray icon asset path — dev vs packaged
```typescript
// Works in both dev and packaged because Forge maps resourcesPath
const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'assets', 'tray-icon.png')
  : path.join(app.getAppPath(), 'src', 'assets', 'tray-icon.png');
```

### IPC handler registration pattern
```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import type { DataService } from './data-service';

export function registerIpcHandlers(dataService: DataService): void {
  // Phase 1: stubs that return empty data — implemented in Phase 2+
  ipcMain.handle('tasks:getAll', () => []);
  ipcMain.handle('tasks:create', (_event, task) => ({ id: 'stub', ...task }));
  ipcMain.handle('tasks:update', (_event, id, _updates) => ({ id }));
  ipcMain.handle('tasks:delete', (_event, _id) => true);
  ipcMain.handle('tasks:complete', (_event, _id) => true);
  ipcMain.handle('reflections:get', (_event, _date) => null);
  ipcMain.handle('reflections:save', (_event, _date, _answers) => true);
  ipcMain.handle('settings:get', () => settingsStore.store);
  ipcMain.handle('settings:update', (_event, updates) => {
    Object.entries(updates).forEach(([k, v]) => settingsStore.set(k as any, v));
    return true;
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `remote` module for renderer→main | `contextBridge` + `ipcRenderer.invoke` | Deprecated Electron 12, removed Electron 14 | No alternative exists; contextBridge is mandatory |
| `node-notifier` for notifications | Electron's built-in `Notification` API | ~Electron 5-7 matured | Zero dependencies, native appearance |
| `electron-builder` as only option | `electron-forge` (Vite template) | Forge v7 (2023) | Official support, HMR, native rebuild built-in |
| BrowserRouter in packaged apps | HashRouter | Always been wrong; widely documented only recently | Prevents blank screen on first launch |
| `electron-store` for all data | `electron-store` for settings only + `better-sqlite3` for tasks/reflections | Project decision | Enables SQL queries, transactions, better crash resilience |
| `openAsHidden` for hidden login item | Check `wasOpenedAtLogin` on startup | macOS 13 (deprecated the property) | Must use startup check pattern instead |

**Deprecated/outdated:**
- `openAsHidden` in `setLoginItemSettings`: Deprecated macOS 13+, does nothing. Use `wasOpenedAtLogin` check instead.
- `@electron/remote`: Removed Electron 14. Never reinstall for new apps.
- `node-notifier`: Legacy. Electron's built-in `Notification` is the replacement.
- `electron-store` v9+: ESM-only. Pin to v8.2.0 for CJS main process.

---

## Open Questions

1. **electron-store atomic write confirmation**
   - What we know: `conf` (electron-store's dependency) claims atomic writes via `write-file-atomic`; behavior confirmed as of conf 10+
   - What's unclear: Whether v8.2.0 of electron-store uses a version of conf that has this enabled by default
   - Recommendation: In Phase 1 implementation, verify by checking `node_modules/electron-store/node_modules/conf/package.json` (if present) or `node_modules/conf/package.json` for version. If conf >= 10.x, atomic writes are on. Add the daily backup regardless as a belt-and-suspenders measure.

2. **Tray icon format per platform**
   - What we know: Tray icons on macOS should be a template image (black + alpha only, 22x22) for proper dark/light mode rendering; Windows uses 16x16 ICO or PNG
   - What's unclear: Whether `nativeImage.createFromPath` with a PNG auto-adapts to template-image behavior on macOS, or whether `nativeImage.createFromPath(path, { scaleFactor: 2 })` is required for Retina
   - Recommendation: Provide both a 16x16 and a 22x22 PNG. On macOS, call `.setTemplateImage(true)` on the created nativeImage for proper system integration.

3. **Electron version to target**
   - What we know: Latest stable is 35.x (as of March 2026); `better-sqlite3@12.8.0` supports up to Electron 41 per its build matrix
   - What's unclear: Whether the latest stable Electron version has any known regressions with the Forge Vite template
   - Recommendation: Use `npm create electron-app@latest` which scaffolds with the latest compatible Electron. Do not manually pin Electron unless a specific regression is hit.

---

## Validation Architecture

> `nyquist_validation: true` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | No test framework yet — this is a greenfield scaffold |
| Config file | None — Wave 0 must create `vitest.config.ts` (for renderer) and decide main process test strategy |
| Quick run command | `npx vitest run` (after Wave 0 setup) |
| Full suite command | `npx vitest run --reporter=verbose` |

**Note on testing Electron main process code:** Electron main process code (DataService, IPC handlers, tray) cannot be unit tested with Vitest alone — it requires a real Electron context. The standard approach is:
1. Pure logic (DataService SQL methods, settings validation) — testable with vitest + mocked `better-sqlite3` or an in-memory SQLite.
2. Integration (IPC bridge, tray behavior, packaged build) — smoke-tested manually or with Playwright's Electron support.

For Phase 1, the acceptance criteria are primarily manual smoke tests on the packaged build. Unit tests for DataService pure methods can be automated.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FOUND-01 | App launches with contextIsolation, preload loads, `window.taskmate` is defined | Manual smoke (packaged) | N/A — requires Electron runtime | ❌ Wave 0 |
| FOUND-01 | DataService initializes schema (tables exist after first run) | Unit | `npx vitest run src/main/data-service.test.ts` | ❌ Wave 0 |
| FOUND-02 | Window close hides to tray, main process stays alive | Manual smoke | N/A | ❌ Wave 0 |
| FOUND-03 | Login item registered — verify via system settings | Manual smoke | N/A | ❌ Wave 0 |
| FOUND-04 | Data written to DB survives app restart | Manual smoke | N/A | ❌ Wave 0 |
| FOUND-04 | Settings written to electron-store survive restart | Manual smoke | N/A | ❌ Wave 0 |
| FOUND-05 | CSP blocks external network requests | Manual (network tab in devtools) | N/A | ❌ Wave 0 |
| FOUND-06 | UI renders within 200ms (no jank on window open) | Manual timing (devtools) | N/A | ❌ Wave 0 |

### Automated Acceptance Checks (run in terminal, not a test runner)

These shell commands validate Phase 1 completion without a full test framework:

```bash
# 1. App builds without error
npm run make 2>&1 | tail -5
# Expected: "✓ Making for target: zip / squirrel" (no errors)

# 2. Packaged app contains unpacked native modules
ls out/*/resources/app.asar.unpacked/node_modules/better-sqlite3/
# Expected: directory exists with build/ subfolder

# 3. Package.json postinstall triggers rebuild
cat package.json | grep postinstall
# Expected: "postinstall": "electron-rebuild"

# 4. electron-store is pinned at v8
cat node_modules/electron-store/package.json | grep '"version"'
# Expected: "version": "8.2.0"

# 5. Vite renderer config has base './'
grep "base" vite.renderer.config.ts
# Expected: base: './'

# 6. HashRouter used (not BrowserRouter)
grep -r "HashRouter" src/renderer/
# Expected: at least one match in main.tsx
```

### Sampling Rate

- **Per task commit:** Run shell acceptance checks (items 1-6 above) manually
- **Per wave merge:** Run `npm run make` and smoke-test the packaged binary — open it, verify window appears, verify tray icon appears, verify window hides on close and reappears from tray
- **Phase gate:** All manual smoke tests green before moving to Phase 2

### Wave 0 Gaps

- [ ] `src/main/data-service.test.ts` — unit tests for DataService schema creation and CRUD stubs using in-memory SQLite (`:memory:` database path)
- [ ] `vitest.config.ts` — configure Vitest for renderer/main pure-logic tests (exclude Electron-native code from unit test scope)
- [ ] `src/assets/tray-icon.png` — 22x22 template-image PNG (macOS) and 16x16 PNG (Windows); must exist before tray initialization

---

## Sources

### Primary (HIGH confidence)

- [Electron Forge Vite + TypeScript template](https://www.electronforge.io/templates/vite-+-typescript) — scaffold command, template structure, experimental status note
- [Electron Forge Vite Plugin docs](https://www.electronforge.io/config/plugins/vite) — forge.config.ts structure, build/renderer entries, external module guidance
- [Electron Context Isolation docs](https://www.electronjs.org/docs/latest/tutorial/context-isolation) — contextBridge exposeInMainWorld, TypeScript global.d.ts pattern (IElectronAPI / Window augmentation)
- [Electron app API docs](https://www.electronjs.org/docs/latest/api/app) — setLoginItemSettings full parameter list, platform differences, macOS 13+ type parameter, Windows enabled/name parameters
- [Electron Security docs](https://www.electronjs.org/docs/latest/tutorial/security) — CSP meta tag approach, nodeIntegration/contextIsolation baseline
- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) — version 12.8.0 confirmed current
- [electron-store GitHub](https://github.com/sindresorhus/electron-store) — schema validation API (ajv JSON Schema), migrations option, ESM-only from v9+
- Project research files: STACK.md, ARCHITECTURE.md, PITFALLS.md, SUMMARY.md — all HIGH confidence, heavily inform patterns above

### Secondary (MEDIUM confidence)

- [Electron Forge React + TypeScript guide](https://www.electronforge.io/guides/framework-integration/react-with-typescript) — React install steps (webpack-based, adapted for Vite)
- [Integrating SQLite with Electron Forge](https://blog.loarsaw.de/using-sqlite-with-electron-electron-forge) — asarUnpack pattern, rebuildConfig structure (MEDIUM: third-party blog, consistent with official docs)
- [electron-store alternatives (Astrolytics)](https://www.astrolytics.io/blog/electron-store-alternatives) — confirms electron-conf as CJS/ESM dual-mode alternative
- [@electron-forge/template-vite-typescript npm](https://www.npmjs.com/package/@electron-forge/template-vite-typescript) — version 7.11.1 confirmed current

### Tertiary (LOW confidence)

- Community reports of `app.dock.hide()` + `app.hide()` conflict on macOS — GitHub issue #16093 referenced in ARCHITECTURE.md; not independently verified in this session
- Windows `StartupApproved` registry key behavior causing `getLoginItemSettings()` stale results — mentioned in GitHub issue #20122; consistent with known Windows behavior

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all packages verified via `npm view`, scaffold command confirmed against official Electron Forge docs
- Architecture: HIGH — contextBridge/IPC patterns from official Electron docs; Vite config structure confirmed via Forge plugin docs; tray patterns from prior research (HIGH confidence)
- Pitfalls: HIGH — white screen (canonical community issue), native rebuild (official Electron docs), IPC leak (well-documented React+Electron pattern), electron-store ESM (confirmed from package itself)
- Login item platform differences: HIGH — directly from official Electron `app` API documentation
- CSP approach: HIGH — from official Electron security documentation

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (90 days — Electron Forge and better-sqlite3 versions may change; re-verify npm versions before starting)
