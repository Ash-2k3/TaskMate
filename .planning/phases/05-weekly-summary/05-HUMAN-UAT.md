---
status: partial
phase: 05-weekly-summary
source: [05-VERIFICATION.md]
started: 2026-03-23T05:00:00Z
updated: 2026-03-23T05:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 3-tab nav and Summary empty state
expected: Nav bar at bottom shows Today | Reflections | Summary tabs. Clicking Summary shows "No summary yet. Your first will appear this Sunday evening."
result: [pending]

### 2. Gear icon and Settings screen
expected: Gear icon (cog) visible in TodayView header top-right next to + Add Task. Clicking it navigates to /settings showing record counts.
result: [pending]

### 3. Export JSON opens native file dialog
expected: Clicking "Export all data" in Settings opens a native OS save-file dialog defaulting to taskmate-export.json
result: [pending]

### 4. Delete all inline confirmation and nav-bar hiding on Settings
expected: Clicking "Delete all data" shows inline confirmation text "Are you sure? This cannot be undone." Nav bar is hidden on /settings route (utility route).
result: [pending]

### 5. Sunday 8 PM summary generation and OS notification
expected: On Sunday at or after 20:00 local time, app generates a summary and fires an OS notification with title "TaskMate" and body "Your weekly summary is ready". Summary then appears on /summary tab.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
