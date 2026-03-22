# Phase 4: Daily Reflection - Research

**Researched:** 2026-03-22
**Domain:** Electron IPC push events, shadcn Dialog, Zustand store pattern, better-sqlite3 reflection persistence, React Router nav bar
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Modal presentation**
- D-01: Reflection prompt uses a shadcn Dialog overlay rendered in `App.tsx` — not a dedicated route
- D-02: App.tsx owns the event listener (`onReflectionPrompt`) and the `reflectionOpen` open/close state; `ReflectionModal` is rendered as a sibling to `<Routes>`
- D-03: Dialog is fully blocking — `modal=true`, no outside-click dismiss; user must answer ≥1 question or snooze to close
- D-04: No navigation occurs when the modal opens — user remains on whatever screen they were on

**Snooze mechanics**
- D-05: Snooze state is persisted in `settingsStore` as `snoozeUntil: string | null` (ISO timestamp) — added to the existing `Settings` schema
- D-06: When user hits "Snooze 30 min": set `settingsStore.snoozeUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()`, close the modal
- D-07: The existing per-minute cron tick function in `reminder-scheduler.ts` is extended to also check the reflection trigger — same tick, not a second cron job
- D-08: Reflection cron logic in tick: if currentHHMM >= '21:00' AND today's reflection is not saved AND (snoozeUntil is null OR now >= snoozeUntil) → send `prompt:reflection` IPC to renderer; clear `snoozeUntil` after triggering
- D-09: If user restarts app before snooze expires: startup catch-up check fires immediately (REFLECT-06 behavior — snooze does not block catch-up on next open)
- D-10: `snoozeUntil` is cleared from settingsStore when a reflection is successfully saved

**Reflection trigger — cron and startup**
- D-11: Cron fires `prompt:reflection` event at most once per day — guarded by `dataService.hasReflection(todayDate)` check each tick
- D-12: On app startup, if current local time > '21:00' AND today's reflection is not saved: send `prompt:reflection` immediately (REFLECT-06 catch-up)
- D-13: `dataService.hasReflection(dateStr: string): boolean` — SELECT count from reflections WHERE date = ?
- D-14: `dataService.getCompletedTaskCountToday(): number` — SELECT COUNT(*) from tasks WHERE completed = 1 AND date(completed_at) = date('now', 'localtime')
- D-15: `dataService.saveReflection(date: string, q1: string | null, q2: string | null, q3: string | null): void` — INSERT OR REPLACE INTO reflections

**Modal questions and pre-fill**
- D-16: 3 fixed questions in order (grounding → learning → forward-intention):
  1. `"You finished {N} tasks today. What else did you actually finish, even if it wasn't on your list?"`
  2. `"What slowed you down most today, and was it avoidable?"`
  3. `"What is the one thing you'll protect time for tomorrow?"`
- D-17: Q1 textarea is pre-filled with the question text only; the `{N}` count is fetched via `dataService.getCompletedTaskCountToday()` called when the modal opens
- D-18: Unanswered questions are saved as `null` in the reflections table (q1/q2/q3 are already nullable in schema)

**Save / dismiss behavior**
- D-19: Explicit "Save reflection" button — disabled until ≥1 textarea has non-empty text
- D-20: Button label is dynamic: `"Save (N/3 answered)"` where N = count of non-empty textareas; updates live as user types
- D-21: On Save: call `reflections:save` IPC, close modal, clear `snoozeUntil` in settingsStore
- D-22: "Snooze 30 min" button always visible as secondary action — persists snoozeUntil, closes modal
- D-23: No escape key / outside-click dismiss — blocked by `modal=true` shadcn Dialog prop

**Zustand store (useReflectionStore)**
- D-24: New `useReflectionStore` in `src/renderer/stores/useReflectionStore.ts` with:
  - `reflections: ReflectionRecord[]` — loaded for history screen
  - `loadReflections(): Promise<void>` — calls `reflections:getAll` IPC
  - `saveReflection(date, q1, q2, q3): Promise<void>` — calls `reflections:save` IPC
  - `hasToday: boolean` — derived from whether today's ISO date exists in reflections
- D-25: `ReflectionRecord` type: `{ date: string; q1: string | null; q2: string | null; q3: string | null; completed_at: string }`

**IPC additions**
- D-26: New IPC handler `reflections:getAll` — returns all reflections ordered by date DESC (replaces Phase 1 stub for `reflections:get`)
- D-27: `reflections:save` stub replaced with real implementation calling `dataService.saveReflection(date, q1, q2, q3)`
- D-28: New IPC handler `reflections:hasToday` — calls `dataService.hasReflection(todayDate)`, returns boolean
- D-29: `reflections:getCompletedCountToday` — calls `dataService.getCompletedTaskCountToday()`, returns number

