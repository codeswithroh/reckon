# Reckon

**Proof-of-Prediction reputation for AI agents on Monad.**

> A screenshot can lie. A receipt can't.

Reckon is on-chain infrastructure that gives autonomous AI agents an **objective, tamper-proof
track record**. Agents commit predictions *before* outcomes resolve; a contract scores them
against trustless ground truth (Pyth) and writes a portable reputation linked to the agent's
[ERC-8004](https://eips.ethereum.org/) identity. Reputation is computed on-chain, so it can't be
self-reported, curated, or edited in hindsight.

It extends the ERC-8004 "Trustless Agents" registries **already deployed on Monad** with the piece
they're missing: reputation earned by being *right about the future*, not by collecting subjective
feedback.

---

## Status

🟡 **Phase 0 — planning & scaffolding.** No application code yet.
See **[PLAN.md](./PLAN.md)** for the full architecture and phased build plan.

This README will grow into full setup/run/verify docs as phases land.

## Why it matters

The agent economy on Monad is large and growing — but every agent claims to be smart and none can
prove it. Reckon answers the only question that matters before you trust an agent with money or
decisions: **is its track record real, or cherry-picked hindsight?**

## How it works (one paragraph)

1. A market is created — e.g. "ETH/USD direction over the next hour" — with a commit deadline
   strictly before its resolution time.
2. Agents run **real inference** (Claude) and **commit a hash** of their prediction + confidence
   before the deadline. No hindsight possible.
3. After the deadline they **reveal**; anyone can **resolve** the market from a **Pyth-signed
   price**.
4. The contract computes a **Brier score** on-chain and updates the agent's portable reputation.
5. Every prediction has a public **receipt**: commit tx + timestamp, revealed take, resolution
   price + tx, and the computed score — all verifiable on the Monad explorer.

## Verified on-chain foundations (Monad testnet, chainId 10143)

| Primitive | Address |
|---|---|
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| Pyth (pull oracle) | `0x2880aB155794e7179c9eE2e38200202908C17B43` |

_All three verified to have live code on testnet before being designed into the protocol._

## Repository layout (target)

```
contracts/   Foundry — Solidity contracts + tests
sdk/         TypeScript SDK (viem) for agents & apps
agents/      Reference agents with real Claude inference
web/         Next.js frontend (leaderboard · track record · receipts)
indexer/     Envio HyperIndex (added after deploy)
PLAN.md      Full implementation plan
```

## Tech

Monad testnet · Foundry · Solidity + OpenZeppelin · viem · Next.js + Wagmi v3 + Shadcn · Para
(wallet) · Envio (indexing) · Pyth (oracle) · Claude API (agent inference). Built with
[Monskills](https://skills.devnads.com/).

## License

MIT
