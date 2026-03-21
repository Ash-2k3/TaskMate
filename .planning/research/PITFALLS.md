# Pitfalls Research: TaskMate

**Domain:** Local-first productivity desktop app (Electron + React)
**Researched:** 2026-03-21
**Confidence:** MEDIUM — external search tools unavailable; findings drawn from Electron official documentation patterns (training knowledge through August 2025), well-documented community issues, and established desktop app engineering wisdom. Flag any claim marked LOW for validation before implementation.

---

## Electron Gotchas

### Security: nodeIntegration + contextIsolation (CRITICAL)

**What goes wrong:** Enabling `nodeIntegration: true` in a renderer window without `contextIsolation: true` gives any JavaScript running in the renderer — including code injected via XSS or a compromised dependency — full Node.js access. This means file system access, shell execution, and anything the OS user can do. Electron's own security checklist marks this as the single highest-severity mistake.

**Prevention:**
- Always set `nodeIntegration: false` (default in Electron 12+) and `contextIsolation: true` (default in Electron 12+). Never override these.
- All main-process logic must be exposed to the renderer **only** via `contextBridge.exposeInMainWorld()` in the preload script.
- Validate all IPC messages in the main process; never trust renderer input as safe.

**Confidence:** HIGH — this is Electron's officially documented security rule #1.

---

### Security: Content Security Policy (CSP) misconfiguration

**What goes wrong:** A missing or overly permissive CSP header (`default-src *` or `unsafe-inline`) defeats the browser-level XSS protections that otherwise compensate for a web-based runtime. In Electron, the renderer's `webPreferences` `webSecurity` defaults to `true` — disabling it for convenience (a common dev workaround) persists to production if not reverted.

**Prevention:**
- Set a strict CSP via `<meta http-equiv="Content-Security-Policy">` in `index.html`. For a fully local app with no remote resources, use: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'` (unsafe-inline for CSS-in-JS libraries like styled-components or Emotion is generally acceptable; avoid it for scripts).
- Never set `webSecurity: false` in production. Use it only in dev if absolutely necessary and guard it with `if (!app.isPackaged)`.

**Confidence:** HIGH — documented in Electron security checklist.

---

### Security: Remote module (deprecated / removed)

**What goes wrong:** Older tutorials (pre-Electron 14) show using `remote` module to call main-process APIs from the renderer directly. The `remote` module was deprecated in Electron 12 and removed in Electron 14. Apps built from those tutorials break on modern Electron.

**Prevention:** Use `ipcRenderer.invoke()` / `ipcMain.handle()` pattern exclusively. Never reinstall `@electron/remote` unless you have a specific legacy migration reason.

**Confidence:** HIGH — confirmed removal timeline.

---

### Performance: Memory leaks from IPC listeners not cleaned up

**What goes wrong:** Every `ipcRenderer.on('channel', handler)` registered inside a React component's effect without a corresponding cleanup creates a new listener on every render cycle that mounts the component. After 100 mounts/unmounts (e.g., switching views), there are 100 handlers all firing — causing memory accumulation and duplicate side effects (e.g., 100 notifications firing for one event).

**Prevention:**
```js
// In React component
useEffect(() => {
  const handler = (_, data) => { /* ... */ };
  window.electron.ipcRenderer.on('task:remind', handler);
  return () => {
    window.electron.ipcRenderer.removeListener('task:remind', handler);
  };
}, []);
```
Use `ipcRenderer.once()` for one-shot responses. Always pair `on` with cleanup in `useEffect` return.

**Confidence:** HIGH — well-documented Electron + React pattern failure.

---

### Performance: Main process blocking

**What goes wrong:** The main process runs on the single Node.js event loop thread. Any synchronous operation — large JSON parsing, synchronous file I/O (`fs.readFileSync` on large files), blocking loops — freezes the entire app (UI becomes unresponsive, IPC stalls). This is distinct from browser apps where the renderer has its own thread.

**Prevention:**
- Use `fs.promises.*` (async) for all file I/O in the main process.
- Offload heavy computation (weekly summary generation, data aggregation) to a Worker thread (`worker_threads` module) or use `setImmediate` chunking.
- For SQLite: use `better-sqlite3` (synchronous API is fine because SQLite operations are typically sub-millisecond for small datasets) but avoid queries inside tight loops.