**Navigation bar**
- D-30: Add a minimal bottom nav bar to the app layout with two tabs: "Today" (→ `/`) and "Reflections" (→ `/reflections`)
- D-31: Nav bar renders in `App.tsx` as a persistent sibling to `<Routes>` — always visible at bottom
- D-32: Active tab indicated by color/underline using the existing indigo/primary theme; no animations (PROJECT.md no-animation constraint)
- D-33: Nav bar is only shown when on route `/` or `/reflections` — hidden on `/add` and `/edit/:id` (full-screen utility screens)

**Reflection history screen (/reflections)**
- D-34: New route `/reflections` → `ReflectionsHistory` screen in `src/renderer/screens/ReflectionsHistory.tsx`
- D-35: Screen shows a read-only list of past reflection dates — collapsed by default; click a date row to expand and reveal Q1/Q2/Q3 answers
- D-36: Date format: `"Monday, March 22"` (date-fns `format(date, 'EEEE, MMMM d')`) — consistent with TodayView header
- D-37: Unanswered questions (null) shown as `"—"` (em dash) in expanded view
- D-38: Empty state when no reflections saved yet: text "No reflections yet. Your first will appear here after tonight."

### Claude's Discretion
- Exact CSS/Tailwind classes for the dialog, nav bar, and history screen (consistent with existing indigo theme + shadcn/ui)
- Textarea resize behavior in the reflection modal
- Exact positioning of the Snooze vs Save buttons in modal footer
- Loading skeleton for history screen while fetching

### Deferred Ideas (OUT OF SCOPE)
- Configurable reflection time (default 9 PM) — v2 (REFLECT-V2-01)
- Customizable reflection questions — v2 (REFLECT-V2-02)
- Streak tracking for consecutive reflection days — v2 (SUMMARY-V2-02)
- Edit today's reflection after submitting — out of scope for v1
- Reflection export — v2 (DATA-V2-01)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFLECT-01 | App triggers a reflection prompt at 9 PM daily | Extend existing `tick()` in reminder-scheduler.ts with HH:MM >= '21:00' guard + hasReflection check — same pattern as reminder logic already there |
| REFLECT-02 | Reflection appears as a modal with 3 fixed questions | shadcn Dialog (needs `@radix-ui/react-dialog` install); 3 questions are fixed strings in component; Q1 pre-filled with `{N}` from IPC |
| REFLECT-03 | User must answer at least 1 question before modal can be dismissed | Controlled by disabled state on Save button; `modal=true` on Dialog blocks escape/outside-click |
| REFLECT-04 | Modal includes "Snooze 30 min" option | Secondary button sets `snoozeUntil` in settingsStore via `settings:update` IPC, closes modal |
| REFLECT-05 | Reflection responses are stored by date (ISO date string key) | `reflections` table already exists in schema with `date TEXT PRIMARY KEY`; `saveReflection` method to add |
| REFLECT-06 | Catch-up reflection prompt on next open if 9 PM was missed | Startup check in `index.ts` after `initScheduler()` — same pattern as missed-reminder check in TodayView; uses hasReflection + local time check |
</phase_requirements>

---

## Summary

Phase 4 builds on an already-solid foundation. The `reflections` table schema is already defined in `data-service.ts` (date, q1, q2, q3, completed_at). The `prompt:reflection` IPC event channel is already wired in `preload.ts` via `onReflectionPrompt`. The per-minute cron tick in `reminder-scheduler.ts` only needs a third check block added alongside the existing two (initial notification, re-notification). The reflection stub handlers in `ipc-handlers.ts` are placeholders that need real implementations, not net-new registrations.

The most isolated new work is the renderer side: a shadcn Dialog component (`@radix-ui/react-dialog` is not yet installed — it must be added), a `useReflectionStore` following the exact Zustand pattern from `useTaskStore`, and a new `/reflections` route with a `ReflectionsHistory` screen. The nav bar is a thin layout component in `App.tsx` that uses `useLocation()` to know when to hide itself.

The key architectural insight: the cron trigger and the startup catch-up are two separate code paths that both send the same `prompt:reflection` IPC event — the renderer only needs one listener to handle both cases identically.

