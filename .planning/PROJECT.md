# TaskMate

## What This Is

TaskMate is a local-first desktop app (Electron + React) that helps overwhelmed students, solo developers, and knowledge workers reduce mental overload. It combines task management with daily reflection and weekly summaries — not just storing information, but building behavioral awareness over time.

## Core Value

Users complete their day with a clear picture of what happened and why — not just a list of incomplete todos.

## Requirements

### Validated

- ✓ All data persists locally after restart with no internet required — Phase 1
- ✓ UI response time under 200ms for all interactions — Phase 1

### Active

- [ ] User can create, edit, delete, and mark tasks complete (with title, due date, priority)
- [ ] App sends native desktop notifications as reminders; re-notifies once after 10 min if task incomplete
- [ ] Daily reflection modal appears at 9 PM with 3 fixed questions; requires at least 1 answer to dismiss
- [ ] Weekly summary generates every Sunday evening showing task stats and top distraction keyword
- [ ] All data persists locally after restart with no internet required
- [ ] UI response time under 200ms for all interactions

### Out of Scope

- AI/LLM integration — keep it finishable and offline-clean
- Voice assistant — complexity not justified for MVP
- Cloud sync — local-first by design
- Team/collaboration features — single-user tool
- Complex analytics or charts — text-based summary is sufficient
- Calendar integrations — out of initial scope

## Context

- **Platform**: macOS/Windows desktop via Electron + React
- **Data storage**: Local file system via electron-store or SQLite — no server, no cloud
- **Target users**: People overwhelmed by existing todo apps that only store tasks without promoting reflection
- **Gap in market**: Existing apps (Todoist, Notion, etc.) focus on storage; none force behavioral review
- **Notification system**: Native OS notifications via Electron's Notification API
- **Reflection trigger**: Fixed 9 PM system time; weekly trigger every Sunday evening

## Constraints

- **Tech Stack**: Electron + React — chosen for ecosystem breadth and JS-only workflow
- **Offline**: App must function with zero network access at all times
- **Performance**: All UI actions must respond in < 200ms
- **UI Simplicity**: No animations required; prioritize clarity over aesthetics
- **Data**: Reflection responses stored by date; weekly stats derived from local task + reflection data

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Electron + React over Tauri | Lower barrier to entry, no Rust required | — Pending |
| better-sqlite3 (not electron-store) for task data | WAL mode, indexed queries needed for weekly summaries | ✓ Good |
| Fixed reflection questions (no customization) | Reduces decision fatigue; MVP scope | — Pending |
| Re-notify once after 10 min (not indefinitely) | Avoids annoyance; one nudge is enough | — Pending |
| Text-only weekly summary (no charts) | Keeps scope tight; charts are v2 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-22 after Phase 4.1 (UI Polish — minimalist redesign complete)*
