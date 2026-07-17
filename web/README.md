# @reckon/web — Reckon site + app

A multi-page Next.js 14 (App Router) static export: a marketing landing page, plus a separate
product app with three flows. Deployed at
[reckon-monad-seatbelt.netlify.app](https://reckon-monad-seatbelt.netlify.app).

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page: hero, the problem (gas_used vs gas_limit diagram + incident stats), how it works (3 surface cards), proof summary. No embedded tool — pure marketing. |
| `/app` | The dashboard, in four parts: **Connect your wallet**, **Live guard** (the real thing — see below), **Your wallet's real history** (a live scan with one-click revoke on risky approvals), and **No wallet? See it work instantly** (the old button-driven scenario demo, now a fallback, not the headline). |
| `/app/proof` | Full on-chain evidence: naive-vs-guarded bar chart + transaction-by-transaction table with real explorer links. |
| `/app/integrate` | Tabbed integration docs: SDK, MCP agent guard, wallet guard, and a composable-signal snippet. |

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

### The real flow: ambient guard, not a sandbox

Even with narration, the dashboard was still fundamentally a sandbox: pick a canned scenario,
watch a verdict render. That's not what the winning analogs in the same research pass actually
did. Deep-diving their showcase pages (not just taglines) found the real mechanism behind the
highest-prized ones:

- **Safenode** (8 prizes) — users add it as their actual wallet RPC. Every real transaction they
  ever send routes through it; unknown addresses get queued for approval *before* the mempool, not
  after.
- **Onay** and **Revoke.Delegate** — don't just warn, they pre-delegate a narrow permission so
  approvals can be revoked proactively, without the user needing to notice the risk first.
- **Tanuki** — turns the output into a composable primitive (`IScoreProvider.viewScore(address)`)
  other contracts call directly, not a page a human reads.

Reckon already had the right primitive (`createGuardedProvider`, an EIP-1193 wrapper), it was just
buried as a secondary button after picking a demo scenario. `GuardConsole.tsx` inverts that: click
**Enable Reckon Guard** and it swaps `window.ethereum` for the guarded version for the rest of the
browser tab, so *any* Monad testnet dApp you then use gets every `eth_sendTransaction` pre-flighted
before the wallet ever prompts. A live feed narrates each intercepted call as BLOCKED (would
revert), FLAGGED (succeeds but grants a risky standing permission, forwarded to the wallet anyway,
`createGuardedProvider`'s `mode: "block"` only hard-stops reverts by design, an `approve()` can be
entirely intentional), or ALLOWED.

`WalletReport.tsx` got the Onay/Revoke.Delegate-style follow-through too: each risky approval it
finds now has a **Revoke this permission** button (real `approve(spender, 0)` /
`setApprovalForAll(operator, false)`, sent through the connected wallet), shown only when the
connected wallet matches the scanned address. The report changed from something you read to
something you can act on.

`/app/integrate` picked up a fourth tab, **Composable signal**, making the Tanuki-style pitch
explicit: `detectRiskFlags()` is a pure function, no RPC, safe to call from a relayer, an agent's
own tool-call guard, or another wallet's pre-sign hook, not just this page.

**Verified**: the exact mechanism `GuardConsole` depends on (`createGuardedProvider`'s `onVerdict`
classification into revert/critical-risk/clean) was checked directly against a mocked EIP-1193
provider using the real built SDK package (not the source, the actual `packages/sdk/dist` output),
confirming BLOCK only fires on revert and risky-but-successful calls are FLAGGED and forwarded, not
blocked, exactly what the UI now shows. **Known gap**: the click-through with a real wallet
extension enabling the guard from the dashboard UI itself is untested here, for the same reason
noted below (no wallet extension in this environment, and injected mocks don't survive the
detection flow) — the underlying wrap/restore logic is straightforward and code-reviewed, but worth
a manual pass with a real extension before a live demo.

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

The "connect a real wallet" path (`WalletConnect.tsx`, and now `GuardConsole.tsx`'s "Enable Reckon
Guard", which wraps `window.ethereum` with `createGuardedProvider`) could **not** be tested
end-to-end in this project's automated browser: it has no wallet extension installed, and injected
`window.ethereum` mocks don't survive navigation/reload (confirmed empirically, not assumed) — real
wallet extensions inject at document-start via a content script, which this environment has no
equivalent hook for. The underlying logic is the exact same `createGuardedProvider` already proven
by 8/8 passing `@codeswithroh/reckon-sdk` tests (including "blocks a doomed `eth_sendTransaction`
before it reaches the wallet"), independently re-verified above against the built SDK package with
a mocked provider, and the dashboard's wiring code mirrors that pattern directly, but this specific
click-through has only been verified by code review and the mocked-provider check, not a live
browser run with a real wallet extension present. Worth a manual check before relying on it for a
demo.
