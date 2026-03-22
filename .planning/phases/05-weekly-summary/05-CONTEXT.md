# Phase 5: Weekly Summary - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate a weekly text summary every Sunday at 8 PM, persist it to SQLite, fire an OS notification, and expose a dedicated Weekly Summary screen + past summaries review. Add a Settings screen (record counts, date range, Export JSON, Delete all) accessible via a gear icon in TodayView. No charts. Nav expands to 3 tabs.

</domain>

<decisions>
## Implementation Decisions

### Trigger and notification
- **D-01:** Sunday 8 PM cron trigger — extend existing `tick()` in `reminder-scheduler.ts` with a Sunday-at-20:00 check (same pattern as reflection trigger at 21:00)
- **D-02:** Guard: generate at most once per week — check `weekly_summaries` table for existing `week_of` = current week's Monday ISO date before generating
- **D-03:** After generation: fire OS notification with title `"TaskMate"` and body `"Your weekly summary is ready"` — no click handler required (notification only, no auto-open)
- **D-04:** No automatic navigation on trigger — user opens the app and browses to Summary tab at their convenience

### Deferred tasks definition
- **D-05:** "Deferred tasks" = incomplete tasks where `created_at < this Monday (ISO date)` — uses `created_at`, NOT `due_date`
- **D-06:** `week_start` = ISO date of the most recent Monday: `date('now', 'weekday 1', '-7 days', 'localtime')` in SQLite (or compute in JS as `startOfWeek(new Date(), { weekStartsOn: 1 })` via date-fns)
- **D-07:** Deferred tasks shown by title in "Still waiting" section; each title followed by days on list in parentheses: `Write Q1 report (12 days)` — days = `floor((now - created_at) / 86400000)`
- **D-08:** "Oldest neglected task" (SUMMARY-03 success criterion) = the single deferred task with the oldest `created_at` — extracted from the same deferred list, surfaced separately in the "Still waiting" section as first item (implicit — no separate label needed)

### Weekly summary content schema (the `data TEXT` JSON blob)
- **D-09:** `weekly_summaries.data` stores JSON with shape:
  ```json
  {
    "week_of": "2026-03-16",
    "tasks_created": 8,
    "tasks_completed": 5,
    "completion_rate": 62,
    "deferred_tasks": [
      { "title": "Write Q1 report", "days": 12 },
      { "title": "Fix onboarding bug", "days": 8 }
    ],
    "recurring_topic": "focus"
  }
  ```
- **D-10:** `week_of` = ISO date of the Monday starting that week (e.g., `"2026-03-16"`)
- **D-11:** `tasks_created` = COUNT of tasks with `created_at >= week_start AND created_at < week_end`
- **D-12:** `tasks_completed` = COUNT of tasks with `completed = 1 AND completed_at >= week_start AND completed_at < week_end`
- **D-13:** `completion_rate` = `Math.round((tasks_completed / tasks_created) * 100)` — stored as integer; if `tasks_created = 0`, store `0`

### Keyword extraction
- **D-14:** Source text = all `q2` answers from reflections in the current week (`date >= week_start AND date < week_end`) — per SUMMARY-03 (q2 = "What slowed you down most today")
- **D-15:** Algorithm: lowercase → strip punctuation → split on whitespace → remove stop words → frequency count → return top-1 word
- **D-16:** Stop words list: a, an, the, and, or, but, in, on, at, to, for, of, with, it, is, was, i, my, me, we, our, that, this, not, so, just, very, really, too, up, out, if, but, be, do, did, had, has, have, been, were, are, am, what, when, how, would, could, should, also, which, there, their, they, you, your, him, her, his, its, about, than, then, like, more, most, some, any, no
- **D-17:** If no q2 answers exist for the week OR no word survives stop-word removal: `recurring_topic = null` — shown as `"—"` in UI
- **D-18:** Keyword extraction runs as pure JS in main process (no npm package) — implement inline in a `extractTopKeyword(texts: string[]): string | null` utility function

### Navigation — 3 tabs + Settings gear
- **D-19:** Nav bar expands from 2 to 3 tabs: `Today (/)` | `Reflections (/reflections)` | `Summary (/summary)`
- **D-20:** `showNavBar` in `App.tsx` updated to: `['/', '/reflections', '/summary'].includes(location.pathname)`
- **D-21:** Nav bar hidden on `/add`, `/edit/:id`, `/settings` (utility/full-screen routes)
- **D-22:** Settings accessible via a gear icon (`⚙` or Lucide `Settings` icon) in TodayView header, top-right — replaces the area next to `+ Add Task` button OR sits as a separate icon link; navigates to `/settings` route
- **D-23:** Settings screen (`/settings`) is a utility screen — no nav bar, has `← Today` back button (same pattern as AddTask/EditTask)

### Weekly Summary screen layout
- **D-24:** Route `/summary` → `WeeklySummary` screen — shows the most recent summary by default
- **D-25:** Past summaries: a dropdown or simple list at the top of the screen to select which week to view (most recent first); switching week updates the displayed summary content
- **D-26:** Summary text layout (top to bottom):
  ```
  Week of [Monday date formatted as "March 16"]

  This week
    Created   N tasks
    Completed N tasks
    Rate      N%

  Still waiting
    • [title] (N days)
    • [title] (N days)
    [if none: "Nothing carried over — great week."]

  Recurring topic
    [word]
    [if null: "—"]
  ```
