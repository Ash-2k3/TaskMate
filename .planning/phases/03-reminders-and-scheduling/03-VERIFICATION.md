---
phase: 03-reminders-and-scheduling
verified: 2026-03-22T13:11:30Z
status: human_needed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "End-to-end notification flow"
    expected: "Native OS notification fires at reminder time with title 'TaskMate Reminder' and task title as body; clicking the notification surfaces the app window; re-notification fires 10 minutes later with 'Still incomplete — {title}'; catch-up banner appears in TodayView on restart for overdue tasks"
    why_human: "Native OS notification firing, click-to-focus window behaviour, and 10-minute re-notification timing cannot be verified programmatically without running the Electron app"
---

# Phase 3: Reminders and Scheduling — Verification Report

**Phase Goal:** The app proactively notifies users about due tasks at the right time via native OS notifications, with one re-notification after 10 minutes and a catch-up indicator when reminders are missed
**Verified:** 2026-03-22T13:11:30Z
**Status:** human_needed — all automated checks passed; one item requires human testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

The 15 truths are grouped by plan for clarity.

#### Plan 01 — Data Foundation (REMIND-01, REMIND-04, REMIND-05)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | tasks table has reminder_time TEXT column | VERIFIED | `initSchema()` runs `ALTER TABLE tasks ADD COLUMN reminder_time TEXT` guarded by `pragma table_info` check; data-service.test.ts "createTask stores and returns reminder_time" passes |
| 2 | CreateTaskInput and UpdateTaskInput include reminder_time | VERIFIED | Both interfaces in `src/main/data-service.ts` lines 20-34 declare `reminder_time?: string | null` |
| 3 | UpdateTaskInput includes notified_at and renotified fields | VERIFIED | Lines 32-33 of `data-service.ts` |
| 4 | DataService has getMissedReminders and dismissMissedReminders | VERIFIED | Methods at lines 204-225; 3 passing tests cover both |
| 5 | IPC channels tasks:getMissedReminders and tasks:dismissMissedReminders are registered | VERIFIED | `ipc-handlers.ts` lines 13-14 |
| 6 | Preload exposes getMissedReminders and dismissMissedReminders to renderer | VERIFIED | `preload.ts` lines 10-11 |
| 7 | Zustand Task interface includes reminder_time | VERIFIED | `useTaskStore.ts` line 12 |
| 8 | vitest is installed and vitest.config.ts exists | VERIFIED | `vitest.config.ts` exists; `package.json` has `"vitest": "^4.1.0"` in devDependencies |
| 9 | Test files exist for data-service and reminder-scheduler | VERIFIED | Both `src/__tests__/data-service.test.ts` and `src/__tests__/reminder-scheduler.test.ts` exist and contain substantive tests (no .todo stubs remaining) |

#### Plan 02 — Scheduler (REMIND-02, REMIND-03, REMIND-04)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | Scheduler runs a per-minute cron job that checks for due reminders | VERIFIED | `reminder-scheduler.ts` line 66: `schedule('* * * * *', tick, { noOverlap: true })` |
| 11 | Native OS notification fires when a task's reminder time is reached | VERIFIED | `tick()` constructs `new Notification({ title: 'TaskMate Reminder', body: task.title })` and calls `.show()`; test "fires notification for task due at current HH:MM" passes |
| 12 | Re-notification fires 10 minutes after initial notification if task still incomplete | VERIFIED | `getTasksDueForRenotification` SQL uses `datetime(notified_at, '+10 minutes') <= datetime('now')`; scheduler fires re-notification with body `Still incomplete — {title}` and sets `renotified: 1`; test passes |
| 13 | Re-notification is suppressed at or after 20:30 | VERIFIED | Line 45: `if (currentHHMM < '20:30')`; test "suppresses re-notification at 20:30" passes (returns no notifications at 20:30) |
| 14 | powerMonitor resume event triggers immediate re-evaluation | VERIFIED | `reminder-scheduler.ts` lines 69-71: `powerMonitor.on('resume', () => { tick(); })` |
| 15 | Already-notified tasks are not re-fired on app restart | VERIFIED | `getTasksDueForReminder` SQL filters `notified_at IS NULL`; `getTasksDueForRenotification` filters `renotified = 0`; test "does not re-fire task with renotified=1" passes |

