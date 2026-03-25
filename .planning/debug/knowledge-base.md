# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## black-screen-on-npm-start — SVG `?react` import crashes renderer when vite-plugin-svgr is absent
- **Date:** 2026-03-25
- **Error patterns:** black screen, SharedImageManager, ProduceOverlay, Invalid mailbox, svg, ?react, import, renderer
- **Root cause:** TodayView.tsx used `import X from '*.svg?react'` which requires vite-plugin-svgr. The plugin was not installed and not configured in vite.renderer.config.ts, so Vite could not resolve the import, crashing the renderer process and producing a black screen.
- **Fix:** Inlined the SVG as a JSX component directly in TodayView.tsx (no new dependency). Also added app icon assets (icon.png, icon.icns) and wired them into forge.config.ts packagerConfig and BrowserWindow/app.dock.setIcon() in main/index.ts.
- **Files changed:** src/renderer/screens/TodayView.tsx, src/assets/icon.png, src/assets/icon.icns, forge.config.ts, src/main/index.ts
---

