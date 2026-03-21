# Architecture Research

**Project:** TaskMate (Electron + React, local-first)
**Researched:** 2026-03-21
**Confidence:** HIGH — Electron process model, IPC, and tray patterns have been stable since Electron 12+ (contextBridge mandate). Scheduling and storage patterns draw from established Node.js/Electron community practice.

---

## Process Architecture (Main vs Renderer)

### How Electron's Process Model Works

Electron runs two distinct process types with different capabilities:

**Main Process** — One instance per app lifetime. Runs in Node.js. Has full OS access: file system, native notifications, tray, window management, system timers. This is where the app's "backend" lives.

**Renderer Process** — One per BrowserWindow. Runs Chromium. Handles all UI. By default (and by security mandate since Electron 12), `nodeIntegration` is disabled, meaning renderer cannot directly call Node.js APIs. It communicates with main via IPC.

### What Belongs Where for TaskMate

| Responsibility | Process | Rationale |
|---|---|---|
| Window creation/management | Main | Only main can create BrowserWindow |
| SQLite / electron-store reads & writes | Main | File system access; Node.js only |
| Native desktop notifications (`new Notification()`) | Main | Requires Node.js Notification API |
| Task scheduling (node-cron / setInterval) | Main | Persists when window is hidden or minimized |
| System tray icon and context menu | Main | Native OS tray API |
| App lifecycle (quit, minimize-to-tray) | Main | `app` module is main-process only |
| React UI (task list, forms, reflection modal) | Renderer | DOM rendering via Chromium |
| Local state management (Zustand/Redux) | Renderer | UI-layer state only |
| Form validation, UI logic | Renderer | No OS access needed |
| Timer countdown displays | Renderer | Can use browser `setInterval` for display only |

### Critical Rule

Never put data persistence or scheduling logic in the renderer. If the window is closed or hidden (TaskMate will minimize to tray), renderer code stops running. Main process continues for the lifetime of the `app` object.

### Recommended File Structure

```
src/
  main/
    index.ts          ← app entry, BrowserWindow creation
    store.ts          ← electron-store setup, all read/write operations
    scheduler.ts      ← node-cron jobs (9 PM reflection, Sunday summary)
    notifications.ts  ← native Notification wrappers
    tray.ts           ← Tray icon setup and context menu
    ipc-handlers.ts   ← all ipcMain.handle() registrations
  preload/
    preload.ts        ← contextBridge.exposeInMainWorld()
  renderer/
    App.tsx
    components/
    hooks/
    store/            ← Zustand or Context for UI state
```

---

## IPC Patterns

### The Mandatory Pattern: contextBridge + preload

Since Electron 12, `nodeIntegration: false` is the enforced default and `contextIsolation: true` is required for security. The correct pattern is:

1. Main process registers handlers with `ipcMain.handle(channel, handler)`
2. Preload script uses `contextBridge.exposeInMainWorld()` to expose a typed API to the renderer
3. Renderer calls the exposed API — it never imports from `electron` directly

### Preload Script Pattern

```typescript
// src/preload/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('taskmate', {
  // Tasks
  getTasks: () => ipcRenderer.invoke('tasks:getAll'),
  createTask: (task: CreateTaskInput) => ipcRenderer.invoke('tasks:create', task),
  updateTask: (id: string, updates: Partial<Task>) => ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string) => ipcRenderer.invoke('tasks:delete', id),
  completeTask: (id: string) => ipcRenderer.invoke('tasks:complete', id),

  // Reflections
  getReflection: (date: string) => ipcRenderer.invoke('reflections:get', date),
  saveReflection: (date: string, answers: ReflectionAnswers) => ipcRenderer.invoke('reflections:save', date, answers),

  // Weekly Summary
  getWeeklySummary: (weekOf: string) => ipcRenderer.invoke('summary:getWeek', weekOf),
  generateWeeklySummary: (weekOf: string) => ipcRenderer.invoke('summary:generate', weekOf),

  // Events pushed from main → renderer
  onReflectionPrompt: (cb: () => void) => ipcRenderer.on('prompt:reflection', cb),
  onWeeklySummaryReady: (cb: (summary: WeeklySummary) => void) =>
    ipcRenderer.on('summary:ready', (_event, summary) => cb(summary)),
  removeListener: (channel: string, cb: (...args: any[]) => void) =>
    ipcRenderer.removeListener(channel, cb),
});
```