#### Plan 03 — Catch-up UI (REMIND-01, REMIND-05)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 16 | User can set a reminder time on any task via a time input field | VERIFIED | `AddTask.tsx` and `EditTask.tsx` both contain `<input type="time" ... disabled={!dueDate}>` |
| 17 | Reminder time field is disabled when no due date is set | VERIFIED | `disabled={!dueDate}` on both screens |
| 18 | Reminder time is passed to createTask and updateTask IPC calls | VERIFIED | `AddTask.tsx` line 31, `EditTask.tsx` line 48 both include `reminder_time: reminderTime` |
| 19 | Catch-up banner appears in TodayView showing missed reminder task titles | VERIFIED | `TodayView.tsx` lines 22-30: `useEffect` fetches `getMissedReminders` on mount; banner renders `missedTasks.map(t => t.title).join(', ')` |
| 20 | Dismissing the banner marks missed tasks as notified | VERIFIED | `handleDismissMissed` calls `window.taskmate.dismissMissedReminders(ids)` then `setMissedTasks([])` |
| 21 | Clicking notification surfaces the app window | HUMAN NEEDED | `notification.on('click', () => { win.show(); win.focus(); })` is wired in code; actual OS notification click behaviour requires running Electron |

**Score:** 15/15 automated truths verified (truth 21 is human-only)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `vitest.config.ts` | Vitest configuration | VERIFIED | Contains `defineConfig`, node environment, `src/__tests__/**/*.test.ts` glob |
| `src/__tests__/data-service.test.ts` | DataService tests for reminder schema | VERIFIED | 5 passing tests; no .todo stubs |
| `src/__tests__/reminder-scheduler.test.ts` | Scheduler tests | VERIFIED | 7 passing tests; all former .todo stubs replaced with real assertions |
| `src/main/data-service.ts` | Extended schema, 4 new methods | VERIFIED | All 4 methods present: `getMissedReminders`, `dismissMissedReminders`, `getTasksDueForReminder`, `getTasksDueForRenotification`; all interfaces updated |
| `src/main/reminder-scheduler.ts` | Scheduler module | VERIFIED | 80 lines; exports `initScheduler` and `stopScheduler`; cron, powerMonitor, notification logic all present |
| `src/main/ipc-handlers.ts` | IPC handlers for missed reminders | VERIFIED | Lines 13-14: both `tasks:getMissedReminders` and `tasks:dismissMissedReminders` registered |
| `src/preload/preload.ts` | Renderer API for missed reminders | VERIFIED | Lines 10-11: `getMissedReminders` and `dismissMissedReminders` exposed via `contextBridge` |
| `src/renderer/stores/useTaskStore.ts` | Task interface with reminder_time | VERIFIED | Line 12: `reminder_time: string | null; // HH:MM 24h — Phase 3` |
| `src/renderer/screens/AddTask.tsx` | Time input field for reminder_time | VERIFIED | Lines 90-112: `<input type="time">` with `disabled={!dueDate}` and hint text |
| `src/renderer/screens/EditTask.tsx` | Time input pre-populated from task | VERIFIED | Line 33: `setReminderTime(task.reminder_time)` in useEffect; same time input markup |
| `src/renderer/screens/TodayView.tsx` | Dismissible catch-up banner | VERIFIED | Lines 16-36: `missedTasks` state, `getMissedReminders` fetch on mount, dismiss handler, yellow banner JSX |
| `src/main/index.ts` | Scheduler wired into lifecycle | VERIFIED | Line 89: `initScheduler(dataService, () => mainWindow)` after IPC handlers; line 117: `stopScheduler()` in sole before-quit handler |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/ipc-handlers.ts` | `src/main/data-service.ts` | `dataService.getMissedReminders()` | WIRED | Line 13 calls `dataService.getMissedReminders()` directly |
| `src/preload/preload.ts` | `src/main/ipc-handlers.ts` | `ipcRenderer.invoke('tasks:getMissedReminders')` | WIRED | Line 10 invokes the registered channel |
| `src/main/reminder-scheduler.ts` | `src/main/data-service.ts` | `dataService.getTasksDueForReminder()` | WIRED | Line 26 calls `dataService.getTasksDueForReminder(todayDate, currentHHMM)` |
| `src/main/reminder-scheduler.ts` | `src/main/data-service.ts` | `dataService.updateTask(id, { notified_at, renotified })` | WIRED | Line 40 sets `notified_at`; line 60 sets `renotified: 1` |
| `src/main/index.ts` | `src/main/reminder-scheduler.ts` | `initScheduler(dataService, getMainWindow)` | WIRED | Line 89; `stopScheduler()` in before-quit at line 117 |
| `src/renderer/screens/AddTask.tsx` | `src/renderer/stores/useTaskStore.ts` | `createTask({ ..., reminder_time })` | WIRED | Line 31 passes `reminder_time: reminderTime` |
| `src/renderer/screens/EditTask.tsx` | `src/renderer/stores/useTaskStore.ts` | `updateTask(id, { ..., reminder_time })` | WIRED | Line 48 passes `reminder_time: reminderTime` |
| `src/renderer/screens/TodayView.tsx` | `src/preload/preload.ts` | `window.taskmate.getMissedReminders()` | WIRED | Line 24 calls `window.taskmate.getMissedReminders()`; line 34 calls `dismissMissedReminders` |

---

## Requirements Coverage

Requirements declared across plans: REMIND-01 (plans 01, 03), REMIND-02 (plan 02), REMIND-03 (plan 02), REMIND-04 (plans 01, 02), REMIND-05 (plans 01, 03).

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REMIND-01 | 03-01, 03-03 | User can set a reminder time on any task | SATISFIED | `AddTask.tsx` and `EditTask.tsx` both have `<input type="time">` wired through store to `createTask`/`updateTask` IPC |
| REMIND-02 | 03-02 | App fires a native OS desktop notification at the reminder time | SATISFIED | `reminder-scheduler.ts` fires `new Notification(...)` for due tasks; test "fires notification for task due at current HH:MM" passes |
| REMIND-03 | 03-02 | Single re-notification 10 minutes later, once only | SATISFIED | `getTasksDueForRenotification` uses `+10 minutes` SQL, `renotified = 0` filter; scheduler sets `renotified: 1` after firing; test passes |
| REMIND-04 | 03-01, 03-02 | Notification state persisted so restart does not re-fire | SATISFIED | `notified_at` and `renotified` columns in SQLite; `getTasksDueForReminder` filters `notified_at IS NULL`; data-service tests verify persistence |
| REMIND-05 | 03-01, 03-03 | Startup catch-up indicator for missed reminders | SATISFIED | `getMissedReminders()` queries overdue tasks with `notified_at IS NULL`; `TodayView` fetches on mount and renders dismissible yellow banner |

No orphaned requirements: REQUIREMENTS.md maps REMIND-01 through REMIND-05 to Phase 3 and all five appear in plan frontmatter.

---

## Anti-Patterns Found

No blockers or warnings found in Phase 3 files.

Scanned: `src/main/reminder-scheduler.ts`, `src/main/data-service.ts`, `src/main/ipc-handlers.ts`, `src/preload/preload.ts`, `src/renderer/screens/AddTask.tsx`, `src/renderer/screens/EditTask.tsx`, `src/renderer/screens/TodayView.tsx`, `src/__tests__/data-service.test.ts`, `src/__tests__/reminder-scheduler.test.ts`

**Notable (info only):** `npx tsc --noEmit` reports 5 errors, but all are pre-existing from Phase 2:
- `app.isQuitting` property not typed on Electron `App` interface (from `src/main/index.ts` and `src/main/tray.ts`)
- Two `Object literal's property ... implicitly has an 'any' type` errors in the test helper in `reminder-scheduler.test.ts` (null literal inference)