**Confidence:** HIGH.

---

### Performance: Startup time — eager module loading

**What goes wrong:** `require()`-ing every module at the top of `main.js` (including large ones like `better-sqlite3`, schema migrations, notification setup) before the first window is shown causes startup times of 3-8 seconds on cold start, which is jarring for a productivity tool users open daily.

**Prevention:**
- Show the window as early as possible (`browserWindow.show()` after `ready-to-show` event fires).
- Use `app.whenReady()` then create the window first, then lazily initialize non-critical services.
- Electron Forge/Builder: enable ASAR packaging. Unpackaged apps load 40-60% slower due to individual file stat calls.
- Use `v8-compile-cache` or rely on Electron's built-in V8 snapshot features for faster module initialization.

**Confidence:** MEDIUM — startup timing numbers are approximations from community benchmarks, not official Electron docs.

---

### Packaging: ASAR path issues

**What goes wrong:** In packaged builds, `__dirname` points inside the `.asar` archive. Native modules (like `better-sqlite3`) cannot be inside `.asar` because they are `.node` binary files that must be on a real filesystem path. File paths constructed with `path.join(__dirname, 'assets/...')` work in dev but fail silently or crash in packaged builds.

**Prevention:**
- In `electron-builder` config, add `better-sqlite3` (and any other native modules) to `asarUnpack`: `"asarUnpack": ["**/*.node"]`.
- Use `app.getPath('userData')` for any user-writable files (database, logs). Never write to `__dirname` or `app.getAppPath()` — those are read-only in packaged builds on macOS (signed apps in `/Applications`).
- For static assets bundled with the app: use `path.join(process.resourcesPath, 'assets', ...)` in packaged builds, and `path.join(__dirname, '../assets', ...)` in dev. Guard with `app.isPackaged`.

**Confidence:** HIGH — well-documented ASAR limitation.

---

### Packaging: Native module rebuild mismatch

**What goes wrong:** `better-sqlite3` is a native Node addon. If it was compiled for Node.js 20 but Electron ships Node.js 22 internally, the binary is incompatible and the app crashes immediately with `Error: The module was compiled against a different Node.js version`. This is a silent gotcha — it works in dev (where your system Node runs it) but fails in the packaged Electron app.

**Prevention:**
- Use `electron-rebuild` (or `@electron/rebuild`) as a postinstall script: `"postinstall": "electron-rebuild"`. This recompiles native modules against Electron's bundled Node version.
- In CI: run `electron-rebuild` after `npm install` before packaging.
- Alternatively, use a pure-JS SQLite alternative (`sql.js` — WebAssembly, no native rebuild needed) at the cost of 3-5x slower writes and higher memory use for large datasets. For TaskMate's data volume (<10K rows), this tradeoff is acceptable.

**Confidence:** HIGH — canonical Electron native module issue.

---

### Auto-updater pitfalls

**What goes wrong:** `electron-updater` (from `electron-builder`) requires the app to be code-signed to function on macOS. Attempting to auto-update an unsigned macOS app triggers Gatekeeper errors. On Windows, update files must be served from HTTPS with correct MIME types.

**Prevention (for TaskMate MVP):** Disable auto-updater entirely in MVP. Notify users of new versions via a simple in-app banner fetched from a GitHub releases API call. Implement proper auto-update only after signing infrastructure is set up.

**Confidence:** HIGH.

---

## Notification Reliability

### macOS: Notification permissions not requested properly

**What goes wrong:** On macOS 10.14+, apps must request notification permission from the user. Electron's `Notification` API fires notifications without explicitly showing a permission prompt in some configurations — but the notification is silently dropped if the app doesn't have permission. The user never sees an error; the notification simply doesn't appear.

**Detection:** Use `Notification.isSupported()` and, for macOS 10.14+, check `systemPreferences.getMediaAccessStatus` — though Electron does not expose a direct `notifications` permission check. A better approach: fire a test notification at app startup and verify via user feedback (first-run onboarding).