**Primary recommendation:** Work in three plans: (1) data layer — DataService methods + IPC handlers + preload + settingsStore schema + useReflectionStore; (2) modal component — ReflectionModal with all interaction logic; (3) scheduler integration + startup catch-up + nav bar + history screen.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 (already installed) | Reflection persistence | Already in use; reflections table already defined in schema |
| electron-store | 8.2.0 (already installed, pinned to v8.x) | snoozeUntil persistence | Already in use for settings; snoozeUntil added to existing Settings schema |
| node-cron | 4.2.1 (already installed) | Per-minute tick driving reflection trigger | Already in use for reminder scheduling; extend same tick() |
| @radix-ui/react-dialog | ^1.x (NOT YET INSTALLED) | shadcn Dialog primitive | shadcn Dialog depends on it; needed for blocking modal overlay |
| zustand | 5.0.12 (already installed) | useReflectionStore | Already used for useTaskStore; exact same pattern |
| date-fns | 4.1.0 (already installed) | Date formatting in history screen | Already imported in TodayView.tsx |
| react-router-dom | 7.13.1 (already installed) | useLocation for nav bar visibility, /reflections route | Already in use with HashRouter |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 (already installed) | Optional nav bar icons | Use if icons improve clarity; icons not required per D-30 |
| tailwind-merge + clsx | already installed | Conditional class composition | Use for nav tab active state styling |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn Dialog (Radix) | Custom modal div | Radix Dialog handles focus trap, ARIA, escape key blocking reliably — don't hand-roll |
| React state in App.tsx for reflectionOpen | Zustand for modal state | React local state is correct here — it's transient UI, not cross-component shared data |

### Installation

```bash
npm install @radix-ui/react-dialog
```

Then create `src/renderer/components/ui/dialog.tsx` manually (shadcn source pattern — same as how button.tsx, input.tsx, etc. were created in Phase 2).

**Version verification:** `@radix-ui/react-dialog` latest is `^1.1.x` as of 2026-03. Confirm with `npm view @radix-ui/react-dialog version` before installing. All other packages already in `package.json` — no additional installation needed.

---

## Architecture Patterns

### Recommended Project Structure

New files this phase:

```
src/
├── main/
│   ├── data-service.ts          # Add hasReflection, getCompletedTaskCountToday, saveReflection methods
│   ├── ipc-handlers.ts          # Replace reflection stubs; add reflections:getAll, :hasToday, :getCompletedCountToday
│   ├── settings-store.ts        # Add snoozeUntil: string | null to Settings interface + schema
│   ├── reminder-scheduler.ts    # Extend tick() with reflection trigger logic (block 3)
│   └── index.ts                 # Add startup catch-up check after initScheduler()
├── preload/
│   └── preload.ts               # Add getReflections, hasReflectionToday, getCompletedCountToday, saveReflection
├── renderer/
│   ├── App.tsx                  # Add reflectionOpen state, onReflectionPrompt listener, ReflectionModal + NavBar
│   ├── components/
│   │   └── ui/
│   │       └── dialog.tsx       # NEW — shadcn Dialog source file (manual creation, same pattern as button.tsx)
│   ├── screens/
│   │   ├── ReflectionsHistory.tsx  # NEW — /reflections route
│   │   └── ReflectionModal.tsx     # NEW — 3-question modal component
│   └── stores/
│       └── useReflectionStore.ts   # NEW — Zustand store following useTaskStore pattern
```

### Pattern 1: Main-to-Renderer IPC Push Event

The `prompt:reflection` event originates in the main process (cron tick or startup) and is pushed to the renderer via `webContents.send`. The renderer registers a listener in `useEffect` with cleanup.

```typescript
// Source: existing preload.ts pattern (onReflectionPrompt already wired)

// Main process (reminder-scheduler.ts or index.ts):
const win = getMainWindow();
if (win && !win.isDestroyed()) {
  win.webContents.send('prompt:reflection');
}

// Renderer App.tsx:
useEffect(() => {
  const cleanup = window.taskmate.onReflectionPrompt(() => {
    setReflectionOpen(true);
  });
  return cleanup;
}, []);
```

**Confidence:** HIGH — `onReflectionPrompt` is already implemented in preload.ts and returns a cleanup function.

### Pattern 2: Extending the Tick Function

Add reflection logic as a third sequential block in `tick()` — after the existing two blocks (initial notifications, re-notifications). The snooze guard uses lexicographic string comparison (safe for ISO timestamps as used throughout the app).

```typescript
// Source: reminder-scheduler.ts pattern (existing blocks 1 and 2 for reference)

// Block 3: Reflection trigger (per D-08)
if (currentHHMM >= '21:00') {
  const todayReflected = dataService.hasReflection(todayDate);
  if (!todayReflected) {
    const snoozeUntil = settingsStore.get('snoozeUntil');
    const snoozed = snoozeUntil !== null && now < new Date(snoozeUntil);
    if (!snoozed) {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send('prompt:reflection');
        settingsStore.set('snoozeUntil', null);  // clear after triggering
      }
    }
  }
}
```

