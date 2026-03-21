# Project Research Summary

**Project:** TaskMate
**Domain:** Local-first desktop productivity app (Electron + React) — task management with behavioral reinforcement via daily reflection and weekly summaries
**Researched:** 2026-03-21
**Confidence:** HIGH

---

## Executive Summary

TaskMate is a behavioral habit app dressed as a task manager. The product's differentiator is not task tracking — it is the feedback loop: tasks logged during the day, a fixed-time reflection that extracts learnings, and a weekly summary that names patterns. Every architecture and UX decision must protect this loop. The recommended build approach is a "thin renderer / fat main" Electron app: React handles all UI in the renderer process, while the main process owns SQLite persistence, node-cron scheduling, system tray, and native notifications — all connected through a typed contextBridge IPC layer. This split is not optional: scheduler and notification reliability depend on the main process surviving window close, which only works with a system tray pattern.

The stack is high-confidence and uncontroversial: Electron Forge with Vite, React 18 with TypeScript, better-sqlite3 for task and reflection data, electron-store for settings, Zustand for UI state, node-cron for scheduling, and Electron's built-in Notification API. The only meaningful tension in the stack is between electron-store (zero-config, adequate for MVP) and better-sqlite3 (more robust, required if data volume or query complexity grows). Research from both STACK.md and ARCHITECTURE.md converges on: use electron-store for MVP behind a DataService abstraction layer, design for a clean migration to SQLite without rewriting React components, and do the migration if the user's dataset exceeds ~500 tasks or weekly summary queries become slow.

The top three risks are all well-mitigated but must be addressed in Phase 1, not deferred: (1) the app must run as a login item with a system tray so the 9 PM reflection trigger fires even when the user hasn't opened the app — this is the core product promise and has no fallback; (2) electron-store's JSON file needs atomic writes and a daily backup to prevent total data loss on crash; (3) the React router must use HashRouter and Vite must set `base: './'` or the packaged app will show a blank white screen for every new user. These are not edge cases — they are the top reported failure modes for Electron + React apps and are completely preventable with day-one configuration.

---

## Key Findings

### Recommended Stack

The full recommended stack is a tight, well-validated set. Electron Forge with the Vite template is the official starting point — it delivers HMR in development, handles native module rebuilds automatically, and produces platform-native installers via `npm run make`. React 18 with TypeScript runs in the renderer; Zustand (separate stores per domain: tasks, reflections, UI) manages client state without Redux boilerplate. All data persistence lives in the main process: better-sqlite3 for relational task and reflection data (full SQL, transactions, indexes), electron-store for settings and preferences only.

One critical version note: electron-store v9+ is ESM-only. If the Electron Forge Vite template uses a CommonJS main process (the default), pin electron-store to v8.x or handle the dynamic import carefully. Similarly, better-sqlite3 must be rebuilt against Electron's bundled Node version via `electron-rebuild` — this is handled automatically by Forge but must be confirmed in the CI pipeline.

**Core technologies:**
- **Electron (latest stable) + Electron Forge + Vite:** App runtime and build tooling — official recommended path, handles native rebuilds automatically
- **React 18 + TypeScript:** Renderer UI — standard, no novel choices needed
- **better-sqlite3:** Primary data store for tasks, reflections, summaries — SQL queries, transactions, and crash resilience outweigh the native-rebuild setup cost
- **electron-store (v8.x):** Settings and preferences only — zero-config, appropriate for flat key-value data
- **Zustand (v4+):** UI state management — minimal boilerplate, domain-separated stores, no Redux overhead
- **node-cron:** In-process scheduler for 9 PM reflection and Sunday summary triggers — cron syntax, timezone-aware, pairs with powerMonitor wake guard
- **Electron Notification API:** Native OS notifications from main process — zero dependencies, replaces legacy node-notifier entirely

### Expected Features

Research validated all core features and added important behavioral nuance to their implementation. The "Today" view is the product's primary surface and must cap at 7 visible tasks — cognitive load research is unambiguous that showing the full backlog alongside today's work is the primary driver of app abandonment. The daily reflection is validated at exactly 3 questions (behavioral science confirms this as the sweet spot) with a specific question order: grounding → learning → forward intention. The weekly summary must show specific deferred task titles, not completion percentages — named tasks force re-decision; statistics allow comfortable avoidance.

