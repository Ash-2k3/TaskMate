# Phase 2: Task Management — Research

**Researched:** 2026-03-21
**Domain:** better-sqlite3 CRUD, shadcn/ui init in Electron+Vite, Zustand IPC store pattern, react-router-dom v7 HashRouter, first-launch detection
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TASK-01 | User can create a task with title (required), optional due date, and priority (Low/Medium/High) | DataService.createTask() + IPC + Zustand action + Add Task screen |
| TASK-02 | User can edit any field of an existing task | DataService.updateTask() + IPC + Zustand action + Edit Task screen |
| TASK-03 | User can delete a task | DataService.deleteTask() + IPC + Zustand action + inline confirmation |
| TASK-04 | User can mark a task complete; completed tasks removed from active view immediately | DataService.completeTask() + display:none pattern + Zustand filter |
| TASK-05 | Main screen displays active tasks sorted by due date, capped at 7 visible priority tasks | SQL ORDER BY + JS slice(0,7) + Today view component |
| TASK-06 | User can add a task via dedicated Add Task screen with title, due date picker, priority selector, Save button | Add Task route + shadcn Input/Popover+Calendar/ToggleGroup |
</phase_requirements>

---

## Summary

Phase 2 builds on a solid Phase 1 foundation. The DataService exists with the correct tasks table schema but CRUD methods are entirely absent — they must be added as public methods. IPC handlers exist as stubs that return hardcoded values; they must be wired to the real DataService methods. Zustand is not yet installed. shadcn/ui is not yet initialized. react-router-dom v7 is installed but App.tsx has no router or routes.

The three plans map cleanly to three implementation layers: (1) data + IPC + store, (2) Today view rendering, (3) task screens + onboarding. Each plan is independently verifiable before the next begins. The critical ordering constraint is that Plan 02-01 must fully complete before 02-02 or 02-03 touch the store — otherwise UI components are built against a moving API contract.

**Primary recommendation:** Implement the full data/IPC/store stack first (02-01), verify it end-to-end via the IPC bridge before touching any UI, then build Today view (02-02), then screens (02-03). This ordering avoids the trap of building UI against stub data and then debugging data layer issues under live React components.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | 12.8.0 (installed) | Synchronous SQLite CRUD in main process | Already installed; Phase 1 schema in place |
| zustand | 5.0.12 (current) | Renderer-side task state, IPC action wrappers | Chosen in STACK.md; minimal boilerplate for IPC-backed stores |
| react-router-dom | 7.13.1 (installed) | HashRouter + route-per-screen navigation | Already installed; HashRouter required for packaged Electron build |
| shadcn/ui | latest CLI | Input, Button, Popover, Calendar, ToggleGroup, Card components | Locked in UI-SPEC; CSS-variable design system matches Electron CSP |
| uuid | 13.0.0 (current) | Generate TEXT primary keys for tasks table | Tasks table uses TEXT id; crypto.randomUUID() is also viable |
| date-fns | 4.1.0 (current) | Due date formatting, overdue day calculation | Pure JS, no native deps, tree-shakeable |
| lucide-react | bundled with shadcn | Icons (checkbox circle, plus, arrow-left, trash) | Bundled; no additional install |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | bundled with shadcn | Variant-safe className composition | Inside shadcn component files |
| clsx | bundled with shadcn | Conditional className merging | Task row priority border logic |
| tailwind-merge | bundled with shadcn | Merge Tailwind classes without conflicts | shadcn component internals |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| uuid package | crypto.randomUUID() | crypto.randomUUID() is available in Electron's renderer (Chromium 92+) and Node.js 14.17+; either works — uuid avoids an import in main process where crypto is also available natively |
| date-fns | Intl.DateTimeFormat + manual math | date-fns is cleaner for "days since" calculation; Intl alone has no diff utility |
| zustand v5 | zustand v4 | v5 is current stable; API is compatible for TaskMate's usage |

**Installation (new packages only — better-sqlite3 and react-router-dom already installed):**

```bash
npm install zustand uuid date-fns
```

shadcn init is separate — see Architecture Patterns section.