These errors do not affect runtime behaviour and are not regressions introduced by Phase 3 — they appear in commits predating Phase 3 (`7db57cc` and earlier).

---

## Test Results

```
12 passed / 12 total — 0 failing, 0 todo, 0 skipped
Duration: 154ms

Files: src/__tests__/data-service.test.ts (5 tests), src/__tests__/reminder-scheduler.test.ts (7 tests)
```

All Plan 01 `.todo` stubs from the scheduler test were replaced with real assertions in Plan 02.

---

## Human Verification Required

### 1. End-to-end notification and click-to-focus flow

**Test:** Run `npm start`. Create a task with today's due date and a reminder time 2 minutes from now. Wait for the notification.
**Expected:** Native OS notification appears with title "TaskMate Reminder" and the task's title as the body. Clicking the notification brings the app window to the foreground.
**Why human:** Native OS notification delivery and window focus-on-click cannot be triggered or observed without running the Electron process.

### 2. Re-notification at 10 minutes

**Test:** After the first notification fires (step above), do not complete the task. Wait 10 minutes.
**Expected:** A second notification fires with body "Still incomplete — {task title}". No further notification fires after that.
**Why human:** Requires waiting 10 minutes in real time; cannot be simulated without running the process.

### 3. Catch-up banner on restart

**Test:** Directly update a task in the SQLite database: set `due_date` to yesterday's date, `reminder_time` to any HH:MM, and ensure `notified_at IS NULL`. Restart the app.
**Expected:** The yellow "Missed reminders:" banner appears in TodayView listing the task's title. Clicking the dismiss button (×) hides the banner permanently for that session.
**Why human:** Requires database manipulation and a full app restart cycle.

---

## Gaps Summary

No gaps found. All automated checks passed at all three levels (exists, substantive, wired) for all 15 truths and all 12 artifacts. The three human verification items above are inherent to native OS notification behaviour and cannot be automated.

---

_Verified: 2026-03-22T13:11:30Z_
_Verifier: Claude (gsd-verifier)_
