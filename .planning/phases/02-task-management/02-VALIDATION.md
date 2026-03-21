---
phase: 2
slug: task-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit) + manual smoke tests (Electron UI) |
| **Config file** | `vitest.config.ts` — already created in Phase 1 |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test -- --reporter=verbose` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test -- --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite green + manual UI smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 02-01 | 1 | TASK-01,02,03,04 | unit | `npm test -- --testPathPattern=dataservice` | ⬜ pending |
| 2-01-02 | 02-01 | 1 | TASK-01,02,03,04 | unit | `grep -c "tasks:getAll\|tasks:create\|tasks:update\|tasks:delete\|tasks:complete" src/main/ipc-handlers.ts` | ⬜ pending |
| 2-01-03 | 02-01 | 1 | TASK-01,02,03,04,05 | unit | `npm test -- --testPathPattern=useTaskStore` | ⬜ pending |
| 2-02-01 | 02-02 | 0 | TASK-05 | automated | `test -f src/renderer/index.css && grep -c "tailwind" src/renderer/index.css` | ⬜ pending |
| 2-02-02 | 02-02 | 1 | TASK-05 | manual | `npm run start` → Today view renders with task list | ⬜ pending |
| 2-03-01 | 02-03 | 2 | TASK-01,06 | manual | Click "+ Add Task" → Add Task screen appears with all fields | ⬜ pending |
| 2-03-02 | 02-03 | 2 | TASK-02 | manual | Click task → Edit screen pre-filled; save updates view | ⬜ pending |
| 2-03-03 | 02-03 | 2 | TASK-03 | manual | Delete task → confirmation shown → task removed | ⬜ pending |
| 2-03-04 | 02-03 | 2 | TASK-04 | manual | Complete task → disappears from Today view immediately | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/tests/dataservice.tasks.test.ts` — unit tests for DataService CRUD (getAllTasks, createTask, updateTask, deleteTask, completeTask)
- [ ] `src/tests/useTaskStore.test.ts` — unit tests for Zustand store actions against mocked IPC
- [ ] shadcn/ui init — `npx shadcn@latest init` with path alias setup (Wave 0 of plan 02-02)

*Wave 0 must complete before plan 02-01 tasks run.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Today view 7-task cap | TASK-05 | Requires live data + render | Add 10 tasks → confirm only 7 visible |
| Priority visual display | TASK-05 | Visual rendering check | Create High/Medium/Low tasks → verify border + opacity |
| Overdue badge | TASK-05 | Requires past due date | Create task with yesterday's date → badge shows "N days ago" |
| Empty state message | TASK-05 | Requires zero active tasks | Complete all tasks → "All clear — nothing left for today." |
| First-launch onboarding | TASK-06 | Requires fresh app state | Delete electron-store data → relaunch → 3-step onboarding appears |
| Date picker in Electron | TASK-01 | Electron window quirks | Open date picker → calendar renders → select date → input updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