**Prevention:**
- On first launch, show an explicit in-app prompt explaining why notifications are needed, then trigger a native notification to cause the system permission dialog to appear.
- In `Info.plist` (macOS), set `NSUserNotificationUsageDescription` (though this is primarily for sandboxed/Mac App Store builds). For direct distribution builds, the system prompt still appears on first notification.
- Provide a Settings UI link that opens `System Settings > Notifications` for users to re-enable manually: `shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications')`.

**Confidence:** MEDIUM — behavior has varied across macOS versions; test on macOS 13+ (Ventura) and 14+ (Sonoma) specifically.

---

### macOS: Focus Mode / Do Not Disturb silently drops notifications

**What goes wrong:** macOS Focus Mode (introduced macOS 12, expanded in 13/14) can be configured by users to block notifications from all apps except explicitly allowed ones. Electron apps — especially unsigned ones — are unlikely to be in any user's Focus allowlist. When DND or Focus is active at 9 PM (reflection trigger time), the notification fires in the OS but is never shown to the user. There is no callback to the app indicating the notification was suppressed.

**Electron's limitation:** As of Electron 27-28, there is no API to detect whether a notification was actually displayed or suppressed by Focus Mode. This is an OS-level decision.

**Mitigations (pick 2-3):**
1. Show an in-app badge/indicator in the taskbar/dock that the reflection is pending, even if the notification was suppressed. Users who open the app see it waiting.
2. At app open, check if the scheduled daily reflection time has passed today and the reflection hasn't been completed — show a persistent in-app modal regardless of notification state.
3. Educate users during onboarding to add TaskMate to their Focus allowlist. Deep-link to notification settings.
4. Use `BrowserWindow`-based reminder as fallback: if the app is open at trigger time, show a prominent in-app modal instead of (or in addition to) an OS notification.

**Confidence:** HIGH for the DND problem; MEDIUM for the specific Electron API limitation (verify against current Electron docs).

---

### Windows: Notification identity and AppUserModelID

**What goes wrong:** Windows toast notifications require the app to have a registered `AppUserModelID` (AUMID) to be attributed to a specific app entry in the Start Menu. Without a proper AUMID, notifications either fail silently or are attributed to a generic "Windows PowerShell" / "Electron" entry, causing them not to appear or appearing with the wrong icon. This is especially problematic in development builds.

**In packaged builds:** `electron-builder` handles AUMID registration automatically when using NSIS installer. The problem surfaces in:
- Development (no installer run): `app.setAppUserModelId(app.name)` must be called in `main.js` before any notification is fired.
- Portable builds (no installer): AUMID must be manually registered.

**Prevention:**
```js
// In main.js, early in app initialization
if (process.platform === 'win32') {
  app.setAppUserModelId(app.name); // or use your app's full bundle ID
}
```

**Confidence:** HIGH — well-documented Windows notification requirement.

---

### Windows: Focus Assist (Do Not Disturb equivalent)

**What goes wrong:** Windows 10/11 Focus Assist and Windows 11 Focus Sessions suppress notifications during active periods. Like macOS, there is no Electron API to detect this state or confirm notification delivery. Windows 11 also has an "automatic rules" feature that enables Focus Assist during certain hours automatically — potentially exactly at 9 PM (a common "wind down" time).

**Mitigations:** Same strategy as macOS — use in-app state to track whether the reflection was completed today, and surface it prominently when the app is opened regardless of notification delivery.

**Confidence:** MEDIUM — Windows Focus Assist behavior is well-documented; Electron API limitations inferred from known API surface.

---

### Both platforms: App must be running for scheduled notifications

**What goes wrong (critical for TaskMate):** Electron's `Notification` API fires notifications from within the running app process. If TaskMate is not running at 9 PM, no notification fires. Unlike a native iOS/Android app, there is no background notification service that wakes a sleeping Electron app to send a reminder.

This is the most impactful reliability gap for a productivity app with timed triggers.

**Mitigations:**
1. **System-level schedulers (recommended):** On macOS, register a `launchd` plist that launches the app (or a lightweight helper) at the scheduled time. On Windows, use the Task Scheduler API. Both can be configured programmatically from the main process using `node-cron` + OS CLI calls, or via `node-schedule`. However, this requires the user to grant "login item" or "startup" permissions — present this as a feature during onboarding.
2. **Login item (simpler):** Register the app as a login item (`app.setLoginItemSettings({ openAtLogin: true })`). If the app starts at login and runs in the background (tray icon, no visible window), it can fire notifications even when the user hasn't actively opened it. This is the most reliable cross-platform approach for a productivity tool.
3. **Missed trigger catch-up:** On each app open, check: "Has today's reflection been triggered and not completed?" If yes, show immediately.