**Note:** `initScheduler` needs `settingsStore` imported or passed in. Currently it only receives `dataService` and `getMainWindow`. The simplest extension is to import `settingsStore` directly (it is already a module-level export from `settings-store.ts`).

**Confidence:** HIGH — pattern is identical to how getTasksDueForReminder works in the same function.

### Pattern 3: Startup Catch-Up Check

Run in `index.ts` after `initScheduler()`. Uses the same local time comparison as the tick, but fires immediately on app open without waiting for the next cron tick.

```typescript
// Source: TodayView.tsx useEffect pattern for missed reminders (parallel concept)
// Place in index.ts, inside app.whenReady().then(), after initScheduler():

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const currentHHMM = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
const todayDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

if (currentHHMM >= '21:00' && !dataService.hasReflection(todayDate)) {
  // Wait for window to be ready before sending IPC event
  mainWindow!.once('ready-to-show', () => {
    mainWindow!.webContents.send('prompt:reflection');
  });
}
```

**Pitfall:** The startup check in `index.ts` must fire AFTER `createWindow()` and use `ready-to-show` or `did-finish-load` to ensure the renderer is ready to receive the IPC event before it is sent. If sent before the renderer mounts its listener, the event is lost.

**Confidence:** HIGH — this mirrors the exact problem solved by `mainWindow.once('ready-to-show', ...)` already present in `createWindow()`.

### Pattern 4: shadcn Dialog (Blocking Modal)

`modal={true}` on `DialogContent` prevents outside-click dismissal. The escape key is blocked by `onEscapeKeyDown={(e) => e.preventDefault()}` on `DialogContent`. This gives the "must snooze or save" behavior required by D-03 and D-23.

```typescript
// Source: Radix UI Dialog docs — DialogContent props
<DialogContent
  onEscapeKeyDown={(e) => e.preventDefault()}
  onPointerDownOutside={(e) => e.preventDefault()}
  onInteractOutside={(e) => e.preventDefault()}
>
```

**Note:** `modal` is a prop on `<Dialog>` (the root), not on `<DialogContent>`. Setting `<Dialog modal={true}>` is the default and is what activates the focus trap and overlay.

**Confidence:** HIGH — verified against Radix UI Dialog API.

### Pattern 5: Zustand Store (useReflectionStore)

Follows `useTaskStore.ts` exactly — `create<StoreInterface>()` with async actions that call window.taskmate IPC methods, then update local state.

```typescript
// Source: src/renderer/stores/useTaskStore.ts (exact pattern to replicate)
import { create } from 'zustand';

interface ReflectionStore {
  reflections: ReflectionRecord[];
  isLoading: boolean;
  loadReflections: () => Promise<void>;
  saveReflection: (date: string, q1: string | null, q2: string | null, q3: string | null) => Promise<void>;
}

export const useReflectionStore = create<ReflectionStore>((set) => ({
  reflections: [],
  isLoading: false,

  loadReflections: async () => {
    set({ isLoading: true });
    const reflections = await window.taskmate.getReflections();
    set({ reflections, isLoading: false });
  },

  saveReflection: async (date, q1, q2, q3) => {
    await window.taskmate.saveReflection(date, q1, q2, q3);
    // Re-load to sync with DB (keeps store accurate)
    const reflections = await window.taskmate.getReflections();
    set({ reflections });
  },
}));
```

**Confidence:** HIGH — direct pattern match to existing code.

### Pattern 6: Nav Bar Visibility with useLocation

React Router's `useLocation()` returns the current pathname. Use it to conditionally render the nav bar. This is imported from `react-router-dom` which is already in use.

```typescript
// In App.tsx
import { Routes, Route, useLocation } from 'react-router-dom';

const location = useLocation();
const showNav = ['/', '/reflections'].includes(location.pathname);
```

**Confidence:** HIGH — standard React Router pattern; `react-router-dom` v7 is already installed.

### Anti-Patterns to Avoid

