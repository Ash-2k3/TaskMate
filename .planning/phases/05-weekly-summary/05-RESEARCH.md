# Phase 5: Weekly Summary - Research

**Researched:** 2026-03-22
**Domain:** SQLite aggregation, pure-JS NLP, node-cron extension, Electron IPC, Zustand, React/Tailwind screen composition
**Confidence:** HIGH

## Summary

Phase 5 is additive — it extends three already-proven subsystems (scheduler, data layer, renderer routing) rather than introducing new external dependencies. All required libraries (`better-sqlite3`, `node-cron`, `date-fns`, `lucide-react`, `zustand`, `electron`, `react-router-dom`) are already installed and in production use. No new npm packages are needed.

The three delivery units map cleanly to plan files: (1) data layer — new DataService methods + SQL queries for the `weekly_summaries` table that already exists in the schema; (2) keyword extraction — a single pure-JS utility function with no dependencies; (3) scheduler extension + UI — the scheduler gains a Sunday 8 PM guard, and three new screens (WeeklySummary, Settings) plus nav/routing changes land in the renderer.

The highest-risk area is the SQLite week-boundary arithmetic. SQLite's `date('now', 'weekday 1', '-7 days', 'localtime')` correctly computes the most recent Monday but must be understood carefully: `weekday 1` is Monday in SQLite; applying it with `-7 days` prevents snapping forward to the next Monday when today is already Monday. All date comparisons use `localtime` modifier to match how `created_at` values are produced from `new Date().toISOString()` — which is UTC. **This is a subtle mismatch: tasks are stored with UTC timestamps, but week boundaries are computed in local time.** The plan must address this explicitly.

**Primary recommendation:** Extend, don't recreate. Every pattern in this phase has a direct predecessor in the codebase — copy the structure from `reflectionFiredToday` for the weekly guard, copy `useReflectionStore` for `useWeeklySummaryStore`, copy `ReflectionsHistory` layout for `WeeklySummary`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Trigger and notification**
- D-01: Sunday 8 PM cron trigger — extend existing `tick()` in `reminder-scheduler.ts` with a Sunday-at-20:00 check (same pattern as reflection trigger at 21:00)
- D-02: Guard: generate at most once per week — check `weekly_summaries` table for existing `week_of` = current week's Monday ISO date before generating
- D-03: After generation: fire OS notification with title `"TaskMate"` and body `"Your weekly summary is ready"` — no click handler required (notification only, no auto-open)
- D-04: No automatic navigation on trigger — user opens the app and browses to Summary tab at their convenience

**Deferred tasks definition**
- D-05: "Deferred tasks" = incomplete tasks where `created_at < this Monday (ISO date)` — uses `created_at`, NOT `due_date`
- D-06: `week_start` = ISO date of the most recent Monday: `date('now', 'weekday 1', '-7 days', 'localtime')` in SQLite (or compute in JS as `startOfWeek(new Date(), { weekStartsOn: 1 })` via date-fns)
- D-07: Deferred tasks shown by title in "Still waiting" section; each title followed by days on list in parentheses: `Write Q1 report (12 days)` — days = `floor((now - created_at) / 86400000)`
- D-08: "Oldest neglected task" = the single deferred task with the oldest `created_at` — extracted from the same deferred list, surfaced separately in the "Still waiting" section as first item (implicit — no separate label needed)

**Weekly summary content schema**
- D-09: `weekly_summaries.data` stores JSON with shape:
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
- D-10: `week_of` = ISO date of the Monday starting that week (e.g., `"2026-03-16"`)
- D-11: `tasks_created` = COUNT of tasks with `created_at >= week_start AND created_at < week_end`
- D-12: `tasks_completed` = COUNT of tasks with `completed = 1 AND completed_at >= week_start AND completed_at < week_end`
- D-13: `completion_rate` = `Math.round((tasks_completed / tasks_created) * 100)` — stored as integer; if `tasks_created = 0`, store `0`

**Keyword extraction**
- D-14: Source text = all `q2` answers from reflections in the current week (`date >= week_start AND date < week_end`)
- D-15: Algorithm: lowercase → strip punctuation → split on whitespace → remove stop words → frequency count → return top-1 word
- D-16: Stop words list: a, an, the, and, or, but, in, on, at, to, for, of, with, it, is, was, i, my, me, we, our, that, this, not, so, just, very, really, too, up, out, if, but, be, do, did, had, has, have, been, were, are, am, what, when, how, would, could, should, also, which, there, their, they, you, your, him, her, his, its, about, than, then, like, more, most, some, any, no
- D-17: If no q2 answers exist OR no word survives stop-word removal: `recurring_topic = null` — shown as `"—"` in UI
- D-18: Keyword extraction runs as pure JS in main process — implement inline in `extractTopKeyword(texts: string[]): string | null`

