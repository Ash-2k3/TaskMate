# Phase 3: Reminders and Scheduling - Research

**Researched:** 2026-03-22
**Domain:** Electron Notification API, node-cron v4, powerMonitor, SQLite migration
**Confidence:** HIGH (core APIs), MEDIUM (macOS permission nuances)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `<input type="time">` field added to AddTask and EditTask screens, placed below the DatePicker
- **D-02:** Reminder time field is disabled/hidden when no due date is set — reminder always anchors to due date
- **D-03:** Stored as HH:MM string (24-hour) in the tasks table as `reminder_time TEXT NULL`
- **D-04:** Optional — tasks with no `reminder_time` receive no notification
- **D-05:** Add `reminder_time TEXT` column to the tasks SQLite table (migration via `ALTER TABLE ... ADD COLUMN`)
- **D-06:** Extend `CreateTaskInput` and `UpdateTaskInput` interfaces to include `reminder_time?: string | null`
- **D-07:** Extend `UpdateTaskInput` to also include `notified_at?: string | null` and `renotified?: 0 | 1` so the scheduler can persist state via DataService (not raw SQL)
- **D-08:** `node-cron` job runs every minute in the main process (`* * * * *`)
- **D-09:** On each tick: query incomplete tasks where `due_date` = today, `reminder_time` is set, `notified_at` IS NULL, and current HH:MM >= `reminder_time`
- **D-10:** `powerMonitor` `resume` event re-evaluates immediately after system wake
- **D-11:** Scheduler is initialized after `app.whenReady()` in `index.ts`, receives `dataService` reference
- **D-12:** Initial notification — Title: `"TaskMate Reminder"`, Body: task title
- **D-13:** Re-notification — Title: `"TaskMate Reminder"`, Body: `"Still incomplete — {task title}"`
- **D-14:** No action buttons — avoids macOS notification entitlement complexity
- **D-15:** Clicking the notification calls `mainWindow.show()` + `mainWindow.focus()` to surface the app
- **D-16:** Re-notification fires 10 minutes after `notified_at` if task is still incomplete and `renotified = 0`
- **D-17:** Re-notification is suppressed if current time is at or after `20:30`
- **D-18:** After re-notification fires, set `renotified = 1` — no further notifications for that task
- **D-19:** `notified_at` (ISO timestamp) and `renotified` (0|1) are already in the tasks SQLite schema — no additional electron-store state needed
- **D-20:** On app launch, the scheduler's startup catch-up logic reads existing `notified_at` values to avoid re-firing
- **D-21:** Dismissible banner rendered at the top of TodayView (above the task list)
- **D-22:** Banner text: `"Missed reminders: [Task A], [Task B]"` with an × dismiss button
- **D-23:** "Missed reminder" = task where `due_date` < today AND `reminder_time` is set AND `notified_at` IS NULL
- **D-24:** Catch-up data is fetched via a new IPC channel `tasks:getMissedReminders` — returns Task[]
- **D-25:** Dismissing the banner marks those tasks as `notified_at = now()` via a new IPC channel `tasks:dismissMissedReminders`
- **D-26:** Banner state lives in TodayView local React state — no Zustand needed

### Claude's Discretion
- Exact CSS for the catch-up banner (consistent with existing shadcn/ui + indigo theme)
- Whether to use `Notification` class directly or wrap it in a helper module
- Error handling for macOS notification permission denial

### Deferred Ideas (OUT OF SCOPE)
- Configurable re-notification count (beyond "once") — v2
- Notification sound customization — v2
- Global reminder time default in Settings — v2
- Snooze action button in notification — v2
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REMIND-01 | User can set a reminder time on any task | `<input type="time">` in AddTask/EditTask; `reminder_time TEXT NULL` column via ALTER TABLE migration |
| REMIND-02 | App fires a native OS desktop notification at the reminder time | Electron `Notification` class from main process; node-cron `* * * * *` ticker |
| REMIND-03 | If task not complete by reminder time, a single re-notification fires 10 min later (once only) | Re-notification query on `renotified = 0` + 10-min elapsed check; `renotified = 1` after firing |
| REMIND-04 | Notification state persists so re-launch does not re-fire already-sent notifications | `notified_at` and `renotified` already in SQLite schema; startup catch-up reads these values |
| REMIND-05 | App checks on startup for missed reminders and shows an in-app catch-up indicator | `tasks:getMissedReminders` IPC + dismissible banner in TodayView local state |
</phase_requirements>