**Confidence:** HIGH — fundamental Electron architecture constraint.

---

### Notification click handling

**What goes wrong:** Clicking a notification on macOS should bring the app to the foreground and open the relevant context (e.g., the reflection modal). This requires the `notification.on('click')` event handler to call `mainWindow.show()` and `mainWindow.focus()`. If the window is hidden (tray-only mode), `show()` must be called first. If the notification fires while the app is completely closed (impossible in current architecture, but possible with system schedulers), the click handler is never registered.

**Prevention:** Register notification click handlers before firing the notification. For tray-mode apps, always call `mainWindow.show(); mainWindow.focus();` in the click handler.

**Confidence:** HIGH.

---

## Data Integrity

### electron-store: No atomic writes by default

**What goes wrong:** `electron-store` uses `conf` under the hood, which writes data by serializing the entire store to JSON and writing the file. On crash, power loss, or process kill during a write, the JSON file can be partially written — producing invalid JSON that fails to parse on next launch, effectively wiping all user data (the store defaults to an empty object on parse failure).

This is especially risky for TaskMate because the entire task list, reflection history, and weekly data live in a single file.

**Prevention:**
1. **Atomic writes:** Use `write-file-atomic` (which `conf` supports via its `serialize` option). Verify the version of `electron-store` in use actually enables atomic writes — check the conf package changelog. As of conf 10+, atomic writes are enabled by default via `write-file-atomic`.
2. **Periodic backups:** On each app launch, copy the data file to `data.backup.json` before any writes. If the primary file fails to parse on next launch, restore from backup.
3. **Schema validation:** Pass a `schema` object to `electron-store` constructor. This validates data shape on read and prevents corrupted/unexpected shapes from propagating through the app.
4. **Migration versioning:** Use `electron-store`'s `migrations` option to handle schema changes between versions. Without migrations, a v1 → v2 upgrade that changes the data shape silently corrupts existing records.

**Confidence:** HIGH for the risk; MEDIUM for conf atomic write status (verify in current conf package changelog).

---

### SQLite: WAL mode not enabled

**What goes wrong (if SQLite is chosen over electron-store):** SQLite defaults to "journal" mode, which has lower concurrency tolerance and more exposure to corruption on unclean shutdown. Write-Ahead Logging (WAL) mode is dramatically more crash-resilient.

**Prevention:**
```js
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL'); // balance between safety and performance
```
Run these immediately after opening the database connection, before any other operations.

**Confidence:** HIGH — SQLite official documentation recommends WAL for desktop apps.

---

### SQLite: Database not closed on app quit

**What goes wrong:** If `better-sqlite3`'s `db.close()` is not called before the Electron process exits, SQLite may not flush its WAL buffer to the main database file, leaving the database in a state requiring recovery on next open. Recovery usually succeeds, but is not guaranteed on all platforms.

**Prevention:**
```js
app.on('before-quit', () => {
  db.close();
});
```

**Confidence:** HIGH.

---

### Data volume underestimation leading to poor schema choices

**What goes wrong:** Starting with `electron-store` (flat JSON) is fine for <500 tasks + 365 reflections (a year of daily use). But if a user runs TaskMate for 2+ years, the JSON file grows, parse time increases, and the schema becomes unwieldy for querying (e.g., "find all tasks completed on Tuesdays" requires a full JSON scan). For TaskMate's weekly summary feature, this calculation complexity compounds.

**Recommendation:** Start with `electron-store` for MVP as stated in PROJECT.md decisions, but design the data layer behind an abstraction (a `DataService` class) that can be swapped from JSON to SQLite without React component changes. This is the migration path, not a rewrite.

**Confidence:** HIGH.

---

### No backup/export means total data loss on disk failure

**What goes wrong:** A local-first app with no export mechanism means a user's 2 years of reflection data is gone if their drive fails or their OS is reinstalled. For a productivity/reflection app, data permanence is part of the core value proposition.

