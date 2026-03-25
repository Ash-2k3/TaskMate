---
phase: quick
plan: 260325-dzg
type: execute
wave: 1
depends_on: []
files_modified:
  - src/assets/daycap-logo.svg
  - src/renderer/screens/TodayView.tsx
autonomous: true
requirements: []

must_haves:
  truths:
    - "DayCap logo appears in TodayView header, replacing the plain 'Today' h1 text"
    - "Logo uses the cyan/indigo gradient and looks cohesive with the glassmorphism dark theme"
    - "Logo is an SVG asset importable from anywhere in the renderer"
  artifacts:
    - path: "src/assets/daycap-logo.svg"
      provides: "Standalone SVG logo asset usable across the app"
    - path: "src/renderer/screens/TodayView.tsx"
      provides: "TodayView header updated to render the logo"
  key_links:
    - from: "src/renderer/screens/TodayView.tsx"
      to: "src/assets/daycap-logo.svg"
      via: "import as React component (vite svg plugin) or img src"
      pattern: "daycap-logo"
---

<objective>
Create a DayCap SVG logo and render it in the TodayView header, replacing the plain "Today" h1 text with the branded logo mark. The logo must feel native to the glassmorphism dark theme — cyan-to-indigo gradient fill, clean geometry, no drop shadows that fight the backdrop-blur surfaces.

Purpose: Gives the app a distinct identity that matches the product name and design language.
Output: `src/assets/daycap-logo.svg` (reusable asset) + updated TodayView header.
</objective>

<execution_context>
@~/.claude/get-shit-done/workflows/execute-plan.md
@~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/renderer/screens/TodayView.tsx

<interfaces>
<!-- Current TodayView header (lines 56-65): -->
```tsx
<div className="glass rounded-2xl flex items-start justify-between mx-4 mt-4 mb-0 px-4 py-4">
  <div>
    <h1 className="text-2xl font-semibold text-foreground">Today</h1>
    <p className="text-ui text-muted-foreground mt-1">
      {format(new Date(), 'EEEE, d MMMM')}
    </p>
  </div>
  {/* settings icon button on the right */}
</div>
```

Design tokens in use:
- Background: #080810
- Cyan: #06b6d4  (tailwind: cyan-400 / --color-cyan-400)
- Indigo: #6366f1 (tailwind: indigo-500 / --color-indigo-500)
- Glass surfaces: backdrop-filter: blur(16px), rgba(255,255,255,0.06) bg
- Font: Inter, weights 400/500/600
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create DayCap SVG logo asset</name>
  <files>src/assets/daycap-logo.svg</files>
  <action>
Create `src/assets/daycap-logo.svg` — a wordmark / logomark for "DayCap" using the cyan-to-indigo gradient.

Design spec:
- viewBox: "0 0 140 36" (horizontal wordmark, fits the header left slot)
- Define a linearGradient id="daycap-grad" from cyan (#06b6d4) at x1="0%" to indigo (#6366f1) at x2="100%", y1/y2="0%"
- Draw a small cap/arc icon to the left of the text (represents the "cap" in DayCap — a semicircle arc ~20x14px, stroke-only, stroke="url(#daycap-grad)", strokeWidth="2", fill="none", with a short vertical tick at the center top like a graduation cap)
- Render the text "DayCap" using a `<text>` element: font-family="Inter, system-ui, sans-serif", font-size="18", font-weight="600", fill="url(#daycap-grad)", y baseline aligned with the icon center
- The icon sits at x=0, text starts at x=28
- No drop shadows, no opacity less than 0.9 on fills, no animation

If a pure-geometry cap icon feels overly complex, use a simpler alternative: a filled circle segment (like a sun rising above a line) as the mark — still gradient-filled, ~18px wide. The key constraint is: icon + "DayCap" wordmark, gradient-filled, fits in ~140x36 viewBox, looks intentional at 28-36px rendered height.

The SVG must be self-contained (no external font references — the `<text>` font-family is a hint only; the rendered result in Electron uses the app's loaded Inter font automatically since SVG text inherits from the DOM when inlined, and looks fine as a standalone file too).
  </action>
  <verify>
    <automated>test -f /Users/ashwath/Desktop/Personal/AuctionX/src/assets/daycap-logo.svg && echo "EXISTS" || echo "MISSING"</automated>
  </verify>
  <done>File exists, opens correctly in a browser/SVG viewer, gradient is visible, wordmark is legible at 28-36px height.</done>
</task>

<task type="auto">
  <name>Task 2: Render logo in TodayView header</name>
  <files>src/renderer/screens/TodayView.tsx</files>
  <action>
Replace the `<h1 className="text-2xl font-semibold text-foreground">Today</h1>` in TodayView's glass header with an inline SVG import of the DayCap logo.

Vite supports SVG imports as React components via `?react` suffix (already available in this project's Vite config — it uses `@vitejs/plugin-react` which supports the `?react` transform). Import at top of file:

```tsx
import DayCapLogo from '../../assets/daycap-logo.svg?react';
```

Replace the h1 with:
```tsx
<DayCapLogo className="h-7 w-auto" aria-label="DayCap" />
```

Keep the date subline `<p className="text-ui text-muted-foreground mt-1">` unchanged — it sits below the logo just as it sat below the h1.

The `className="h-7 w-auto"` on the SVG component applies to the root `<svg>` element — Vite's SVG-as-component pass-through supports className on the root element. This renders the logo at 28px tall, width scales with viewBox ratio (~109px for a 140:36 viewBox), fitting cleanly in the glass header left slot.

If the `?react` import causes a TypeScript error (missing module declaration), add a one-line declaration to `src/renderer/vite-env.d.ts` (or create it if absent):
```ts
declare module '*.svg?react' { const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>; export default ReactComponent; }
```
  </action>
  <verify>
    <automated>cd /Users/ashwath/Desktop/Personal/AuctionX && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>TypeScript compiles clean. App renders with the DayCap logo in the TodayView header where "Today" text used to be. Date subline remains visible below.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npx tsc --noEmit` passes with no new errors
2. Run the app (`npm start`) and confirm:
   - TodayView header shows the DayCap logo (gradient wordmark) instead of the plain "Today" text
   - Date subline remains below the logo
   - Logo is legible and gradient-colored against the dark glass header
   - Settings gear icon on the right is unaffected
</verification>

<success_criteria>
- `src/assets/daycap-logo.svg` exists and contains a valid gradient wordmark
- TodayView header renders the logo at h-7 (28px tall)
- TypeScript build is clean
- Visual result: branded logo replaces plain text heading, cohesive with glassmorphism theme
</success_criteria>

<output>
After completion, create `.planning/quick/260325-dzg-add-daycap-logo-to-the-app/260325-dzg-SUMMARY.md` with what was built, files modified, and any deviations from this plan.
</output>