---

## Summary

Phase 3 adds per-task reminder scheduling to TaskMate using three pillars: a `node-cron` per-minute ticker in the Electron main process, native OS notifications via Electron's built-in `Notification` class, and `powerMonitor.on('resume')` to catch reminders that should have fired during system sleep. The SQLite schema already has `notified_at` and `renotified` columns — only `reminder_time TEXT NULL` needs to be added via a safe `ALTER TABLE` migration. The catch-up indicator for truly missed reminders (app was closed when they should have fired) is a dismissible banner in TodayView fetched through two new IPC channels.

The critical integration point is that `powerMonitor` must be accessed only inside `app.whenReady()` — importing it at module level crashes on Linux and is fragile on macOS. The scheduler module should be initialized at the tail of the `app.whenReady()` block in `index.ts`, after `registerIpcHandlers`, and receive both `dataService` and a `mainWindow` getter as arguments.

node-cron v4 (latest: 4.2.1, published 2026-03-18) ships its own TypeScript declarations — `@types/node-cron` is not needed. The v4 API changes `scheduled` and `runOnInit` options (removed) and the task returned by `schedule()` starts immediately. The safe pattern is to call `schedule()` directly and hold the returned `ScheduledTask` reference for cleanup in `before-quit`.

**Primary recommendation:** Create `src/main/reminder-scheduler.ts` as a self-contained module that owns the cron job, powerMonitor listener, and all notification firing logic. Export an `initScheduler(dataService, getMainWindow)` function called from `index.ts`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-cron | 4.2.1 | Per-minute cron job in main process | Ships its own TS types, native Node.js, no native binaries — no rebuild needed |
| electron (Notification) | 41.0.3 (already installed) | Native OS notification | Built-in Electron API, no extra package |
| electron (powerMonitor) | 41.0.3 (already installed) | System wake detection | Built-in Electron API, no extra package |
| better-sqlite3 | 12.8.0 (already installed) | SQLite migration + scheduler queries | Already in use; synchronous API is correct for main process |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/node-cron | NOT needed | — | node-cron v4 bundles `dist/cjs/node-cron.d.ts` — do not install separate types |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | cron (kelektiv) | `cron` has richer timezone support but adds more surface area; node-cron is simpler for a per-minute ticker |
| node-cron | setInterval | setInterval drifts over time and has no DST awareness; node-cron is semantically correct and produces a stoppable task |

**Installation:**
```bash
npm install node-cron
```

**Version verification:** Confirmed 4.2.1 via `npm view node-cron version` on 2026-03-22. Published 2026-03-18. No `@types/node-cron` needed — built-in declarations at `dist/cjs/node-cron.d.ts`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/main/
├── index.ts              # calls initScheduler() after registerIpcHandlers()
├── data-service.ts       # extend Task, CreateTaskInput, UpdateTaskInput; add DataService methods
├── ipc-handlers.ts       # add tasks:getMissedReminders, tasks:dismissMissedReminders handlers
├── reminder-scheduler.ts # NEW — owns cron job, powerMonitor, notification logic
└── settings-store.ts     # no changes needed

src/renderer/
├── screens/
│   ├── TodayView.tsx     # add dismissible missed-reminder banner
│   ├── AddTask.tsx       # add reminder_time time input (disabled when no due date)
│   └── EditTask.tsx      # add reminder_time time input (disabled when no due date)
└── stores/
    └── useTaskStore.ts   # extend Task type; updateTask already handles arbitrary UpdateTaskInput fields
```

### Pattern 1: Scheduler Module Initialization

**What:** A single module exports `initScheduler` which is called once from `index.ts` after `app.whenReady()`. It holds the cron task and powerMonitor listener as module-level state and exposes a `destroyScheduler` function for cleanup.

**When to use:** Any time you need a long-lived background process in Electron main.

```typescript
// src/main/reminder-scheduler.ts
import cron from 'node-cron';
import { powerMonitor, Notification } from 'electron';
import type { DataService } from './data-service';
import type { BrowserWindow } from 'electron';