**Prevention:**
- Add a simple "Export to JSON" / "Export to CSV" feature in the initial release, not a later version.
- Optionally: store data in `~/Documents/TaskMate/` instead of `app.getPath('userData')` so it falls under standard backup tools (Time Machine, Windows Backup).

**Confidence:** HIGH — recurring complaint in productivity app post-mortems.

---

## Scheduling Reliability

### setInterval / setTimeout are not reliable schedulers

**What goes wrong:** Using `setInterval(checkTime, 60000)` in the main process to poll for the 9 PM trigger has several failure modes:
1. The interval drifts — each iteration fires slightly late, accumulating drift over hours.
2. The system sleeps (laptop lid closed) — `setInterval` is suspended during sleep and resumes after wake, potentially skipping the trigger window entirely.
3. After a long sleep + wake, all pending intervals fire simultaneously.

**Prevention:** Use `node-schedule` or `cron` library which uses actual wall-clock time (not interval counting) and handles system sleep/wake by recalculating the next trigger time on wake. Register a listener for `powerMonitor.on('resume', ...)` to re-evaluate scheduled triggers after sleep.

```js
const schedule = require('node-schedule');
const { powerMonitor } = require('electron');

// Schedule 9 PM daily
const job = schedule.scheduleJob('0 21 * * *', () => {
  fireReflectionNotification();
});

// Re-check on system wake (in case the trigger was missed during sleep)
powerMonitor.on('resume', () => {
  checkAndFireMissedTriggers();
});
```

**Confidence:** HIGH — `setInterval` drift and sleep behavior are well-documented Node.js/OS issues.

---

### App closed at trigger time: the fundamental gap

**What goes wrong:** As noted in Notification Reliability, if TaskMate is not running at 9 PM, no in-process scheduler fires. This is not a bug — it's an architectural constraint. For a reflection app that depends on a fixed daily trigger, this is a core reliability risk.

**Decision tree for TaskMate:**

| Scenario | What happens | Mitigation |
|---|---|---|
| App running at 9 PM | Notification fires + in-app modal | Works as designed |
| App in tray (background) at 9 PM | Notification fires | Works if login item is set |
| App fully closed at 9 PM | No notification | Missed trigger catch-up on next open |
| System asleep at 9 PM | Trigger skipped | powerMonitor resume check |
| System asleep, wakes after 9 PM | Depends on node-schedule recalc | Re-check on resume |

**Recommended implementation:** Set `openAtLogin: true` by default (with user opt-out). Show it as a feature: "TaskMate will gently remind you at 9 PM even if you forget to open it."

**Confidence:** HIGH — architectural constraint.

---

### Re-notification after 10 minutes: double-fire risk

**What goes wrong:** The spec says "re-notify once after 10 min if task incomplete." If implemented naively with `setTimeout(reNotify, 600000)`, and the app quits and restarts within that 10-minute window, the timer is lost — no re-notification fires. Alternatively, if the timer is stored and re-hydrated incorrectly, the re-notification fires immediately on next launch regardless of elapsed time.

**Prevention:** Store the "pending re-notification" state persistently:
```json
{
  "pendingRenotify": {
    "taskId": "abc123",
    "scheduledAt": 1711234567890
  }
}
```
On each app start, check if `scheduledAt + 600000 > Date.now()` — if so, schedule the remaining wait time. If `scheduledAt + 600000 < Date.now()`, the window passed; don't re-notify.

**Confidence:** HIGH.

---

### Weekly summary trigger: Sunday evening edge cases

**What goes wrong:** "Every Sunday evening" is ambiguous in implementation. Using `node-schedule` with `'0 20 * * 0'` (8 PM Sunday) works when the app is running. Edge cases:
- User is in a different timezone than the developer's assumption — wall-clock time is correct (it uses system time) but if the user changes timezone mid-week, `node-schedule` may not recalculate correctly.
- DST transitions: clocks jump forward/back — a 9 PM trigger can fire at 8 PM or 10 PM real-time.

**Prevention:** Always use the system's local time (which `node-schedule` does by default). For DST, add ±1 hour tolerance in the catch-up check: "Did the weekly summary fire this week?" not "Did it fire at exactly 8:00 PM Sunday?"

