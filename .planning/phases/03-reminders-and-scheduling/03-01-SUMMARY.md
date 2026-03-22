---
phase: 03-reminders-and-scheduling
plan: 01
subsystem: database
tags: [vitest, sqlite, better-sqlite3, ipc, electron, zustand, tdd]

# Dependency graph
requires:
  - phase: 02-task-management
    provides: DataService, IPC pattern, preload API, Zustand store structure
provides:
  - vitest configured with node environment and test scripts
  - reminder_time TEXT column on tasks table (safe ALTER TABLE migration)
  - DataService.getMissedReminders() — overdue tasks needing catch-up notification
  - DataService.dismissMissedReminders(ids) — bulk notified_at setter via transaction
  - DataService.getTasksDueForReminder(date, HH:MM) — scheduler query
  - DataService.getTasksDueForRenotification(date, cutoff) — re-notify query
  - UpdateTaskInput extended with reminder_time, notified_at, renotified
  - IPC channels tasks:getMissedReminders and tasks:dismissMissedReminders
  - Preload API getMissedReminders and dismissMissedReminders
  - Zustand Task interface with reminder_time
affects:
  - 03-02-scheduler (uses getTasksDueForReminder, getTasksDueForRenotification)
  - 03-03-catchup-ui (uses getMissedReminders, dismissMissedReminders via preload)

# Tech tracking
tech-stack:
  added: [vitest 4.1.0]
  patterns:
    - vi.mock('electron') with mutable tmpDir for SQLite isolation in tests
    - Safe ALTER TABLE migration pattern using pragma table_info before adding column
    - better-sqlite3 transaction for bulk updates in dismissMissedReminders
    - fs.copyFileSync for synchronous backup (avoid async db.backup() in test environments)

key-files:
  created:
    - vitest.config.ts
    - src/__tests__/data-service.test.ts
    - src/__tests__/reminder-scheduler.test.ts
  modified:
    - package.json
    - src/main/data-service.ts
    - src/main/ipc-handlers.ts
    - src/preload/preload.ts
    - src/renderer/stores/useTaskStore.ts

key-decisions:
  - "Use fs.copyFileSync for DB backup instead of async db.backup() — avoids unhandled rejection when DB closes during test teardown"
  - "reminder_time migration runs outside transaction via pragma table_info check — ALTER TABLE cannot run inside a transaction in SQLite"
  - "getTasksDueForRenotification cutoffTime parameter compared as string — HH:MM lexicographic ordering is safe for time comparisons"

patterns-established:
  - "SQLite test isolation: vi.mock electron with mutable tmpDir, create new DataService per test, close + rmSync in afterEach"
  - "Safe schema migration: check pragma table_info before ALTER TABLE to allow idempotent runs"

requirements-completed: [REMIND-01, REMIND-04, REMIND-05]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 3 Plan 01: Reminders Data Foundation Summary

**vitest configured with SQLite test isolation, tasks schema extended with reminder_time via safe migration, and DataService given 4 new query methods wired through IPC and preload**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T07:26:18Z
- **Completed:** 2026-03-22T07:29:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Installed vitest and created vitest.config.ts with node environment; 5 data-service tests pass and 4 scheduler stubs await plan 02
- Migrated tasks table with reminder_time TEXT column via idempotent ALTER TABLE migration guarded by pragma table_info
- Extended DataService with getMissedReminders, dismissMissedReminders, getTasksDueForReminder, and getTasksDueForRenotification
- Wired two new IPC channels and preload methods; updated Zustand Task interface

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Install vitest, create config, write test stubs** - `15c6331` (test)
2. **Task 2 (GREEN): Migrate schema, extend DataService, wire IPC + preload + Zustand** - `2417012` (feat)

_Note: TDD tasks have two commits — test (RED) then feat (GREEN)_

## Files Created/Modified

- `vitest.config.ts` — Vitest config with node environment and @/ alias
- `src/__tests__/data-service.test.ts` — 5 passing tests for reminder_time, getMissedReminders, dismissMissedReminders
- `src/__tests__/reminder-scheduler.test.ts` — 4 todo stubs for plan 02 scheduler tests
- `package.json` — Added vitest devDependency and test script
- `src/main/data-service.ts` — Extended interfaces, migration, 4 new query methods, backup fix
- `src/main/ipc-handlers.ts` — Two new IPC channels for missed reminders
- `src/preload/preload.ts` — Two new preload methods exposed to renderer
- `src/renderer/stores/useTaskStore.ts` — Task interface and store method signatures updated

## Decisions Made

- Used `fs.copyFileSync` for DB backup instead of async `db.backup()` — the async backup causes an unhandled rejection when the DB connection closes during test teardown. This is also safer in production as it avoids a dangling async operation on app quit.
- reminder_time migration runs outside the transaction block using `pragma table_info` check — `ALTER TABLE` cannot execute inside a SQLite transaction, so it must run after the CREATE TABLE transaction completes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed async db.backup() causing unhandled rejection in tests**
- **Found during:** Task 1 (vitest test run)
- **Issue:** `this.db.backup()` is async in better-sqlite3; when `close()` is called in afterEach, the pending async backup throws "database connection is not open" as an unhandled rejection, failing all tests
- **Fix:** Replaced `this.db.backup(backupPath)` with `fs.copyFileSync(dbPath, backupPath)` for synchronous backup
- **Files modified:** `src/main/data-service.ts`
- **Verification:** Tests run cleanly with no unhandled rejections
- **Committed in:** `15c6331` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Fix is essential for test correctness and also improves production robustness. No scope creep.

## Issues Encountered

None beyond the backup bug auto-fixed above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02 (scheduler) can now import `getTasksDueForReminder` and `getTasksDueForRenotification` from DataService
- Plan 03 (catch-up UI) can use `getMissedReminders` and `dismissMissedReminders` via `window.taskmate`
- Test stubs in `reminder-scheduler.test.ts` are ready to be filled in during plan 02
- No blockers

---
*Phase: 03-reminders-and-scheduling*
*Completed: 2026-03-22*