let cronTask: ReturnType<typeof cron.schedule> | null = null;

export function initScheduler(
  dataService: DataService,
  getMainWindow: () => BrowserWindow | null
): void {
  // powerMonitor is safe inside app.whenReady() callback
  powerMonitor.on('resume', () => runSchedulerTick(dataService, getMainWindow));

  cronTask = cron.schedule('* * * * *', () => {
    runSchedulerTick(dataService, getMainWindow);
  });
}

export function destroyScheduler(): void {
  cronTask?.stop();
  cronTask = null;
}
```

### Pattern 2: node-cron v4 Schedule API

**What:** `cron.schedule(expression, callback, options?)` returns a `ScheduledTask` that starts immediately. Call `.stop()` to pause (reversible) or `.destroy()` to terminate (irreversible). Use `noOverlap: true` so if a tick's DB query + notification takes longer than a minute, the next tick is skipped.

**When to use:** All scheduled jobs in this project.

```typescript
// Source: node-cron v4 API (verified via npm dist-tags 2026-03-22)
import cron from 'node-cron';

const task = cron.schedule('* * * * *', callback, {
  noOverlap: true,          // skip tick if previous is still running
  timezone: 'America/New_York'  // optional; omit to use system timezone
});

// Cleanup in before-quit:
task.stop();
```

### Pattern 3: Electron Notification (Main Process)

**What:** Instantiate `Notification` from `electron`, attach click listener before calling `.show()`. The notification is fired from main process — works when the window is hidden to tray.

**When to use:** All OS notifications in this project.

```typescript
// Source: Electron official docs (electronjs.org/docs/latest/tutorial/notifications)
import { Notification } from 'electron';

function fireNotification(
  title: string,
  body: string,
  onClick: () => void
): void {
  const notif = new Notification({ title, body });
  // Attach listener BEFORE show() to avoid missing the event
  notif.once('click', () => {
    notif.removeAllListeners();  // prevent stale listener accumulation
    onClick();
  });
  notif.show();
}
```

**Click handler pattern:**
```typescript
// In reminder-scheduler.ts, the onClick passed to fireNotification:
() => {
  const win = getMainWindow();
  if (win) {
    win.show();
    win.focus();
  }
}
```

### Pattern 4: Scheduler Tick Logic

**What:** The core logic run on every cron tick and on `powerMonitor.resume`. Queries due tasks, fires initial notifications, evaluates re-notification eligibility.

```typescript
function runSchedulerTick(
  dataService: DataService,
  getMainWindow: () => BrowserWindow | null
): void {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0]; // 'YYYY-MM-DD'
  const currentHHMM = now.toTimeString().slice(0, 5); // 'HH:MM'
  const currentMinutes = toMinutes(currentHHMM);       // helper: HH*60+MM

  // --- Initial notification ---
  const dueForInitial = dataService.getTasksDueForReminder(todayStr, currentHHMM);
  for (const task of dueForInitial) {
    fireNotification('TaskMate Reminder', task.title, onClick(getMainWindow));
    dataService.updateTask(task.id, { notified_at: now.toISOString() });
  }

  // --- Re-notification ---
  const dueForRenotify = dataService.getTasksDueForRenotification();
  for (const task of dueForRenotify) {
    const notifiedAt = new Date(task.notified_at!);
    const elapsedMs = now.getTime() - notifiedAt.getTime();
    if (elapsedMs < 10 * 60 * 1000) continue;       // not yet 10 min
    if (currentMinutes >= toMinutes('20:30')) continue; // past cutoff

    fireNotification(
      'TaskMate Reminder',
      `Still incomplete — ${task.title}`,
      onClick(getMainWindow)
    );
    dataService.updateTask(task.id, { renotified: 1 });
  }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
