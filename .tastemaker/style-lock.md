# Reckon — Style Lock

Mood: **engineered / technical / trustworthy**, dark. References the Foundry·viem·Linear developer
aesthetic (dense, high-signal, monospace data, restrained color), NOT consumer crypto. Cold start,
no reference images — palette inferred from the product's mood + Monad's purple brand accent.

## Palette (dark)

| Role | Hex | Notes |
|---|---|---|
| bg | `#0A0A0F` | near-black, slight cool tint |
| surface | `#14141B` | cards |
| surface-2 | `#1B1B24` | raised / inputs |
| border | `#26262F` | hairlines |
| text | `#E6E6EE` | 15.9:1 on bg ✓ |
| text-muted | `#9A9AA8` | 7.1:1 on bg ✓ |
| accent | `#836EF9` | Monad purple — fills, borders, glows |
| accent-text | `#A996FF` | lighter purple for accent *text* on dark |
| on-accent | `#0A0A0F` | dark label on purple buttons (5.2:1 ✓; white FAILS at 3.8:1) |
| ok | `#3FB950` | OK verdict (7.2:1 on card ✓) |
| block | `#F85149` | BLOCK verdict (5.5:1 on card ✓) |
| warn | `#E3B341` | warnings |

## Type

- UI / headings: **Inter** (Google) — tight tracking on large sizes.
- Data / numbers / code / addresses: **JetBrains Mono** (Google) — all on-chain values, gas, MON,
  tx hashes, calldata render in mono. This is the primary "engineered" signal.

## Shape & depth

- Radius: 10px cards, 8px controls, 6px chips. Not pill-shaped.
- Borders over shadows: 1px `border` hairlines; shadows only as faint accent glows on hover.
- Density: tight. Generous whitespace between sections, compact within data cards.

## Motion

