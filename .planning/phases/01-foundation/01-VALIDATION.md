---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (renderer unit tests) + manual smoke tests (Electron packaged build) |
| **Config file** | `vitest.config.ts` — Wave 0 creates it |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test && npm run make -- --dry-run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test && npm run make -- --dry-run`
- **Before `/gsd:verify-work`:** Full suite must be green + packaged build manual smoke test
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 1-01-01 | 01 | 1 | FOUND-01 | manual | `npm start` — window opens, no white screen | ⬜ pending |
| 1-01-02 | 01 | 1 | FOUND-05 | unit | `grep -r "connect-src 'none'" src/` | ⬜ pending |
| 1-01-03 | 01 | 1 | FOUND-06 | manual | DevTools performance tab, interactions < 200ms | ⬜ pending |
| 1-02-01 | 02 | 1 | FOUND-04 | unit | `npm test -- --testPathPattern=dataservice` | ⬜ pending |
| 1-02-02 | 02 | 1 | FOUND-04 | manual | Write task → restart app → task still present | ⬜ pending |
| 1-03-01 | 03 | 2 | FOUND-01 | unit | `grep "contextIsolation: true" src/main/` | ⬜ pending |
| 1-03-02 | 03 | 2 | FOUND-02 | manual | Close window → app in tray, process still alive | ⬜ pending |
| 1-03-03 | 03 | 2 | FOUND-03 | manual | Reboot → TaskMate auto-launches | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — configure vitest for renderer-side unit tests
- [ ] `src/tests/dataservice.test.ts` — stub tests for DataService read/write/persistence
- [ ] `src/tests/ipc.test.ts` — stub tests for contextBridge channel names

*Wave 0 creates test infrastructure before plan 01-02 writes DataService.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No white screen on packaged build | FOUND-01 | Requires actual packaging + launch | Run `npm run make`, open installer, launch app |
| Minimize-to-tray survives close | FOUND-02 | Requires OS-level window management | Click window close → check system tray icon remains |
| Login item auto-start | FOUND-03 | Requires system reboot | Enable login item in app → reboot → verify app launches |
| Data persists across restart | FOUND-04 | Requires full app lifecycle | Write data → `npm run make` packaged restart → data present |
| Offline works fully | FOUND-05 | Requires network isolation | Disable network → use all app features → no errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