**Confidence:** MEDIUM — DST behavior with node-schedule depends on version; verify.

---

## React + Electron Integration

### White screen on packaged build (most common reported issue)

**What goes wrong:** The most frequently reported Electron + React issue: app works perfectly in dev (`npm run dev`) but shows a blank white screen in production packaged build. Root cause is almost always a **file path resolution issue**.

In dev, Vite (or webpack) serves files from `localhost:5173`. In prod, `mainWindow.loadFile()` is used to load `index.html` from the ASAR. React Router's `BrowserRouter` uses HTML5 history API which requires a server — it generates paths like `/tasks` which the filesystem cannot resolve. The filesystem only knows `file:///path/to/index.html`.

**Prevention (two-part fix):**
1. Use `HashRouter` instead of `BrowserRouter` in Electron packaged builds. The hash (`#/tasks`) is handled entirely client-side with no server round-trip.
   ```jsx
   // In prod Electron
   import { HashRouter } from 'react-router-dom';
   ```
   Or detect environment: `process.env.NODE_ENV === 'production' ? HashRouter : BrowserRouter`.

2. In Vite config, set `base: './'` so all asset paths are relative:
   ```js
   // vite.config.js
   export default { base: './' }
   ```
   Without this, Vite generates absolute paths (`/assets/index.js`) that work on a dev server but fail when loading from `file://`.

**Confidence:** HIGH — this is the #1 reported Electron + React packaging issue.

---

### Preload script not loading: path misconfiguration

**What goes wrong:** The preload script path in `BrowserWindow` options is relative to the main process file. In dev vs. packaged builds, the directory structure differs. A preload path that works in dev silently fails in production, resulting in `window.electron` being undefined — causing the entire IPC bridge to fail without a clear error message.

**Prevention:**
```js
// Correct — works in both dev and packaged
const preloadPath = path.join(__dirname, 'preload.js');
// In Vite + Electron Forge/Builder setups, use:
const preloadPath = path.join(__dirname, '../preload/preload.js'); // adjust for your build output structure
```
Use `console.log('preload path:', preloadPath)` during development to verify. Add a health-check in the renderer: `if (!window.electron) { throw new Error('Preload failed to load') }`.

**Confidence:** HIGH.

---

### HMR (Hot Module Replacement) conflicts with IPC state

**What goes wrong:** During development with Vite HMR, React components reload when file changes are detected. IPC listeners registered in `useEffect` survive the HMR cycle if the module is not fully remounted — resulting in duplicate listeners, stale closures holding old state, and events firing multiple times. This makes bugs in notification and scheduling logic hard to reproduce — they appear in dev but not prod, or vice versa.

**Prevention:**
- Treat HMR behavior as unreliable for IPC testing. Always test IPC flows with a full app reload (`Ctrl+R` in dev tools).
- For IPC-heavy features (reminders, reflections), write integration tests that run in a real Electron process rather than relying on HMR-based manual testing.

**Confidence:** HIGH.

---

### CSP blocking inline scripts from bundlers

**What goes wrong:** Vite injects small inline `<script>` tags for module loading in development. A strict CSP that blocks `'unsafe-inline'` for scripts will cause the dev build to fail with cryptic "Refused to execute inline script" console errors. Developers then add `'unsafe-inline'` to fix dev, and accidentally ship it to production.

**Prevention:**
- Use separate CSP configs for dev and prod via environment variables.
- In prod, Vite's output is fully external script files — no inline scripts — so a strict CSP works fine.
- Use nonces (a random value per page load injected via the preload) as an alternative to `'unsafe-inline'` if inline scripts are unavoidable.

**Confidence:** HIGH.

---

### `require` vs ES modules in Electron main process

**What goes wrong:** Electron's main process has historically been CommonJS (`require`). Mixing ES module syntax (`import/export`) in `main.js` without proper configuration causes `SyntaxError: Cannot use import statement in a module` at launch. Conversely, setting `"type": "module"` in `package.json` to enable ES modules breaks `__dirname` and `__filename` (not available in ESM) and requires `createRequire` workarounds for native modules.