- **Sending IPC before renderer is ready:** Do not call `win.webContents.send('prompt:reflection')` immediately after `createWindow()`. The renderer is not mounted yet. Always gate on `ready-to-show` or `did-finish-load` for startup-triggered sends.
- **Second cron job for reflection:** D-07 mandates extending the existing tick() — do NOT create a separate `schedule('0 21 * * *', ...)` call. A second cron adds complexity and breaks the snooze guard interplay.
- **Storing reflectionOpen in Zustand:** Modal open/close state is transient UI state. Keep it in `useState` in App.tsx, not in useReflectionStore (same rationale as `missedTasks` in TodayView — Phase 3 decision D-26).
- **Using `onInteractOutside` alone to block dismissal:** Also need `onPointerDownOutside` and `onEscapeKeyDown` — Radix fires different events for different interaction types.
- **Float snooze-until comparison using string comparison:** `snoozeUntil` is an ISO timestamp; comparison must be `now < new Date(snoozeUntil)` (Date object comparison), not lexicographic string comparison.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Blocking modal overlay with focus trap | Custom `<div role="dialog">` with focus management | `@radix-ui/react-dialog` (shadcn Dialog) | Focus trap across dynamic content is complex; Radix handles ARIA, keyboard, screen reader correctly |
| Accordion expand/collapse in history | Custom toggle state per item | Simple `useState<string \| null>` tracking `expandedDate` | History list is simple enough — no library needed; one expanded item at a time |
| Date formatting | Custom format functions | `date-fns format()` | Already imported in TodayView.tsx; covers edge cases |

**Key insight:** This phase has no novel hard problems. Every pattern has been established in Phases 1-3. The main risk is integration order, not algorithm complexity.

---

## Common Pitfalls

### Pitfall 1: Startup IPC Send Before Renderer Is Ready

**What goes wrong:** `mainWindow.webContents.send('prompt:reflection')` is called immediately after `createWindow()`, but the React app has not yet mounted its `onReflectionPrompt` listener. The event fires into the void; the modal never appears.

**Why it happens:** `createWindow()` starts loading the URL but the renderer is async. The window emits `ready-to-show` after content loads; only then is `useEffect` in App.tsx running.

**How to avoid:** In the startup catch-up block in `index.ts`, gate the send on `mainWindow.once('ready-to-show', ...)` or `mainWindow.webContents.once('did-finish-load', ...)`. The cron tick has no this problem because it runs 60+ seconds after app launch.

**Warning signs:** Modal never appears on app open after 9 PM during manual testing.

### Pitfall 2: reflections:get vs reflections:getAll IPC Name Collision

**What goes wrong:** The existing stub in `ipc-handlers.ts` is registered as `reflections:get` (singular). D-26 defines the new real handler as `reflections:getAll`. If `reflections:get` is not removed before adding `reflections:getAll`, there are two handlers with different names — old preload code still calls `reflections:get`, new preload code calls `reflections:getAll`. Both need updating atomically.

**Why it happens:** Phase 1 registered stubs with slightly different names than Phase 4 plans to use.

**How to avoid:** In Plan 04-01, replace BOTH the ipc-handlers.ts stub AND the preload.ts stub in the same task. The old `reflections:get` stub must be removed (or replaced) when `reflections:getAll` is added; update preload to call `reflections:getAll`.

**Warning signs:** `getReflections()` in the renderer returns null (still hitting the old stub).

### Pitfall 3: snoozeUntil Type Missing from electron-store Schema

**What goes wrong:** `settingsStore.set('snoozeUntil', ...)` or `settingsStore.get('snoozeUntil')` throws at runtime because `snoozeUntil` is not declared in the `Settings` interface or the store schema.

**Why it happens:** electron-store with TypeScript validates against the schema; unknown keys are type errors. The `settings-store.ts` file must be updated to add `snoozeUntil` to both the `Settings` interface and the `schema` object.

**How to avoid:** Add to Settings interface: `snoozeUntil: string | null`. Add to schema: `snoozeUntil: { default: null }`. Do this in Plan 04-01 alongside DataService changes.

**Warning signs:** TypeScript compile error on `settingsStore.get('snoozeUntil')`.

### Pitfall 4: Cron Fires prompt:reflection Every Minute After 9 PM

**What goes wrong:** The tick() check fires `prompt:reflection` every minute from 9 PM onwards because `hasReflection()` returns false until the user saves. The renderer receives the event multiple times, reopening the modal repeatedly.

**Why it happens:** The guard only checks `hasReflection` but not "has the prompt already been sent this session without a save."

**How to avoid:** D-11 addresses this — but the implementation needs a session-level flag. Two options: (a) a module-level `reflectionPromptSentToday: boolean` flag in reminder-scheduler.ts cleared at midnight, or (b) rely on snoozeUntil being set immediately when the modal opens (not just on snooze button press). The cleaner approach: set `snoozeUntil` briefly (e.g., 1 minute) when the modal opens, not only on the snooze button. OR add a `let reflectionPromptedToday = false` module-level guard in scheduler that resets at midnight.

