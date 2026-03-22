---
phase: 4
slug: daily-reflection
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run src/__tests__/data-service.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/__tests__/data-service.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | REFLECT-05 | unit | `npx vitest run src/__tests__/data-service.test.ts` | yes | pending |
| 04-01-02 | 01 | 1 | REFLECT-05 | unit | `npx vitest run src/__tests__/data-service.test.ts` | yes | pending |
| 04-01-03 | 01 | 1 | REFLECT-05 | unit (tdd) | `npx vitest run src/__tests__/data-service.test.ts` | yes | pending |
| 04-02-01 | 02 | 2 | REFLECT-02 | manual | See manual verifications | N/A | pending |
| 04-02-02 | 02 | 2 | REFLECT-03 | manual | See manual verifications | N/A | pending |
| 04-03-01 | 03 | 3 | REFLECT-01 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | yes | pending |
| 04-03-02 | 03 | 3 | REFLECT-06 | unit | `npx vitest run src/__tests__/reminder-scheduler.test.ts` | yes | pending |
| 04-03-03 | 03 | 3 | REFLECT-04 | manual | See manual verifications (checkpoint) | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vitest is configured, `src/__tests__/data-service.test.ts` and `src/__tests__/reminder-scheduler.test.ts` already exist. Plan 04-01 Task 3 adds the new `describe('Reflection methods')` block to `data-service.test.ts` covering hasReflection, saveReflection, getAllReflections, and getCompletedTaskCountToday. No new test infrastructure needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dialog renders over TodayView at 9 PM | REFLECT-01, REFLECT-02 | Electron IPC push to renderer — not unit-testable without full E2E harness | Run app, wait until 21:00 or mock the cron trigger; confirm dialog appears with 3 questions |
| Q1 pre-fills with completed task count | REFLECT-02 | Requires live renderer state and IPC round-trip | Complete a task, trigger reflection; confirm Q1 label shows "You finished N tasks today..." |
| At-least-1 validation blocks dismiss | REFLECT-03 | React component interaction — requires renderer | Open modal, click Save with no answers filled; confirm button is disabled |
| Snooze closes modal and re-triggers after 30 min | REFLECT-04 | Requires real 30-min wait or settingsStore manipulation | Set snoozeUntil to 30s in the future via settingsStore; verify re-trigger fires |
| Catch-up fires on next open after 9 PM | REFLECT-06 | Requires app restart with mocked system time | Close app, set snoozeUntil to null, reopen after 21:00; confirm modal appears immediately |
| Nav bar shows Today/Reflections tabs | (D-30) | UI rendering — manual verification | Confirm nav bar visible on / and /reflections; hidden on /add and /edit/:id |
| Reflection history expands/collapses | (D-35) | React accordion interaction | Navigate to /reflections; click date row; confirm Q1/Q2/Q3 expand |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