**Version verification (confirmed 2026-03-21):**
- zustand: 5.0.12
- uuid: 13.0.0
- date-fns: 4.1.0
- react-day-picker (shadcn Calendar peer): 9.14.0

---

## Architecture Patterns

### Recommended Project Structure (additions for Phase 2)

```
src/
├── main/
│   ├── data-service.ts       # ADD: public CRUD methods
│   └── ipc-handlers.ts       # REPLACE stubs with real wiring
├── renderer/
│   ├── App.tsx               # REPLACE: add HashRouter + Routes
│   ├── main.tsx              # unchanged
│   ├── index.html            # unchanged
│   ├── index.css             # ADD: shadcn CSS variables (globals)
│   ├── components/
│   │   └── ui/               # ADD: shadcn components (Button, Input, etc.)
│   ├── stores/
│   │   └── useTaskStore.ts   # ADD: Zustand task store
│   ├── screens/
│   │   ├── TodayView.tsx     # ADD
│   │   ├── AddTask.tsx       # ADD
│   │   └── EditTask.tsx      # ADD
│   ├── components/
│   │   ├── TaskRow.tsx       # ADD
│   │   ├── EmptyState.tsx    # ADD
│   │   └── DatePicker.tsx    # ADD (Popover+Calendar wrapper)
│   └── types/
│       └── global.d.ts       # unchanged
└── preload/
    └── preload.ts            # unchanged — API already correct
```

---

### Pattern 1: DataService CRUD Methods

The tasks table schema is already correct. Add these public methods to DataService. The id column is TEXT — use `crypto.randomUUID()` (available in Node.js 14.17+, no extra import) or the `uuid` package.

**Task type interface (define in a shared types file or inline in data-service.ts):**

```typescript
// src/main/data-service.ts additions

export interface Task {
  id: string;
  title: string;
  due_date: string | null;   // ISO 8601 date string "YYYY-MM-DD" or null
  priority: 'low' | 'medium' | 'high';
  completed: 0 | 1;          // SQLite boolean
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  notified_at: string | null;
  renotified: 0 | 1;
}

export interface CreateTaskInput {
  title: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateTaskInput {
  title?: string;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
}
```

**Method signatures and SQL (add to DataService class):**

```typescript
// Returns all incomplete tasks sorted by due_date ASC (nulls last), then created_at ASC
getAllTasks(): Task[] {
  return this.db.prepare(`
    SELECT * FROM tasks
    WHERE completed = 0
    ORDER BY
      CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
      due_date ASC,
      created_at ASC
  `).all() as Task[];
}

createTask(input: CreateTaskInput): Task {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  this.db.prepare(`
    INSERT INTO tasks (id, title, due_date, priority, completed, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).run(id, input.title, input.due_date ?? null, input.priority ?? 'medium', now, now);
  return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task;
}

updateTask(id: string, updates: UpdateTaskInput): Task | null {
  const now = new Date().toISOString();
  // Build SET clause dynamically to avoid overwriting untouched fields
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];
  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
  if (updates.due_date !== undefined) { fields.push('due_date = ?'); values.push(updates.due_date); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  values.push(id);
  this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | null;
}

