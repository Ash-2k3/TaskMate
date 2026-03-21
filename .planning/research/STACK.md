# Stack Research: TaskMate (Electron + React, Local-First)

**Researched:** 2026-03-21
**Confidence note:** WebSearch and WebFetch were unavailable in this session. All findings are drawn from training data (knowledge cutoff August 2025). Confidence levels are assigned conservatively. Version numbers should be verified against npm before committing to them.

---

## Local Data Persistence

### Options Evaluated

#### electron-store
- **What it is:** A thin JSON-file wrapper that persists data to the OS user data directory via Electron's `app.getPath('userData')`. Backed by `conf` under the hood.
- **Format:** JSON file on disk; reads the whole file into memory on startup.
- **Strengths:** Zero setup. No native binaries, no rebuild step for new Electron versions. Excellent for settings, preferences, and small flat records. Has schema validation via JSON Schema.
- **Weaknesses:** No querying — you load everything into memory and filter in JS. Degrades above ~5,000 records or large payloads (the full JSON file is parsed on every read/write). No transactions, no indexes. Not suitable for relational data.
- **Confidence:** HIGH (well-documented, widely used, behavior is stable)

#### better-sqlite3
- **What it is:** A synchronous (blocking) SQLite binding for Node.js. Synchronous design is intentional and beneficial in Electron's main process where async IPC chains are complex.
- **Format:** Single `.db` binary file. Supports full SQL — indexes, transactions, foreign keys, aggregates.
- **Strengths:** Very fast for reads/writes on datasets of any size TaskMate would realistically hit. SQL lets you query tasks by date, tag, status without loading everything. Transactions make writes atomic. Well-maintained with a long track record in production Electron apps (e.g., used by Signal Desktop internals and many others).
- **Weaknesses:** Native module — must be rebuilt for each Electron version using `electron-rebuild` or the equivalent in Forge/builder. Adds ~500KB to bundle. Setup is more involved than electron-store.
- **Confidence:** HIGH (synchronous API, Electron compatibility, performance — all well-established)

#### NeDB
- **What it is:** An embedded NoSQL document store inspired by MongoDB, storing data as newline-delimited JSON.
- **Status:** The original `nedb` package has been unmaintained since ~2016. The active fork is `@seald-io/nedb`.
- **Weaknesses for TaskMate:** No SQL-style aggregates. The weekly summary feature (aggregate tasks over 7 days) and filtering by date/status requires loading documents into memory or writing manual reduce logic. Slower than SQLite for structured queries. The maintenance fork reduces confidence in long-term viability.
- **Confidence:** MEDIUM (the fork is active but ecosystem momentum is behind SQLite)

#### lowdb
- **What it is:** A tiny local JSON database using Lodash-style chaining. Built for small apps and prototyping.
- **Status:** v7+ is ESM-only, which creates friction in Electron's CommonJS main process without careful configuration.
- **Weaknesses for TaskMate:** Like electron-store, it loads the full JSON into memory. No indexing. ESM-only in recent versions creates module interop friction with Electron's main process.
- **Confidence:** MEDIUM (well-understood limitations, ESM issue is a known community pain point)

### Recommendation: better-sqlite3

For TaskMate, the data model is inherently relational: tasks have due dates, tags, completion status, reflection entries are timestamped, weekly summaries need date-range aggregation. `electron-store` is the right choice for **settings and preferences only** (window size, theme, user name).

Use `better-sqlite3` for all task, reflection, and summary data. The native-rebuild step is a one-time setup cost, and Electron Forge handles it automatically. The long-term gains — typed queries, no memory ceiling, transactional writes — far outweigh the friction.