**Navigation**
- D-19: Nav bar expands from 2 to 3 tabs: `Today (/)` | `Reflections (/reflections)` | `Summary (/summary)`
- D-20: `showNavBar` updated to: `['/', '/reflections', '/summary'].includes(location.pathname)`
- D-21: Nav bar hidden on `/add`, `/edit/:id`, `/settings`
- D-22: Settings accessible via gear icon in TodayView header, top-right — navigates to `/settings`
- D-23: Settings screen (`/settings`) — no nav bar, has `← Today` back button (same pattern as AddTask/EditTask)

**Weekly Summary screen**
- D-24: Route `/summary` → `WeeklySummary` screen — shows most recent summary by default
- D-25: Past summaries: a dropdown or simple list at the top to select which week (most recent first)
- D-26: Text layout top to bottom: Week of / This week (Created, Completed, Rate) / Still waiting (bullet list) / Recurring topic
- D-27: "Week of" formatted as `format(parseISO(week_of), 'MMMM d')` using date-fns
- D-28: Empty state: `"No summary yet. Your first will appear this Sunday evening."`

**Settings screen**
- D-29: Read-only record counts + date ranges: "X reflections (from [date] to [date])", "X tasks total", "X weekly summaries"
- D-30: "Export all data" → `dialog.showSaveDialog` → writes JSON file
- D-31: "Delete all data" → inline confirmation → DELETE all rows from all three tables
- D-32: No other settings in v1

### Claude's Discretion
- Exact Tailwind classes for the Summary screen
- Lucide icon choice for Settings gear (Settings or Settings2)
- Exact position of gear icon in TodayView header
- Whether past summary selector is a `<select>` or a simple list of week labels

### Deferred Ideas (OUT OF SCOPE)
- Configurable summary day/time — v2
- Email digest — out of scope (requires network)
- Charts/visualizations — SUMMARY-V2-01
- TF-IDF keyword analysis upgrade — SUMMARY-V2-02
- Streak tracking — SUMMARY-V2-03
- CSV export format — DATA-V2-01
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SUMMARY-01 | App generates a weekly summary every Sunday evening | D-01/D-02: extend `tick()` in `reminder-scheduler.ts` with Sunday 20:00 guard + `week_of` deduplication check against `weekly_summaries` table |
| SUMMARY-02 | Summary includes: total tasks created, total tasks completed, completion rate (%), deferred tasks shown by title | D-09 to D-13: SQL COUNT queries with week-boundary params; deferred list from `created_at < week_start`; stored as JSON blob in `weekly_summaries.data` |
| SUMMARY-03 | Summary includes top distraction keyword from q2 answers via word frequency analysis (stop words removed) | D-14 to D-18: `extractTopKeyword()` pure-JS function; source = `reflections.q2` for week; null-safe when no data |
| SUMMARY-04 | Summary displayed as text only (no charts) on dedicated Weekly Summary screen | D-24 to D-28: `/summary` route + `WeeklySummary` screen; text layout with four sections; Tailwind only, no chart libraries |
| SUMMARY-05 | Summary data persists by week so past summaries can be reviewed | D-05: `weekly_summaries` table already exists with `week_of TEXT PRIMARY KEY`; `getAllWeeklySummaries()` returns all rows ordered DESC; past-week selector in UI |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 | SQL aggregation queries for summary stats | Already the project DB; synchronous API fits Electron main process |
| node-cron | 4.2.1 | Per-minute tick extended for Sunday 20:00 check | Already scheduling reminders and reflection; same `noOverlap` cron task |
| date-fns | 4.1.0 | `isSunday`, `startOfWeek`, `format`, `parseISO` | Already imported in TodayView and ReflectionsHistory |
| electron (Notification) | 41.0.3 | OS notification after summary generation | Already used in scheduler for task reminders |
| zustand | 5.0.12 | `useWeeklySummaryStore` — store for summary list + selection | Already pattern for tasks and reflections |
| lucide-react | 0.577.0 | Settings gear icon in TodayView header | Already used for UI icons throughout |
| react-router-dom | 7.13.1 | `/summary` and `/settings` routes | Already routing all screens |
| electron (dialog) | 41.0.3 | `dialog.showSaveDialog` for JSON export | Built-in Electron API, no extra package |

