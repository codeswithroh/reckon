# Reckon — Implementation Plan

> **Reckon** is a Proof-of-Prediction reputation layer for AI agents on Monad.
> It extends the ERC-8004 "Trustless Agents" standard with *objective, outcome-verified*
> reputation: agents commit predictions **before** outcomes resolve, and an on-chain
> contract scores them against trustless ground truth (Pyth). The result is a portable,
> tamper-proof track record — "a screenshot can lie, a receipt can't."

_Working name; can be renamed. Status of this document: **DRAFT — awaiting sign-off before Phase 1.**_

---

## 1. The problem (and why it's personal)

The agent economy is exploding on Monad (413 of 742 hackathon projects in 2026 were agentic).
Every agent claims to be smart. **None of them can prove it.** As someone who wants to
delegate money and decisions to AI agents, I have no way to answer the only question that
matters: *which agent's track record is actually real, and not cherry-picked hindsight?*

Today's on-chain reputation (including ERC-8004's `ReputationRegistry`) is **subjective**:
clients leave feedback/attestations. That can be gamed, bought, or curated. There is no
**objective, outcome-verified** track record for autonomous agents.

**Reckon fills that gap.** It is infrastructure — a protocol + SDK any agent or app can
build on — not a single consumer app.

## 2. Why this can win

Mapped against what actually won past Monad hackathons (OpenAlice, AMMO, Nobel, Gorillionaire,
ShieldAI) and the strongest external reference (Heckle / tryheckle.xyz):

| Winning pattern | How Reckon hits it |
|---|---|
| Cryptographically-verifiable AI claims (not "trust me") | Commit-before-resolve, on-chain scoring, signer-checked authorship |
| Extends live infra rather than duplicating it | Builds **on** the ERC-8004 registries already deployed on Monad |
| Monad-specific advantage | Frequent commit/reveal/resolve cycles are only cheap because of sub-second finality + near-zero fees |
| An economic/reputation loop, not a feature list | Portable reputation that compounds and is queryable by other apps |
| Live, real data — no vaporware | Real Claude inference + real Pyth prices + real testnet txs, end to end |

## 3. Verified foundations (checked against live testnet — not assumed)

| Primitive | Address / value | Status |
|---|---|---|
| Monad testnet | chainId `10143`, RPC `https://testnet-rpc.monad.xyz` | ✅ live (block ~44.8M) |
| ERC-8004 IdentityRegistry | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` | ✅ has code on testnet |
| ERC-8004 ReputationRegistry | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` | ✅ has code on testnet |
| Pyth (pull oracle) | `0x2880aB155794e7179c9eE2e38200202908C17B43` | ✅ has code on testnet |
| Stork (pull oracle) | `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62` | ✅ has code on testnet |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ has code on testnet |
| Chainlink feeds (from docs) | (various) | ❌ **empty on testnet — do NOT use** |
| Pyth beta MON/USD (from docs) | `0xad2B52…CD0B5` | ❌ **empty on testnet — do NOT use** |

> The Chainlink/Pyth-beta rows are why we verify: the docs list them, but there is no code
> at those addresses on testnet today. Resolution will use **Pyth** (verified live).

## 4. Architecture

```
                         ┌──────────────────────────────────────────────┐
                         │                 Frontend (web/)               │
                         │  Next.js + Wagmi v3 + Shadcn + Para wallet     │
                         │  Leaderboard · Agent track record · Receipt    │
                         └───────────────┬───────────────┬──────────────┘
                                         │ reads         │ reads (events)
                                         ▼               ▼
                              ┌───────────────┐   ┌──────────────────┐
                              │  Monad RPC    │   │ Envio HyperIndex │
                              │ (direct reads)│   │  (activity/feed) │
                              └──────┬────────┘   └────────┬─────────┘
                                     │  indexes events      │
        ┌────────────────────────────┴──────────────────────┴──────────────┐
        │                        Contracts (contracts/)                     │
        │                                                                   │
        │  MarketRegistry ──creates──▶ Market{subject, closeAt, resolveAt}  │
        │        ▲                                    │                     │
        │        │ commit(hash)/reveal()              │ resolve(pythData)   │
        │  CommitmentRegistry ◀───────┐               ▼                     │
        │        │ on reveal+resolved  │        Resolver ──reads──▶ Pyth    │
        │        ▼                     │                                    │
        │  ReputationScorer ──writes──▶ reputation aggregate per agent      │
        │        │  links identity                                         │
        │        ▼                                                          │
        │  ERC-8004 IdentityRegistry / ReputationRegistry (canonical)       │
        └───────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ register / commit / reveal / resolve
                        ┌────────────┴─────────────┐
                        │      Agent SDK (sdk/)     │  TypeScript + viem
                        └────────────┬─────────────┘
                                     │ used by
                        ┌────────────┴─────────────┐
                        │  Reference agents (agents/)│  REAL Claude inference
                        │  Momentum · Contrarian ·   │  → sign → commit → reveal
                        │  Macro   (distinct strats) │
                        └───────────────────────────┘
```

### 4.1 Contracts (Foundry, Solidity ^0.8.24, OpenZeppelin)

- **AgentRegistry (adapter):** links a Reckon agent to its ERC-8004 identity (agentId) and
  stores a model-metadata pointer. Spike first (Phase 1) to learn the deployed registry's
  real interface before committing to write-integration; fall back to identity-linkage +
  local reputation if writes are gated.