### Main Process Handler Registration

```typescript
// src/main/ipc-handlers.ts
import { ipcMain } from 'electron';
import { store } from './store';

export function registerIpcHandlers() {
  ipcMain.handle('tasks:getAll', () => store.getTasks());
  ipcMain.handle('tasks:create', (_event, task) => store.createTask(task));
  ipcMain.handle('tasks:update', (_event, id, updates) => store.updateTask(id, updates));
  ipcMain.handle('tasks:delete', (_event, id) => store.deleteTask(id));
  ipcMain.handle('tasks:complete', (_event, id) => store.completeTask(id));

  ipcMain.handle('reflections:get', (_event, date) => store.getReflection(date));
  ipcMain.handle('reflections:save', (_event, date, answers) => store.saveReflection(date, answers));

  ipcMain.handle('summary:getWeek', (_event, weekOf) => store.getWeeklySummary(weekOf));
  ipcMain.handle('summary:generate', (_event, weekOf) => store.generateWeeklySummary(weekOf));
}
```

### Renderer Usage (React Hook Pattern)

```typescript
// src/renderer/hooks/useTasks.ts
declare global {
  interface Window {
    taskmate: typeof import('../../preload/preload').taskmateAPI;
  }
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    window.taskmate.getTasks().then(setTasks);
  }, []);

  const complete = async (id: string) => {
    await window.taskmate.completeTask(id);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true } : t));
  };

  return { tasks, complete };
}
```

### IPC Communication Directions

| Direction | Mechanism | Use Case |
|---|---|---|
| Renderer → Main (request/response) | `ipcMain.handle` + `ipcRenderer.invoke` | CRUD operations, data queries |
| Main → Renderer (push event) | `mainWindow.webContents.send` | Scheduled triggers (9 PM reflection, notifications) |
| Renderer → Main (fire and forget) | `ipcMain.on` + `ipcRenderer.send` | Logging, analytics — not needed for TaskMate |

### Anti-Pattern: Never Do This

```typescript
// BAD — exposes entire ipcRenderer to renderer, breaks security
contextBridge.exposeInMainWorld('electron', { ipcRenderer });

// BAD — nodeIntegration: true with direct require('electron') in renderer
const { ipcRenderer } = require('electron');
```

---

## Data Models

### Storage Decision: electron-store for MVP

electron-store wraps a JSON file in the OS user data directory (`app.getPath('userData')`). It is zero-config, type-safe with generics, and appropriate for TaskMate's data volume (hundreds of tasks, weeks of reflections). SQLite becomes relevant at thousands of tasks with complex query needs — defer to v2.

### Task Model

```typescript
interface Task {
  id: string;              // crypto.randomUUID()
  title: string;           // required, 1-200 chars
  dueDate: string | null;  // ISO 8601 date string "2026-03-21", nullable
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  completedAt: string | null; // ISO 8601 datetime, set when completed
  createdAt: string;          // ISO 8601 datetime
  updatedAt: string;          // ISO 8601 datetime
  notifiedAt: string | null;  // last notification sent; tracks re-notify window
  renotified: boolean;        // true once re-notify has fired for this task
}
```

### Daily Reflection Model

```typescript
interface DailyReflection {
  date: string;          // "2026-03-21" — primary key, one per calendar day
  answers: {
    q1: string;          // "What did I accomplish today?"
    q2: string;          // "What distracted or blocked me?"
    q3: string;          // "What's my priority for tomorrow?"
  };
  completedAt: string;   // ISO 8601 datetime — when dismissed
  skippedAt: string | null; // set if user explicitly skipped (future: allow skip)
}
```

### Weekly Summary Model

```typescript
interface WeeklySummary {
  weekOf: string;               // ISO date of the Monday starting that week "2026-03-16"
  generatedAt: string;          // ISO 8601 datetime
  taskStats: {
    totalCreated: number;
    totalCompleted: number;
    totalOverdue: number;        // due date passed, not completed
    completionRate: number;      // 0–1 float
  };
  reflectionStats: {
    daysReflected: number;       // out of 7
    topDistraction: string;      // most frequent word from q2 answers (stopword-filtered)
  };
  summary: string;               // human-readable generated paragraph
}
```