**Installation:** No new packages required. Zero `npm install` needed for this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure-JS keyword extraction | `natural`, `compromise` npm packages | npm packages add bundle weight; pure-JS is sufficient for frequency count with a static stop-word list; CONTEXT.md D-18 locks this |
| `dialog.showSaveDialog` in main | renderer-side file save | Electron sandboxing requires main-process file dialog; IPC is necessary |
| JSON blob in `data` column | Separate columns per stat | JSON blob allows schema evolution without migrations; all stats accessed together anyway |

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── main/
│   ├── data-service.ts          # ADD: summary methods (getWeeklySummaryStats, getDeferredTasks,
│   │                            #      saveWeeklySummary, getAllWeeklySummaries,
│   │                            #      getDataStats, deleteAllData, getReflectionsForWeek)
│   ├── ipc-handlers.ts          # ADD: summary:* and data:* IPC handlers
│   ├── reminder-scheduler.ts    # EXTEND: tick() with Sunday 20:00 weekly check
│   └── keyword-extractor.ts     # NEW: extractTopKeyword(texts: string[]): string | null
├── preload/
│   └── preload.ts               # ADD: summary + settings IPC channel exposures
└── renderer/
    ├── App.tsx                  # EXTEND: /summary + /settings routes; 3-tab nav; showNavBar update
    ├── stores/
    │   └── useWeeklySummaryStore.ts   # NEW: Zustand store for summaries
    └── screens/
        ├── TodayView.tsx        # EXTEND: gear icon → /settings in header
        ├── WeeklySummary.tsx    # NEW: /summary screen
        └── Settings.tsx         # NEW: /settings screen
```

### Pattern 1: Scheduler Extension — Sunday 8 PM Weekly Guard

**What:** Add a fourth block inside `tick()` after the existing reflection check. Uses module-level `summaryGeneratedThisWeek: string | null` to prevent re-firing, mirroring `reflectionFiredToday`.

**When to use:** Any periodic event that must fire at most once per period and must survive power resume.

```typescript
// Source: existing reminder-scheduler.ts — replicate this pattern exactly
let summaryGeneratedThisWeek: string | null = null;

// Inside tick(), after reflection block:
// 4. Weekly summary trigger at Sunday 8 PM (D-01, D-02)
if (currentHHMM >= '20:00') {
  const sunday = isSunday(now);  // date-fns
  if (sunday) {
    // Compute this week's Monday as the dedup key
    const weekOf = startOfWeek(now, { weekStartsOn: 1 })
      .toISOString().split('T')[0];

    const alreadyExists = dataService.hasWeeklySummary(weekOf);
    if (!alreadyExists && summaryGeneratedThisWeek !== weekOf) {
      // Generate and persist summary
      const stats = dataService.getWeeklySummaryStats(weekOf);
      const deferred = dataService.getDeferredTasks(weekOf);
      const q2Texts = dataService.getReflectionsForWeek(weekOf);
      const recurringTopic = extractTopKeyword(q2Texts);
      dataService.saveWeeklySummary(weekOf, now.toISOString(), { ...stats, deferred_tasks: deferred, recurring_topic: recurringTopic });

      // Notify (D-03) — no click handler
      new Notification({
        title: 'TaskMate',
        body: 'Your weekly summary is ready',
      }).show();

      summaryGeneratedThisWeek = weekOf;
    }
  }
}
```

### Pattern 2: DataService Summary Methods

**What:** Three query methods for summary generation, two for UI retrieval, two for Settings screen.

**Week boundary computation:** Use JS `startOfWeek` to produce `week_start` and `week_end` as ISO date strings, then pass as parameters to SQL. This avoids relying on SQLite's `localtime` modifier against UTC-stored timestamps.

```typescript
// Source: data-service.ts pattern — synchronous better-sqlite3 prepare/run
getWeeklySummaryStats(weekOf: string): { tasks_created: number; tasks_completed: number; completion_rate: number } {
  // weekOf = Monday ISO date e.g. "2026-03-16"
  // weekEnd = following Monday e.g. "2026-03-23" — computed in caller via addDays(parseISO(weekOf), 7)
  const weekEnd = /* passed as param */;
  const created = (this.db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE created_at >= ? AND created_at < ?"
  ).get(weekOf + 'T00:00:00.000Z', weekEnd + 'T00:00:00.000Z') as { c: number }).c;

  const completed = (this.db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE completed = 1 AND completed_at >= ? AND completed_at < ?"
  ).get(weekOf + 'T00:00:00.000Z', weekEnd + 'T00:00:00.000Z') as { c: number }).c;

  const completion_rate = created === 0 ? 0 : Math.round((completed / created) * 100);
  return { tasks_created: created, tasks_completed: completed, completion_rate };
}