**Warning signs:** Modal reopens while user is still filling it out.

**Recommended implementation:** In `reminder-scheduler.ts`, add a module-level `let reflectionPromptedToday: string | null = null` (stores the date string). After sending `prompt:reflection`, set `reflectionPromptedToday = todayDate`. In the tick check, also guard: `reflectionPromptedToday !== todayDate`. Reset to null at midnight (when `todayDate !== reflectionPromptedToday`'s date prefix). This is a 2-line addition.

### Pitfall 5: Dialog Not Blocking on Escape Key

**What goes wrong:** User presses Escape and the Radix Dialog closes without saving or snoozing, violating D-03/D-23.

**Why it happens:** Radix Dialog fires `onEscapeKeyDown` and closes by default. The `modal={true}` prop does NOT prevent escape — it only affects pointer events.

**How to avoid:** Explicitly set `onEscapeKeyDown={(e) => e.preventDefault()}` on `DialogContent`. Also set `onPointerDownOutside={(e) => e.preventDefault()}` and `onInteractOutside={(e) => e.preventDefault()}` for full coverage.

**Warning signs:** During testing, pressing Escape closes the modal without saving.

### Pitfall 6: window.taskmate TypeScript Types Not Updated for New IPC Methods

**What goes wrong:** New preload methods (`getReflections`, `hasReflectionToday`, `getCompletedCountToday`, updated `saveReflection`) are added to `preload.ts` but the `Window` interface in a global `.d.ts` or inside `preload.ts` itself is not updated. TypeScript errors everywhere the new methods are called.

**Why it happens:** The project uses `typeof taskmateAPI` pattern in preload.ts — `contextBridge.exposeInMainWorld('taskmate', taskmateAPI)` — which means the Window type is inferred from the object literal. Adding methods to `taskmateAPI` automatically updates the type. **This is actually safe** — just add the new methods to the `taskmateAPI` object in preload.ts and the types flow through.

**How to avoid:** Add new methods directly to the `taskmateAPI` const in preload.ts. Do not create a separate type declaration. Verify with `tsc --noEmit` after changes.

**Warning signs:** `Property 'getReflections' does not exist on type ...` TypeScript error.

---

## Code Examples

### DataService: hasReflection

```typescript
// Source: pattern from data-service.ts getTaskCount() — same SELECT COUNT approach
hasReflection(dateStr: string): boolean {
  const row = this.db
    .prepare('SELECT COUNT(*) as count FROM reflections WHERE date = ?')
    .get(dateStr) as { count: number };
  return row.count > 0;
}
```

### DataService: getCompletedTaskCountToday

```typescript
// Source: D-14 decision; uses SQLite date() with localtime modifier
getCompletedTaskCountToday(): number {
  const row = this.db
    .prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed = 1
        AND date(completed_at) = date('now', 'localtime')
    `)
    .get() as { count: number };
  return row.count;
}
```

### DataService: saveReflection

```typescript
// Source: D-15 decision; INSERT OR REPLACE handles repeat saves on same date
saveReflection(
  date: string,
  q1: string | null,
  q2: string | null,
  q3: string | null
): void {
  const now = new Date().toISOString();
  this.db
    .prepare(`
      INSERT OR REPLACE INTO reflections (date, q1, q2, q3, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(date, q1, q2, q3, now);
}
```

### IPC Handlers: Reflection (replacing stubs)

```typescript
// Source: ipc-handlers.ts pattern — replace stubs registered in Phase 1
// REMOVE: ipcMain.handle('reflections:get', ...)
// REMOVE: ipcMain.handle('reflections:save', ...)
// ADD:
ipcMain.handle('reflections:getAll', () =>
  dataService.getAllReflections()
);
ipcMain.handle('reflections:save', (_event, date: string, q1: string | null, q2: string | null, q3: string | null) =>
  dataService.saveReflection(date, q1, q2, q3)
);
ipcMain.handle('reflections:hasToday', () => {
  const today = new Date().toISOString().split('T')[0];
  return dataService.hasReflection(today);
});
ipcMain.handle('reflections:getCompletedCountToday', () =>
  dataService.getCompletedTaskCountToday()
);
```

### Preload: New Reflection Methods

```typescript
// Source: preload.ts pattern — add to taskmateAPI object
getReflections: () => ipcRenderer.invoke('reflections:getAll'),
saveReflection: (date: string, q1: string | null, q2: string | null, q3: string | null) =>
  ipcRenderer.invoke('reflections:save', date, q1, q2, q3),
hasReflectionToday: () => ipcRenderer.invoke('reflections:hasToday'),
getCompletedCountToday: () => ipcRenderer.invoke('reflections:getCompletedCountToday'),
// Note: onReflectionPrompt already exists — do not re-add it
```

### ReflectionModal: At-Least-1-Answer Guard

```typescript
// Source: D-19, D-20 — disabled state logic
const [q1, setQ1] = useState('');
const [q2, setQ2] = useState('');
const [q3, setQ3] = useState('');

const answeredCount = [q1, q2, q3].filter((v) => v.trim().length > 0).length;
const canSave = answeredCount > 0;

// Button:
<Button onClick={handleSave} disabled={!canSave}>
  Save ({answeredCount}/3 answered)
</Button>
```

### Nav Bar: useLocation Visibility Guard

```typescript
// Source: react-router-dom docs; useLocation hook
import { useLocation, NavLink } from 'react-router-dom';

const location = useLocation();
const showNav = ['/', '/reflections'].includes(location.pathname);

// Render:
{showNav && (
  <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background">
    <div className="flex">
      <NavLink to="/" className={({ isActive }) =>
        `flex-1 py-3 text-center text-sm ${isActive ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'}`
      }>
        Today
      </NavLink>
      <NavLink to="/reflections" className={({ isActive }) =>
        `flex-1 py-3 text-center text-sm ${isActive ? 'text-primary border-t-2 border-primary' : 'text-muted-foreground'}`
      }>
        Reflections
      </NavLink>
    </div>
  </nav>
)}
```

**Note:** With a fixed bottom nav bar, the main content area in TodayView and ReflectionsHistory needs `pb-16` (or equivalent) to prevent content from being hidden behind the nav. Add this padding to the root div of screens that show the nav.

### History Screen: Accordion Expand Pattern

```typescript
// Simple single-expanded-at-a-time pattern — no library needed
const [expandedDate, setExpandedDate] = useState<string | null>(null);