**Prevention:** For Electron projects, keep the main process and preload as CommonJS (the default). Use ESM only in the renderer (Vite handles this transparently). Do not set `"type": "module"` in the root `package.json` — set it only in a subdirectory if needed, or use `.mjs` extension selectively.

**Confidence:** HIGH.

---

### Dev tools left open in production

**What goes wrong:** `mainWindow.webContents.openDevTools()` called unconditionally causes the Chrome DevTools panel to open on every launch in production, consuming screen space and alarming users.

**Prevention:**
```js
if (!app.isPackaged) {
  mainWindow.webContents.openDevTools();
}
```

**Confidence:** HIGH — trivial but frequently shipped.

---

## Adoption / UX Pitfalls

### The "just one more feature" death spiral

**What goes wrong:** Productivity apps fail adoption more often from complexity than from missing features. Each added feature (tags, filters, recurring tasks, sub-tasks, categories) increases cognitive load at exactly the moment users are trying to reduce it. TaskMate's market position is "forces behavioral review" — every feature that makes it feel like a full todo app undermines this positioning.

**Prevention:** Enforce the current out-of-scope list ruthlessly in v1. The reflection modal, weekly summary, and basic task CRUD are the entire value proposition. Ship those well; add nothing else until users explicitly ask for specific features repeatedly.

**Confidence:** HIGH — documented in "Why productivity apps fail" category of product post-mortems (Sunrise Calendar, Workflow acquired by Apple, countless indie apps).

---

### Onboarding to zero — immediate abandonment

**What goes wrong:** Productivity apps that show an empty state with no guidance ("Add your first task!") lose users in the first session. Users who don't immediately understand the app's behavioral loop (task → reminder → reflection → summary) abandon before completing one full cycle.

**Prevention:**
- Seed the app with 2-3 example tasks on first launch.
- Show a 3-step onboarding: "Here's how it works" → "Set your first task" → "We'll remind you at 9 PM to reflect."
- The first 9 PM reflection modal is the product's "aha moment" — ensure users reach it. If they haven't created any tasks by 8:55 PM, prompt them.

**Confidence:** HIGH.

---

### Mandatory reflection that blocks the app

**What goes wrong:** The spec says the reflection modal "requires at least 1 answer to dismiss." If implemented as a truly unbypassable modal that locks all app interaction, users who encounter it at a bad moment (in the middle of looking up a task during a meeting) will resent the app and may uninstall it. Compulsion-based UX rarely survives contact with real users.

**Prevention:**
- Require 1 answer but provide a clearly visible "Snooze 30 minutes" or "Remind me later" option that defers but doesn't permanently dismiss.
- Never make the reflection modal block access to existing tasks. Users should be able to close it minimally (snooze) to complete urgent work.
- Reconsider "requires at least 1 answer" — a softer framing: the modal shows with a count of days since last reflection, and dismissing without answering shows "You can still reflect anytime from the menu." Track non-completion as data rather than preventing it.

**Confidence:** HIGH.

---

### Notification fatigue and re-notification backfire

**What goes wrong:** The re-notification after 10 minutes for incomplete tasks, when stacked with the 9 PM reflection notification, can feel like harassment on a bad day. Two notifications for the same task in 10 minutes + a reflection notification in the same evening = user disables notifications entirely.

**Prevention:**
- Cap re-notifications: only re-notify for tasks that are (a) overdue today, not just incomplete, and (b) were explicitly marked high priority.
- Suppress the task re-notification entirely if the reflection notification is also pending (it's 9 PM) — one nudge at a time.
- Let users set a "Do Not Disturb" window within the app (separate from OS-level DND) that suppresses re-notifications.

**Confidence:** HIGH.

---

### No feedback loop on data

**What goes wrong:** Users who complete daily reflections but never see the weekly summary connected to their behavior abandon the reflection habit. The "behavioral awareness over time" value prop only lands if the weekly summary visibly references the user's own words and patterns.

**Prevention:**
- The weekly summary must quote actual reflection answers, not just statistics.
- Surface the most recent weekly summary prominently (not buried in a menu) every Monday.

**Confidence:** MEDIUM — inferred from user psychology research on habit tracking; not TaskMate-specific data.

---

### App feels like "surveillance" if data is opaque

**What goes wrong:** Users who don't know what data is stored about them (reflection answers, task completion rates, keyword extraction for "top distraction") may feel uncomfortable, especially for a locally-stored reflection tool. The concern is not privacy (it's local), but transparency.

