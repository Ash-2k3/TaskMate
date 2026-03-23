# Roadmap: TaskMate

## Overview

TaskMate is built in five phases, each delivering a complete, independently verifiable capability. Phase 1 establishes the Electron shell, IPC bridge, storage layer, and system tray — the foundation everything else depends on. Phase 2 delivers the primary user surface: a Today view with full task CRUD. Phase 3 adds the scheduling engine and native notifications that make TaskMate proactive rather than passive. Phase 4 introduces the daily reflection loop — the behavioral core of the product. Phase 5 closes the loop with weekly summaries that surface patterns from task and reflection data. The ordering is dependency-driven: no phase can be built without the ones before it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Electron shell, IPC/preload bridge, SQLite storage, system tray, and login item (completed 2026-03-21)
- [ ] **Phase 2: Task Management** - Today view with full task CRUD, priority display, and onboarding
- [x] **Phase 3: Reminders and Scheduling** - node-cron scheduler, native notifications, re-notification logic, and catch-up on open (completed 2026-03-22)
- [x] **Phase 4: Daily Reflection** - 9 PM reflection modal, 3 fixed questions, snooze, catch-up, and persistence (completed 2026-03-22)
- [x] **Phase 5: Weekly Summary** - Sunday summary generation, stats, deferred tasks, keyword analysis, and data export (completed 2026-03-23)

## Phase Details

### Phase 1: Foundation
**Goal**: A runnable, packageable Electron app with a secure IPC bridge, local storage, system tray, and login-item registration — the correct foundation from which all features can be built without retroactive rewrites
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06
**Success Criteria** (what must be TRUE):
  1. App launches on macOS and Windows from the packaged build without a white screen (HashRouter and Vite base path are correctly configured)
  2. App minimizes to the system tray when the window is closed and does not fully quit, so the main process continues running in the background
  3. App is registered as a login item and restarts automatically after system reboot
  4. Task and reflection data written to better-sqlite3 survives an app restart; settings written to electron-store survive a restart
  5. Renderer can invoke main-process operations (read tasks, write tasks) via the typed `window.taskmate.*` IPC bridge — no raw ipcRenderer exposure
**Plans**: TBD

Plans:
- [x] 01-01: Electron Forge + Vite scaffold with React 18 + TypeScript, HashRouter, Vite base path, CSP, and devtools gate
- [x] 01-02: better-sqlite3 initialization with WAL mode, DataService wrapper, electron-store for settings, daily backup, schema validation
- [x] 01-03: contextBridge preload with typed window.taskmate API (channels stubbed), system tray with hide-to-tray behavior, and login-item registration

### Phase 2: Task Management
**Goal**: Users can create, view, edit, complete, and delete tasks from a Today view that surfaces the right tasks without overwhelming them
**Depends on**: Phase 1
**Requirements**: TASK-01, TASK-02, TASK-03, TASK-04, TASK-05, TASK-06
**Success Criteria** (what must be TRUE):
  1. User can add a task with a title (required), optional due date, and priority (Low / Medium / High) via the Add Task screen and see it appear in the Today view immediately
  2. User can edit any field of an existing task and see the update reflected immediately without a full reload
  3. User can mark a task complete; it disappears from the Today view immediately and is archived in the database
  4. User can delete a task; it is removed immediately from both the view and the database
  5. Today view shows tasks sorted by due date, capped at 7 visible tasks, with a calm empty-state message when all tasks are done
**Plans**: TBD

Plans:
- [x] 02-01: better-sqlite3 tasks schema and DataService CRUD methods wired through IPC handlers and Zustand useTaskStore
- [x] 02-02: Today view with 7-task cap, due-date sort, priority display (bold/border for High, greyed for Low), overdue badge, and calm empty state
- [x] 02-03: Add Task screen (title input, due date picker, priority selector, Save), Edit Task screen, Delete confirmation, and 3-step first-launch onboarding with seeded example tasks

### Phase 3: Reminders and Scheduling
**Goal**: The app proactively notifies users about due tasks at the right time via native OS notifications, with one re-notification after 10 minutes and a catch-up indicator when reminders are missed
**Depends on**: Phase 2
**Requirements**: REMIND-01, REMIND-02, REMIND-03, REMIND-04, REMIND-05
**Success Criteria** (what must be TRUE):
  1. User can set a reminder time on any task; a native OS desktop notification fires at that time
  2. If the task is not marked complete 10 minutes after the reminder fires, a single re-notification fires — and does not fire again
  3. Re-notifications are suppressed after 8:30 PM so evening notification pile-up cannot occur
  4. Notification state (notifiedAt, renotified) persists in electron-store so re-launching the app does not re-fire already-sent notifications
  5. When the app is opened after a reminder should have fired, an in-app catch-up indicator shows which tasks had missed reminders
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Vitest setup, schema migration (reminder_time column), DataService query methods, IPC + preload wiring, Zustand type updates
- [x] 03-02-PLAN.md — node-cron scheduler module with per-minute tick, native notifications, re-notification logic (10-min, 20:30 cutoff), powerMonitor wake guard
- [x] 03-03-PLAN.md — Reminder time UI field in AddTask/EditTask, catch-up banner in TodayView, end-to-end verification checkpoint