- **D-27:** "Week of" date formatted as `format(parseISO(week_of), 'MMMM d')` using date-fns
- **D-28:** Empty state when no summaries exist yet: `"No summary yet. Your first will appear this Sunday evening."`

### Settings screen content
- **D-29:** Settings screen shows read-only record counts + date ranges: "X reflections (from [date] to [date])", "X tasks total", "X weekly summaries"
- **D-30:** "Export all data" button → triggers JSON export of all tasks, reflections, and summaries via `dialog.showSaveDialog` (Electron) → writes JSON file to user-chosen path
- **D-31:** "Delete all data" button → confirmation text inline ("Are you sure? This cannot be undone.") → on confirm: DELETE all rows from tasks, reflections, weekly_summaries tables; uses same inline confirmation pattern as task delete (no modal)
- **D-32:** No other settings in v1 — reflection time customization and question editing are v2

### Claude's Discretion
- Exact Tailwind classes for the Summary screen (consistent with existing px-6 py-6 pattern + new minimal style from Phase 04.1)
- Lucide icon choice for Settings gear (Settings or Settings2)
- Exact position of gear icon in TodayView header relative to Add Task button
- Whether past summary selector is a `<select>` or a simple list of week labels above the content

</decisions>

<specifics>
## Specific Ideas

- Summary layout mockup (D-26): Stats block first (facts), then "Still waiting" (lingering tasks), then "Recurring topic" (insight). Mirrors how a weekly retrospective actually reads.
- Notification text: "Your weekly summary is ready" — short, clear, no emoji
- Deferred tasks: age shown in parentheses per item so user can see at a glance how long each has been sitting
- Settings as gear icon in TodayView header — keeps the 3-tab nav clean; settings is a utility not a primary destination

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data layer (extend, don't recreate)
- `src/main/data-service.ts` — `weekly_summaries` table already defined; add: `getWeeklySummaryStats()`, `getDeferredTasks()`, `saveWeeklySummary()`, `getAllWeeklySummaries()`, `getDataStats()`, `deleteAllData()`
- `src/main/ipc-handlers.ts` — add summary + settings IPC handlers following existing `ipcMain.handle` pattern
- `src/preload/preload.ts` — expose new IPC channels via `contextBridge`

### Scheduler (extend, not replace)
- `src/main/reminder-scheduler.ts` — extend `tick()` with Sunday 8 PM weekly summary check (pattern: `currentHHMM >= '20:00'` AND `isSunday(now)` AND not yet generated this week)

### Renderer integration points
- `src/renderer/App.tsx` — add `/summary` and `/settings` routes; update `showNavBar`; add 3rd nav tab
- `src/renderer/screens/TodayView.tsx` — add gear icon linking to `/settings` in header
- `src/renderer/screens/ReflectionsHistory.tsx` — visual reference for list-with-expand pattern

### Prior phase context (patterns to follow)
- `.planning/phases/04-daily-reflection/04-CONTEXT.md` — IPC, store, scheduler extension patterns
- `.planning/phases/04.1-ui-polish-minimalist-redesign-across-all-screens/04.1-CONTEXT.md` — visual patterns from minimalist redesign (bg-background, px-6 py-6, font-semibold headings)

### Requirements
- `.planning/REQUIREMENTS.md` §Weekly Summary — SUMMARY-01 through SUMMARY-05 (all must be satisfied)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `node-cron` schedule — already installed; `tick()` pattern in `reminder-scheduler.ts` handles per-minute checks with guards
- `date-fns` — already installed; use `format`, `parseISO`, `startOfWeek`, `isSunday`
- `Notification` from Electron — already used in scheduler for task reminders (D-03 uses same API)
- `useReflectionStore` / `useTaskStore` — Zustand store pattern to replicate for `useWeeklySummaryStore`
- Bottom nav bar in `App.tsx` — add 3rd button following existing pattern

### Established Patterns
- IPC: `ipcMain.handle` in `ipc-handlers.ts`, exposed via `contextBridge` in `preload.ts`
- Store: Zustand with async `load*()` action calling IPC, local state updated after each action
- Scheduler guard: `reflectionFiredToday` pattern → replicate as `summarygeneratedThisWeek: string | null`
- Inline delete confirmation: `showDeleteConfirm` local state (used in EditTask) — replicate for "Delete all data"
- No animations — PROJECT.md constraint

### Integration Points
- `reminder-scheduler.ts` tick() — weekly check runs after existing reminder + reflection checks
- `index.ts` — no startup catch-up needed for weekly summary (unlike reflection catch-up)
- Export: use `dialog.showSaveDialog` from `electron` in main process via new IPC handler `data:export`

</code_context>

<deferred>
## Deferred Ideas

- Configurable summary day/time (e.g., Friday instead of Sunday) — v2
- Email digest of weekly summary — out of scope (requires network)
- Charts/visualizations for weekly trends — SUMMARY-V2-01
- TF-IDF keyword analysis upgrade — SUMMARY-V2-02
- Streak tracking — SUMMARY-V2-03
- CSV export format — DATA-V2-01 (JSON export is v1)

</deferred>

---

*Phase: 05-weekly-summary*
*Context gathered: 2026-03-22*