- **GSAP + ScrollTrigger** (the tastemaker default), via `@gsap/react`'s `useGSAP` hook for correct
  cleanup. `web/app/lib/motion.ts` holds the locked feel: duration 0.5s, distance 8px, ease
  `power2.out`, stagger 0.08s. Branches on `prefers-reduced-motion` via `gsap.matchMedia()`.
  - `components/Reveal.tsx` — scroll-triggered fade+rise for every `[data-reveal]` /
    `[data-reveal-group]` element, sitewide (ported from `gsap-starter.js`'s CDN pattern).
  - `components/HeroTimeline.tsx` — sequenced hero entrance (eyebrow → h1 → tagline → subhead →
    CTA → visual), the landing page's highest-impact motion moment.
  - `components/CountUp.tsx` — real stat numbers (94.04%, $112.7K, etc.) count up from 0 on
    scroll-into-view; ties motion to actual proof data, not decoration.
  - `components/BarChart.tsx` — fills animate via `scaleX` (transform, not `width`, per the
    animate-only-transform-and-opacity performance rule), staggered per bar.
  - Verified end-to-end in-browser: confirmed via forced frame-pumping (this dev environment's
    headless browser only ticks rAF on an explicit paint request) that the full sequence settles
    at the exact correct final values with zero console errors.

## Show-don't-tell

Carry meaning with: the live verdict card, the naive-vs-Reckon comparison table with real tx hashes,
stat tiles (94% / MON burned vs spent), a gas-limit bar comparison. Prose only as captions.

## Assets

No stock photography/illustration — a technical dev-infra dashboard; the "visuals" are constructed
diagrams and live data components (GasChargeDiagram, HeroDiagram, BarChart, verdict cards,
comparison tables, stat tiles), which is the honest right call here. Logo: a constructed geometric
mark (a shield/seatbelt motif) in accent purple.

Favicon: full export completed (favicon.ico, 16/32px PNGs, apple-touch-icon, 192/512 PWA icons,
OG card) via `export_favicons.py`. System `cairo` was missing initially; installed via
`brew install cairo`, then run through a Homebrew Python 3.14 venv (the system's SIP-protected
`/usr/bin/python3` silently ignores `DYLD_LIBRARY_PATH`, so cairo was unreachable from it even
after installing — the venv sidesteps that). Wired into `layout.tsx` metadata (icons, manifest,
OpenGraph, Twitter card) and `public/site.webmanifest`.

Icons: fetched via Iconify (`scripts/fetch_icons.py`, Lucide set, no attribution needed), tinted to
the locked accent, inlined as `currentColor` React components in `web/app/components/Icon.tsx` so
they can theme per-context. One stroke weight (2) throughout: shield-check, zap, terminal, bot,
link-2, alert-triangle, check-circle-2, x-circle, bar-chart-3, wallet, code-2, fuel.

## Site architecture (multi-page, added 2026-07-15)

- **Landing (`/`)** — marketing only, no embedded tool. Header + footer + 4 sections: hero,
  problem (GasChargeDiagram + incident stats), how-it-works (3 icon cards), proof summary
  (BarChart + CTA into the full evidence page).
- **Product app (`/app/*`)** — a real dashboard IA, not a stacked marketing page (rebuilt
  2026-07-18 to match a reference dashboard layout the user supplied). `app/app/layout.tsx` wraps
  every product route in `.app-shell`: a sticky 240px `AppSidebar` (logo, nav with active-state
  highlighting, GitHub + back-to-site) and an `.app-main` column with a sticky `AppTopbar`
  (per-route title/sub via a pathname map + a live wagmi `useConnection()` status pill) above
  `.app-content`. `/app` (`DashboardApp.tsx`) leads with a `.kpi-row` of 4 `StatCard`s (the "one
  number you open the app to check" rule from `component-patterns.md`: MON burned, risky
  approvals, session sends checked, session MON saved — the last two lifted live from
  `GuardConsole`'s `onOutcome` and `WalletReport`'s `onResult` callbacks, not separately computed),
  then a `.dash-grid` (Live Guard wide left, Wallet Connect + History stacked right), then two
  full-width `.dash-panel-full` cards (no-wallet demo, deployed-contract proof). `/app/proof` and
  `/app/integrate` render as plain content inside the same shell, no per-page chrome duplication.
- The old `Header variant="app"` tab-nav and `.app-shell-banner` are gone along with the "app"
  variant of `Header` itself (now landing-only) — removed as dead code, not left disabled.
- Next static export requires `trailingSlash: true` once a route (`/app`) is also a parent of
  nested routes (`/app/proof`) — without it, export produces a colliding `app.html` file and `app/`
  directory that 404s on clean-URL resolution. This also means `usePathname()` returns a trailing
  slash (`/app/proof/`) under this export mode — `AppTopbar`'s route-title lookup normalizes it
  before matching (caught live: the Proof page briefly showed the Overview title before the fix).

## Text-density pass (2026-07-18)

The user explicitly wants a storyteller-not-explainer UX: minimal reading, visual/interactive
carriers of meaning. Two new reusable primitives now sit alongside the existing show-don't-tell
components (GasChargeDiagram, BarChart, verdict cards):

- **`Tooltip.tsx`** — CSS-only hover/focus popover (`.tt-wrap`/`.tt-dot`/`.tt-bubble`), no JS
  positioning. Used to move a sentence of detail off a label and onto a small "?" dot next to it —
  KPI stat labels, section headers (`Reverted transactions`, `Open approvals`), the deployed-contract
  panel title. The visible label stays one or two words; the full sentence is one hover away, not
  always on-screen.
- **`FlowLoop.tsx`** — the app's entire mental model as 3 pill-shaped steps (Connect → Reckon checks
  → You decide) with `→` connectors, rendered once at the top of `DashboardApp`. Replaces what used
  to be a paragraph repeated in slightly different words across the Live Guard blurb, the empty
  wallet-report state, and the topbar sub. One visual instead of three sentences saying the same
  thing.
- **`GuardLegend`** (inline in `GuardConsole.tsx`) — the block/flag/allow outcome space as 3 colored
  dot chips ("Blocked before signing" / "Flagged, you decide" / "Sent, gas tightened"), each with a
  `Tooltip` for the mechanism detail. Replaces both of `GuardConsole`'s old 3-4 sentence blurbs
  (connected and disconnected states) — the same information, shown as a legend instead of read as
  prose, and it's now visible in both states instead of only when connected.
- `WalletReport`'s `reportHeadline()` was cut from full sentences (e.g. "This wallet has N
  outstanding approval(s) that let another address move its tokens...") to a 2-4 word status phrase
  ("Risky approvals found, review below.") — the actual numbers were already duplicated a few lines
  below in the `.report-stats` grid, so the sentence was restating a visual that already existed.
  Classic case of the show-don't-tell rule catching a section that was *mostly* already visual but
  still had a redundant text summary bolted on top.
- Every `dash-panel-sub`/`sec-sub` explanatory paragraph across `DashboardApp`, `GuardedActions`,
  and all four `IntegrateTabs` panels was cut to one short line or removed outright where a sibling
  panel header/tag already carried the meaning. The payoff narratives (`narrateVerdict` output,
  `RiskFlagView` messages) were deliberately left untouched — those are the actual show-don't-tell
  content (a real verdict on a real transaction), not filler prose, and cutting them would remove
  the thing the whole redesign exists to surface.
