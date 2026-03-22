---
phase: 5
slug: weekly-summary
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | SUMMARY-02, SUMMARY-05 | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-01-02 | 01 | 1 | SUMMARY-02 | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-01-03 | 01 | 1 | SUMMARY-02, SUMMARY-03 | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-01-04 | 01 | 1 | SUMMARY-05 | unit | `npx vitest run --reporter=verbose src/__tests__/data-service.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-02-01 | 02 | 0 | SUMMARY-03 | unit | `npx vitest run --reporter=verbose src/__tests__/keyword-extractor.test.ts` | ❌ W0 new | ⬜ pending |
| 05-02-02 | 02 | 1 | SUMMARY-03 | unit | `npx vitest run --reporter=verbose src/__tests__/keyword-extractor.test.ts` | ❌ W0 new | ⬜ pending |
| 05-03-01 | 03 | 0 | SUMMARY-01 | unit | `npx vitest run --reporter=verbose src/__tests__/reminder-scheduler.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-03-02 | 03 | 1 | SUMMARY-01 | unit | `npx vitest run --reporter=verbose src/__tests__/reminder-scheduler.test.ts` | ❌ W0 extend | ⬜ pending |
| 05-03-03 | 03 | 1 | SUMMARY-04 | manual | Visual inspection of WeeklySummary screen | N/A | ⬜ pending |
| 05-03-04 | 03 | 2 | SUMMARY-05 | manual | Open app, navigate to Summary tab, verify past weeks selectable | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/keyword-extractor.test.ts` — new file; covers SUMMARY-03 (extractTopKeyword unit tests: top word returned, null when all stop words, null for empty input)
- [ ] `src/__tests__/data-service.test.ts` — extend existing file with new `describe` blocks: `getWeeklySummaryStats`, `getDeferredTasks`, `saveWeeklySummary`, `hasWeeklySummary`, `getAllWeeklySummaries`, `getDataStats`, `deleteAllData`, `getAllTasksForExport`
- [ ] `src/__tests__/reminder-scheduler.test.ts` — extend existing file with Sunday 20:00 weekly summary trigger tests (mock `isSunday`, `startOfWeek`, `DataService.hasWeeklySummary`, `DataService.saveWeeklySummary`, `Notification`)

*Existing mock infrastructure (MockNotification, vi.mock('electron'), vi.mock('node-cron'), vi.resetModules pattern) is directly reusable.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WeeklySummary screen renders empty state text | SUMMARY-04 | React rendering requires real renderer | Launch app, navigate to `/summary`, verify "No summary yet. Your first will appear this Sunday evening." |
| Past summaries selector shows most-recent-first | SUMMARY-05 | Requires multiple DB entries | Seed 2+ weekly summaries, open Summary tab, verify dropdown/list order |
| Settings screen shows correct record counts | SUMMARY-05 | Requires live DB state | Add tasks/reflections, open Settings, verify counts match DB |
| Export JSON writes valid file | SUMMARY-05 | Requires Electron dialog | Click Export, save file, open it, verify JSON is valid and includes all tables |
| Delete all clears app and navigates to Today | SUMMARY-05 | Requires full app state | Confirm deletion, verify TodayView shows empty state |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