getDeferredTasks(weekOf: string): Array<{ title: string; days: number }> {
  // Incomplete tasks created before this Monday
  const rows = this.db.prepare(
    "SELECT title, created_at FROM tasks WHERE completed = 0 AND created_at < ? ORDER BY created_at ASC"
  ).all(weekOf + 'T00:00:00.000Z') as Array<{ title: string; created_at: string }>;
  const now = Date.now();
  return rows.map(r => ({
    title: r.title,
    days: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
  }));
}
```

**Critical note on timestamp comparison:** `created_at` is stored as UTC ISO strings (`new Date().toISOString()`). Week boundaries must also be expressed as UTC midnight strings to compare correctly against stored values. Appending `T00:00:00.000Z` to the week_of ISO date string achieves this when the local timezone is at or ahead of UTC. For users in UTC-offset timezones, the "week" in data will be offset from the "week" in local time. The decisions in CONTEXT.md use JS computation (`startOfWeek`) for the Monday date — this is fine for the key stored in `weekly_summaries.week_of`, but the SQL WHERE clauses must account for the UTC/local mismatch. The safest approach: compute week_start and week_end as UTC midnight of the local Monday/Sunday in the main process (JS), pass as ISO strings to SQL. Do NOT use SQLite `date('now', 'localtime')` in queries that compare against UTC-stored timestamps.

### Pattern 3: Pure-JS Keyword Extraction

**What:** Single utility function, no npm dependency. Lives in `src/main/keyword-extractor.ts`.

```typescript
// Source: D-15, D-16, D-17 in CONTEXT.md
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'it', 'is', 'was', 'i', 'my', 'me', 'we', 'our', 'that',
  'this', 'not', 'so', 'just', 'very', 'really', 'too', 'up', 'out', 'if',
  'be', 'do', 'did', 'had', 'has', 'have', 'been', 'were', 'are', 'am',
  'what', 'when', 'how', 'would', 'could', 'should', 'also', 'which',
  'there', 'their', 'they', 'you', 'your', 'him', 'her', 'his', 'its',
  'about', 'than', 'then', 'like', 'more', 'most', 'some', 'any', 'no',
]);

export function extractTopKeyword(texts: string[]): string | null {
  const freq: Record<string, number> = {};
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 0 && !STOP_WORDS.has(w));
    for (const w of words) {
      freq[w] = (freq[w] ?? 0) + 1;
    }
  }
  const entries = Object.entries(freq);
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
}
```

### Pattern 4: Zustand Store for Weekly Summaries

**What:** Mirror `useReflectionStore.ts` exactly. Load all summaries on mount, track selected week index locally in the screen component (not in the store).

```typescript
// Source: src/renderer/stores/useReflectionStore.ts — replicate structure
export interface WeeklySummaryRecord {
  week_of: string;
  generated_at: string;
  data: string; // JSON string — parse on read
}

interface WeeklySummaryStore {
  summaries: WeeklySummaryRecord[];
  isLoading: boolean;
  loadSummaries: () => Promise<void>;
}

export const useWeeklySummaryStore = create<WeeklySummaryStore>((set) => ({
  summaries: [],
  isLoading: false,
  loadSummaries: async () => {
    set({ isLoading: true });
    const summaries = await window.taskmate.getAllWeeklySummaries();
    set({ summaries, isLoading: false });
  },
}));
```

### Pattern 5: IPC Handler Extension

**What:** Add summary and data management handlers following the exact `ipcMain.handle` pattern in `ipc-handlers.ts`.

New channels to add:
- `summary:getAll` → `dataService.getAllWeeklySummaries()`
- `data:getStats` → `dataService.getDataStats()`
- `data:export` → triggers `dialog.showSaveDialog` + `fs.writeFileSync` in main process
- `data:deleteAll` → `dataService.deleteAllData()`

**Critical:** `data:export` requires `dialog` from `electron` — this must be imported in `ipc-handlers.ts`. The dialog and fs operations run in the main process only; never attempt `dialog.showSaveDialog` in the renderer.

### Pattern 6: WeeklySummary Screen Layout

**What:** Text-only, four sections. Matches minimalist Phase 04.1 conventions: `px-6 py-6`, `text-2xl font-semibold`, `text-muted-foreground` for secondary text, `border-b border-border` row style if using a week selector list.

Past week selector: a `<select>` element is simpler and accessible; use `className="text-sm text-muted-foreground bg-background border border-border rounded px-2 py-1"` to keep it flat. The select's options are generated from `summaries.map(s => s.week_of)`.

```tsx
// Source: D-26 layout + Phase 04.1 Tailwind conventions
<div className="min-h-screen bg-background">
  <div className="px-6 py-6">
    <h1 className="text-2xl font-semibold mb-4">Summary</h1>
    {/* Week selector */}
    {/* Week of heading */}
    {/* This week section */}
    {/* Still waiting section */}
    {/* Recurring topic section */}
  </div>
