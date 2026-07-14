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

- IntersectionObserver reveal (fade + 8px rise, staggered), reduced-motion aware. Restrained —
  this is a data tool, not a marketing splash.

## Show-don't-tell

Carry meaning with: the live verdict card, the naive-vs-Reckon comparison table with real tx hashes,
stat tiles (94% / MON burned vs spent), a gas-limit bar comparison. Prose only as captions.

## Assets

No stock photography/illustration — a technical dev-infra dashboard; the "visuals" are constructed
diagrams and live data components (GasChargeDiagram, HeroDiagram, BarChart, verdict cards,
comparison tables, stat tiles), which is the honest right call here. Logo: a constructed geometric
mark (a shield/seatbelt motif) in accent purple, also used as an SVG favicon (raster favicon/OG
export skipped — system `cairo` unavailable; SVG favicon works in all current browsers).

Icons: fetched via Iconify (`scripts/fetch_icons.py`, Lucide set, no attribution needed), tinted to
the locked accent, inlined as `currentColor` React components in `web/app/components/Icon.tsx` so
they can theme per-context. One stroke weight (2) throughout: shield-check, zap, terminal, bot,
link-2, alert-triangle, check-circle-2, x-circle, bar-chart-3, wallet, code-2, fuel.

## Site architecture (multi-page, added 2026-07-15)

- **Landing (`/`)** — marketing only, no embedded tool. Header + footer + 4 sections: hero,
  problem (GasChargeDiagram + incident stats), how-it-works (3 icon cards), proof summary
  (BarChart + CTA into the full evidence page).
- **Product app (`/app/*`)** — the actual tool, in its own shell (`.app-shell-banner` + tab-style
  nav via `Header variant="app"`): `/app` (pre-flight dashboard), `/app/proof` (full on-chain
  evidence + BarChart + tx-by-tx table), `/app/integrate` (tabbed SDK/MCP/wallet-guard docs via
  `IntegrateTabs.tsx`).
- Next static export requires `trailingSlash: true` once a route (`/app`) is also a parent of
  nested routes (`/app/proof`) — without it, export produces a colliding `app.html` file and `app/`
  directory that 404s on clean-URL resolution. Confirmed this the hard way; keep trailingSlash on.