### Store Schema (electron-store)

```typescript
interface StoreSchema {
  tasks: Record<string, Task>;                    // keyed by task.id
  reflections: Record<string, DailyReflection>;  // keyed by date "2026-03-21"
  weeklySummaries: Record<string, WeeklySummary>; // keyed by weekOf "2026-03-16"
  settings: {
    reflectionTime: string;    // "21:00" — default 9 PM, future: user configurable
    summaryDayOfWeek: number;  // 0=Sunday — default Sunday
    minimizeToTray: boolean;
    lastSeenReflectionDate: string | null;
    lastSeenSummaryWeek: string | null;
  };
}
```

### Key Design Decisions

- Use string keys over arrays for O(1) lookup by ID or date. Electron-store's underlying JSON handles this efficiently at MVP scale.
- Dates as ISO strings (no Date objects in store) — avoids JSON serialization edge cases.
- `notifiedAt` + `renotified` on Task enables the "re-notify once after 10 min" requirement without a separate notifications table.
- `topDistraction` is computed at summary generation time from q2 answers — no need to store tokenized text separately.

---

## Scheduling Architecture

### The Core Problem

Browser `setTimeout` and `setInterval` in the renderer process are unreliable for app-level scheduling because:
1. They stop when the window is hidden, minimized, or closed
2. Chromium throttles timers in background tabs/windows
3. The renderer may be garbage-collected if the window is destroyed

All scheduling must live in the **main process**.

### Recommended Library: node-cron

`node-cron` is a well-maintained cron scheduler for Node.js, suitable for Electron main process. It uses standard cron syntax and fires reliably regardless of window state.

```bash
npm install node-cron
npm install -D @types/node-cron
```

### Scheduler Implementation

```typescript
// src/main/scheduler.ts
import cron from 'node-cron';
import { BrowserWindow, Notification } from 'electron';
import { store } from './store';

export function initScheduler(getMainWindow: () => BrowserWindow | null) {
  // Daily reflection prompt at 9:00 PM
  cron.schedule('0 21 * * *', () => {
    const today = new Date().toISOString().slice(0, 10);
    const alreadyDone = store.hasReflection(today);

    if (!alreadyDone) {
      // Push event to renderer if window exists and is ready
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('prompt:reflection');
        win.show(); // bring window to front from tray
        win.focus();
      }

      // Also fire native notification as fallback
      new Notification({
        title: 'TaskMate — Daily Reflection',
        body: 'Time to reflect on your day. Takes 2 minutes.',
      }).show();
    }
  });

  // Weekly summary generation on Sunday at 8:00 PM
  cron.schedule('0 20 * * 0', () => {
    const weekOf = getStartOfWeek(); // returns ISO Monday date string
    const summary = store.generateWeeklySummary(weekOf);

    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send('summary:ready', summary);
      win.show();
      win.focus();
    }

    new Notification({
      title: 'TaskMate — Weekly Summary Ready',
      body: `You completed ${summary.taskStats.completionRate * 100 | 0}% of tasks this week.`,
    }).show();
  });

  // Task reminder check every minute — for due-date notifications
  cron.schedule('* * * * *', () => {
    checkAndSendTaskReminders();
  });
}
```

### Task Reminder Logic

```typescript
function checkAndSendTaskReminders() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tasks = store.getIncompleteTasks();

  for (const task of tasks) {
    if (!task.dueDate || task.dueDate !== todayStr) continue;

    const notNotifiedYet = !task.notifiedAt;
    const tenMinutesPassed = task.notifiedAt
      ? now.getTime() - new Date(task.notifiedAt).getTime() > 10 * 60 * 1000
      : false;

    if (notNotifiedYet) {
      sendTaskNotification(task);
      store.updateTask(task.id, { notifiedAt: now.toISOString() });
    } else if (tenMinutesPassed && !task.renotified) {
      sendTaskNotification(task, true); // re-notify flag in body
      store.updateTask(task.id, { renotified: true });
    }
  }
}
```