</div>
```

### Pattern 7: Settings Screen

**What:** Utility screen — same shell as AddTask/EditTask (no nav bar, back button in header, full-width form area).

**Export flow:**
1. Renderer calls `window.taskmate.exportData()` via IPC
2. Main process handler calls `dialog.showSaveDialog(mainWindow, { defaultPath: 'taskmate-export.json', filters: [{ name: 'JSON', extensions: ['json'] }] })`
3. On confirmation, serialize all tasks + reflections + summaries to JSON, `fs.writeFileSync(filePath, JSON.stringify(data, null, 2))`
4. Return `{ success: true }` to renderer

**Delete all flow:** Reuse `showDeleteConfirm` local state pattern from EditTask. Show confirmation text inline. On confirm: call `window.taskmate.deleteAll()`, then reload task store and navigate back to `/`.

### Anti-Patterns to Avoid

- **Do not use `date('now', 'weekday 1', '-7 days', 'localtime')` in SQL WHERE clauses against UTC timestamps.** Only use this pattern for the `weekly_summaries.week_of` key lookup. All range comparisons must use JS-computed UTC boundary strings.
- **Do not compute `week_of` in the renderer.** The scheduler (main process) owns summary generation. The renderer is read-only for summaries.
- **Do not add `summaryGeneratedThisWeek` to the scheduler module's exported API.** It is internal module state, same as `reflectionFiredToday`.
- **Do not render `data` column raw.** Always `JSON.parse(record.data)` before accessing fields. Type the parsed shape with an interface.
- **Do not use `dialog` in the renderer process.** It only works in the main process. Always go through IPC.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week start computation | Manual date math | `startOfWeek(date, { weekStartsOn: 1 })` from date-fns | DST edge cases, off-by-one on Monday itself |
| Day-of-week check | Bitwise or modulo | `isSunday(date)` from date-fns | Already installed; readable |
| ISO date formatting | String template | `format(date, 'MMMM d')` from date-fns | Locale-aware, handles padding |
| File save dialog | Custom renderer UI | `dialog.showSaveDialog` from Electron | Platform-native save dialog; sandboxing requirement |
| Stop-word NLP | External package | Inline Set in `keyword-extractor.ts` | Zero dependency cost; list is locked by D-16 |

**Key insight:** The entire phase is extension, not invention. The hard problems (scheduling, persistence, IPC, routing) are already solved; this phase wires them in a new configuration.

---

## Common Pitfalls

### Pitfall 1: UTC/Local Timestamp Mismatch in Week Boundary Queries

**What goes wrong:** Using `date('now', 'localtime')` or local-date strings in SQL WHERE clauses against `created_at` / `completed_at` values that are stored as UTC ISO strings (e.g., `"2026-03-16T23:30:00.000Z"`). A task created at 11:30 PM UTC on Sunday might appear in Monday's "week" depending on local timezone.

**Why it happens:** `new Date().toISOString()` produces UTC. SQLite stores this as text. When you query `created_at >= '2026-03-16'`, SQLite does a text comparison — `'2026-03-16T23:30:00.000Z' >= '2026-03-16'` is TRUE but `'2026-03-15T22:00:00.000Z' >= '2026-03-16'` is FALSE, even though 10 PM UTC on March 15 might be Monday morning locally.

**How to avoid:** Compute week_start and week_end as full UTC midnight strings in the JS main process: `weekStartIso + 'T00:00:00.000Z'` and `weekEndIso + 'T00:00:00.000Z'`. Pass these as SQL parameters. For most users (UTC+0 to UTC+12 timezones), this means week boundaries are offset by timezone hours but are internally consistent.

**Warning signs:** Task counts in summaries are slightly off from what the user expects for tasks created late Sunday or early Monday night.

### Pitfall 2: Double-Generation on Power Resume

**What goes wrong:** `powerMonitor.on('resume', tick)` fires `tick()` immediately on wake. If the device wakes at 20:01 on a Sunday and the summary was already generated at 20:00, the guard must prevent a second generation.

**Why it happens:** The `tick()` function runs on resume with no cooldown. `reflectionFiredToday` pattern prevents this for reflections. The same guard (`summaryGeneratedThisWeek`) must be set before the `Notification.show()` call, not after.

**How to avoid:** Set `summaryGeneratedThisWeek = weekOf` immediately after `saveWeeklySummary()` succeeds and before `new Notification(...).show()`. Also, `hasWeeklySummary(weekOf)` queries the DB — this is the backup guard that persists across app restarts.

**Warning signs:** Duplicate rows in `weekly_summaries` — impossible due to `week_of TEXT PRIMARY KEY` constraint, but the Notification could fire twice.

### Pitfall 3: JSON Parse Errors in WeeklySummary Screen

**What goes wrong:** `JSON.parse(record.data)` throws if `data` column is malformed. The WeeklySummary screen crashes.

**Why it happens:** If `saveWeeklySummary` is ever called with a non-serializable value, or if the DB is manually edited.

**How to avoid:** Wrap `JSON.parse(record.data)` in a try/catch in the store's `loadSummaries` action. Filter out or flag records that fail parsing. Type the parsed object with a `WeeklySummaryData` interface to catch shape mismatches at compile time.

### Pitfall 4: `dialog.showSaveDialog` in Renderer

**What goes wrong:** Importing `dialog` from `electron` in renderer code throws at runtime — `dialog` is main-process only.

**Why it happens:** Electron splits APIs between main and renderer process. Renderer code running in Vite sees `electron` in node_modules but `dialog` is undefined when accessed from renderer context.

**How to avoid:** The export handler lives entirely in `ipc-handlers.ts` (main process). The renderer calls `window.taskmate.exportData()` and receives `{ success: boolean; path?: string }`.

### Pitfall 5: `isSunday` Incorrectly Checking for Generation Window

**What goes wrong:** If `tick()` fires at `20:00` and the check is `currentHHMM >= '20:00'` with an `isSunday(now)` check, but the summary generation takes several hundred milliseconds, the next `tick()` at `20:01` will attempt to generate again (before `summaryGeneratedThisWeek` module var is set if async).

**Why it happens:** `DataService` methods are synchronous (`better-sqlite3` is sync). There is no async gap. Setting `summaryGeneratedThisWeek = weekOf` before returning from the block is sufficient.

**How to avoid:** Keep summary generation fully synchronous (DataService methods are already sync). Set the module guard variable as the first action inside the `if (!alreadyExists && summaryGeneratedThisWeek !== weekOf)` block, before queries.

### Pitfall 6: `<select>` for Past Week Selector Inherits OS Styling on macOS

**What goes wrong:** Native `<select>` elements on macOS Electron look different from the minimalist flat design.

**Why it happens:** Electron renders using Chromium but OS native form controls vary. macOS applies system appearance to `<select>`.

**How to avoid:** Apply `appearance-none` (or Tailwind's `appearance-none` class) and provide custom styling. Alternatively, use a simple `<ul>` of week labels with click-to-select — Claude's Discretion area per CONTEXT.md.

---

## Code Examples

### Computing Week Boundaries in JS (Main Process)

```typescript
// Source: date-fns docs (verified installed v4.1.0)
import { startOfWeek, addDays, format } from 'date-fns';