**Must have (table stakes — v1):**
- Task CRUD with optional due date and three-tier priority (High / Normal / Low) — no P1/P2/P3 inflation
- "Today" view capped at 7 items; completed tasks removed immediately from view, archived for weekly summary
- Daily reflection modal at 9 PM with exactly 3 fixed questions; requires at least 1 answer (with snooze, not hard block)
- Native OS notifications for task reminders (batched, not per-task) and the 9 PM reflection prompt
- Re-notification once after 10 minutes for task reminders — suppressed after 8:30 PM to avoid evening notification pile-up
- Weekly summary every Sunday showing deferred task titles, reflection streak count, and top keyword from reflection answers
- System tray mode with login-item registration so scheduling survives window close
- Data export (JSON or CSV) on first release — not a v2 feature; reflection data has high perceived value and loss is catastrophic

**Should have (differentiators that make TaskMate distinct):**
- Pre-fill reflection Question 1 with today's completed task count to reduce blank-page anxiety
- Oldest neglected task surfaced in weekly summary ("This task has been on your list for 14 days") — the most behavior-changing line in the summary
- Distraction keyword extraction from reflection answers using pure-JS tokenization + stop-word filter (no NLP library needed for MVP)
- In-app "reflection pending" badge on tray icon as fallback when OS notifications are suppressed by Focus Mode / DND
- Catch-up logic on app open: if past 9 PM and reflection not completed, show modal immediately regardless of notification state
- Calm empty-state message on Today view when all tasks are done ("You're clear for today")
- 3-step onboarding with seeded example tasks; first 9 PM reflection modal is the product's "aha moment"
- Data transparency in Settings: record count, date range, delete-all and export-all as first-class actions

**Defer to v2+:**
- TF-IDF keyword weighting (requires 4+ weeks of historical data to be meaningful; simple frequency counting delivers 80% of the insight)
- Numeric focus self-rating (1-5 slider on reflection) and weekly energy trend
- Tags and filtering by tag
- Recurring tasks
- Sub-tasks
- Cloud sync of any kind
- Sentiment analysis on reflection answers

### Architecture Approach

TaskMate follows the "thin renderer / fat main" Electron pattern. The renderer is a React SPA responsible only for display and user interaction; it has no direct access to the filesystem, scheduler, or OS APIs. The main process owns everything durable: SQLite (via better-sqlite3), electron-store settings, node-cron jobs, native notifications, and the system tray. The two sides communicate exclusively through a typed contextBridge API exposed via a preload script — `window.taskmate.*` in the renderer. Main-to-renderer push events (9 PM trigger, weekly summary ready) travel via `mainWindow.webContents.send()`. This architecture is not a preference — it is mandated by Electron's security model (nodeIntegration: false, contextIsolation: true since Electron 12) and by the operational requirement that scheduling survive window close.

**Major components:**

1. **Main process — `src/main/`:** App entry, BrowserWindow creation, startup sequence, IPC handler registration
2. **Store layer — `store.ts` (main):** All better-sqlite3 and electron-store read/write operations; wrapped in a DataService class for future SQLite migration
3. **Scheduler — `scheduler.ts` (main):** node-cron jobs for daily reflection (9 PM) and weekly summary (Sunday 8 PM); per-minute task reminder check; powerMonitor wake guard; startup catch-up check
4. **Notifications — `notifications.ts` (main):** Notification wrappers with platform-specific handling (AppUserModelId on Windows, DND awareness on macOS)
5. **Tray — `tray.ts` (main):** System tray icon, context menu, window hide-to-tray interceptor, dock hide/show on macOS
6. **Preload — `preload.ts`:** contextBridge exposure of typed `window.taskmate` API; no raw ipcRenderer exposure
7. **Renderer — `src/renderer/`:** React components (Today view, task form, reflection modal, weekly summary view); Zustand stores for tasks, reflections, and UI state; custom hooks wrapping `window.taskmate.*` calls

### Critical Pitfalls

1. **App closed at 9 PM = no reflection notification (CRITICAL)** — The entire product promise fails silently if the main process is not running. Mitigation: register as a login item (`app.setLoginItemSettings({ openAtLogin: true })`) with system tray by default; implement startup catch-up check; show tray badge when reflection is pending. This must ship in Phase 1.

2. **electron-store data loss on crash (HIGH)** — Single-file JSON store without atomic writes can be corrupted on crash or power loss, wiping all user data. Mitigation: verify conf/electron-store version uses `write-file-atomic` (conf 10+ does); add daily backup to `data.backup.json`; add schema validation on store load. Address in Phase 1 before any user data is written.

3. **White screen on packaged build (HIGH)** — HashRouter is required in production Electron builds; `BrowserRouter` generates paths the filesystem cannot resolve. Vite must set `base: './'`. Mitigation: configure both before writing a single component; add a CI packaging smoke test. Address in Phase 1.