### Why Not Alternatives

| Option | Problem |
|---|---|
| `setInterval` in renderer | Stops when window hidden; Chromium throttles it |
| `setInterval` in main | Works for short intervals, but imprecise for hour/day timers — no persistence across restarts |
| OS-level task scheduler (launchd/Task Scheduler) | Complex platform-specific setup; overkill for MVP |
| `node-cron` in main | Correct — fires reliably, cron syntax is readable, handles missed fires on next tick |

### Handling App Restarts

node-cron does not persist state across restarts. If the app is not running at 9 PM, the cron job never fires. Mitigate with an **on-startup catch-up check**:

```typescript
// src/main/index.ts — run immediately after app.whenReady()
function runStartupChecks() {
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();

  // If it's past 9 PM and no reflection yet today, prompt immediately
  if (hour >= 21 && !store.hasReflection(today)) {
    mainWindow.webContents.send('prompt:reflection');
  }

  // If it's Sunday past 8 PM and no summary for this week, generate it
  const dayOfWeek = new Date().getDay();
  if (dayOfWeek === 0 && hour >= 20) {
    const weekOf = getStartOfWeek();
    if (!store.getWeeklySummary(weekOf)) {
      const summary = store.generateWeeklySummary(weekOf);
      mainWindow.webContents.send('summary:ready', summary);
    }
  }
}
```

---

## System Tray Approach

### Recommendation: Yes, Minimize to Tray

TaskMate's core requirement is that scheduling (9 PM reflection, notifications) fires even when the user is not actively using the app. The system tray pattern enables this correctly.

**Without tray:** User closes the window → `app.quit()` fires → main process dies → no more cron jobs → no 9 PM prompt.

**With tray:** User "closes" the window → window hides, main process stays alive → cron jobs continue → app reappears when needed.

### Tray Implementation

```typescript
// src/main/tray.ts
import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import path from 'path';

let tray: Tray | null = null;

export function initTray(getMainWindow: () => BrowserWindow | null) {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, '../assets/tray-icon.png') // 16x16 or 22x22
  );

  tray = new Tray(icon);
  tray.setToolTip('TaskMate');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open TaskMate',
      click: () => {
        const win = getMainWindow();
        if (win) { win.show(); win.focus(); }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click tray icon to open
  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) { win.show(); win.focus(); }
  });
}

// Prevent window close from quitting — hide to tray instead
export function setupWindowCloseHandler(win: BrowserWindow) {
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}
```

### app.isQuitting Pattern

TypeScript requires augmenting Electron's `app` object type for the custom property:

```typescript
// src/types/electron.d.ts
import { app } from 'electron';
declare module 'electron' {
  interface App {
    isQuitting?: boolean;
  }
}
```

### macOS Dock Behavior

On macOS, hiding to tray should also remove the app from the Dock while hidden:

```typescript
// When hiding window on macOS
if (process.platform === 'darwin') {
  app.dock.hide();
}

// When showing window on macOS
if (process.platform === 'darwin') {
  app.dock.show();
}
```

### Tray vs Always-Visible Window

| Approach | Pros | Cons |
|---|---|---|
| System tray | Scheduling persists, low friction to "close", matches OS convention | Slightly more setup code |
| Always-visible window | Simpler code | Annoying UX; users will force-quit, breaking scheduling |
| No tray (periodic restart) | N/A for MVP | Too complex for no benefit |

**Verdict:** Implement tray from day one. It is the only pattern that satisfies the "9 PM prompt even when not actively using the app" requirement without OS-level daemons.

---

## Recommended Architecture

### Overall Design

TaskMate is structured as a **thin renderer + fat main** Electron app. The renderer is a React SPA responsible only for display and user interaction. The main process owns all persistence, scheduling, and OS integration. They communicate exclusively through a typed contextBridge API.

