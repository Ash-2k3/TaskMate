---
phase: 03-reminders-and-scheduling
plan: 02
subsystem: scheduler
tags: [node-cron, electron, notifications, powerMonitor, vitest, tdd]

# Dependency graph
requires:
  - phase: 03-reminders-and-scheduling
    plan: 01
    provides: getTasksDueForReminder, getTasksDueForRenotification, updateTask, reminder_time schema
provides:
  - reminder-scheduler.ts with initScheduler and stopScheduler exports
  - Per-minute cron job with noOverlap via node-cron v4
  - Native Electron Notification firing for due tasks
  - Re-notification logic (10-min delay, once only, suppressed at 20:30)
  - powerMonitor resume event for sleep recovery
  - getNow injection for deterministic testing
  - Scheduler wired into index.ts lifecycle (init after IPC, stop before DB close)
affects:
  - 03-03-catchup-ui (scheduler now running, state columns populated in SQLite)

# Tech tracking
tech-stack:
  added: [node-cron 4.2.1]
  patterns:
    - getNow injection via SchedulerOptions for deterministic scheduler tests
    - vi.resetModules() in beforeEach with dynamic import for isolated test instances
    - MockNotification class capturing constructor args and .on() handlers for click testing
    - noOverlap: true on node-cron to prevent tick re-entrance

key-files:
  created:
    - src/main/reminder-scheduler.ts
  modified:
    - src/__tests__/reminder-scheduler.test.ts
    - src/main/index.ts
    - package.json

key-decisions:
  - "Use UTC time (toISOString().slice(11,16)) for HH:MM extraction — consistent with ISO timestamp storage in SQLite"
  - "vi.resetModules() + dynamic import in each beforeEach allows multiple initScheduler() calls without cronTask module-state collision"
  - "noOverlap: true on node-cron prevents tick re-entrance if a tick takes longer than 1 minute"

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 3 Plan 02: Reminder Scheduler Summary

**node-cron per-minute cron job wired into Electron main process with native notification firing, re-notification at 10-min delay suppressed at 20:30, powerMonitor wake recovery, and getNow injection for deterministic tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T07:31:40Z
- **Completed:** 2026-03-22T07:34:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `reminder-scheduler.ts` with `initScheduler` (cron + powerMonitor) and `stopScheduler` exports; all 7 scheduler tests pass
- Implemented per-minute cron job (noOverlap: true), initial notification firing, re-notification with 20:30 cutoff, and powerMonitor.on('resume') for sleep recovery
- Installed node-cron v4.2.1 as runtime dependency (ships own TypeScript types, no @types needed)
- Wired `initScheduler(dataService, () => mainWindow)` after `setupWindowCloseHandler` in app.whenReady(); `stopScheduler()` added to sole before-quit handler before `dataService.close()`

## Task Commits

Each task was committed atomically (TDD: RED then GREEN for Task 1):

1. **Task 1 RED: Add failing scheduler tests** - `db68c55` (test)
2. **Task 1 GREEN: Implement reminder-scheduler.ts** - `a54d534` (feat)
3. **Task 2: Install node-cron, wire into index.ts** - `59482ba` (feat)

_Note: TDD tasks have two commits — test (RED) then feat (GREEN)_

## Files Created/Modified

- `src/main/reminder-scheduler.ts` — Scheduler module: initScheduler, stopScheduler, cron tick, notification logic, re-notification, powerMonitor resume
- `src/__tests__/reminder-scheduler.test.ts` — 7 passing tests (replaced .todo stubs from Plan 01)
- `src/main/index.ts` — Import + wire scheduler after IPC handlers; stopScheduler in before-quit
- `package.json` — Added node-cron ^4.2.1 runtime dependency

## Decisions Made

- Used `toISOString().slice(11, 16)` for HH:MM extraction (UTC) — consistent with ISO timestamps stored in SQLite; avoids timezone edge cases from `toTimeString()` which returns local time
- Used `vi.resetModules()` + dynamic `import('../main/reminder-scheduler')` in each `beforeEach` — the module has module-level `cronTask` state; resetting ensures each test gets a fresh scheduler with a fresh `mockTickFn`
- noOverlap: true on the cron schedule — prevents a slow tick from running concurrently with the next scheduled tick

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used UTC time extraction instead of toTimeString().slice(0,5)**
- **Found during:** Task 1 (GREEN — analyzing time extraction consistency)
- **Issue:** The plan's sample code used `now.toTimeString().slice(0, 5)` which returns local time (e.g., "09:00" in PST), but `notified_at` is stored as ISO timestamp (UTC). The `getTasksDueForRenotification` SQL compares `datetime(notified_at, '+10 minutes') <= datetime('now')` using UTC. Mixing local time for HH:MM with UTC for ISO timestamps creates timezone-dependent bugs.
- **Fix:** Changed to `now.toISOString().slice(11, 16)` for UTC HH:MM extraction — consistent with both DB storage and test fake dates (all in UTC)
- **Files modified:** `src/main/reminder-scheduler.ts`
- **Verification:** All 7 tests pass with UTC extraction; test fake dates are UTC ISO strings

---

**Total deviations:** 1 auto-fixed (Rule 1 — timezone consistency bug)
**Impact on plan:** Critical correctness fix — local-time extraction would cause reminders to misfire by UTC offset on any non-UTC machine.

## Issues Encountered

None beyond the timezone consistency fix above.

## User Setup Required

None — node-cron is a runtime dependency installed automatically.

## Next Phase Readiness

- Plan 03 (catch-up UI) can proceed — scheduler is running and will populate `notified_at` values in SQLite
- `getMissedReminders` and `dismissMissedReminders` IPC channels are ready from Plan 01
- No blockers

## Self-Check: PASSED

- `src/main/reminder-scheduler.ts` — FOUND
- `src/__tests__/reminder-scheduler.test.ts` — FOUND
- commit `db68c55` (test RED) — FOUND
- commit `a54d534` (feat GREEN) — FOUND
- commit `59482ba` (feat index.ts) — FOUND

---
*Phase: 03-reminders-and-scheduling*
*Completed: 2026-03-22*