4. **Native module rebuild mismatch for better-sqlite3 (HIGH)** — better-sqlite3 compiled against system Node fails silently in packaged Electron (different Node version). Mitigation: `"postinstall": "electron-rebuild"` in package.json; CI runs rebuild before packaging. Address when adding better-sqlite3.

5. **Evening notification pile-up causes fatigue and uninstall (MEDIUM)** — Task re-notification (10 min) stacked with the 9 PM reflection notification creates a harassment pattern. Mitigation: suppress task re-notifications after 8:30 PM; only re-notify high-priority overdue tasks; never re-notify if reflection notification is pending. Address in notification implementation phase.

---

## Implications for Roadmap

Based on the combined research, 5 phases are recommended. The ordering is driven by three dependencies: (1) the IPC + storage foundation must exist before any feature can work; (2) the system tray and scheduler must exist before notification reliability can be tested; (3) reflection and weekly summary depend on task data existing and being queryable.

### Phase 1: Foundation — Electron Shell, IPC, Storage, and Tray

**Rationale:** Every other phase depends on this. The IPC pattern (contextBridge + preload), storage layer (better-sqlite3 + electron-store), and system tray must be correct from day one — retroactively fixing security misconfigurations or swapping routers in a packaged app is significantly more painful than setting them up correctly initially. This phase also addresses the three highest-severity risks before any user-facing feature is built.

**Delivers:**
- Working Electron Forge + Vite + React + TypeScript scaffold
- contextBridge preload with typed `window.taskmate` API surface (all channels stubbed)
- better-sqlite3 initialized with WAL mode, schema created, DataService wrapper class
- electron-store for settings (window bounds, theme, notification time, timezone)
- System tray with hide-to-window behavior; login item registration
- HashRouter configured; Vite `base: './'` set
- CSP headers set in index.html; devtools gated on `!app.isPackaged`
- Daily auto-backup of data file; schema validation on store load
- AppUserModelId set on Windows
- CI pipeline: install → electron-rebuild → package → smoke test

**Avoids:** White screen on packaged build (Risk 3), native module mismatch (Pitfall 4), nodeIntegration security hole (Pitfall 1), electron-store corruption (Risk 2)

**Research flag:** Standard patterns — skip phase research. All decisions are well-documented and unambiguous.

---

### Phase 2: Task Management Core

**Rationale:** Tasks are the primary data source that feeds every other feature (notifications, reflection pre-fill, weekly summary). The Today view is the product's primary surface and must be correct before building anything on top of it. UX decisions from FEATURES.md (7-task cap, immediate removal on complete, no completion dialogs, three-tier priority with visual differentiation) are well-validated and should not be deferred or simplified.

**Delivers:**
- Task CRUD (create, edit, complete, delete) wired through IPC to better-sqlite3
- Today view: filtered to due-today and pinned tasks, capped at 7 visible with overflow collapse
- Full task list as secondary surface
- Priority display: High (bold + left border), Normal (default), Low (greyed)
- Overdue badge ("2 days ago") without red-alarm styling
- Empty Today state: calm success message
- Completed tasks removed from Today immediately; archived in DB for later querying
- 3-step first-launch onboarding with 2-3 seeded example tasks
- Zustand useTaskStore wired to IPC layer

**Avoids:** Overwhelming backlog view (FEATURES: Today cap), priority inflation (FEATURES: three-tier only), completion anxiety (FEATURES: immediate removal)

**Research flag:** Standard patterns — skip phase research.

---

### Phase 3: Notifications and Scheduling

**Rationale:** Notifications depend on tasks (due-date reminders require task data) and must be built before the reflection modal so the 9 PM trigger mechanism is in place and testable. This is the phase with the most Electron-specific risk — platform differences in notification behavior (macOS permissions, Windows AUMID, Focus Mode) must be validated against real packaged builds.

**Delivers:**
- node-cron scheduler in main process: daily 9 PM job, Sunday 8 PM job, per-minute task reminder check
- powerMonitor wake guard to re-evaluate triggers after system sleep
- Startup catch-up check: if past 9 PM and no reflection, trigger immediately on app open
- Batched task due-date notifications (one summary notification for all tasks due today, not per-task)
- Re-notification once after 10 minutes for high-priority overdue tasks only
- Re-notification suppressed after 8:30 PM
- Notification click handler: `mainWindow.show(); mainWindow.focus();`
- Tray icon badge when reflection is pending
- macOS: first-launch notification permission prompt with explanation; link to System Settings if denied
- Windows: AppUserModelId set (from Phase 1), toast attribution verified
- In-app notification state persisted in electron-store (notifiedAt, renotified) to survive restarts