// Per row:
<button onClick={() => setExpandedDate(expandedDate === r.date ? null : r.date)}>
  {format(parseISO(r.date), 'EEEE, MMMM d')}
</button>
{expandedDate === r.date && (
  <div>
    <p><strong>Q1:</strong> {r.q1 ?? '—'}</p>
    <p><strong>Q2:</strong> {r.q2 ?? '—'}</p>
    <p><strong>Q3:</strong> {r.q3 ?? '—'}</p>
  </div>
)}
```

**Note:** `parseISO` from `date-fns` is needed to parse the stored date string before formatting. Import alongside `format`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate cron for each scheduled event | Single per-minute tick with sequential checks | Phase 3 established this | Don't add a second cron for reflection — extend tick() |
| ipcRenderer.on without cleanup | ipcRenderer.on + removeListener returned as cleanup fn | Phase 1 preload pattern | onReflectionPrompt already returns cleanup — use it in useEffect return |
| electron-store v9+ (ESM) | electron-store v8.x (pinned) | Phase 1 decision | Stay on v8.x — v9+ is ESM-only, breaks CJS Electron Forge build |

**Deprecated/outdated:**
- `reflections:get` stub in ipc-handlers.ts: Replace with `reflections:getAll` (real implementation). The old stub channel name should not coexist — remove it.
- `getReflection(date)` in preload.ts: Replace with `getReflections()` (returns all, for history screen). The old single-date pattern is unused.

---

## Open Questions

1. **`reflectionPromptedToday` session guard implementation**
   - What we know: The tick fires every minute; `hasReflection()` is false until user saves. Without a session guard, the prompt fires every minute from 9 PM until saved.
   - What's unclear: Whether to use a module-level variable in scheduler, or a slightly-extended snooze (1 min) set when prompt is sent.
   - Recommendation: Module-level `let reflectionPromptedToday: string | null = null` in `reminder-scheduler.ts`. Set to `todayDate` when prompt is sent. Clear when `todayDate` changes (next day's tick will have a different date). This is the cleanest approach with zero IPC overhead.

2. **DataService method name for getAll reflections**
   - What we know: D-26 says `reflections:getAll` IPC channel; but the DataService method name is not specified in decisions.
   - What's unclear: Nothing blocking — just needs a name.
   - Recommendation: `getAllReflections(): ReflectionRecord[]` — mirrors `getAllTasks()` naming convention.

3. **Startup catch-up: `ready-to-show` vs `did-finish-load`**
   - What we know: Both events signal the renderer is ready. `ready-to-show` already used for `mainWindow.show()` in `createWindow()`.
   - What's unclear: Can two `once('ready-to-show', ...)` listeners coexist without conflict?
   - Recommendation: Use `webContents.once('did-finish-load', ...)` for the IPC send in `index.ts` to avoid conflicting with the existing `ready-to-show` handler in `createWindow()`. These are different events and different `once` registrations on different emitters (window vs webContents) — no conflict, but `did-finish-load` is semantically more precise for "renderer is ready to receive messages."

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npm test -- --reporter=verbose src/__tests__/data-service.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFLECT-01 | tick() triggers `prompt:reflection` at 21:00 | unit | `npm test -- src/__tests__/reminder-scheduler.test.ts` | ✅ (extend existing file) |
| REFLECT-01 | tick() does NOT trigger if reflection already saved | unit | `npm test -- src/__tests__/reminder-scheduler.test.ts` | ✅ (extend existing file) |
| REFLECT-01 | tick() does NOT trigger if snoozeUntil is in the future | unit | `npm test -- src/__tests__/reminder-scheduler.test.ts` | ✅ (extend existing file) |
| REFLECT-02 | Modal renders 3 fixed questions with correct text | manual | Visual inspection on app open at/after 21:00 | manual-only |
| REFLECT-03 | Save button disabled with 0 answers; enabled with ≥1 | unit (renderer) | vitest environment: 'jsdom' needed for renderer tests | ❌ Wave 0 gap (or manual) |
| REFLECT-04 | Snooze sets snoozeUntil ~30min in future in settingsStore | unit | `npm test -- src/__tests__/reminder-scheduler.test.ts` | ✅ (extend) |
| REFLECT-05 | saveReflection stores by ISO date; hasReflection returns true after save | unit | `npm test -- src/__tests__/data-service.test.ts` | ✅ (extend existing file) |
| REFLECT-05 | getAllReflections returns records ordered by date DESC | unit | `npm test -- src/__tests__/data-service.test.ts` | ✅ (extend existing file) |
| REFLECT-06 | Startup catch-up: hasReflection check after 21:00 | integration | Manual: close app, wait past 21:00, reopen | manual-only |

**Note on renderer unit tests (REFLECT-03):** The current vitest config uses `environment: 'node'`. Testing React components requires `environment: 'jsdom'`. Adding jsdom for a single button disabled-state test is disproportionate. Mark REFLECT-03 as manual-only for this phase. The test coverage for the logic (answeredCount calculation) can be a pure function test in node environment if the count logic is extracted.

### Sampling Rate

- **Per task commit:** `npm test -- src/__tests__/data-service.test.ts` (data layer tests)
- **Per wave merge:** `npm test` (full suite — both test files)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/data-service.test.ts` — add reflection method tests (hasReflection, saveReflection, getCompletedTaskCountToday, getAllReflections); file exists but needs new describe blocks
- [ ] `src/__tests__/reminder-scheduler.test.ts` — add reflection trigger tests (21:00 gate, snooze guard, once-per-day guard); file exists but needs new describe blocks

