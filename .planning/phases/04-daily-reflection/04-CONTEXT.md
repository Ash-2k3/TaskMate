# Phase 4: Daily Reflection - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Trigger a 3-question reflection modal at 9 PM daily, save responses to SQLite by ISO date, support snooze (30 min), enforce at-least-1-answer before full dismiss, catch up on next open if missed, and expose a reflection history screen accessible via a basic nav bar. Creating tasks and reminders are already done in Phases 2 and 3.

</domain>

<decisions>
## Implementation Decisions

### Modal presentation
- **D-01:** Reflection prompt uses a shadcn Dialog overlay rendered in `App.tsx` — not a dedicated route
- **D-02:** App.tsx owns the event listener (`onReflectionPrompt`) and the `reflectionOpen` open/close state; `ReflectionModal` is rendered as a sibling to `<Routes>`
- **D-03:** Dialog is fully blocking — `modal=true`, no outside-click dismiss; user must answer ≥1 question or snooze to close
- **D-04:** No navigation occurs when the modal opens — user remains on whatever screen they were on

### Snooze mechanics
- **D-05:** Snooze state is persisted in `settingsStore` as `snoozeUntil: string | null` (ISO timestamp) — added to the existing `Settings` schema
- **D-06:** When user hits "Snooze 30 min": set `settingsStore.snoozeUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()`, close the modal
- **D-07:** The existing per-minute cron tick function in `reminder-scheduler.ts` is extended to also check the reflection trigger — same tick, not a second cron job
- **D-08:** Reflection cron logic in tick: if currentHHMM >= '21:00' AND today's reflection is not saved AND (snoozeUntil is null OR now >= snoozeUntil) → send `prompt:reflection` IPC to renderer; clear `snoozeUntil` after triggering
- **D-09:** If user restarts app before snooze expires: startup catch-up check fires immediately (REFLECT-06 behavior — snooze does not block catch-up on next open)
- **D-10:** `snoozeUntil` is cleared from settingsStore when a reflection is successfully saved

### Reflection trigger — cron and startup
- **D-11:** Cron fires `prompt:reflection` event at most once per day — guarded by `dataService.hasReflection(todayDate)` check each tick
- **D-12:** On app startup, if current local time > '21:00' AND today's reflection is not saved: send `prompt:reflection` immediately (REFLECT-06 catch-up)
- **D-13:** `dataService.hasReflection(dateStr: string): boolean` — SELECT count from reflections WHERE date = ?
- **D-14:** `dataService.getCompletedTaskCountToday(): number` — SELECT COUNT(*) from tasks WHERE completed = 1 AND date(completed_at) = date('now', 'localtime') — used for Q1 pre-fill
- **D-15:** `dataService.saveReflection(date: string, q1: string | null, q2: string | null, q3: string | null): void` — INSERT OR REPLACE INTO reflections

### Modal questions and pre-fill
- **D-16:** 3 fixed questions in order (grounding → learning → forward-intention):
  1. `"You finished {N} tasks today. What else did you actually finish, even if it wasn't on your list?"`
  2. `"What slowed you down most today, and was it avoidable?"`
  3. `"What is the one thing you'll protect time for tomorrow?"`
- **D-17:** Q1 textarea is pre-filled with the question text only; the `{N}` count is fetched via `dataService.getCompletedTaskCountToday()` called when the modal opens
- **D-18:** Unanswered questions are saved as `null` in the reflections table (q1/q2/q3 are already nullable in schema)

### Save / dismiss behavior
- **D-19:** Explicit "Save reflection" button — disabled until ≥1 textarea has non-empty text
- **D-20:** Button label is dynamic: `"Save (N/3 answered)"` where N = count of non-empty textareas; updates live as user types
- **D-21:** On Save: call `reflections:save` IPC, close modal, clear `snoozeUntil` in settingsStore
- **D-22:** "Snooze 30 min" button always visible as secondary action — persists snoozeUntil, closes modal
- **D-23:** No escape key / outside-click dismiss — blocked by `modal=true` shadcn Dialog prop

### Zustand store (useReflectionStore)
- **D-24:** New `useReflectionStore` in `src/renderer/stores/useReflectionStore.ts` with:
  - `reflections: ReflectionRecord[]` — loaded for history screen
  - `loadReflections(): Promise<void>` — calls `reflections:getAll` IPC
  - `saveReflection(date, q1, q2, q3): Promise<void>` — calls `reflections:save` IPC
  - `hasToday: boolean` — derived from whether today's ISO date exists in reflections
- **D-25:** `ReflectionRecord` type: `{ date: string; q1: string | null; q2: string | null; q3: string | null; completed_at: string }`

### IPC additions
- **D-26:** New IPC handler `reflections:getAll` — returns all reflections ordered by date DESC (replaces Phase 1 stub for `reflections:get`)
- **D-27:** `reflections:save` stub replaced with real implementation calling `dataService.saveReflection(date, q1, q2, q3)`
- **D-28:** New IPC handler `reflections:hasToday` — calls `dataService.hasReflection(todayDate)`, returns boolean
- **D-29:** `reflections:getCompletedCountToday` — calls `dataService.getCompletedTaskCountToday()`, returns number

