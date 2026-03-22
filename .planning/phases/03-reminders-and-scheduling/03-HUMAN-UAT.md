---
status: partial
phase: 03-reminders-and-scheduling
source: [03-VERIFICATION.md]
started: 2026-03-22T00:00:00.000Z
updated: 2026-03-22T00:00:00.000Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Native OS notification fires and displays correctly
expected: At the scheduled reminder time, a native desktop notification appears with title "TaskMate Reminder" and body equal to the task title

result: [pending]

### 2. Clicking notification surfaces the app window
expected: Clicking the OS notification causes the TaskMate window to appear (show + focus) even if it was hidden to tray

result: [pending]

### 3. Catch-up banner appears after restart with overdue missed reminders
expected: When the app is opened after a task's reminder_time has passed without the app running, the TodayView shows the yellow dismissible banner listing the missed task title(s)

result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