deleteTask(id: string): boolean {
  const result = this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

completeTask(id: string): boolean {
  const now = new Date().toISOString();
  const result = this.db.prepare(`
    UPDATE tasks SET completed = 1, completed_at = ?, updated_at = ? WHERE id = ?
  `).run(now, now, id);
  return result.changes > 0;
}

// First-launch detection (Plan 02-03)
getTaskCount(): number {
  const row = this.db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
  return row.count;
}
```

**Confidence:** HIGH — matches the existing schema exactly, uses better-sqlite3 synchronous prepared statement API.

---

### Pattern 2: IPC Handler Wiring

Replace the stubs in `ipc-handlers.ts`. The `dataService` parameter is already passed in — just use it.

```typescript
// src/main/ipc-handlers.ts — replace all tasks:* handlers

ipcMain.handle('tasks:getAll', () => {
  return dataService.getAllTasks();
});

ipcMain.handle('tasks:create', (_event, task: CreateTaskInput) => {
  return dataService.createTask(task);
});

ipcMain.handle('tasks:update', (_event, id: string, updates: UpdateTaskInput) => {
  return dataService.updateTask(id, updates);
});

ipcMain.handle('tasks:delete', (_event, id: string) => {
  return dataService.deleteTask(id);
});

ipcMain.handle('tasks:complete', (_event, id: string) => {
  return dataService.completeTask(id);
});
```

Remove the `void dataService;` suppression line — dataService is now used.

**Confidence:** HIGH — preload already exposes exactly these channel names with correct argument shapes.

---

### Pattern 3: Zustand useTaskStore with IPC Actions

Zustand v5 store with async IPC actions. No optimistic updates — await the IPC call then sync state. This keeps state truthful for a local app where IPC latency is sub-millisecond.

```typescript
// src/renderer/stores/useTaskStore.ts
import { create } from 'zustand';

export interface Task {
  id: string;
  title: string;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  completed: 0 | 1;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TaskStore {
  tasks: Task[];
  isLoading: boolean;
  loadTasks: () => Promise<void>;
  createTask: (input: { title: string; due_date?: string | null; priority?: 'low' | 'medium' | 'high' }) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'due_date' | 'priority'>>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  isLoading: false,

  loadTasks: async () => {
    set({ isLoading: true });
    const tasks = await window.taskmate.getTasks();
    set({ tasks, isLoading: false });
  },

  createTask: async (input) => {
    const task = await window.taskmate.createTask(input);
    set((state) => ({ tasks: [...state.tasks, task] }));
    return task;
  },

  updateTask: async (id, updates) => {
    const updated = await window.taskmate.updateTask(id, updates);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTask: async (id) => {
    await window.taskmate.deleteTask(id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  completeTask: async (id) => {
    await window.taskmate.completeTask(id);
    // Remove from active tasks immediately (TASK-04: display:none equivalent)
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },
}));
```

**Why await-then-sync, not optimistic:** IPC to the local SQLite process roundtrips in under 1ms. Optimistic updates add complexity (rollback logic) with zero perceived benefit for local-first apps. The FOUND-06 200ms constraint is met trivially.

**Confidence:** HIGH — Zustand v5 create API is stable; window.taskmate types are already declared via global.d.ts.

---

### Pattern 4: react-router-dom v7 HashRouter Route Structure

**Critical:** react-router-dom v7 (installed at 7.13.1) ships with a new data router API but still exports `HashRouter` and `Routes`/`Route` for component-based routing. Use the component API (not `createHashRouter`) to keep the migration surface minimal.

Note: react-router-dom v7 renamed some exports vs v6. `HashRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useParams` are all stable and present in v7.

```typescript
// src/renderer/App.tsx — replace entire file
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { useTaskStore } from './stores/useTaskStore';
import TodayView from './screens/TodayView';
import AddTask from './screens/AddTask';
import EditTask from './screens/EditTask';

function App() {
  const loadTasks = useTaskStore((s) => s.loadTasks);

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<TodayView />} />
        <Route path="/add" element={<AddTask />} />
        <Route path="/edit/:id" element={<EditTask />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
```

**EditTask route:** receives task id via `useParams<{ id: string }>()` and looks it up from `useTaskStore`.

**Navigation pattern:**

```typescript
// In TodayView: navigate to edit
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
// On row click:
navigate(`/edit/${task.id}`);
// On "+ Add Task":
navigate('/add');

// In AddTask/EditTask: back to today
navigate('/');
```

**Confidence:** HIGH — HashRouter is unchanged between v6 and v7 for this usage pattern. v7 breaking changes are in the data router / loader API which this project does not use.

---

### Pattern 5: shadcn/ui Init in Electron + Vite

shadcn/ui is not yet initialized (`shadcn_initialized: true` in UI-SPEC frontmatter is the goal state, not current state). The init command must be run once and then components added individually.

**Init command (run from project root):**

```bash
npx shadcn@latest init
```

**Interactive prompts and correct answers for this project:**

| Prompt | Answer |
|--------|--------|
| Which style? | Default |
| Which base color? | Slate (closest to neutral; accent is overridden to indigo via CSS) |
| CSS variables for colors? | Yes |
| Where is your global CSS file? | `src/renderer/index.css` |
| Where is your tailwind.config? | `tailwind.config.js` (shadcn creates it) |
| Configure the import alias for components? | `@/components` |
| Configure the import alias for utils? | `@/lib/utils` |

**Vite alias requirement:** shadcn uses `@/` path alias. Must add to `vite.renderer.config.ts`:

```typescript
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
});
```

Also add to `tsconfig.json` compilerOptions:

```json
"paths": {
  "@/*": ["./src/renderer/*"]
}
```

**Tailwind CSS v4 vs v3 warning:** shadcn's current CLI (`shadcn@latest`) targets Tailwind CSS v3 via PostCSS. Vite 5.x works with Tailwind v3 PostCSS plugin. Do NOT use Tailwind v4 (alpha) — shadcn does not yet support it as of early 2026.

**CSP compatibility:** The existing CSP (`style-src 'self' 'unsafe-inline'`) covers Tailwind's utility classes injected at build time. shadcn does not inject runtime styles dynamically — all styles are generated at build via PostCSS. No CSP changes required.

**Component add commands (after init):**

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add popover
npx shadcn@latest add calendar
npx shadcn@latest add toggle-group
```

Each command copies component source into `src/renderer/components/ui/`. These are owned code, not node_modules.

**Accent color override:** After init, in `src/renderer/index.css`, override `--primary` in both `:root` and `.dark` to match the spec:

```css
:root {
  --primary: 239 68% 60%;   /* hsl of #6366f1 */
  --primary-foreground: 0 0% 100%;
}
.dark {
  --primary: 239 68% 60%;
  --primary-foreground: 0 0% 100%;
}
```

**Confidence:** HIGH for init procedure. MEDIUM for exact prompt answers (shadcn CLI prompts may vary slightly by version — verify against actual CLI output).

---

### Pattern 6: shadcn Calendar + Popover Date Picker in Electron

The shadcn Calendar component uses react-day-picker (v9.14.0). Known Electron compatibility issues:

**window.matchMedia:** react-day-picker uses `window.matchMedia` for responsive detection. In Electron's renderer this is fully available (Chromium). No polyfill needed.

**ResizeObserver:** Popover positioning uses Floating UI (via Radix UI). Floating UI uses `ResizeObserver` which is available in Electron's Chromium renderer. No issues.

**Date object serialization over IPC:** The Calendar component works with JavaScript `Date` objects. IPC serializes via JSON — `Date` objects become strings. The store must convert `Date` → ISO string before calling `window.taskmate.createTask()`, and convert stored strings back to `Date` for the Calendar `selected` prop.

```typescript
// In AddTask.tsx — date conversion pattern
const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(undefined);

// When saving:
const due_date = selectedDate ? selectedDate.toISOString().split('T')[0] : null; // "YYYY-MM-DD"

// When displaying existing date in EditTask:
const initialDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : undefined;
// Note: append T00:00:00 to prevent UTC offset shifting the date by 1 day
```

**Confidence:** HIGH for Electron compatibility. HIGH for the Date serialization pattern (this is a universal IPC pitfall with dates).

---

### Pattern 7: First-Launch Detection and Onboarding

**Detection approach:** Check task count in DataService. If `getTaskCount() === 0` AND this is the first time the app has run, seed example tasks and show a 3-step onboarding overlay.

**Reliable first-launch flag using electron-store (already installed):**

```typescript
// In main/index.ts, after registerIpcHandlers:
const isFirstLaunch = !settingsStore.get('hasLaunched');
if (isFirstLaunch) {
  settingsStore.set('hasLaunched', true);
  // Seed example tasks via dataService
  dataService.createTask({ title: 'Try completing a task', priority: 'high', due_date: todayISO });
  dataService.createTask({ title: 'Add your first real task', priority: 'medium' });
  dataService.createTask({ title: 'Review your day at 9 PM', priority: 'low' });
}
```

**Expose to renderer via settings IPC:** The renderer can call `window.taskmate.getSettings()` to check `hasLaunched`. If the renderer needs to show the onboarding overlay, add a `firstLaunch` field to the settings store schema.

**Alternative (simpler):** Expose `tasks:getCount` as a new IPC channel, check in the renderer on mount. If count is 0 and no tasks have ever existed, show onboarding. This avoids touching settings store for a UI concern.

The planner should choose one approach. The electron-store flag approach is more reliable (task count is 0 is not equivalent to "first launch" if user deleted all tasks).

**Confidence:** HIGH for the flag pattern. MEDIUM for the exact onboarding interaction design (3-step overlay — UI-SPEC does not fully specify the overlay structure).

---

### Anti-Patterns to Avoid

- **Exposing ipcRenderer directly:** Never. The preload already uses contextBridge correctly. Do not add `nodeIntegration: true`.
- **Calling SQLite from the renderer:** Never. All DB access via IPC + DataService in main process.
- **Using BrowserRouter instead of HashRouter:** Breaks packaged build. HashRouter is mandatory.
- **Using `new Date(dueDateString)` without timezone suffix:** `new Date('2026-03-21')` parses as UTC midnight, displays as previous day in UTC- timezones. Always append `T00:00:00` for local date parsing.
- **Storing Date objects in Zustand:** Zustand state serializes; Date objects become plain objects across some operations. Store due dates as ISO strings, convert to Date only at the component boundary.
- **Dynamic SET clauses with string interpolation:** Use the parameterized approach shown in Pattern 1 (`fields.push()` + `values.push()`) — never template the values themselves into the SQL string.
- **Installing Tailwind v4:** shadcn does not support it. Check `npm view tailwindcss version` after init — should be 3.x.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date picker UI | Custom calendar grid | shadcn Calendar + Popover | react-day-picker handles keyboard nav, focus traps, ARIA, month navigation |
| Priority toggle buttons | Custom radio group | shadcn ToggleGroup | Radix handles accessibility, keyboard, single-select enforcement |
| CSS variable theming | Manual prefers-color-scheme JS | shadcn CSS vars + Tailwind dark: | shadcn's CSS variable system resolves automatically via OS preference |
| Task ID generation | Sequential integers | crypto.randomUUID() | Avoids ID collision if future export/import or sync is added |
| Date diff ("N days ago") | Manual Date math | `differenceInCalendarDays` from date-fns | Handles DST, month boundaries, leap years correctly |
| Class merging | String concatenation | `cn()` utility (clsx + tailwind-merge) | Prevents Tailwind class conflicts in conditional expressions |

**Key insight:** shadcn components are source-owned code, not a library import. They can be edited directly. This means the indigo accent override and the 3px priority border are applied by modifying the copied component files or via Tailwind utilities in the consuming component — no wrapper hacks needed.

---

## Common Pitfalls

### Pitfall 1: Date Parsed as Previous Day

**What goes wrong:** User picks March 21 in Calendar. Stored as `"2026-03-21"`. Retrieved and passed to `new Date("2026-03-21")` which is UTC midnight. In a UTC-5 timezone, this displays as March 20.

**Why it happens:** ISO date-only strings without a time component parse as UTC by spec.

**How to avoid:** Always parse stored date strings with a local time component: `new Date("2026-03-21T00:00:00")`. This makes the browser treat it as local midnight.

**Warning signs:** Overdue badge shows "1 days ago" for tasks due today. Calendar displays one day behind selection.

---

### Pitfall 2: IPC Channel Name Mismatch

**What goes wrong:** A new IPC handler is registered with `ipcMain.handle('tasks:getAll', ...)` but the preload invokes `ipcRenderer.invoke('tasks:get-all', ...)` — silent failure, returns undefined.

**Why it happens:** The preload and handler files are separate — no compile-time check on channel name strings.

**How to avoid:** The preload is already written with correct channel names (`tasks:getAll`, `tasks:create`, `tasks:update`, `tasks:delete`, `tasks:complete`). Match exactly. Do not rename channels.

**Warning signs:** Store actions resolve with `undefined` instead of a Task object. No error thrown — IPC returns undefined for unregistered handlers.

---

### Pitfall 3: Tailwind Utility Classes Not Found After shadcn Init

**What goes wrong:** shadcn init adds `tailwind.config.js` with a `content` array. If the content paths don't include `src/renderer/**/*.{ts,tsx}`, Tailwind purges all classes from the output.

**Why it happens:** shadcn's default content path assumes a Next.js project layout. The Electron+Vite layout is different.

**How to avoid:** After `npx shadcn@latest init`, verify `tailwind.config.js` content array includes:

```js
content: [
  './src/renderer/**/*.{ts,tsx,html}',
  './src/renderer/components/**/*.{ts,tsx}',
],
```

**Warning signs:** All Tailwind classes silently stripped. App renders with no styles applied (bare HTML). Check CSS output size — a fully purged Tailwind build is ~2KB; correct build is ~5-15KB.

---

### Pitfall 4: Zustand Store Accessed Before loadTasks() Resolves

**What goes wrong:** TodayView renders immediately and reads `useTaskStore(s => s.tasks)` — gets empty array `[]` — renders empty state "All clear". Then `loadTasks()` resolves and tasks appear after a flash.

**Why it happens:** `loadTasks()` is async. React renders before the first await resolves.

**How to avoid:** Use the `isLoading` flag. TodayView should render a null/skeleton state when `isLoading === true`, then render the task list when false. Given IPC is sub-millisecond, the loading state flash will be imperceptible, but the logic must be correct.

**Warning signs:** Empty state "All clear" briefly appears on every app open even when tasks exist.

---

### Pitfall 5: react-router-dom v7 Import Changes

**What goes wrong:** Code copies examples from react-router-dom v6 docs and imports `Switch` (removed in v6, definitely not in v7) or uses `<Redirect>` syntax.

**Why it happens:** Outdated documentation is abundant online.

**How to avoid:** In v7 with component-based routing, the imports are: `HashRouter`, `Routes`, `Route`, `Link`, `useNavigate`, `useParams`, `useLocation` — all from `react-router-dom`. `Switch` is gone (replaced by `Routes` in v6). `<Redirect>` is replaced by `<Navigate>`. The v7 breaking changes affect data routers, loaders, and actions — not the component API used in this project.

**Warning signs:** TypeScript compile error on import — v7 type definitions will correctly flag removed exports.

---

### Pitfall 6: shadcn Calendar Popover Clipped by Electron Window Bounds

**What goes wrong:** The Calendar popover opens below the date trigger button but the window is too small and the popover is clipped by the window edge.

**Why it happens:** Radix Popover uses Floating UI for positioning. Floating UI calculates available space and flips/shifts the popover, but if the window is very small it may still clip.

**How to avoid:** Ensure the BrowserWindow minimum height is sufficient (currently 700px — adequate). The Add Task form is max-width 480px centered, which leaves enough vertical space. If clipping occurs, add `side="top"` to the Popover `Content` component so it opens above the trigger.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json.

### Test Framework

This project has no test framework installed yet. The Electron + Vite scaffold does not include one. Given the Electron architecture (main process + renderer IPC), the most practical test approach for Phase 2 is:

| Layer | Test Approach |
|-------|---------------|
| DataService CRUD | Jest + better-sqlite3 in-memory DB (`:memory:`) — no Electron context needed |
| IPC handlers | Manual smoke test via DevTools console |
| Zustand store | Jest + @testing-library/react-hooks (renderer logic only) |
| React screens | Manual visual verification |

**Installing a minimal test harness for DataService (Wave 0 gap):**

```bash
npm install --save-dev jest @types/jest ts-jest
```

`jest.config.js`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
};
```

**Quick run command:** `npx jest --testPathPattern=data-service`
**Full suite command:** `npx jest`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TASK-01 | createTask returns a Task with correct fields; persists in DB | unit | `npx jest --testPathPattern=data-service.test` | No — Wave 0 |
| TASK-02 | updateTask updates specified fields, leaves others unchanged | unit | `npx jest --testPathPattern=data-service.test` | No — Wave 0 |
| TASK-03 | deleteTask removes row; returns false for missing id | unit | `npx jest --testPathPattern=data-service.test` | No — Wave 0 |
| TASK-04 | completeTask sets completed=1; getAllTasks excludes it | unit | `npx jest --testPathPattern=data-service.test` | No — Wave 0 |
| TASK-05 | getAllTasks returns due-date sorted list, null dates last | unit | `npx jest --testPathPattern=data-service.test` | No — Wave 0 |
| TASK-06 | Add Task screen saves and navigates to Today | manual smoke | Open app, fill form, save, verify row appears | N/A |

### Sampling Rate

- **Per task commit:** `npx jest --testPathPattern=data-service.test`
- **Per wave merge:** `npx jest`
- **Phase gate:** All Jest tests green + manual smoke of add/edit/delete/complete before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/data-service.test.ts` — in-memory SQLite tests for all 5 CRUD methods (TASK-01 through TASK-05)
- [ ] `jest.config.js` — root level
- [ ] Framework install: `npm install --save-dev jest @types/jest ts-jest`

*(DataService tests run in Node.js without Electron context — use `new Database(':memory:')` and call `initSchema()` via a test helper that exposes the private method or creates a test-only DataService subclass.)*

---

## Code Examples

### Overdue Days Calculation (date-fns)

```typescript
// Source: date-fns differenceInCalendarDays documentation
import { differenceInCalendarDays, parseISO } from 'date-fns';

function getOverdueDays(dueDateStr: string): number {
  const today = new Date();
  const dueDate = parseISO(dueDateStr); // handles YYYY-MM-DD correctly as local
  return differenceInCalendarDays(today, dueDate); // positive = overdue
}

// Usage in TaskRow:
const overdueDays = task.due_date ? getOverdueDays(task.due_date) : 0;
const isOverdue = overdueDays > 0;
// Display: `${overdueDays} days ago`
```

**Note:** `parseISO` from date-fns correctly parses `YYYY-MM-DD` as local time (date-fns convention differs from native `new Date()`). This avoids the UTC offset pitfall.

---

### Today View 7-Task Cap

```typescript
// In TodayView.tsx
const tasks = useTaskStore((s) => s.tasks); // already sorted by DataService SQL

const visibleTasks = tasks.slice(0, 7); // hard cap per TASK-05 / UI-SPEC

// Render visibleTasks; tasks beyond index 6 are silently suppressed in Phase 2
```

---

### Priority Border and Opacity

```typescript
// TaskRow.tsx using cn() utility
import { cn } from '@/lib/utils';

function taskRowClass(priority: 'low' | 'medium' | 'high') {
  return cn(
    'flex items-center min-h-[48px] px-4 py-4 bg-muted border-b border-border',
    {
      'border-l-[3px] border-l-primary': priority === 'high',
      'border-l-[3px] border-l-transparent': priority !== 'high',
      'opacity-60': priority === 'low',
    }
  );
}
```

---

### Instant Completion (display:none equivalent)

```typescript
// Zustand completeTask removes task from state immediately
// React re-renders — the row simply does not appear in the next render
// No CSS animation, no display:none needed — component unmounts

const completeTask = useTaskStore((s) => s.completeTask);

// On checkbox click:
await completeTask(task.id);
// Task is gone from state; TodayView re-renders without it
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zustand v4 `devtools` middleware import path | Zustand v5: `import { devtools } from 'zustand/middleware'` | Zustand v5 (2024) | Import path unchanged; API identical for basic usage |
| react-router-dom v5 `Switch` | `Routes` (v6+) and maintained in v7 | v6 (2021) | All v5 Switch/Redirect patterns must use Routes/Navigate |
| react-router-dom v6 loader API (optional) | v7 promotes data router; component API still works | v7 (2024) | No impact for this project — not using loaders |
| react-day-picker v8 | react-day-picker v9 (shadcn Calendar peer) | 2024 | shadcn Calendar component wraps the correct version automatically |
| shadcn add via `npx shadcn-ui@latest` | `npx shadcn@latest` (package rename) | 2024 | Use `shadcn` not `shadcn-ui` |

**Deprecated/outdated:**
- `npx shadcn-ui@latest`: Package renamed to `shadcn`. Use `npx shadcn@latest`.
- react-router-dom `<Switch>`: Removed in v6. Use `<Routes>`.
- better-sqlite3 `.prepare().all()` without type assertion: Now requires `as Task[]` since the return type is `unknown[]` in current @types/better-sqlite3.

---

## Open Questions

1. **Should the Task interface live in a shared types file accessible to both main and renderer?**
   - What we know: Currently main and renderer have separate TypeScript compilation contexts (vite.main.config.ts vs vite.renderer.config.ts). Sharing types requires a path that both compilers can resolve.
   - What's unclear: Whether the existing `tsconfig.json` allows importing from `src/main/` in `src/renderer/` — likely not in the Vite split.
   - Recommendation: Define `Task`, `CreateTaskInput`, `UpdateTaskInput` in `src/renderer/types/task.ts` for the renderer (Zustand store uses it). Duplicate or co-locate the interface in `src/main/data-service.ts` for the main process. A shared `src/shared/types.ts` is cleaner but requires tsconfig path configuration. The planner should pick one — duplication is simpler for now.

2. **settings-store schema for `hasLaunched` flag**
   - What we know: `electron-store` is already set up. The settings-store file exists but its schema was not in the files provided.
   - What's unclear: Whether `hasLaunched` is already in the schema or needs to be added.
   - Recommendation: Add `hasLaunched: { type: 'boolean', default: false }` to the electron-store schema. Planner should read `src/main/settings-store.ts` before specifying this task.

3. **The UI-SPEC `shadcn_initialized: true` frontmatter — is shadcn already installed?**
   - What we know: `package.json` does not list `tailwindcss`, `@radix-ui/*`, or any shadcn packages. `vite.renderer.config.ts` has no path alias. `tsconfig.json` has no paths.
   - Conclusion: shadcn is NOT installed. The `shadcn_initialized: true` in UI-SPEC is the desired end-state, not current state. Wave 0 of Plan 02-01 or a pre-step in 02-02 must run `npx shadcn@latest init`.
   - Recommendation: Make shadcn init the first task of Plan 02-02 (it's a UI concern), clearly after Plan 02-01's data layer is complete.

---

## Sources

### Primary (HIGH confidence)
- better-sqlite3 source code and @types/better-sqlite3 — prepared statement API, `.all()` return type
- Zustand v5 documentation (zustand.docs.pmnd.rs) — `create` API, middleware imports
- react-router-dom v7 changelog and API reference — HashRouter, Routes, component API stability
- Electron contextBridge docs — IPC serialization behavior (JSON, no Date objects)
- shadcn/ui official docs (ui.shadcn.com) — init command, component add, Vite alias requirement
- date-fns v4 docs — `parseISO`, `differenceInCalendarDays`

### Secondary (MEDIUM confidence)
- shadcn CLI prompt answers — inferred from current CLI behavior; exact prompts may vary by version
- Tailwind v3 content path for Electron+Vite layout — standard pattern, not from official Tailwind Electron guide
- react-day-picker v9 Electron compatibility — no known issues; no explicit Electron compatibility matrix exists

### Tertiary (LOW confidence — flag for validation)
- First-launch onboarding 3-step overlay visual design — UI-SPEC does not specify overlay structure; planner must define
- Test harness choice (Jest + ts-jest) — confirmed available; an alternative is Vitest which works with Vite projects natively

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry; versions confirmed 2026-03-21
- DataService CRUD: HIGH — matches existing schema exactly; better-sqlite3 synchronous API is stable
- IPC wiring: HIGH — preload channel names are locked; no ambiguity
- Zustand store pattern: HIGH — v5 API confirmed; IPC serialization behavior is well-understood
- shadcn init procedure: HIGH/MEDIUM — init steps are correct; exact CLI prompts are MEDIUM (version-dependent)
- react-router-dom v7: HIGH — component API unchanged; breaking changes are in data router only
- First-launch detection: HIGH — electron-store flag pattern is standard
- Pitfalls: HIGH — each is verified against actual Electron+Vite+better-sqlite3 behavior

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (30 days — stack is stable; shadcn CLI is the highest drift risk)
