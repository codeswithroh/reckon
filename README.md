# Reckon

**A transaction seatbelt for Monad.** Stop burning MON on failed and over-sized transactions.

**Live app → [reckon-monad-seatbelt.netlify.app](https://reckon-monad-seatbelt.netlify.app)** ·
**Repo → [github.com/codeswithroh/reckon](https://github.com/codeswithroh/reckon)** ·
**Contract → [`0x84e5…B6AE`](https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE)**

**npm → [`@codeswithroh/reckon-sdk`](https://www.npmjs.com/package/@codeswithroh/reckon-sdk) ·
[`@codeswithroh/reckon-core`](https://www.npmjs.com/package/@codeswithroh/reckon-core)**

> On Monad you pay for the gas limit you declare — **not the gas you use, and even when your
> transaction reverts.** Reckon pre-flights every transaction: it simulates it, refuses to
> broadcast doomed ones, and sets the tightest *correct* gas limit — so you never pay for a
> failure or an oversized limit again.

---

## Status

🟢 **Phase 8 complete** — the full stack is built, tested, published, and browser-verified:

- **`packages/core`** ([npm](https://www.npmjs.com/package/@codeswithroh/reckon-core)) — pre-flight
  engine (49/49 tests), plus:
  - an **adaptive gas buffer** learned from real per-contract chain history instead of a flat
    percentage (`adaptiveBuffer.ts`) — a gap Monad's own team described publicly but never shipped.
  - **approval/permission-escalation risk detection** (`riskDetection.ts`): flags unlimited ERC-20
    approvals, NFT operator grants, and EIP-2612 permits, the exact pattern behind a real ~$175K
    agent-drain incident in May 2026, even when the call itself would succeed.
- **`packages/sdk`** ([npm](https://www.npmjs.com/package/@codeswithroh/reckon-sdk)) — drop-in viem
  wrapper, on-chain batch routing, and a one-line EIP-1193 **wallet guard**
  (`createGuardedProvider`) that blocks doomed sends before the wallet prompts (8/8 tests).
- **`packages/agent`** — MCP server so AI agents pre-flight every tx (9/9 tests, real MCP client);
  now blocks critical permission risk, not just reverts.
- **`contracts/`** — `GuardedExecutor` deployed + source-verified at
  [`0x84e5C3c524f473c19821ae2D1494b274730bB6AE`](https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE)
  (16/16 tests); plus a minimal `MockToken` demo target at
  [`0x1eF032308c9fFfa11277775a3969eBe62dedD68E`](https://testnet.monadscan.com/address/0x1eF032308c9fFfa11277775a3969eBe62dedD68E)
  (6/6 tests).
- **`web/`** — a marketing landing page (`/`) plus a redesigned product dashboard (`/app`) built
  around two things a real visitor can actually use: a live **wallet safety report** (connect or
  paste any address, see real reverted-tx history, MON burned, and outstanding risky approvals,
  zero calldata typing) and a button-driven **"try it live"** demo (simulated dApp actions like
  "claim free airdrop", not raw hex). See `web/README.md` for what's tested vs. a known gap in the
  real-wallet click-through path.
- **`examples/agent-framework-recipe/`** — a runnable recipe wiring Reckon's MCP server as an agent
  framework's mandatory pre-flight gate, tested live against real testnet.

**Live proof — a real agent, real transactions:** a naive agent burned **0.0408 MON** (a reverted
tx plus an oversized-limit tx); the same agent guarded by Reckon spent **0.0024 MON** — a **94%
reduction**, every transaction verifiable on the explorer. See `packages/agent/demo/`.

Next: demo video + submission (Phase 6). See **[PLAN.md](./PLAN.md)**.

Run the engine yourself:

```bash
npm install
cd packages/core && npm run build && node examples/demo.mjs
```

It pre-flights a healthy tx (recommends a tight 21,000-gas limit) and a doomed one (refuses to
broadcast, decodes the revert, and reports the MON it just saved you) — all against real testnet.

## The problem (verified, not assumed)

We proved Monad's gas model against live testnet data — reproducible in
**[research/gas-model/](./research/gas-model/VERIFICATION.md)**:

- A **reverted** tx paid its **full declared gas limit** — balance delta
  `0.013586524000131908 MON` = `gasLimit × price`, exact to the wei
  ([tx](https://testnet.monadexplorer.com/tx/0x272f56f75f38199c6cc1a465df6bb0c310bae51beaa4ea6500e15107f7fb29b8)).
- **40/40** sampled txs report `receipt.gasUsed == gasLimit` — the chain **hides your real usage**.
- Wallets balloon the limit on revert-probes, so one failed action (a sold-out NFT mint, an
  underpriced swap) can cost a shocking amount of MON.
- A Monad airdrop user burned **~$112,700** on failed transactions; the network failure rate is **~6%**.

There is no Monad-native tool that prevents this. Reckon is that tool.

## How it works

`preflight(tx)` runs before you broadcast and returns a verdict:

```ts
const v = await reckon.preflight(tx)
// {
//   ok: false,
//   willRevert: true,
//   revertReason: "SoldOut()",
//   recommendedGasLimit: 61_000n,     // Monad-correct, not Ethereum-guessed
//   worstCaseFeeMON: "0.0062",        // what you'd actually be charged
//   overpayVsWalletDefault: "0.045"   // MON the wallet default would have burned
// }
await reckon.safeSend(tx)             // refuses to broadcast a doomed tx
```

## Three surfaces (it's infrastructure, not an app)

| Surface | For | What it does |
|---|---|---|
| **SDK** (`packages/sdk`) | dApps & deploy scripts | drop-in viem wrapper: `safeSend()` |
| **Agent guard** (`packages/agent`) | autonomous AI agents | MCP tools so agents pre-flight every tx |
| **GuardedExecutor** (`contracts/`) | on-chain | bounded, predictable, policy-enforced execution |

AI agents fire many transactions and are the most exposed to Monad's gas model — so the agent
economy *increases* Reckon's value, it doesn't erode it.

## Honest accounting

Savings come from **pre-broadcast** (not sending failures + declaring the tightest correct limit).
Once a tx is on-chain, Monad charges the limit — **no component pretends to refund gas.** Every
cost/savings figure is measured against real testnet transactions.

## Repository layout (target)

```
packages/core    pre-flight engine (simulate + Monad gas model + cost quote)
packages/sdk     drop-in viem middleware for apps & scripts
packages/agent   MCP server / agent guard
contracts/       Foundry — GuardedExecutor + tests
web/             Next.js dashboard (MON saved · receipts)
research/        live-testnet gas-model verification (reproducible)
PLAN.md          full implementation plan
```

## Verify the problem yourself

```bash
cd research/gas-model && npm install && npm run summary
```

## Tech

Monad testnet · viem · Foundry · Solidity + OpenZeppelin · MCP · Next.js + Wagmi v3 + Shadcn · Para
(wallet). Built with [Monskills](https://skills.devnads.com/).

## License

MIT