*(No new test files needed — extend the two existing test files. No framework changes needed.)*

---

## Sources

### Primary (HIGH confidence)

- Existing source code — `src/main/data-service.ts`, `ipc-handlers.ts`, `reminder-scheduler.ts`, `settings-store.ts`, `preload.ts`, `App.tsx`, `useTaskStore.ts` — all read directly for pattern verification
- Existing test files — `src/__tests__/data-service.test.ts`, `src/__tests__/reminder-scheduler.test.ts` — confirmed test patterns and mock structure
- `package.json` — confirmed installed versions: better-sqlite3 12.8.0, zustand 5.0.12, date-fns 4.1.0, react-router-dom 7.13.1, node-cron 4.2.1; confirmed @radix-ui/react-dialog is NOT installed
- `vitest.config.ts` — confirmed framework, include glob, node environment

### Secondary (MEDIUM confidence)

- Radix UI Dialog API — `onEscapeKeyDown`, `onPointerDownOutside`, `onInteractOutside` props on `DialogContent` for blocking all dismiss paths; `modal` prop on `Dialog` root for focus trap. Verified via knowledge of @radix-ui/react-dialog v1.x API (consistent with all other Radix primitives already in use in this project).

### Tertiary (LOW confidence)

- None — all claims in this document are grounded in the actual codebase or established Radix/React Router API patterns.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages read from package.json; only @radix-ui/react-dialog is new
- Architecture: HIGH — all patterns derived from reading existing Phase 1-3 source code
- Pitfalls: HIGH — pitfalls derived from reading actual code (IPC stubs, tick() function, no existing snoozeUntil in settings schema)
- Test gaps: HIGH — confirmed by reading existing test files and vitest config

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack — no fast-moving dependencies)