function getWeekBounds(now: Date): { weekOf: string; weekStart: string; weekEnd: string } {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const nextMonday = addDays(monday, 7);
  return {
    weekOf: format(monday, 'yyyy-MM-dd'),
    weekStart: monday.toISOString(),   // UTC midnight of Monday local date
    weekEnd: nextMonday.toISOString(), // UTC midnight of following Monday local date
  };
}
```

### hasWeeklySummary Check (DataService)

```typescript
// Source: mirrors hasReflection() in data-service.ts
hasWeeklySummary(weekOf: string): boolean {
  const row = this.db.prepare(
    'SELECT COUNT(*) as count FROM weekly_summaries WHERE week_of = ?'
  ).get(weekOf) as { count: number };
  return row.count > 0;
}
```

### getAllWeeklySummaries (DataService)

```typescript
getAllWeeklySummaries(): Array<{ week_of: string; generated_at: string; data: string }> {
  return this.db.prepare(
    'SELECT * FROM weekly_summaries ORDER BY week_of DESC'
  ).all() as Array<{ week_of: string; generated_at: string; data: string }>;
}
```

### saveWeeklySummary (DataService)

```typescript
saveWeeklySummary(weekOf: string, generatedAt: string, payload: object): void {
  this.db.prepare(
    'INSERT OR REPLACE INTO weekly_summaries (week_of, generated_at, data) VALUES (?, ?, ?)'
  ).run(weekOf, generatedAt, JSON.stringify(payload));
}
```

### getDataStats for Settings Screen (DataService)

```typescript
getDataStats(): {
  tasksTotal: number;
  reflectionsTotal: number;
  reflectionsFrom: string | null;
  reflectionsTo: string | null;
  summariesTotal: number;
} {
  const tasksTotal = (this.db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number }).c;
  const refRow = this.db.prepare(
    'SELECT COUNT(*) as c, MIN(date) as from_d, MAX(date) as to_d FROM reflections'
  ).get() as { c: number; from_d: string | null; to_d: string | null };
  const summariesTotal = (this.db.prepare(
    'SELECT COUNT(*) as c FROM weekly_summaries'
  ).get() as { c: number }).c;
  return {
    tasksTotal,
    reflectionsTotal: refRow.c,
    reflectionsFrom: refRow.from_d,
    reflectionsTo: refRow.to_d,
    summariesTotal,
  };
}
```

### deleteAllData (DataService)

```typescript
deleteAllData(): void {
  this.db.transaction(() => {
    this.db.prepare('DELETE FROM tasks').run();
    this.db.prepare('DELETE FROM reflections').run();
    this.db.prepare('DELETE FROM weekly_summaries').run();
  })();
}
```

### Export IPC Handler (ipc-handlers.ts)

```typescript
// Source: Electron docs — dialog.showSaveDialog must be in main process
import { ipcMain, dialog } from 'electron';
import fs from 'fs';