**Schema sketch:**
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  due_date TEXT,          -- ISO 8601
  completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE reflections (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,     -- YYYY-MM-DD
  content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**electron-store** remains appropriate for user preferences (theme, notification time preference, window bounds). Keep these two stores separate by concern.

---

## Native Notifications

### Options Evaluated

#### Electron's built-in `Notification` API (main process)
- **What it is:** A wrapper around the OS-native notification system. On macOS it calls `NSUserNotification` / `UNUserNotificationCenter`; on Windows it calls `ToastNotification` via the Windows Runtime.
- **macOS:** Works well. In development (unsigned app), notifications appear in Notification Center but are attributed to "Electron" rather than your app name. In production (signed + notarized), they appear under the app name. Requires the app to have `LSUIElement` or be a normal app (not a background agent) to display reliably.
- **Windows:** Works on Windows 10+. Requires an AppUserModelID set (`app.setAppUserModelId`) for toast notifications to show correctly, especially when the app is not pinned to the taskbar. Toasts appear in the Action Center.
- **Strengths:** Zero extra dependencies, no binary rebuild, fully cross-platform from a single API surface. Supports `click` events to bring the app window to the foreground when the user taps a notification.
- **Weaknesses:** No persistent/scheduled delivery by the OS — Electron must be running for notifications to fire. No support for notification actions (buttons) on Windows without additional effort. On macOS, focus assist / Do Not Disturb can suppress them silently.
- **Confidence:** HIGH (official Electron API, behavior is well-documented)

#### node-notifier
- **What it is:** A Node.js library that shells out to platform-specific notification utilities: `terminal-notifier` on macOS, `notifu` or `Snoretoast` on Windows, `notify-send` on Linux.
- **Strengths:** Was necessary before Electron's own Notification API matured (~Electron 5 era). Has richer action support on some platforms.
- **Weaknesses:** Spawns child processes for each notification — fragile, slower, adds dependencies (bundled binaries). `terminal-notifier` adds ~1MB. On macOS 12+, there are known reliability issues with `terminal-notifier` due to sandboxing changes. On Windows, `Snoretoast` behavior varies across Windows versions. It is effectively a legacy solution for Electron apps.
- **Confidence:** HIGH that this is the wrong choice for a new Electron app in 2025+

### Recommendation: Electron's built-in `Notification` API

Use `new Notification({ title, body })` in the main process. It is the correct, maintained, zero-dependency approach. For TaskMate specifically:

- Call `app.setAppUserModelId('com.yourname.taskmate')` early in `app.ready` — this is required on Windows for toasts to be attributed to the app.
- On macOS, request notification permissions proactively (Electron handles this via the OS prompt on first notification).
- Wire the `click` event on each notification to `BrowserWindow.show()` + `BrowserWindow.focus()` so tapping a reminder opens the app.

```js
// main process
const { Notification } = require('electron');

function showDailyReflectionPrompt() {
  const notif = new Notification({
    title: 'TaskMate — Daily Reflection',
    body: "How did today go? Tap to open your journal.",
  });
  notif.on('click', () => mainWindow.show());
  notif.show();
}
```

**node-notifier should not be used** for new Electron apps. Its value was bridging platform gaps that the Electron API itself now covers.

---

## State Management

### Options Evaluated

#### Zustand
- **What it is:** A minimal (~1KB) state management library using hooks. State lives outside React's component tree; updates are subscription-based (components only re-render if their subscribed slice changed).
- **Strengths:** Extremely low boilerplate — a store is just a function call. No providers, no action creators, no reducers. Supports middleware (persist, devtools, immer). The `persist` middleware can sync state to `localStorage` or a custom storage adapter, which in Electron you would replace with an IPC call or direct electron-store write.
- **Weaknesses:** No enforced conventions — in large teams this can lead to inconsistent patterns, but TaskMate is a solo or small-team project where this is not a concern.
- **Confidence:** HIGH (package is actively maintained, widely adopted, API is stable)

#### Redux Toolkit (RTK)
- **What it is:** The official, opinionated Redux wrapper. Adds `createSlice`, `createAsyncThunk`, and RTK Query.
- **Strengths:** Strong conventions, excellent devtools, well-understood patterns for complex state.
- **Weaknesses:** Significant boilerplate relative to the complexity of TaskMate. RTK Query is designed for remote data fetching — its primary value proposition does not apply to a local-first app. For managing a task list, a reflection journal, and a handful of UI flags, Redux is architectural overreach.
- **Confidence:** HIGH (assessment of fit, not capability)

#### React Context API
- **What it is:** React's built-in mechanism for passing values through the component tree without prop drilling.
- **Strengths:** No dependencies. Fine for truly global singletons (current theme, auth state).
- **Weaknesses:** Context triggers a re-render on every consumer when the context value changes, unless you carefully memoize. Managing multiple slices of state (tasks, reflections, UI state) through Context requires multiple providers and careful structuring. It is not a state management solution — it is a dependency injection mechanism.
- **Confidence:** HIGH (React documentation is unambiguous about this limitation)

### Recommendation: Zustand

Zustand is the right choice for TaskMate. Create separate stores by domain:

```
useTaskStore      — task list, CRUD operations
useReflectionStore — daily reflection content
useUIStore        — selected date, sidebar open state, theme
```

Each store calls the Electron IPC layer (or directly calls `better-sqlite3` via a preload-exposed API) when it needs to persist. Zustand's `devtools` middleware works with Redux DevTools Extension in Electron, giving full state inspection during development.

Do not use Context API for anything beyond static configuration (e.g., a ThemeContext that never changes at runtime). Do not use Redux — its conventions provide no return on investment at TaskMate's scale.

---

## Scheduling/Cron

### Options Evaluated

#### node-cron
- **What it is:** A pure-JS cron scheduler running in Node.js. Uses standard 5 or 6-field cron expressions. No native binaries.
- **Strengths:** Simple API. Runs in Electron's main process. Supports timezone-aware scheduling via the `timezone` option (wraps `luxon` / `moment-timezone` internally in some versions — verify the version you use).
- **Weaknesses:** Scheduler only runs while the Node.js process is alive — if the user quits the app, no reminders fire. This is the fundamental constraint for all in-process schedulers in Electron.
- **Confidence:** HIGH (package behavior is well-established)

#### cron (npm package)
- **What it is:** An older, more feature-rich cron library for Node.js. Similar constraints to node-cron.
- **Confidence:** MEDIUM (less commonly recommended for new Electron projects vs node-cron)

#### OS-level schedulers (launchd on macOS, Task Scheduler on Windows)
- **What they are:** The operating system's own scheduling infrastructure. Can wake/launch the app even when it is not running.
- **Strengths:** Fires even if the user has not opened TaskMate that day. Most reliable for "I must show a notification at 9 PM regardless."
- **Weaknesses:** Registering with `launchd` requires writing a plist file to `~/Library/LaunchAgents/`; Task Scheduler requires COM API calls or `schtasks.exe`. Both require OS-specific code paths and careful cleanup on uninstall. Significantly more engineering complexity.
- **Confidence:** HIGH (the capability exists, the complexity is well-understood)

#### Electron's `powerMonitor` + `setTimeout`/`setInterval`
- **What it is:** A manual approach — calculate milliseconds until the next target time, set a timeout, and reschedule on wake from sleep via `powerMonitor.on('resume')`.
- **Strengths:** No dependencies. Handles sleep/wake correctly if you re-anchor the timer on resume.
- **Weaknesses:** More code than a cron library but total control.
- **Confidence:** HIGH

### Recommendation: node-cron in main process, with a sleep/wake guard

For TaskMate's stated requirements (9 PM daily reflection, Sunday weekly summary), `node-cron` is the correct choice assuming the app is expected to be running (or in the system tray) when the notification fires. This is a reasonable assumption for a productivity app.

```js
const cron = require('node-cron');
const { powerMonitor } = require('electron');

// Daily reflection at 9 PM
cron.schedule('0 21 * * *', () => {
  showDailyReflectionPrompt();
}, { timezone: 'America/New_York' }); // or read from user settings

// Weekly summary every Sunday at 9 AM
cron.schedule('0 9 * * 0', () => {
  showWeeklySummary();
}, { timezone: 'America/New_York' });

// Re-anchor timers after system wakes from sleep
powerMonitor.on('resume', () => {
  // node-cron re-evaluates its schedule on the next tick automatically
  // but if using manual setTimeout, recalculate here
});
```

**Timezone handling is critical:** Store the user's preferred timezone in `electron-store` (user settings), and pass it to every `cron.schedule` call. Without this, cron runs on the system clock's UTC offset, which may silently shift after DST changes.

**If "fire even when the app is closed" is a hard requirement:** Add a system tray mode (`Tray` + `Menu` from Electron) so the app is always running in the background after first launch. This is the standard pattern for reminder apps and sidesteps OS scheduler complexity entirely.

---

## Build Tooling

### Options Evaluated

#### Electron Forge (with Vite plugin)
- **What it is:** The officially recommended build and packaging tool from the Electron team. Provides scaffolding, dev server, and multi-platform packaging in one CLI. As of Electron Forge v7+, a Vite template is available that gives full Vite-powered HMR for both the main and renderer processes.
- **Strengths:** Official support means it tracks Electron's own release cadence. The Vite template delivers fast HMR during development. Handles native module rebuilds (`@electron-forge/plugin-vite` uses `electron-rebuild` internally). Publishing targets built in (GitHub Releases, Squirrel installers, DMG, etc.).
- **Weaknesses:** Slightly more opinionated than electron-builder — the plugin architecture means some niche configs require custom plugins.
- **Confidence:** HIGH (official tool, Vite template is current as of mid-2025)

#### electron-builder
- **What it is:** The long-standing community standard for packaging Electron apps. Highly configurable via `electron-builder.yml` / `package.json`.
- **Strengths:** Extremely flexible. Best-in-class auto-update support via `electron-updater`. Large community, many platform targets (AppImage, NSIS, Squirrel, deb, rpm, snap, flatpak, MAS).
- **Weaknesses:** Does not include a dev server — you pair it with Vite or Webpack separately. The combination (Vite for dev + electron-builder for packaging) is a common and well-supported pattern but requires wiring them together manually (e.g., via `vite-plugin-electron` or a custom `concurrently` setup).
- **Confidence:** HIGH (mature, well-maintained)

#### Plain Vite + electron-builder (vite-plugin-electron)
- **What it is:** Using `vite-plugin-electron` to run Electron in Vite's dev mode and electron-builder for packaging. Popular in the community.
- **Confidence:** MEDIUM (the plugin ecosystem around this is slightly fragmented — multiple competing plugins with varying maintenance levels)

### Recommendation: Electron Forge with the Vite template

For a greenfield app in 2026, start with Electron Forge + Vite. The scaffold command produces a working app in minutes:

```bash
npm create electron-app@latest taskmate -- --template=vite
```

This gives you:
- Vite HMR for the renderer (React with `@vitejs/plugin-react`)
- Fast main-process restarts
- Automatic native module rebuilds on `npm run start`
- Packaging via `npm run make` producing platform-native installers

**If you need auto-update:** Electron Forge's built-in publisher supports Squirrel (macOS/Windows) and GitHub Releases. For more advanced update flows, `electron-updater` (from electron-builder) can be bolted on later without changing the entire build setup.

**electron-builder is not wrong** — it is the right choice if auto-update is a day-one requirement and you need maximum packaging flexibility. For TaskMate (local-first, no cloud, likely manual distribution or direct download), Forge's simpler model is preferable.

---

## Recommended Stack

- **Runtime:** Electron (latest stable — verify current version at release)
- **Renderer:** React 18 with TypeScript
- **Build / Dev tooling:** Electron Forge with Vite template (`@electron-forge/plugin-vite`)
- **Primary data store:** `better-sqlite3` — all tasks, reflections, summaries stored as SQLite in `app.getPath('userData')`
- **Settings/preferences store:** `electron-store` — window bounds, theme, notification time, timezone preference
- **State management:** Zustand — separate stores for tasks, reflections, and UI state
- **Notifications:** Electron's built-in `Notification` API (main process); set `AppUserModelId` on Windows
- **Scheduling:** `node-cron` in the main process with timezone option; supplement with `powerMonitor` wake guard; keep the app alive via system tray (`Tray` API) so reminders fire without the user re-opening the window
- **IPC pattern:** Use a `contextBridge`-exposed preload API to call main-process SQLite functions from the renderer — never expose `ipcRenderer` directly
- **Avoid:** `node-notifier` (legacy), `lowdb` (ESM friction + no queries), `NeDB` (maintenance risk), Redux (overengineered for this scope)

---

## Confidence Summary

| Area | Confidence | Basis |
|------|------------|-------|
| Local data persistence | HIGH | electron-store and better-sqlite3 are both long-standing, stable packages with clear documented trade-offs |
| Native notifications | HIGH | Electron's Notification API behavior on macOS/Windows is well-documented in official Electron docs |
| State management | HIGH | Zustand's API, bundle size, and trade-offs vs Redux/Context are stable and well-established |
| Scheduling/Cron | HIGH | node-cron's cron expression support and Electron's powerMonitor API are stable; timezone handling is a verified known pitfall |
| Build tooling | HIGH | Electron Forge Vite template is the official recommended path as of Electron's own getting-started docs |

**Version numbers to verify before starting:**
- `electron` (latest stable)
- `better-sqlite3` (must match Electron version for native rebuild — check compatibility matrix)
- `electron-store` (check if ESM-only in latest version; may need `"type": "commonjs"` in package.json or dynamic import)
- `node-cron` (check if v3+ requires ESM; v2.x is CJS-compatible)
- `zustand` (v4+ is the current stable series)

**One known version drift risk:** `electron-store` v9+ is ESM-only (as of the package's shift in ~2023). If your Electron main process is CommonJS (which Forge's Vite template uses by default), pin `electron-store` to v8.x or handle dynamic import carefully.