### Phase 4: Daily Reflection
**Goal**: Users are prompted at 9 PM every day with a 3-question reflection modal that requires at least one answer, can be snoozed, and catches up on next open if missed — building the behavioral feedback loop that is TaskMate's core differentiator
**Depends on**: Phase 3
**Requirements**: REFLECT-01, REFLECT-02, REFLECT-03, REFLECT-04, REFLECT-05, REFLECT-06
**Success Criteria** (what must be TRUE):
  1. At 9 PM, a reflection modal appears (triggered by IPC from the main-process cron job) with exactly 3 fixed questions in grounding → learning → forward-intention order
  2. Question 1 is pre-filled with today's completed task count ("You finished N tasks today. What else did you actually finish...")
  3. The modal cannot be fully dismissed without answering at least 1 question; a "Snooze 30 min" option is always available as a non-blocking escape
  4. Reflection responses are saved to better-sqlite3 keyed by ISO date string; the same day's reflection prompt does not reappear after it is saved
  5. If the user opens the app after 9 PM and that day's reflection has not been completed, the modal appears immediately on app open
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — DataService reflection methods (hasReflection, saveReflection, getAllReflections, getCompletedTaskCountToday), IPC handlers replacing stubs, preload bridge, settingsStore snoozeUntil, useReflectionStore
- [x] 04-02-PLAN.md — ReflectionModal component with 3 fixed questions, pre-fill task count, at-least-1-answer validation, Save/Snooze buttons, mounted in App.tsx with onReflectionPrompt IPC listener
- [x] 04-03-PLAN.md — Scheduler tick extension for 9 PM reflection trigger, startup catch-up in index.ts, bottom nav bar (Today/Reflections), ReflectionsHistory screen with expandable date rows

### Phase 04.1: UI Polish — minimalist redesign across all screens (INSERTED)

**Goal:** Near-monochrome minimalist redesign: clean white row backgrounds, weight-only priority signals, flush-left form layouts, flat accordion rows, and lightened border tokens — reducing visual noise across all screens without changing any behavior
**Requirements**: D-01 through D-22 (visual decisions captured in CONTEXT.md)
**Depends on:** Phase 4
**Plans:** 2/2 plans complete

Plans:
- [x] 04.1-01-PLAN.md — CSS variable border lightening (index.css) and TaskRow redesign (bg-background, weight-only priority, subtle hover)
- [x] 04.1-02-PLAN.md — Full-width flush-left layout for AddTask/EditTask, flat accordion rows for ReflectionsHistory, textarea focus ring fix for ReflectionModal

### Phase 5: Weekly Summary
**Goal**: Every Sunday evening, the app generates a text-only summary showing task completion stats, specific deferred task titles, and the top recurring keyword from that week's reflection answers — closing the behavioral feedback loop and making patterns visible
**Depends on**: Phase 4
**Requirements**: SUMMARY-01, SUMMARY-02, SUMMARY-03, SUMMARY-04, SUMMARY-05
**Success Criteria** (what must be TRUE):
  1. Every Sunday evening, a weekly summary is automatically generated and shown on a dedicated Weekly Summary screen (text only, no charts)
  2. Summary shows: total tasks created, total tasks completed, completion rate (%), and the specific titles of tasks deferred from prior weeks (not a count)
  3. Summary surfaces the oldest neglected task by name with the number of days it has been on the list
  4. Summary shows the top keyword extracted from that week's reflection question 2 answers via word frequency analysis (stop words removed, labeled "recurring topic")
  5. Past weekly summaries can be reviewed from within the app; summary data persists across restarts
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — DataService summary methods (stats, deferred tasks, reflections-for-week, summary CRUD, data stats, delete-all, export-all), IPC handlers, preload bridge, unit tests
- [x] 05-02-PLAN.md — Pure-JS keyword extraction (extractTopKeyword) with locked stop-word list, TDD with 7 test cases
- [x] 05-03-PLAN.md — Sunday 8 PM scheduler trigger, WeeklySummary screen, Settings screen, Zustand store, 3-tab nav, gear icon in TodayView, human verification checkpoint

### Phase 5.1: UI Overhaul — Modern, Polished Desktop App (INSERTED)

**Goal:** Elevate TaskMate's visual quality to match the standard of modern desktop apps (Linear, Raycast, Notion) — cohesive typography, refined spacing, subtle depth, consistent component language, and a design system that makes every screen feel intentional and premium
**Depends on:** Phase 5
**Requirements:** TBD (captured in CONTEXT.md after discuss-phase)
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 5.1

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete    | 2026-03-21 |
| 2. Task Management | 2/3 | In Progress|  |
| 3. Reminders and Scheduling | 3/3 | Complete   | 2026-03-22 |
| 4. Daily Reflection | 2/3 | Complete    | 2026-03-22 |
| 04.1 UI Polish | 2/2 | Complete    | 2026-03-22 |
| 5. Weekly Summary | 3/3 | Complete   | 2026-03-23 |
| 5.1 UI Overhaul | 0/? | Not started | - |

---
*Roadmap created: 2026-03-21*
*Coverage: 27/27 v1 requirements mapped*
