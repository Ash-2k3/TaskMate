---
phase: quick
plan: 260325-el8
subsystem: branding
tags: [icon, svg, branding, assets]
key-files:
  created: []
  modified:
    - src/assets/icon.png
    - src/assets/icon.icns
    - src/renderer/screens/TodayView.tsx
    - src/assets/daycap-logo.svg
decisions:
  - Used quadratic bezier (Q command) for in-app arc — simpler and more visually consistent with icon than elliptical arc (A command)
  - Generated icon.icns via sips + iconutil (macOS built-in) from 1024px PNG
  - Removed center tick/antenna element entirely — cleaner mark with just brim + arc
metrics:
  duration: ~10 minutes
  completed: 2026-03-25
---

# Quick Task 260325-el8: Unify DayCap Branding — Cap/Arc Icon Summary

**One-liner:** Arc-over-brim cap symbol in cyan-to-indigo gradient applied to both the macOS app icon (icon.png/icon.icns) and the in-app header logo (TodayView.tsx inline SVG).

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Generate unified app icon (icon.png + icon.icns) | 0e31540 | src/assets/icon.png, src/assets/icon.icns |
| 2 | Update in-app logo SVG to match the icon mark | e7fe355 | src/renderer/screens/TodayView.tsx, src/assets/daycap-logo.svg |

## What Was Built

### Icon (Task 1)
- Used Node.js `canvas` (installed as dev dep, uninstalled after) to generate a 1024x1024 PNG programmatically
- Dark background (#0f1117), macOS rounded-rect clip (180px corner radius)
- Two strokes in cyan-to-indigo linear gradient (60px line width for boldness):
  - Brim: horizontal line across ~60% of canvas width at y=620
  - Arc: quadratic bezier peaking at y=360 (about 25% above center)
- Generated icon.icns with all required sizes (16/32/128/256/512 at 1x and 2x) using `sips` and `iconutil`

### In-App Logo (Task 2)
- Replaced old cap-with-antenna shape in `DayCapLogo` SVG component
- New mark: brim line (`x1=2 y1=22 x2=22 y2=22`) + quadratic bezier arc (`M4 22 Q12 8 20 22`)
- Both strokes use `url(#daycap-grad)` gradient, strokeWidth 2.5, rounded linecaps
- "DayCap" wordmark unchanged (gradient fill, Inter 18px 600 weight)
- `daycap-logo.svg` standalone file updated to match

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/assets/icon.png` — confirmed: PNG image data, 1024 x 1024, 8-bit/color RGBA
- `src/assets/icon.icns` — confirmed: Mac OS X icon, 133895 bytes
- `src/renderer/screens/TodayView.tsx` — confirmed: contains daycap-grad and DayCap
- Commits 0e31540 and e7fe355 verified in git log
- No leftover scripts/ directory or canvas dev dependency
