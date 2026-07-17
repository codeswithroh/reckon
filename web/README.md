# @reckon/web — Reckon site + app

A multi-page Next.js 14 (App Router) static export: a marketing landing page, plus a separate
product app with three flows. Deployed at
[reckon-monad-seatbelt.netlify.app](https://reckon-monad-seatbelt.netlify.app).

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page: hero, the problem (gas_used vs gas_limit diagram + incident stats), how it works (3 surface cards), proof summary. No embedded tool — pure marketing. |
| `/app` | Pre-flight dashboard — the live interactive tool. |
| `/app/proof` | Full on-chain evidence: naive-vs-guarded bar chart + transaction-by-transaction table with real explorer links. |
| `/app/integrate` | Tabbed integration docs: SDK, MCP agent guard, wallet guard code snippets. |

## Live, not static

Every pre-flight call runs `@codeswithroh/reckon-core`'s `preflight()` **directly in the browser** against live
Monad testnet (the RPC allows CORS, so no backend is needed — the whole site is a static export).
Nothing is mocked. The proof pages show real balance deltas with real explorer links
(`app/lib/demo-results.json`, produced by `packages/agent/demo/live-agent.mjs`).

## Run

```bash
npm install                       # from repo root (workspaces)
npm run build -w @reckon/web
cd out && python3 -m http.server 3121   # or `npx serve .`
```

## Static export gotcha

`next.config.mjs` sets `trailingSlash: true`. This is required once a route (`/app`) is also the
parent of nested routes (`/app/proof`, `/app/integrate`) — without it, static export produces a
colliding `app.html` file *and* an `app/` directory, which 404s under clean-URL resolution
(confirmed against both a plain static server and Netlify). Keep it on if you add more nested
routes.

## Design

Tokens are locked in `../.tastemaker/style-lock.md` (dark, technical, Monad-purple accent; Inter +
JetBrains Mono; icon set via Iconify/Lucide). Verified in-browser on the live production URL: all
four routes, both pre-flight verdict paths (BLOCK/OK), and every internal navigation link.