ipcMain.handle('data:export', async (_event) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'taskmate-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return { success: false };

  const tasks = dataService.getAllTasksForExport();   // new method — SELECT * FROM tasks
  const reflections = dataService.getAllReflections();
  const summaries = dataService.getAllWeeklySummaries();
  fs.writeFileSync(filePath, JSON.stringify({ tasks, reflections, summaries }, null, 2), 'utf8');
  return { success: true, filePath };
});
```

### Past Week Selector in WeeklySummary Screen

```tsx
// Source: D-25, Claude's Discretion — simple <select> approach
const [selectedIndex, setSelectedIndex] = useState(0);
const summary = summaries[selectedIndex];
const data: WeeklySummaryData = JSON.parse(summary.data);

<select
  className="appearance-none text-sm text-muted-foreground bg-background border border-border rounded px-2 py-1 mb-6"
  value={selectedIndex}
  onChange={(e) => setSelectedIndex(Number(e.target.value))}
>
  {summaries.map((s, i) => (
    <option key={s.week_of} value={i}>
      Week of {format(parseISO(s.week_of), 'MMMM d')}
    </option>
  ))}
</select>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node-cron` v3 with `.schedule()` return value as stop handle | v4.2.x same API surface; `noOverlap` option confirmed supported | v4.0 (2024) | No impact — existing code uses noOverlap correctly |
| `date-fns` v2 `startOfWeek` signature | v4 same signature — `{ weekStartsOn: 1 }` | v3 (2023) | No impact — identical API |
| Electron `dialog.showSaveDialog` callback style | Promise-based since Electron 6 | 2019 | Already Promise — use `await dialog.showSaveDialog(...)` |
| `better-sqlite3` v8 | v12.8.0 — same synchronous API | Incremental | No API changes affect this phase |

**Deprecated/outdated:**
- `dialog.showSaveDialog(callback)` callback style: replaced by Promise. Current code must use `await`. (Electron 6+, 2019)

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |
| Test directory | `src/__tests__/` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SUMMARY-01 | Sunday 20:00 tick generates summary and fires notification | unit | `npx vitest run --reporter=verbose src/__tests__/reminder-scheduler.test.ts` | ❌ Wave 0 — extend existing file |
| SUMMARY-01 | Guard: second tick on same Sunday does not regenerate | unit | same | ❌ Wave 0 |
| SUMMARY-02 | `getWeeklySummaryStats` returns correct counts for a seeded DB | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ Wave 0 — extend existing file |
| SUMMARY-02 | `getDeferredTasks` returns tasks with `created_at < week_start` with correct `days` | unit | same | ❌ Wave 0 |
| SUMMARY-02 | `completion_rate` is 0 when `tasks_created = 0` | unit | same | ❌ Wave 0 |
| SUMMARY-03 | `extractTopKeyword` returns top word after stop-word removal | unit | `npx vitest run --reporter=verbose src/__tests__/keyword-extractor.test.ts` | ❌ Wave 0 — new file |
| SUMMARY-03 | `extractTopKeyword` returns `null` when all words are stop words | unit | same | ❌ Wave 0 |
| SUMMARY-03 | `extractTopKeyword` returns `null` for empty input array | unit | same | ❌ Wave 0 |
| SUMMARY-04 | WeeklySummary screen renders empty state text | manual | Visual inspection | N/A |
| SUMMARY-05 | `saveWeeklySummary` + `getAllWeeklySummaries` round-trips correctly | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ Wave 0 |
| SUMMARY-05 | `hasWeeklySummary` returns true after save, false before | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/keyword-extractor.test.ts` — new file; covers SUMMARY-03 (extractTopKeyword unit tests)
- [ ] `src/__tests__/data-service.test.ts` — extend existing file with new `describe` blocks: `getWeeklySummaryStats`, `getDeferredTasks`, `saveWeeklySummary`, `hasWeeklySummary`, `getAllWeeklySummaries`, `getDataStats`, `deleteAllData`
- [ ] `src/__tests__/reminder-scheduler.test.ts` — extend existing file with Sunday 20:00 weekly summary trigger tests (mock `isSunday`, `startOfWeek`, `DataService.hasWeeklySummary`, `DataService.saveWeeklySummary`, `Notification`)

