# Phase 3: Reminders and Scheduling - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a per-task reminder time field, a node-cron scheduler in the main process that fires native OS notifications at the right time, re-notification logic (10-min delay, once only, suppressed after 8:30 PM), and an in-app catch-up indicator for missed reminders. Creating, editing, and completing tasks is already done in Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Reminder time UX
- **D-01:** `<input type="time">` field added to AddTask and EditTask screens, placed below the DatePicker
- **D-02:** Reminder time field is disabled/hidden when no due date is set — reminder always anchors to due date
- **D-03:** Stored as HH:MM string (24-hour) in the tasks table as `reminder_time TEXT NULL`
- **D-04:** Optional — tasks with no `reminder_time` receive no notification

### Schema changes
- **D-05:** Add `reminder_time TEXT` column to the tasks SQLite table (migration via `ALTER TABLE ... ADD COLUMN`)
- **D-06:** Extend `CreateTaskInput` and `UpdateTaskInput` interfaces to include `reminder_time?: string | null`
- **D-07:** Extend `UpdateTaskInput` to also include `notified_at?: string | null` and `renotified?: 0 | 1` so the scheduler can persist state via DataService (not raw SQL)

### Scheduler
- **D-08:** `node-cron` job runs every minute in the main process (`* * * * *`)
- **D-09:** On each tick: query incomplete tasks where `due_date` = today, `reminder_time` is set, `notified_at` IS NULL, and current HH:MM >= `reminder_time`
- **D-10:** `powerMonitor` `resume` event re-evaluates immediately after system wake (catches reminders that fired during sleep)
- **D-11:** Scheduler is initialized after `app.whenReady()` in `index.ts`, receives `dataService` reference

### Notification content
- **D-12:** Initial notification — Title: `"TaskMate Reminder"`, Body: task title
- **D-13:** Re-notification — Title: `"TaskMate Reminder"`, Body: `"Still incomplete — {task title}"`
- **D-14:** No action buttons — avoids macOS notification entitlement complexity
- **D-15:** Clicking the notification calls `mainWindow.show()` + `mainWindow.focus()` to surface the app

### Re-notification logic
- **D-16:** Re-notification fires 10 minutes after `notified_at` if task is still incomplete and `renotified = 0`
- **D-17:** Re-notification is suppressed if current time is at or after 22:30 — wait, ROADMAP says 8:30 PM. Use `20:30` as the cutoff
- **D-18:** After re-notification fires, set `renotified = 1` — no further notifications for that task

### Notification state persistence
- **D-19:** `notified_at` (ISO timestamp) and `renotified` (0|1) are already in the tasks SQLite schema — no additional electron-store state needed
- **D-20:** On app launch, the scheduler's startup catch-up logic reads existing `notified_at` values to avoid re-firing

### Catch-up indicator
- **D-21:** Dismissible banner rendered at the top of TodayView (above the task list)
- **D-22:** Banner text: `"Missed reminders: [Task A], [Task B]"` with an × dismiss button
- **D-23:** "Missed reminder" = task where `due_date` < today AND `reminder_time` is set AND `notified_at` IS NULL (app was closed when it should have fired)
- **D-24:** Catch-up data is fetched via a new IPC channel `tasks:getMissedReminders` — returns Task[]
- **D-25:** Dismissing the banner marks those tasks as `notified_at = now()` (so they don't re-appear) via a new IPC channel `tasks:dismissMissedReminders`
- **D-26:** Banner state lives in TodayView local React state — no Zustand needed

### Claude's Discretion
- Exact CSS for the catch-up banner (consistent with existing shadcn/ui + indigo theme)
- Whether to use `Notification` class directly or wrap it in a helper module
- Error handling for macOS notification permission denial

</decisions>

<specifics>
## Specific Ideas

- User requirement: reminder times must be customizable per-task (not a global setting)
- Re-notification cutoff is 8:30 PM (20:30) per ROADMAP success criteria

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and REQUIREMENTS.md.

### Requirements
- `.planning/REQUIREMENTS.md` §Reminders — REMIND-01 through REMIND-05 (all must be satisfied)

### Existing code (must read before planning/implementing)
- `src/main/data-service.ts` — Task schema (notified_at, renotified already present; reminder_time to be added), DataService methods to extend
- `src/main/ipc-handlers.ts` — Where new IPC channels (tasks:getMissedReminders, tasks:dismissMissedReminders) will be registered
- `src/main/index.ts` — Where scheduler is initialized in app.whenReady()
- `src/main/settings-store.ts` — electron-store schema (no new fields needed for this phase)
- `src/preload/preload.ts` — contextBridge API (new IPC channels must be exposed here)
- `src/renderer/screens/TodayView.tsx` — Where catch-up banner will be added
- `src/renderer/screens/AddTask.tsx` — Where reminder_time field is added
- `src/renderer/screens/EditTask.tsx` — Where reminder_time field is added
- `src/renderer/components/DatePicker.tsx` — Pattern to follow for the time input (safe date handling)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DatePicker.tsx`: Popover+Calendar pattern — time input should follow same UX convention (label, clear button)
- `useTaskStore.ts`: `updateTask` action already exists — extend `UpdateTaskInput` type, no new store actions needed
- `settingsStore`: Has `timezone` field already populated — can be passed to scheduler for timezone-aware comparisons if needed

### Established Patterns
- IPC handlers: `ipcMain.handle` pattern in `ipc-handlers.ts`, registered via `registerIpcHandlers(dataService)`
- Preload: every IPC channel used by renderer must be exposed via `contextBridge` in `preload.ts`
- State persistence: task notification state uses SQLite (not electron-store) — consistent with existing approach
- Main process lifecycle: `dataService` is module-level in `index.ts`, passed to handlers at startup

### Integration Points
- Scheduler attaches to `app.whenReady()` block in `index.ts` — after `registerIpcHandlers`
- `powerMonitor` is imported from `electron` — no additional packages needed
- `mainWindow` reference is already module-level in `index.ts` — available for notification click handler

</code_context>

<deferred>
## Deferred Ideas

- Configurable re-notification count (beyond "once") — v2
- Notification sound customization — v2
- Global reminder time default in Settings — v2 (REMIND-01 requires per-task customization, that's sufficient for v1)
- Snooze action button in notification — v2

</deferred>

---

*Phase: 03-reminders-and-scheduling*
*Context gathered: 2026-03-22*