- **MarketRegistry:** a market = `{subjectFeedId, question(direction), closeAt, resolveAt, oracle}`.
  Permissionless or curator-created. Enforces `closeAt < resolveAt`.
- **CommitmentRegistry (core):**
  - `commit(marketId, commitmentHash, confidenceBps)` — before `closeAt`. Stores hash of
    `(agentId, marketId, prediction, confidenceBps, salt)` + block timestamp. Optional
    signature so the contract can `ecrecover` the author.
  - `reveal(marketId, prediction, confidenceBps, salt)` — after `closeAt`; verifies hash.
  - Hindsight is impossible: commit closes strictly before the outcome exists.
- **Resolver:** `resolve(marketId, pythUpdateData)` — permissionless; updates Pyth with the
  signed price blob, reads the price at/after `resolveAt`, records the outcome.
- **ReputationScorer:** on `reveal` of a resolved market, computes a **Brier score** +
  accuracy contribution and updates the agent's aggregate `{count, correct, weightedBrier,
  calibration, streak, updatedAt}`. Score is computed on-chain → cannot be self-reported.

### 4.2 Agent SDK (`sdk/`, TypeScript + viem)
`registerAgent`, `createMarket`, `commitPrediction`, `revealPrediction`, `resolveMarket`,
`getReputation`, `getReceipt`. Encapsulates Monad specifics: 10 MON reserve floor,
`eth_sendRawTransactionSync`, gas-limit conventions, block tags.

### 4.3 Reference agents (`agents/`, TypeScript)
2–3 agents with distinct strategies (Momentum / Contrarian / Macro). Each pulls **real**
market data, calls the **Claude API** (`claude-sonnet-5`) for a genuine prediction +
confidence + reasoning, signs, and commits on-chain — then reveals and triggers resolution.
Runs as a keeper loop. **No hardcoded predictions** (anti-vaporware).

### 4.4 Frontend (`web/`, Next.js + Wagmi v3 + Shadcn + Para)
- **Leaderboard** — agents ranked by verifiable reputation.
- **Agent page** — full track record; every prediction links to commit/reveal/resolve txs.
- **Receipt page** — one prediction: hash, confidence, commit tx+timestamp, revealed content,
  resolution price+tx, computed score.
- **Live markets** — open markets, committed hashes, countdowns.
- Data via Envio HyperIndex + direct RPC. Design via `/tastemaker`; UI tests before any
  "it works" claim.

## 5. Verifiability properties (honest accounting)

| Property | Mechanism | Real now? |
|---|---|---|
| No hindsight editing | commit-before-resolve, timestamped on-chain | ✅ |
| Outcome not gameable by agent | Pyth-signed price resolves the market | ✅ (pending Phase-2 flow verification) |
| Reputation not self-reported | score computed on-chain by contract | ✅ |
| Authorship provable | commit signed; contract `ecrecover`s signer | ✅ |
| **Model**-authorship provable (a real model, not a human) | TEE-attested inference | ⏳ **STRETCH — not promised** |

## 6. Phases & milestones

- **Phase 0 — Foundations.** Repo, README, PLAN, verified-primitives table, scaffolding config.
  _Milestone:_ repo pushed; empty scaffold builds. **(this document)**
- **Phase 1 — Core contracts + tests.** All contracts vs. a mock oracle; forge unit + fuzz tests;
  ERC-8004 interface spike. _Milestone:_ `forge test` green; commit-reveal + scoring proven.
- **Phase 2 — Oracle + testnet deploy.** Wire Pyth pull resolution; verify Hermes→update→read on
  testnet in isolation; deploy + verify all contracts. _Milestone:_ a real market created **and
  resolved from a real Pyth price** on testnet, with explorer links.
- **Phase 3 — SDK + reference agents.** SDK; 2–3 agents doing real Claude inference + on-chain
  commit/reveal; keeper loop. _Milestone:_ agents autonomously run predict→commit→reveal→resolve
  →score live on testnet; reputation updates on-chain.
- **Phase 4 — Frontend.** Envio indexer; leaderboard/agent/receipt/live-markets; Para wallet;
  tastemaker design + UI tests. _Milestone:_ deployed app showing live testnet data; every claim
  browser-tested.
- **Phase 5 — (Stretch) TEE-attested inference.** Only if 0–4 are solid and tested.
- **Phase 6 — Submission.** Demo video (≤3 min), social post, contract address, repo, project URL.

**Build order rationale:** contracts define the ABI everything depends on → prove resolution
against the real oracle (biggest external risk) before building on it → agents produce the data
→ UI consumes it → stretch → package.

## 7. Risks & mitigations

- **Pyth pull-flow complexity** → verify in isolation (Phase 2) before depending on it; documented
  testnet-only fallback resolver if Pyth flow blocks, but Pyth is the goal.
- **ERC-8004 registry interface unknown** (deployed bytecode is small — likely a proxy) → Phase-1
  spike introspects the real interface; if writes are gated, keep Reckon reputation local and link
  identity by agentId. **Verify before designing the adapter.**
- **Agent wallet limits** (10 MON reserve floor, ~1 tx/1.2s for low balances) → fund agent wallets
  from the faucet; stagger txs; use sync tx.
- **Time (deadline Jul 19)** → Phases 1–4 are the winning submission; Phase 5 is explicitly optional.

## 8. Standing rules for this build

- Never claim something works without an actual end-to-end test (browser/tooling). If untested or
  incomplete, say so.
- Correctness over speed. Commit + push regularly; keep this doc and the README current.
- Built with Monskills; UI via `/tastemaker`.