```

### Pattern 5: SQLite Migration — ALTER TABLE ADD COLUMN

**What:** SQLite does not support `ALTER TABLE ADD COLUMN IF NOT EXISTS`. The safe idiomatic pattern for Electron apps (where the DB may or may not have the column from a previous install) is to check `PRAGMA table_info` first or wrap in try/catch.

```typescript
// In DataService.initSchema() — safe migration pattern
private initSchema(): void {
  this.db.transaction(() => {
    // Existing CREATE TABLE IF NOT EXISTS block (unchanged)...

    // Migration: add reminder_time if it doesn't exist yet
    const columns = this.db.pragma('table_info(tasks)') as { name: string }[];
    const hasReminderTime = columns.some((c) => c.name === 'reminder_time');
    if (!hasReminderTime) {
      this.db.exec(`ALTER TABLE tasks ADD COLUMN reminder_time TEXT`);
    }
  })();
}
```

**Why PRAGMA over try/catch:** PRAGMA is synchronous, returns a typed array, and avoids swallowing real errors. The try/catch approach risks hiding legitimate SQL errors.

**Constraint note:** `reminder_time TEXT NULL` has no DEFAULT required because the column is nullable. This satisfies SQLite's constraint that NOT NULL columns without defaults cannot be added to tables with existing rows.

### Pattern 6: DataService Query Methods to Add

```typescript
// Returns tasks where due_date = today, reminder_time set, notified_at IS NULL,
// and current HH:MM >= reminder_time
getTasksDueForReminder(todayStr: string, currentHHMM: string): Task[] {
  return this.db.prepare(`
    SELECT * FROM tasks
    WHERE completed = 0
      AND due_date = ?
      AND reminder_time IS NOT NULL
      AND notified_at IS NULL
      AND reminder_time <= ?
  `).all(todayStr, currentHHMM) as Task[];
}

// Returns tasks where notified_at IS NOT NULL and renotified = 0 and completed = 0
getTasksDueForRenotification(): Task[] {
  return this.db.prepare(`
    SELECT * FROM tasks
    WHERE completed = 0
      AND notified_at IS NOT NULL
      AND renotified = 0
  `).all() as Task[];
}

// Returns tasks where due_date < today, reminder_time set, notified_at IS NULL
getMissedReminders(): Task[] {
  const today = new Date().toISOString().split('T')[0];
  return this.db.prepare(`
    SELECT * FROM tasks
    WHERE completed = 0
      AND due_date < ?
      AND reminder_time IS NOT NULL
      AND notified_at IS NULL
  `).all(today) as Task[];
}

// Marks listed task IDs as notified_at = now
dismissMissedReminders(ids: string[]): void {
  const now = new Date().toISOString();
  const placeholders = ids.map(() => '?').join(', ');
  this.db.prepare(
    `UPDATE tasks SET notified_at = ? WHERE id IN (${placeholders})`
  ).run(now, ...ids);
}
```

### Pattern 7: Reminder Time Input in AddTask/EditTask

Follow the same label + control pattern as DatePicker. The field is an `<input type="time">` (no custom component needed — native HTML element styled with shadcn Input className).

```tsx
// Below the DatePicker in AddTask / EditTask
<div>
  <label className="text-xs text-muted-foreground block mb-1">
    Reminder time
  </label>
  <Input
    type="time"
    value={reminderTime ?? ''}
    onChange={(e) => setReminderTime(e.target.value || null)}
    disabled={!dueDate}
    className={!dueDate ? 'opacity-50 cursor-not-allowed' : ''}
  />
  {!dueDate && (
    <p className="text-xs text-muted-foreground mt-1">
      Set a due date first.
    </p>
  )}
</div>
```

**Important:** When dueDate is cleared, also clear reminderTime (`setDueDate(null); setReminderTime(null)`).

### Pattern 8: Catch-Up Banner in TodayView

```tsx
// TodayView.tsx — local state, no Zustand needed
const [missedTasks, setMissedTasks] = useState<Task[]>([]);

useEffect(() => {
  window.taskmate.getMissedReminders().then(setMissedTasks);
}, []);

async function handleDismissMissed() {
  await window.taskmate.dismissMissedReminders(missedTasks.map((t) => t.id));
  setMissedTasks([]);
}

