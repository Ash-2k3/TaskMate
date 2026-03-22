---
phase: 3
slug: reminders-and-scheduling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (none installed — Wave 0 creates it) |
| **Config file** | `vitest.config.ts` — Wave 0 creates it |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | REMIND-01 | unit | `npx vitest run src/__tests__/data-service.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | REMIND-02 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | REMIND-04 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | REMIND-01 | unit | `npx vitest run src/__tests__/data-service.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | REMIND-02 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 3 | REMIND-03 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 3 | REMIND-05 | unit | `npx vitest run src/__tests__/data-service.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npm install --save-dev vitest` — install test framework
- [ ] `vitest.config.ts` — configure test environment (`node` for main process tests, jsdom for renderer)
- [ ] `src/__tests__/data-service.test.ts` — stubs for REMIND-01 (reminder_time in createTask/updateTask), REMIND-05 (getMissedReminders, dismissMissedReminders)
- [ ] `src/__tests__/reminder-scheduler.test.ts` — stubs for REMIND-02 (scheduler tick fires notification), REMIND-03 (re-notification logic, 20:30 cutoff), REMIND-04 (startup catch-up skips already-notified)

*Tests use `vi.mock('electron', ...)` for Notification + powerMonitor. Scheduler accepts injected `getNow: () => Date` for time-sensitive tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Time input renders in AddTask/EditTask, disabled when no due date | REMIND-01 | DOM interaction in Electron renderer | Launch dev build, add task with/without due date, verify time input enabled state |
| Catch-up banner appears in TodayView on startup after missed reminder | REMIND-05 | Requires OS time manipulation or real wait | Set reminder_time in past manually in DB, relaunch app, verify banner appears |
| macOS native notification appears and is clickable | REMIND-02 | OS notification system | Trigger a notification, verify it appears in Notification Center, click it, verify window surfaces |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
