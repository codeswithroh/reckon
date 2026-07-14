# @reckon/web — Reckon dashboard

A live dashboard for Reckon: an interactive pre-flight widget, the naive-vs-Reckon on-chain proof,
and the deployed contract. Next.js 14 (App Router) + a server-side pre-flight API route.

## Live, not static

The pre-flight widget POSTs to `/api/preflight`, which runs `@reckon/core`'s `preflight()` against
**live Monad testnet** on every call (`eth_estimateGas` + gas model). Nothing is mocked. The proof
table shows real balance deltas with real explorer links (`app/lib/demo-results.json`, produced by
`packages/agent/demo/live-agent.mjs`).

## Run

```bash
npm install            # from repo root (workspaces)
npm run build -w @reckon/web
npm run start -w @reckon/web       # http://localhost:3117
# or: npm run dev -w @reckon/web
```

## Design

Tokens are locked in `../.tastemaker/style-lock.md` (dark, technical, Monad-purple accent; Inter +
JetBrains Mono). Verified in-browser: both the BLOCK and OK pre-flight paths render correctly from
live testnet, and the proof table links to the real transactions.