The existing mock infrastructure in `reminder-scheduler.test.ts` (MockNotification, vi.mock('electron'), vi.mock('node-cron'), vi.resetModules pattern) is directly reusable for the new scheduler tests.

---

## Open Questions

1. **UTC/local mismatch for non-UTC users**
   - What we know: `created_at` is UTC; week boundaries computed in JS local time; users in UTC-5 would have Monday start at 05:00 UTC — tasks created between midnight and 5 AM local Monday would appear in the prior week's stats.
   - What's unclear: Whether this is an acceptable UX tradeoff for v1 (probably yes — the app is personal/local-first).
   - Recommendation: Implement with JS-computed UTC boundaries (most predictable and testable); document the behavior as "weeks based on your system's Monday midnight" if user-facing text is needed.

2. **`getAllTasksForExport` method scope**
   - What we know: Existing `getAllTasks()` only returns incomplete tasks (`WHERE completed = 0`).
   - What's unclear: Export should presumably include completed tasks. A new `getAllTasksForExport()` with no WHERE filter is needed.
   - Recommendation: Add `getAllTasksForExport(): Task[]` to DataService in Plan 05-01 alongside other new methods.

3. **Settings screen back navigation after Delete all**
   - What we know: After deleting all data, the task store is empty. Navigating to `/` will show EmptyState — correct behavior.
   - What's unclear: Should the store be reloaded (`loadTasks()`) before navigating, or after?
   - Recommendation: Call `loadTasks()` from useTaskStore before `navigate('/')` to ensure TodayView sees the cleared state immediately.

---

## Sources

### Primary (HIGH confidence)
- Existing `src/main/reminder-scheduler.ts` — scheduler extension pattern (direct code read)
- Existing `src/main/data-service.ts` — DataService methods and better-sqlite3 usage (direct code read)
- Existing `src/main/ipc-handlers.ts` — IPC handler pattern (direct code read)
- Existing `src/preload/preload.ts` — contextBridge exposure pattern (direct code read)
- Existing `src/renderer/App.tsx` — routing and nav bar pattern (direct code read)
- Existing `src/renderer/stores/useReflectionStore.ts` — Zustand store pattern (direct code read)
- Existing `src/renderer/screens/ReflectionsHistory.tsx` — screen layout reference (direct code read)
- `package.json` — confirmed installed versions of all dependencies (direct read)
- `vitest.config.ts` — confirmed test framework configuration (direct read)
- `src/__tests__/data-service.test.ts` — confirmed test pattern (DataService mock, tmp dir) (direct read)
- `src/__tests__/reminder-scheduler.test.ts` — confirmed scheduler mock pattern (direct read)

### Secondary (MEDIUM confidence)
- date-fns v4 API: `startOfWeek`, `isSunday`, `format`, `parseISO`, `addDays` — confirmed same API as v3 based on package.json version `^4.1.0` and general stability of these functions
- Electron `dialog.showSaveDialog` Promise API — confirmed Promise-based since Electron 6; current project uses Electron 41.0.3

### Tertiary (LOW confidence)
- None — all claims in this document are verified against the project's actual source files or package.json.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and in use; no new dependencies
- Architecture: HIGH — all patterns directly derived from existing code in the codebase
- Pitfalls: HIGH (UTC/local), MEDIUM (others) — UTC mismatch is a well-known SQLite pattern; other pitfalls derived from existing scheduler code structure
- Keyword extraction: HIGH — pure-JS algorithm with locked stop-word list; no external dependencies to verify

**Research date:** 2026-03-22
**Valid until:** 2026-05-22 (stable tech stack; no fast-moving dependencies)
