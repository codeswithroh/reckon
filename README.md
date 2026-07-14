# Reckon

**A transaction seatbelt for Monad.** Stop burning MON on failed and over-sized transactions.

> On Monad you pay for the gas limit you declare — **not the gas you use, and even when your
> transaction reverts.** Reckon pre-flights every transaction: it simulates it, refuses to
> broadcast doomed ones, and sets the tightest *correct* gas limit — so you never pay for a
> failure or an oversized limit again.

---

## Status

🟢 **Phase 4 complete** — the full stack is built, tested, and browser-verified:

- **`packages/core`** — pre-flight engine (18/18 tests).
- **`packages/sdk`** — drop-in viem wrapper + on-chain batch routing (4/4 tests).
- **`packages/agent`** — MCP server so AI agents pre-flight every tx (4/4 tests, real MCP client).
- **`contracts/`** — `GuardedExecutor` deployed + source-verified at
  [`0x84e5C3c524f473c19821ae2D1494b274730bB6AE`](https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE)
  (16/16 tests).
- **`web/`** — a live dashboard with an interactive pre-flight widget (real testnet calls), the
  on-chain naive-vs-Reckon proof, and the deployed contract. Verified in-browser: both the BLOCK and
  OK paths render from live testnet with no console errors.

**Live proof — a real agent, real transactions:** a naive agent burned **0.0408 MON** (a reverted
tx plus an oversized-limit tx); the same agent guarded by Reckon spent **0.0024 MON** — a **94%
reduction**, every transaction verifiable on the explorer. See `packages/agent/demo/`.

Next: demo video + submission (Phase 6); optional TEE/consumer surface (Phase 5). See **[PLAN.md](./PLAN.md)**.

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