### Navigation bar
- **D-30:** Add a minimal bottom nav bar to the app layout with two tabs: "Today" (→ `/`) and "Reflections" (→ `/reflections`)
- **D-31:** Nav bar renders in `App.tsx` as a persistent sibling to `<Routes>` — always visible at bottom
- **D-32:** Active tab indicated by color/underline using the existing indigo/primary theme; no animations (PROJECT.md no-animation constraint)
- **D-33:** Nav bar is only shown when on route `/` or `/reflections` — hidden on `/add` and `/edit/:id` (full-screen utility screens)

### Reflection history screen (/reflections)
- **D-34:** New route `/reflections` → `ReflectionsHistory` screen in `src/renderer/screens/ReflectionsHistory.tsx`
- **D-35:** Screen shows a read-only list of past reflection dates — collapsed by default; click a date row to expand and reveal Q1/Q2/Q3 answers
- **D-36:** Date format: `"Monday, March 22"` (date-fns `format(date, 'EEEE, MMMM d')`) — consistent with TodayView header
- **D-37:** Unanswered questions (null) shown as `"—"` (em dash) in expanded view
- **D-38:** Empty state when no reflections saved yet: text "No reflections yet. Your first will appear here after tonight."

### Claude's Discretion
- Exact CSS/Tailwind classes for the dialog, nav bar, and history screen (consistent with existing indigo theme + shadcn/ui)
- Textarea resize behavior in the reflection modal
- Exact positioning of the Snooze vs Save buttons in modal footer
- Loading skeleton for history screen while fetching

</decisions>

<specifics>
## Specific Ideas

- Q1 pre-fill shows actual completed task count: "You finished 3 tasks today. What else did you actually finish..."
- Nav bar is minimal — 2 tabs only (Today, Reflections); no icons required unless they improve clarity
- History list: collapsed by default with date as accordion trigger; expanding reveals all 3 answers with question labels

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema and data layer (already exists — extend, don't recreate)
- `src/main/data-service.ts` — reflections table already defined (date, q1, q2, q3, completed_at); new methods: hasReflection, getCompletedTaskCountToday, saveReflection (full impl)
- `src/main/settings-store.ts` — add snoozeUntil: string | null to Settings schema; lastSeenReflectionDate already present (may be redundant with hasReflection)
- `src/main/ipc-handlers.ts` — replace reflection stubs with real handlers; add reflections:getAll, reflections:hasToday, reflections:getCompletedCountToday
- `src/preload/preload.ts` — onReflectionPrompt already exposed; add getReflections, hasReflectionToday, getCompletedCountToday

### Scheduler (extend, not replace)
- `src/main/reminder-scheduler.ts` — extend tick() function to include 9 PM reflection trigger logic; read settingsStore.snoozeUntil in tick

### Renderer structure (integration points)
- `src/renderer/App.tsx` — add ReflectionModal + nav bar here; owns reflectionOpen state and event listener
- `src/renderer/stores/useTaskStore.ts` — pattern to follow for useReflectionStore
- `src/renderer/screens/TodayView.tsx` — no direct changes needed; nav bar added at App level

### Requirements
- `.planning/REQUIREMENTS.md` §Daily Reflection — REFLECT-01 through REFLECT-06 (all must be satisfied)

### Prior phase context (patterns to follow)
- `.planning/phases/03-reminders-and-scheduling/03-CONTEXT.md` — scheduler extension pattern, IPC registration pattern, catch-up indicator pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shadcn Dialog` — install via shadcn CLI (`npx shadcn@latest add dialog`); Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter already available once added
- `useTaskStore.ts` — Zustand store pattern to replicate for useReflectionStore (create, async actions, IPC calls)
- `TodayView.tsx` — catch-up banner pattern (useEffect on mount → IPC call) for startup catch-up check in App.tsx
- `Button` component — reuse for Save and Snooze buttons in modal footer

### Established Patterns
- IPC: `ipcMain.handle` in `ipc-handlers.ts`, registered via `registerIpcHandlers(dataService)`
- Preload: every IPC channel used by renderer must be exposed via `contextBridge` in `preload.ts`
- State persistence: reflection data uses SQLite; transient UI state (modal open/closed) is React state in App.tsx
- No animations — PROJECT.md constraint; use `duration-0` or avoid transition classes
- `date-fns` format is already imported in TodayView — use same import for date formatting in history screen

### Integration Points
- `App.tsx` — ReflectionModal and nav bar mount here; event listener registered in useEffect with cleanup return
- `reminder-scheduler.ts` tick() — reflection check added after existing reminder checks; needs access to dataService.hasReflection and settingsStore
- `index.ts` — startup catch-up check runs after `createWindow()` + `registerIpcHandlers()`, before scheduler init

</code_context>

<deferred>
## Deferred Ideas

- Configurable reflection time (default 9 PM) — v2 (REFLECT-V2-01)
- Customizable reflection questions — v2 (REFLECT-V2-02)
- Streak tracking for consecutive reflection days — v2 (SUMMARY-V2-02)
- Edit today's reflection after submitting — out of scope for v1
- Reflection export — v2 (DATA-V2-01)

</deferred>

---

*Phase: 04-daily-reflection*
*Context gathered: 2026-03-22*