// Render above the task list:
{missedTasks.length > 0 && (
  <div className="mx-6 mb-3 flex items-start justify-between rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
    <span>
      Missed reminders:{' '}
      {missedTasks.map((t) => t.title).join(', ')}
    </span>
    <button
      type="button"
      onClick={handleDismissMissed}
      className="ml-2 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200 cursor-pointer"
      aria-label="Dismiss missed reminders"
    >
      ×
    </button>
  </div>
)}
```

**Color rationale:** Amber (warning) is semantically appropriate for "missed" state. Indigo is the action color — use amber for the passive catch-up state. Consistent with shadcn/ui color palette already present.

### Pattern 9: New preload.ts API Surface

```typescript
// Add to taskmateAPI in preload.ts:
getMissedReminders: () => ipcRenderer.invoke('tasks:getMissedReminders'),
dismissMissedReminders: (ids: string[]) =>
  ipcRenderer.invoke('tasks:dismissMissedReminders', ids),
```

### Anti-Patterns to Avoid

- **Accessing powerMonitor at module load time:** Import it only inside `app.whenReady()` callback. Module-level access crashes on Linux.
- **Using `Notification` from renderer process:** The `Notification` class from `electron` is main-process only. Browser `window.Notification` exists in renderer but requires permission and does not have the same click behavior. Always fire from main.
- **Stale click listeners on Notification:** Each `new Notification()` instance is distinct. Use `.once('click', ...)` or `.removeAllListeners()` in the handler to prevent accumulation.
- **SQLite NOT NULL without DEFAULT on ALTER TABLE:** Adding `reminder_time TEXT NOT NULL` to a table with existing rows fails. The column must be nullable or have a DEFAULT. Use `TEXT` (nullable).
- **String comparison for HH:MM times:** Lexicographic comparison works correctly for `HH:MM` 24-hour strings (e.g., `'09:30' <= '14:00'` is true). This is reliable — no Date parsing needed for the reminder_time comparison.
- **Running initScheduler before app.whenReady():** The cron job will fire immediately but powerMonitor will crash. Always call after ready.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-minute tick | `setInterval(60000)` | `node-cron` | setInterval drifts with system load; cron semantics are correct and produce a stoppable handle |
| OS notifications | Custom HTML overlay in renderer | `Notification` from `electron` main | Native OS notifications persist in notification center, appear when app is hidden to tray, and work when window is not focused |
| Time string comparison | `new Date()` parsing of HH:MM | Lexicographic string compare | `'HH:MM' <= 'HH:MM'` is correct for 24-hour strings — zero-cost and no timezone confusion |
| Schema migration tracking | Custom version table | `PRAGMA table_info` check | Simpler than a migrations table for single-column additions; idempotent by construction |

**Key insight:** Notification delivery when the window is hidden to the system tray is the core value here. Only native OS notifications (via Electron main process `Notification`) survive window-hidden state. Renderer-side solutions (HTML notifications, toast libraries) do not.

---

## Runtime State Inventory

This is a greenfield phase (adding new functionality, not renaming). No runtime state migration needed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tasks` table — `notified_at` and `renotified` columns exist; `reminder_time` column missing | ALTER TABLE migration in `initSchema()` |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

---

## Common Pitfalls

### Pitfall 1: powerMonitor Accessed Before App Ready

**What goes wrong:** App crashes on Linux with "The 'powerMonitor' module can't be used before the app 'ready' event". macOS does not crash but behavior is undefined.

**Why it happens:** TypeScript `esModuleInterop: true` (the Forge Vite template default) generates `__importStar` helpers that eagerly evaluate module exports at import time — before `app.whenReady()` fires.

**How to avoid:** Access `powerMonitor` only inside the `app.whenReady().then(...)` callback. The `initScheduler` function in `reminder-scheduler.ts` receives control only after `app.whenReady()` so this is naturally safe.

**Warning signs:** App exits immediately on Linux dev build with "powerMonitor" in the stack trace.

### Pitfall 2: Notification click Events Accumulate

**What goes wrong:** After several notifications, the `click` event stops firing or fires multiple times.

**Why it happens:** Each `new Notification()` instance holds its own listener set. If a persistent reference to the notification is kept and `on('click')` is called multiple times, listeners accumulate.