**Prevention:**
- In Settings, show a simple data summary: "You have 47 tasks, 23 reflections, and data going back to March 2026."
- Make "Export all data" and "Delete all data" first-class features, not buried options.

**Confidence:** HIGH.

---

## Critical Risks

Ranked by severity (impact x likelihood):

---

### Risk 1 (CRITICAL): Notifications fire when app is closed — SEVERITY: HIGH

**What it is:** If TaskMate is closed at 9 PM, no reflection notification fires. For a daily-habit app, missing the trigger even a few times breaks the behavioral loop.

**Likelihood:** HIGH — most users don't leave apps running in the background.

**Impact:** Core product value (daily reflection at 9 PM) fails silently. User sees "the app doesn't work" without understanding why.

**Mitigation:**
1. Enable `openAtLogin: true` by default, running as a tray app. Present this as a feature, not a permission grab.
2. Implement catch-up logic: on every app open, check if today's reflection is incomplete and past 9 PM — show immediately.
3. Make the tray icon show a badge when reflection is pending.

---

### Risk 2 (HIGH): Data loss from electron-store corruption — SEVERITY: HIGH

**What it is:** A single-file JSON store with non-atomic writes can produce an invalid file on crash/power loss, wiping all user data with no recovery path.

**Likelihood:** LOW-MEDIUM (crashes are rare; power loss less so on laptops).

**Impact:** CATASTROPHIC for a reflection app — months of personal data gone, instant uninstall, reputational damage.

**Mitigation:**
1. Verify `electron-store` / `conf` version uses atomic writes (write-file-atomic).
2. Implement daily auto-backup to a `data.backup.json` file.
3. Add schema validation to catch partial corruption before it propagates.
4. Consider SQLite with WAL mode instead of JSON for better crash resilience.

---

### Risk 3 (HIGH): White screen on packaged build breaks first-run experience — SEVERITY: HIGH

**What it is:** HashRouter / Vite base path misconfiguration causes a blank app on first install for every user.

**Likelihood:** HIGH — this is the most commonly reported Electron + React packaging issue; easy to miss in dev.

**Impact:** App is immediately perceived as broken. Users uninstall.

**Mitigation:**
1. Use `HashRouter` in production builds.
2. Set `base: './'` in Vite config.
3. Add a CI step that packages the app and smoke-tests the packaged build before any release.

---

### Risk 4 (MEDIUM): Focus Mode / DND silently suppresses 9 PM notification — SEVERITY: MEDIUM

**What it is:** macOS Focus Mode or Windows Focus Assist drops the reflection notification with no feedback to the app. The trigger fires but the user never sees it.

**Likelihood:** HIGH — Focus Mode at 9 PM is a common user configuration ("work wind-down").

**Impact:** MEDIUM — caught by catch-up logic on next app open; not catastrophic but reduces habit reliability.

**Mitigation:**
1. In-app persistent state: "Today's reflection is waiting" badge regardless of notification delivery.
2. Onboarding instruction to add TaskMate to Focus allowlist.
3. Tray icon badge as secondary signal.

---

### Risk 5 (MEDIUM): Re-notification UX causes notification fatigue and uninstall — SEVERITY: MEDIUM

**What it is:** Two task notifications (original + 10-min re-notify) stacked with the 9 PM reflection notification in the same evening creates a harassment pattern.

**Likelihood:** MEDIUM-HIGH — evening is when all notifications converge.

**Impact:** User disables all notifications → app loses its primary behavioral trigger → app abandoned.

**Mitigation:**
1. Suppress task re-notifications after 8:30 PM (reflection window is coming).
2. Cap re-notifications to high-priority overdue tasks only.
3. Never re-notify if the reflection modal is already pending.

---

*Note: All findings are drawn from training knowledge through August 2025 and established Electron/desktop app engineering patterns. External web sources were unavailable during this research session. Claims marked HIGH confidence reflect well-documented, stable behaviors. Claims marked MEDIUM should be verified against current Electron release notes and platform documentation before implementation.*
