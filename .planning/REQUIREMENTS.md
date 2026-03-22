# Requirements: TaskMate

**Defined:** 2026-03-21
**Core Value:** Users complete their day with a clear picture of what happened and why — not just a list of incomplete todos.

## v1 Requirements

### Foundation

- [x] **FOUND-01**: App launches as an Electron desktop application with contextIsolation enabled and a typed preload/IPC bridge
- [x] **FOUND-02**: App minimizes to system tray (does not fully quit when window is closed) so background scheduling survives
- [x] **FOUND-03**: App registers as a login item so it starts on system boot and the scheduler is always live
- [x] **FOUND-04**: All data persists to local storage (better-sqlite3 for tasks/reflections/summaries, electron-store for settings) and survives restart
- [x] **FOUND-05**: App works fully offline with zero network access required
- [x] **FOUND-06**: All UI interactions respond in under 200ms

### Task Management

- [x] **TASK-01**: User can create a task with a required title, optional due date, and priority (Low / Medium / High)
- [x] **TASK-02**: User can edit any field of an existing task
- [x] **TASK-03**: User can delete a task
- [x] **TASK-04**: User can mark a task as complete; completed tasks are removed from the active view immediately
- [x] **TASK-05**: Main screen displays active tasks sorted by due date (Today view, capped at visible priority tasks)
- [x] **TASK-06**: User can add a task via a dedicated Add Task screen with title input, due date picker, priority selector, and Save button

### Reminders

- [x] **REMIND-01**: User can set a reminder time on any task
- [x] **REMIND-02**: App fires a native OS desktop notification at the reminder time
- [x] **REMIND-03**: If the task is not marked complete by reminder time, a single re-notification fires 10 minutes later (once only)
- [x] **REMIND-04**: Notification state is persisted so re-launching the app does not re-fire already-sent notifications
- [x] **REMIND-05**: App checks on startup for any missed reminders (e.g., user opens app after notification should have fired) and shows an in-app catch-up indicator

### Daily Reflection

- [ ] **REFLECT-01**: App triggers a reflection prompt at 9 PM daily (configurable in settings in v2)
- [ ] **REFLECT-02**: Reflection appears as a modal with 3 fixed questions: (1) What did you actually finish today, even if it wasn't on your list? (2) What slowed you down most today, and was it avoidable? (3) What is the one thing you'll protect time for tomorrow?
- [ ] **REFLECT-03**: User must answer at least 1 question before the modal can be dismissed
- [ ] **REFLECT-04**: Modal includes a "Snooze 30 min" option so it is not a hard block
- [ ] **REFLECT-05**: Reflection responses are stored by date (ISO date string key)
- [ ] **REFLECT-06**: If 9 PM notification is missed (OS Focus Mode / DND), app shows a catch-up reflection prompt on next open if that day's reflection is incomplete

### Weekly Summary

- [ ] **SUMMARY-01**: App generates a weekly summary every Sunday evening
- [ ] **SUMMARY-02**: Summary includes: total tasks created, total tasks completed, completion rate (%), and any tasks deferred from prior weeks (shown by title, not count)
- [ ] **SUMMARY-03**: Summary includes the top distraction keyword extracted from that week's reflection question 2 answers via simple word frequency analysis (stop words removed)
- [ ] **SUMMARY-04**: Summary is displayed as text only (no charts) on a dedicated Weekly Summary screen
- [ ] **SUMMARY-05**: Summary data is persisted by week so past summaries can be reviewed

## v2 Requirements

### Reflection Customization

- **REFLECT-V2-01**: User can configure the daily reflection trigger time (default 9 PM)
- **REFLECT-V2-02**: User can customize the 3 reflection questions

### Enhanced Analytics

- **SUMMARY-V2-01**: Charts/visualizations for weekly completion trends
- **SUMMARY-V2-02**: TF-IDF distraction keyword analysis (upgrade from simple frequency)
- **SUMMARY-V2-03**: Streak tracking for consecutive days with completed reflection

### Data Management

- **DATA-V2-01**: User can export all data (tasks, reflections, summaries) as JSON or CSV
- **DATA-V2-02**: User can import data from export file

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI/LLM integration | Keeps app offline-clean and finishable |
| Voice assistant | Complexity not justified for MVP |
| Cloud sync | Local-first by design |
| Team/collaboration features | Single-user tool |
| Complex analytics or charts | Text summary sufficient for v1 |
| Calendar integrations | Out of initial scope |
| Mobile app | Desktop-first; mobile later |
| Mac App Store distribution | Changes notification/login-item behavior significantly; defer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Complete |
| FOUND-02 | Phase 1 | Complete |
| FOUND-03 | Phase 1 | Complete |
| FOUND-04 | Phase 1 | Complete |
| FOUND-05 | Phase 1 | Complete |
| FOUND-06 | Phase 1 | Complete |
| TASK-01 | Phase 2 | Complete |
| TASK-02 | Phase 2 | Complete |
| TASK-03 | Phase 2 | Complete |
| TASK-04 | Phase 2 | Complete |
| TASK-05 | Phase 2 | Complete |
| TASK-06 | Phase 2 | Complete |
| REMIND-01 | Phase 3 | Complete |
| REMIND-02 | Phase 3 | Complete |
| REMIND-03 | Phase 3 | Complete |
| REMIND-04 | Phase 3 | Complete |
| REMIND-05 | Phase 3 | Complete |
| REFLECT-01 | Phase 4 | Pending |
| REFLECT-02 | Phase 4 | Pending |
| REFLECT-03 | Phase 4 | Pending |
| REFLECT-04 | Phase 4 | Pending |
| REFLECT-05 | Phase 4 | Pending |
| REFLECT-06 | Phase 4 | Pending |
| SUMMARY-01 | Phase 5 | Pending |
| SUMMARY-02 | Phase 5 | Pending |
| SUMMARY-03 | Phase 5 | Pending |
| SUMMARY-04 | Phase 5 | Pending |
| SUMMARY-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