**How to avoid:** Use `notif.once('click', handler)` and call `notif.removeAllListeners()` inside the handler. Never reuse a `Notification` instance — create a new one each time.

### Pitfall 3: ALTER TABLE Fails on Existing Installs

**What goes wrong:** When a user upgrades the app, `initSchema()` tries to `ALTER TABLE tasks ADD COLUMN reminder_time TEXT` — but the column already exists from a previous run of Phase 3. SQLite throws "duplicate column name: reminder_time".

**Why it happens:** SQLite does not support `IF NOT EXISTS` on `ALTER TABLE ADD COLUMN`. The `CREATE TABLE IF NOT EXISTS` pattern does not apply here.

**How to avoid:** Check `PRAGMA table_info(tasks)` before the ALTER. If the column already exists, skip. This is idempotent on every app launch.

### Pitfall 4: Reminder Fires Twice After Wake

**What goes wrong:** System sleeps at 9:55, wakes at 10:05. The `resume` event fires immediately, triggering a tick. The cron job also fires at 10:01 (or whenever node-cron next ticks). The same task receives two notifications.

**Why it happens:** `powerMonitor.on('resume')` and the cron schedule are independent event sources. Both may fire in quick succession after wake.

**How to avoid:** The query for initial notifications uses `notified_at IS NULL`. Once the first notification fires and `notified_at` is set, the second tick (whether from cron or powerMonitor) finds `notified_at IS NOT NULL` and skips. This is naturally idempotent — no additional guard needed.

### Pitfall 5: `<input type="time">` Returns Empty String, Not Null

**What goes wrong:** When a user clears the time field or submits without entering a time, `e.target.value` is `""` (empty string), not `null`. Saving `""` to SQLite instead of `NULL` breaks the scheduler query (`reminder_time IS NOT NULL` would match).

**How to avoid:** In the `onChange` handler: `setReminderTime(e.target.value || null)`. In `handleSave`: pass `reminder_time: reminderTime || null` to `createTask`/`updateTask`.

### Pitfall 6: Windows AUMID Required for Notifications

**What goes wrong:** On Windows, `new Notification().show()` silently fails (no OS notification appears) in development builds if the App User Model ID is not set.

**Why it happens:** Windows requires an AUMID tied to a Start Menu shortcut to attribute the notification to an app. Without it, notifications are orphaned and suppressed.

**How to avoid:** `app.setAppUserModelId('com.taskmate.app')` is already called in `createWindow()` in `index.ts`. This covers both the tray and notification surface. Verify this executes before any `new Notification().show()` call. The existing code already does this.

### Pitfall 7: HH:MM String Comparison — Must Use 24-Hour Zero-Padded Format

**What goes wrong:** `<input type="time">` returns values like `"09:30"` or `"14:00"`. The SQLite `reminder_time <= ?` comparison is lexicographic. This works correctly only if both values are zero-padded HH:MM. `"9:30"` (no leading zero) compares incorrectly.

**How to avoid:** Browser `<input type="time">` always returns zero-padded HH:MM in 24-hour format per the HTML spec. `new Date().toTimeString().slice(0, 5)` also produces zero-padded HH:MM. No extra sanitization needed, but document this assumption.

---

## Code Examples

Verified patterns from official sources and existing codebase analysis:

### node-cron v4 — Import and Schedule

```typescript
// Source: node-cron v4.2.1 README (github.com/node-cron/node-cron, verified 2026-03-22)
import cron from 'node-cron';

// Every minute — starts immediately
const task = cron.schedule('* * * * *', () => {
  // tick logic
}, { noOverlap: true });

// Stop (pause, reversible):
task.stop();

// Destroy (terminate, use in before-quit):
// Note: v4 task.stop() is sufficient for cleanup; destroy() is permanent
```

### Electron Notification — Main Process

```typescript
// Source: electronjs.org/docs/latest/api/notification (verified 2026-03-22)
import { Notification } from 'electron';

const notif = new Notification({
  title: 'TaskMate Reminder',
  body: 'Your task title here',
});
notif.once('click', () => {
  notif.removeAllListeners();
  // show + focus main window
});
notif.show();
```

