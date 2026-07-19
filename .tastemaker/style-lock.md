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

## Wallet connect modal (2026-07-19)

User asked for RainbowKit specifically. Checked first: RainbowKit 2.2.11, ConnectKit 1.9.2, and
Reown AppKit are all still pinned to `wagmi: ^2.x` peer deps — none support the project's
`wagmi@3.7.2` (upgraded earlier this session for its EIP-6963 multi-wallet discovery). No safe
drop-in existed, so built the same UX natively instead of downgrading a working, tested wallet
stack: `WalletConnect.tsx`'s old always-visible grid of per-wallet buttons is now a single
"Connect wallet" button that opens `.wallet-modal` — a centered list of every EIP-6963-announced
connector, each with its real `connector.icon` (browsers/wallets supply this per the EIP-6963
spec, no icon-sourcing step needed), falling back to the `wallet` Icon glyph when a connector
doesn't supply one. "or paste an address" collapsed behind a toggle instead of an always-visible
input row.

**Real bug caught and fixed live**: the modal's `position: fixed` backdrop, rendered inline inside
the panel tree, was positioning relative to the nearest `[data-reveal]` ancestor instead of the
viewport, because GSAP's reveal animation leaves an inline `transform` on that ancestor after it
settles, and any transformed ancestor becomes the containing block for `position: fixed`
descendants. This is the same class of bug as the earlier `position: sticky` + GSAP-transform
interaction, just the fixed-position variant. Fixed by portaling the modal to `document.body` via
`createPortal` (the standard fix, and how RainbowKit's own modal avoids this exact problem) —
confirmed centered and fully on top in the live browser both locally and on the Vercel deploy.

## Landing hero redesign (2026-07-19)

User supplied two reference images (a "Kiwi" mission page and a "plm" community-marketing site)
and asked for the second's hero pattern specifically. The reference's actual palette (bright pink,
cream, halftone-grunge scrapbook) was **not** adopted — flagged this to the user directly before
building: Reckon is a security dev-tool being judged by Monad DevRel on technical credibility, not
a consumer community brand, and the reference's photo collage of real community members + avatar
row would have meant fabricating social proof for a solo hackathon project with no real team, which
conflicts with the project's whole "nothing is mocked" ethos established since Phase 0. What
carried over is the **structural pattern**, rendered in the locked dark/purple palette:

- `.hero-top-row` — the existing eyebrow pill plus a new dashed-border `.annotation-badge`
  ("// zero mocked transactions below"), the reference's small rotated callout-next-to-headline
  move.
- `.hero-collage` — three `.collage-card`s in a scrapbook scatter (`nth-child` rotation ±1-2deg,
  colored border per card: block-red / accent-purple / ok-green), replacing the reference's photo
  collage. Filled with **real product content**, not stock photos: a live-guard verdict snippet, an
  actual `reckon.preflight()` code sample, and the real naive-vs-guarded balance numbers already
  used elsewhere in the app (0.0408 → 0.0024 MON). Honest equivalent of "show real people," shows
  the real product instead.
- `.hero-tags` — small mono pill chips (on-chain / no mocks / live testnet / open source), the
  reference's feature-tag row.
- `.proof-strip` — replaces the reference's "meet our members" avatar row with three real,
  clickable Monad testnet tx-hash chips (the same three verified hashes documented in the root
  README's proof table). The honest version of social proof for a project with transactions but no
  team photos.
- `.cta-band` — a new full-bleed section (accent-purple gradient wash, border-top/bottom) between
  "How it works" and "Proof", the reference's bold color-block CTA. Repurposes the existing
  `HeroDiagram.tsx` (previously the hero's single visual, now freed up by the collage) as its
  visual half rather than leaving it unused.

**Real bug caught and fixed live**: `.hero-collage` initially stayed stuck at `opacity: 0`
indefinitely, confirmed via `getComputedStyle` (found the element, 3 children present, correct
height, just never animated past its `gsap.set` initial state) — `HeroTimeline`'s own sequenced
`tl.to()` chain stalled on it, while sibling steps completed normally. Root cause not fully
isolated (plausibly interaction between `HeroTimeline`'s manual per-step tween and the collage
children's own independent `[data-reveal]` `RevealController` handling racing on the same parent),
but since the children already had `data-reveal` and revealed correctly on their own, the fix was
to simply stop double-controlling the parent: removed `.hero-collage` from `HeroTimeline`'s step
list entirely rather than debugging the interaction further. Verified via `getComputedStyle` before
and after, and visually in the browser.