**Avoids:** App-closed notification gap (Risk 1), evening notification fatigue (Risk 5), macOS silent permission failure (Pitfall), Windows AUMID silent failure (Pitfall)

**Research flag:** Needs phase research. Platform-specific notification behavior (macOS 14+ Sonoma permission flow, Windows 11 Focus Assist API surface) should be validated against current Electron release notes before implementation. node-cron timezone behavior on Windows also needs a focused check.

---

### Phase 4: Daily Reflection

**Rationale:** Reflection depends on the notification trigger (Phase 3) to reach users at the right moment. Building the modal before the trigger exists means it can only be tested by manually opening it, which does not validate the full behavioral loop. The question set and UX constraints from FEATURES.md (exactly 3 questions, specific order, pre-fill with task count, snooze not hard-block) are research-validated and should be implemented as specified.

**Delivers:**
- Reflection modal triggered by IPC event from main process (9 PM cron + startup catch-up)
- Three fixed questions in validated order: grounding → learning → forward intention
- Question 1 pre-filled with completed task count: "You finished N tasks today. What else..."
- Requires at least 1 answer to fully dismiss; "Snooze 30 minutes" option always visible
- Modal does not block access to existing tasks (snooze available at all times)
- Reflection saved to better-sqlite3 keyed by ISO date string
- `hasReflection(date)` check prevents duplicate prompting on same day
- Reflection history accessible from main UI (not buried)
- Zustand useReflectionStore wired to IPC layer

**Avoids:** Compulsion-based UX causing uninstall (Pitfall: mandatory reflection that blocks the app), blank-page anxiety (FEATURES: pre-fill with task count)

**Research flag:** Standard patterns — skip phase research. Question content is research-validated; modal implementation follows standard React patterns.

---

### Phase 5: Weekly Summary and Keyword Analysis

**Rationale:** Weekly summary requires both task data (completion, deferral) and reflection data (answers from all 7 days) to be meaningful. It is correctly the last feature because it synthesizes everything else. The keyword analysis implementation is straightforward (pure-JS tokenization + stop-word filter, ~50 lines) and requires no NLP library for MVP.

**Delivers:**
- node-cron Sunday 8 PM summary generation (already scheduled in Phase 3, now implemented)
- Summary aggregates: tasks completed, tasks deferred (with specific titles listed), reflection streak count
- Deferred task list shows task titles not counts — forces re-decision
- Oldest neglected task surfaced by name ("This task has been on your list for 14 days")
- Top keyword from reflection answers: tokenize → lowercase → strip punctuation → remove stop words → frequency count → top result; domain stop words included (today, day, work, task, done, etc.)
- Bigram detection for two-word phrases (optional, implement if time allows)
- Keyword labeled "recurring topic" not "distraction" in UI
- Summary displayed as text (no charts), surfaces on Monday morning if missed Sunday
- WeeklySummary saved to better-sqlite3; previous summaries accessible
- Data transparency in Settings: record counts, date range, Export all (JSON), Delete all

**Avoids:** Vanity metrics that don't change behavior (FEATURES: no completion percentages as headline), TF-IDF overengineering (FEATURES: defer to v2), data opacity causing distrust (Pitfall: surveillance feeling)

**Research flag:** Standard patterns for summary display and keyword extraction — skip phase research. If bigram detection is included, verify `natural` npm library compatibility with current Electron version.

---

### Phase Ordering Rationale