### powerMonitor — Safe Usage Inside app.whenReady()

```typescript
// Source: electronjs.org/docs/latest/api/power-monitor (verified 2026-03-22)
// MUST be inside app.whenReady() callback, not at module load time
import { app, powerMonitor } from 'electron';

app.whenReady().then(() => {
  powerMonitor.on('resume', () => {
    // run scheduler tick
  });
});
```

### SQLite PRAGMA-based Migration

```typescript
// Source: sqlite.org/lang_altertable.html + better-sqlite3 API (verified 2026-03-22)
// Inside DataService.initSchema() transaction:
const cols = this.db.pragma('table_info(tasks)') as { name: string }[];
if (!cols.some((c) => c.name === 'reminder_time')) {
  this.db.exec(`ALTER TABLE tasks ADD COLUMN reminder_time TEXT`);
}
```

### Extending UpdateTaskInput for Scheduler State

```typescript
// Current UpdateTaskInput (data-service.ts):
export interface UpdateTaskInput {
  title?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  // ADD these for Phase 3:
  reminder_time?: string | null;
  notified_at?: string | null;
  renotified?: 0 | 1;
}

// The existing updateTask() dynamic field builder handles these automatically —
// just add the corresponding `if (updates.X !== undefined)` branches.
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| node-cron v3 with `@types/node-cron` separate package | node-cron v4 (rewritten in TS, types bundled) | May 2025 (v4.0.0) | Install only `node-cron`, no separate @types |
| v3: `scheduled: false` option to create paused task | v4: use `cron.createTask()` instead of `cron.schedule()` for initially-stopped tasks | v4.0.0 | For our use case (start immediately), `cron.schedule()` is unchanged |
| v3: `runOnInit: true` to fire immediately on creation | v4: removed — use explicit first call if needed | v4.0.0 | For per-minute scheduler this does not matter |

**Deprecated/outdated:**
- `scheduled` option in node-cron: Removed in v4 — do not use
- `runOnInit` option in node-cron: Removed in v4 — do not use
- `@types/node-cron`: For v4, the package's own declarations supersede this; installing `@types/node-cron` alongside v4 may cause type conflicts

---

## Open Questions

1. **macOS notification permission denial behavior**
   - What we know: Electron does not expose a `requestPermission()` API. macOS shows a system permission prompt on first notification for unsigned/development builds. For packaged (signed) apps, permission is typically granted on first use via the OS.
   - What's unclear: Whether the development Electron build triggers a permission prompt on macOS Sonoma (14+) on first run. The `Notification.permission` property always returns `"granted"` in Electron regardless of actual OS state (known Electron issue #11221, unfixed as of 2022).
   - Recommendation (Claude's discretion): Wrap `notif.show()` in a try/catch. Log permission failures silently — do not crash. The user can enable notifications in System Settings > Notifications if suppressed. Do not add `electron-mac-permissions` unless QA confirms the permission prompt is not appearing in packaged builds.

2. **node-cron DST behavior on Windows**
   - What we know: node-cron v4 supports a `timezone` option. Without it, the system timezone is used. `* * * * *` (every minute) has no DST sensitivity — it fires every 60 seconds regardless.
   - What's unclear: Whether the one "missing minute" during spring-forward DST transition (clocks jump from 1:59 to 3:00) causes a reminder to be silently missed.
   - Recommendation: The per-minute ticker is DST-immune for our use case. We compare current wall-clock HH:MM against stored `reminder_time`. If the clock jumps forward past a reminder time in DST transition, `powerMonitor.on('resume')` (or the next cron tick) will still evaluate `currentHHMM >= reminder_time` and fire correctly. No special handling needed.

---

## Validation Architecture

`nyquist_validation` is enabled in `.planning/config.json`.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config, no test scripts in package.json |
| Config file | None — needs creation in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` (after Wave 0 setup) |
| Full suite command | `npx vitest run` |