```
┌─────────────────────────────────────────────────┐
│                  MAIN PROCESS                   │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ scheduler│  │  store   │  │ tray + notif │  │
│  │(node-cron│  │(electron │  │ (native OS)  │  │
│  │  jobs)   │  │  store)  │  │              │  │
│  └────┬─────┘  └────┬─────┘  └──────────────┘  │
│       │             │                           │
│       └──────┬──────┘                           │
│              │  ipcMain.handle()                │
└──────────────┼──────────────────────────────────┘
               │ IPC (contextBridge)
┌──────────────┼──────────────────────────────────┐
│              │  PRELOAD SCRIPT                  │
│   window.taskmate.* API surface                 │
└──────────────┼──────────────────────────────────┘
               │
┌──────────────┼──────────────────────────────────┐
│              │  RENDERER PROCESS (React)        │
│                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Task UI  │  │ Reflection   │  │  Weekly   │  │
│  │(list,form│  │   Modal      │  │ Summary   │  │
│  │  edit)   │  │(9 PM trigger)│  │   View    │  │
│  └──────────┘  └──────────────┘  └───────────┘  │
│                                                 │
│         Zustand (UI state only)                 │
└─────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Chosen | Rationale |
|---|---|---|
| Data persistence | electron-store (JSON) | Zero-config, typed, sufficient for MVP task/reflection volume |
| IPC | contextBridge + typed invoke/handle | Security-compliant, type-safe, Electron-recommended pattern |
| Scheduling | node-cron in main process | Fires independent of window state; cron syntax is maintainable |
| UI state | Zustand | Lightweight, no boilerplate, React-native feel |
| Tray | Yes — minimize-to-tray | Required for background scheduling to survive window close |
| Process split | Fat main / thin renderer | All persistence, scheduling, OS APIs in main; React purely for UI |

### Data Flow for Key Requirements

**9 PM Reflection Prompt:**
node-cron (main) fires → check store for today's reflection → not found → `mainWindow.webContents.send('prompt:reflection')` + show window → renderer receives event → opens ReflectionModal → user fills answers → `window.taskmate.saveReflection()` → ipcMain handler → store.saveReflection()

**Task Notification:**
node-cron (main) fires every minute → scan incomplete tasks with dueDate=today → if not notified: fire `new Notification()` → update task.notifiedAt → if 10 min elapsed and not renotified: fire second notification → set task.renotified=true

**Weekly Summary (Sunday 8 PM):**
node-cron (main) fires → `store.generateWeeklySummary()` (aggregates tasks + reflections for week) → `mainWindow.webContents.send('summary:ready', summary)` → renderer renders WeeklySummaryView

### Startup Sequence

```
app.whenReady()
  → create BrowserWindow (contextIsolation: true, nodeIntegration: false)
  → load preload.ts
  → registerIpcHandlers()
  → initTray()
  → initScheduler()
  → runStartupChecks()  ← catches missed 9 PM/Sunday events
  → mainWindow.loadURL(...)
```

### Confidence Levels

| Area | Confidence | Basis |
|---|---|---|
| Main/renderer split | HIGH | Core Electron design; stable since v1 |
| contextBridge + IPC | HIGH | Electron official pattern since v12; no alternatives exist for compliant apps |
| electron-store for MVP | HIGH | Well-established, actively maintained, correct fit for JSON-keyed data at this scale |
| node-cron in main | HIGH | Standard pattern in Electron community; no known conflicts with Electron's Node runtime |
| Tray minimize-to-tray | HIGH | `Tray` API is stable and cross-platform (macOS/Windows) |
| SQLite deferral to v2 | MEDIUM | Reasonable assumption for hundreds of records; validate if users report lag |
| topDistraction word extraction | MEDIUM | Simple frequency count + stopword filter is adequate for MVP; NLP library not needed |

### Gaps to Validate in Phase-Specific Research

- **electron-store vs better-sqlite3:** If task volume grows beyond ~5,000 records or complex cross-entity queries are needed, evaluate SQLite migration. The current JSON schema supports this migration cleanly (same data shape, different driver).
- **node-cron on Windows:** Cron timezone handling on Windows can differ from macOS. Validate that `node-cron`'s scheduled times fire at the correct wall-clock hour on Windows. Consider `node-cron`'s timezone option.
- **macOS notification permissions:** macOS 14+ requires explicit user notification permission. Electron's `Notification` API handles this, but test that the permission prompt fires at first launch rather than silently failing.
- **App signing and notarization:** For macOS distribution, the tray icon and notifications require a signed and notarized app. Plan this for the distribution phase, not MVP.
