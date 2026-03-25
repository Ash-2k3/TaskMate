---
status: resolved
trigger: "App shows black screen after recent changes including adding a DayCap SVG logo via `?react` Vite import"
created: 2026-03-25T10:14:48Z
updated: 2026-03-25T10:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: App dock/window icon is default Electron logo because forge.config.ts has no `icon` in packagerConfig, and BrowserWindow in main/index.ts has no `icon` option set. The DayCap .icns (macOS) and PNG assets don't exist yet.
test: Generate 1024x1024 PNG + .icns from DayCap brand colors, wire into forge.config.ts packagerConfig.icon and BrowserWindow options.
expecting: Dock icon and window icon show DayCap brand icon in dev and packaged builds
next_action: Create icon assets, update forge.config.ts and main/index.ts

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: App starts normally and renders the TodayView UI
actual: Black screen visible in the app window, nothing renders
errors: |
  [92928:0325/101448.192431:ERROR:gpu/command_buffer/service/shared_image/shared_image_manager.cc:360] SharedImageManager::ProduceOverlay: Trying to Produce a Overlay representation from a non-existent mailbox.
  [92928:0325/101448.192498:ERROR:components/viz/service/display_embedder/skia_output_device_buffer_queue.cc:258] Invalid mailbox.
reproduction: Run `npm start` in the project directory
started: After adding DayCap logo SVG via `import DayCapLogo from '../../assets/daycap-logo.svg?react'` in TodayView.tsx, plus nav icon and UI changes

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-25T10:16:00Z
  checked: package.json devDependencies and dependencies
  found: vite-plugin-svgr is completely absent from package.json
  implication: The `?react` suffix import cannot be processed by Vite — no transform plugin exists for it

- timestamp: 2026-03-25T10:16:00Z
  checked: vite.renderer.config.ts plugins array
  found: Only `react()` from `@vitejs/plugin-react` is configured; no svgr plugin
  implication: Even if vite-plugin-svgr were installed, it would not be active — the import fails

- timestamp: 2026-03-25T10:16:00Z
  checked: src/renderer/screens/TodayView.tsx line 10
  found: `import DayCapLogo from '../../assets/daycap-logo.svg?react';` — this is the crash point
  implication: Vite cannot transform this import, causing a module resolution error that crashes the renderer

- timestamp: 2026-03-25T10:16:00Z
  checked: src/assets/daycap-logo.svg
  found: Simple SVG (28 lines) with gradient defs, 3 shape elements, and a text wordmark — easily inlineable as JSX
  implication: Fix can inline as JSX component directly in TodayView.tsx; no new npm dependency needed

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: |
  1. (RESOLVED) Black screen: TodayView.tsx used `?react` SVG import requiring vite-plugin-svgr, which was not installed. Vite could not resolve the import, crashing the renderer process.
  2. (RESOLVED) App icon: forge.config.ts had no `icon` in packagerConfig; BrowserWindow had no `icon` option; no icon assets existed beyond a 22x22 tray-icon.png.
  3. (BENIGN) GPU errors (SharedImageManager::ProduceOverlay, Invalid mailbox): Chromium hardware rendering warnings unrelated to app code — benign, no fix needed.
fix: |
  1. Inlined DayCapLogo as JSX component in TodayView.tsx — no new dependency.
  2. Generated src/assets/icon.png (1024x1024, cyan-indigo gradient, "DC" initials) and src/assets/icon.icns via sips+iconutil. Added `icon: 'src/assets/icon'` to forge.config.ts packagerConfig. Added BrowserWindow `icon` option and `app.dock.setIcon()` call in main/index.ts for dev mode.
verification: confirmed by user — app starts correctly, DayCap logo shows in header, dock icon matches in-app logo, branding is consistent
files_changed:
  - src/renderer/screens/TodayView.tsx
  - src/assets/icon.png
  - src/assets/icon.icns
  - forge.config.ts
  - src/main/index.ts