- Phase 1 before everything: IPC, storage, tray, and routing configuration are foundational. Wrong decisions here require rewrites; correct decisions are permanent.
- Phase 2 before Phase 3: Notifications for task due dates require tasks to exist in the database. Today view design also validates data model before the reflection modal depends on it.
- Phase 3 before Phase 4: The 9 PM trigger must be working and tested before the reflection modal is built, or the modal can only be tested in isolation and the full loop is never validated until late.
- Phase 4 before Phase 5: Weekly summary needs at least 7 days of reflection data to be meaningful. Building the summary UI before reflection works means integration testing is blocked.
- Data export in Phase 5 (not later): Reflection data has high perceived permanence value. Shipping without export means any bug that corrupts data in v1 has no recovery path for users. Export must be present at first public release.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Notifications):** macOS 14+ Sonoma notification permission flow has changed across recent releases; Windows 11 Focus Assist API surface via Electron is not fully documented in training data. Validate against current Electron release notes (v28+) before implementation. Also verify node-cron timezone handling on Windows produces correct wall-clock firing times.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** contextBridge, better-sqlite3 setup, Electron Forge Vite template — all follow official documented patterns with no ambiguity.
- **Phase 2 (Task Management):** React component patterns, Zustand store wiring, IPC CRUD — fully standard.
- **Phase 4 (Reflection):** Modal UX, IPC event handling, SQLite writes — standard patterns throughout.
- **Phase 5 (Weekly Summary):** Pure-JS NLP is straightforward; SQL aggregation queries on better-sqlite3 are standard.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended packages (Electron Forge, better-sqlite3, Zustand, node-cron) are long-standing with stable documented APIs. One version risk: electron-store ESM shift at v9 — pin to v8.x. Version numbers should be verified against npm before starting. |
| Features | HIGH | Task management UX findings (Today cap, completion behavior, priority inflation) draw on well-replicated UX research (Nielsen Norman Group, GTD). Reflection question format draws on Gollwitzer (1999) implementation intentions and Seligman positive psychology — extensively replicated. Weekly summary metric recommendations are MEDIUM confidence (behavioral economics literature, not controlled studies). |
| Architecture | HIGH | Main/renderer split, contextBridge IPC, and tray pattern are stable Electron fundamentals since v12. electron-store sufficiency for MVP data volume is MEDIUM — reasonable assumption for <500 tasks but not a hard limit; DataService abstraction makes migration safe. |
| Pitfalls | HIGH | Top risks (app-closed notification gap, electron-store corruption, white screen on packaged build, native module mismatch) are the canonical Electron failure modes documented in official guides and community post-mortems. macOS Focus Mode suppression behavior and Windows Focus Assist API surface are MEDIUM — behavior has varied across OS versions. |

**Overall confidence:** HIGH

### Gaps to Address

- **electron-store atomic write confirmation:** Verify that the pinned version of `conf` (electron-store's dependency) uses `write-file-atomic` by default. Check the conf package changelog for the specific version before writing any data.
- **node-cron Windows timezone behavior:** Validate that cron expressions fire at the correct wall-clock time on Windows, particularly around DST transitions. May require the `timezone` option explicitly set from user preferences.
- **macOS notification permission flow on Sonoma (14+):** The permission dialog behavior has changed across recent macOS versions. Test on macOS 14 specifically; the first-notification trigger approach may need adjustment.
- **better-sqlite3 / Electron version compatibility matrix:** Verify the exact better-sqlite3 version that supports the current Electron's bundled Node version before committing to it. The electron-rebuild postinstall script handles the rebuild but the compatible version range must be checked.
- **SQLite migration threshold:** electron-store is adequate for MVP, but "adequate" needs a concrete number. Recommendation: run a benchmark at 500 tasks + 365 reflections and measure store parse time. If it exceeds 100ms on a mid-range machine, migrate to SQLite in the same release cycle rather than waiting for v2.

---

## Sources

### Primary (HIGH confidence)

- Electron official documentation — contextBridge, IPC patterns, Notification API, Tray API, security checklist (nodeIntegration, CSP), BrowserWindow webPreferences
- Electron Forge documentation — Vite template, plugin-vite, native module rebuild
- better-sqlite3 README and API docs — synchronous API, WAL mode, prepared statements
- node-cron README — cron expression syntax, timezone option
- Gollwitzer (1999), "Implementation Intentions" — reflected in FEATURES.md reflection question design
- Seligman (2011), positive psychology interventions — reflected in FEATURES.md question ratio recommendation
- Nielsen Norman Group — cognitive load, Today view cap, task list UX
- Iqbal & Bailey (2006), Microsoft Research — notification interruption cost (23-minute recovery)
- Apple Human Interface Guidelines — notification design, permission model
- GTD (Getting Things Done) methodology — inbox vs. today separation
- Things 3 / Omnifocus design patterns — Today view, capture vs. commitment separation

### Secondary (MEDIUM confidence)

- Beeminder / Habitica product retrospectives — vanity vs. behavior-changing metrics in weekly summaries
- Behavioral economics literature (Fogg's Tiny Habits model) — habit loop design for reflection scheduling
- Electron community post-mortems — white screen on packaged build (HashRouter / Vite base path), IPC listener memory leaks
- conf package changelog — atomic write behavior (verify current version)

### Tertiary (needs validation)

- macOS Sonoma (14+) notification permission flow — behavior has varied; verify against current Electron release notes
- Windows 11 Focus Assist suppression behavior via Electron APIs — inferred from known API surface, not directly verified
- node-cron DST handling on Windows — community-reported behavior, not officially documented

---

*Research completed: 2026-03-21*
*Ready for roadmap: yes*
