# @reckon/web — Reckon site + app

A multi-page Next.js 14 (App Router) static export: a marketing landing page, plus a separate
product app with three flows. Deployed at
[reckon-monad-seatbelt.netlify.app](https://reckon-monad-seatbelt.netlify.app).

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page: hero, the problem (gas_used vs gas_limit diagram + incident stats), how it works (3 surface cards), proof summary. No embedded tool — pure marketing. |
| `/app` | The dashboard, in two parts: **Check your wallet** (connect or paste an address, get a real safety report: reverted txs, MON burned, outstanding risky approvals, scanned live) and **Try it live** (button-driven simulated dApp actions, "Claim free airdrop" / "Swap" / "Call broken contract", with a wallet-aware guard demo when a real wallet is connected). Raw calldata testing still exists, tucked under an "Advanced" toggle. |
| `/app/proof` | Full on-chain evidence: naive-vs-guarded bar chart + transaction-by-transaction table with real explorer links. |
| `/app/integrate` | Tabbed integration docs: SDK, MCP agent guard, wallet guard code snippets. |

### Why the dashboard changed

The first version's primary interface was hand-typed addresses and raw calldata hex, a developer
console, not a product. Nobody's real workflow starts with pasting hex. The redesign leads with
something anyone can use with zero technical input (their own wallet's real history) and reframes
the interactive demo around simulated real actions instead of a hex form.

### Plain-English narration

Even after that first redesign, the verdict panel still led with a badge and key-value stats, raw
output, not a product. To fix it, I queried my own database of ~7,500 past accepted hackathon
ideas for prior winners in the same space (wallet security, transaction pre-flight, approval
scanning) and deep-dove the four closest matches: FireMask, Safenode, Prank Wallet, and Metaguard.
The one pattern all four share: translate the raw verdict into a real sentence describing what
actually happens if you sign, shown *before* the technical numbers, not instead of them.
`app/lib/narrate.ts` implements that directly — `narrateVerdict()` and `narrateRiskFlag()` turn a
`PreflightResult`/`RiskFlagView` into sentences like "This gives 0x0000…dEaD permission to take an
unlimited amount of this token from you, at any time, forever, until you revoke it." The badge and
raw `kind`/`severity` fields still render underneath, for anyone who wants them. Action cards also
dropped emoji for the site's existing icon set, with copy that names the actual scenario ("Claim"
button on a lookalike site, Ordinary contract read, Call to a broken function) instead of a playful
label.

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

## Wallet report — what's genuinely tested vs. a known gap

`app/lib/walletScan.ts` scans real recent testnet history (`eth_getBlockReceipts`, bounded by a
hard wall-clock cap so it never hangs) for a given address's reverted transactions and
approval-granting calls. **Verified live, twice, with real data**: an empty/clean scan, and then
after firing two fresh real testnet transactions (one revert, one unlimited approval) from a known
wallet, a re-scan found exactly those two, correctly categorized.

The "connect a real wallet" path (`WalletConnect.tsx`, and `GuardedActions.tsx`'s "try this on your
connected wallet" button, which wraps `window.ethereum` with `createGuardedProvider`) could **not**
be tested end-to-end in this project's automated browser: it has no wallet extension installed, and
injected `window.ethereum` mocks don't survive navigation/reload (confirmed empirically, not
assumed) — real wallet extensions inject at document-start via a content script, which this
environment has no equivalent hook for. The underlying logic is the exact same `createGuardedProvider`
already proven by 8/8 passing `@codeswithroh/reckon-sdk` tests (including "blocks a doomed
`eth_sendTransaction` before it reaches the wallet"), and the dashboard's wiring code mirrors that
test's pattern directly, but this specific click-through has only been verified by code review, not
a live browser run with a real or mocked wallet present. Worth a manual check with a real wallet
extension before relying on it for a demo.