**Note:** The existing project has no test infrastructure. All test files listed below must be created in Wave 0 of implementation.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REMIND-01 | `reminder_time` accepted in createTask/updateTask; stored correctly | unit | `npx vitest run src/__tests__/data-service.test.ts` | Wave 0 |
| REMIND-01 | Time input renders in AddTask/EditTask, disabled when no due date | manual | Visual inspection in dev build | N/A |
| REMIND-02 | Scheduler tick queries correct tasks and fires notification | unit (mock Notification) | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | Wave 0 |
| REMIND-03 | Re-notification logic: fires at 10 min, suppressed after 20:30, renotified=1 set | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | Wave 0 |
| REMIND-04 | Startup catch-up skips tasks with notified_at set | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | Wave 0 |
| REMIND-05 | getMissedReminders returns tasks with due_date < today, reminder_time set, notified_at NULL | unit | `npx vitest run src/__tests__/data-service.test.ts` | Wave 0 |
| REMIND-05 | Catch-up banner appears in TodayView; dismiss works | manual | Visual inspection in dev build | N/A |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose` (unit tests only, < 5 seconds)
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest` and `@vitest/ui` — install: `npm install --save-dev vitest`
- [ ] `vite.config.ts` or `vitest.config.ts` — configure test environment (`node` for main process tests)
- [ ] `src/__tests__/data-service.test.ts` — covers REMIND-01, REMIND-05 (getMissedReminders, dismissMissedReminders, reminder_time in createTask/updateTask)
- [ ] `src/__tests__/reminder-scheduler.test.ts` — covers REMIND-02, REMIND-03, REMIND-04 (mock `Notification`, mock `dataService`, inject fake clock via `vi.useFakeTimers` or time parameter injection)

**Testing strategy for main-process code:** The scheduler tests should receive `dataService` and `getMainWindow` as injected parameters (already the architecture). `Notification` should be mocked via `vi.mock('electron', ...)`. Time-sensitive tests (10-min re-notification) should use dependency-injected `getNow: () => Date` rather than `new Date()` directly — this makes them testable without fake timers.

---

## Sources

### Primary (HIGH confidence)

- Electron official docs — `https://www.electronjs.org/docs/latest/api/notification` — Notification class, constructor options, click event
- Electron official docs — `https://www.electronjs.org/docs/latest/tutorial/notifications` — macOS/Windows notification tutorial, AUMID requirement
- Electron official docs — `https://www.electronjs.org/docs/latest/api/power-monitor` — powerMonitor events (resume, suspend, lock-screen), import restrictions
- npm registry — `npm view node-cron version` — confirmed 4.2.1, published 2026-03-18
- npm dist inspection — `npm pack node-cron@4.2.1 --dry-run` — confirmed bundled `dist/cjs/node-cron.d.ts` (no @types needed)
- SQLite official docs — `https://www.sqlite.org/lang_altertable.html` — ALTER TABLE constraints, no IF NOT EXISTS support
- Existing codebase — `src/main/data-service.ts`, `src/main/index.ts`, `src/main/ipc-handlers.ts`, `src/preload/preload.ts` — patterns verified by direct file read

### Secondary (MEDIUM confidence)

- node-cron GitHub README (via WebFetch) — schedule() API, `* * * * *` expression, v4 options
- node-cron v4 migration guide (via WebSearch) — breaking changes: `scheduled` and `runOnInit` removed, `createTask` vs `schedule` distinction
- Electron GitHub issue #21716 — powerMonitor import-before-ready crash confirmed, safe pattern documented

### Tertiary (LOW confidence)

- Electron GitHub issue #11221 — `Notification.permission` always returns "granted"; closed 2022, may have been partially addressed in Electron 41 but unverified
- WebSearch result — Notification click events not emitting in older Electron; issue was Electron v6/v7 specific and closed as fixed; behavior in Electron 41 presumed correct

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — node-cron version confirmed via npm registry; Electron APIs verified against official docs
- Architecture: HIGH — patterns derived from existing codebase patterns + official API docs
- Pitfalls: HIGH for database/AUMID/powerMonitor (verified); MEDIUM for macOS permission behavior (Notification.permission issue is old, may be resolved in Electron 41)
- Validation: MEDIUM — framework choice (vitest) is standard for Vite/Electron projects; test patterns are recommendations, not from an existing suite

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable APIs; node-cron minor updates possible but non-breaking for this use case)
