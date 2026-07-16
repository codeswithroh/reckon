# Reckon — Implementation Plan

> **Reckon** is a transaction seatbelt for Monad. It pre-flights every transaction — simulating it,
> refusing to broadcast doomed ones, and setting the tightest *correct* gas limit — so you stop
> burning MON on failed and over-sized transactions. Shipped as three surfaces: an **SDK**, an
> **MCP agent guard**, and an on-chain **GuardedExecutor**.

_Status: **direction locked; Phase 0 complete; ready to start Phase 1.**_

---

## 1. The problem (real, documented, and personal)

On Monad you pay for the **declared `gas_limit`, not the gas you actually use — even when your
transaction reverts.** We didn't take this on faith; we **verified it on live testnet**
(see [research/gas-model/VERIFICATION.md](./research/gas-model/VERIFICATION.md)):

- A reverted tx ([`0x272f56…`](https://testnet.monadexplorer.com/tx/0x272f56f75f38199c6cc1a465df6bb0c310bae51beaa4ea6500e15107f7fb29b8))
  paid its full declared limit — balance delta `0.013586524000131908 MON` = `gasLimit × price`,
  exact to the wei.
- **40/40** sampled txs report `receipt.gasUsed == gasLimit`: the chain hides your true usage.
- Primary docs confirm the model; wallets (MetaMask) *balloon* the limit on revert-probes, so a
  single failed action (minting a sold-out NFT, an underpriced swap) can cost a shocking amount.
- A Monad airdrop user burned **~$112,700 in MON** on failed txs. Network failure rate is **~6%**.

**Personal angle:** anyone deploying/testing contracts or running agents/scripts on Monad — me
included — silently bleeds MON to this every day. There is no Monad-native tool that prevents it.

## 2. Why this is a strong hackathon project

- **Solves a documented, six-figure, Monad-specific problem** — evidence, not vibes.
- **Personally felt** by the builder (the "solves your own problem" judging criterion).
- **Infra, reusable by the whole ecosystem** — SDK + MCP guard + on-chain contract, not a closed app.
- **Agent-economy relevant, authentically** — autonomous agents fire many txs, retry in loops, and
  are the population most exposed. AI adoption *increases* this tool's value (unlike a static linter).
- **Deeply Monad-native** — gas-limit charging, opcode repricing, async state, EIP-7702.
- **Live and quantifiable demo** — fire real doomed/over-sized txs with and without Reckon; show MON
  burned vs saved on-chain. Non-fakeable — exactly what the anti-slop AI judge wants.

## 3. Verified on-chain foundations (Monad testnet, chainId 10143)

| Primitive | Address / value | Status |
|---|---|---|
| Testnet | chainId `10143`, RPC `https://testnet-rpc.monad.xyz` | ✅ live |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` | ✅ has code |
| Pyth (pull oracle) | `0x2880aB155794e7179c9eE2e38200202908C17B43` | ✅ has code |
| ERC-8004 Identity / Reputation | `0x8004A169…a432` / `0x8004BAa1…9b63` | ✅ has code |
| Chainlink / Pyth-beta feeds (from docs) | (various) | ❌ **empty — do NOT use** |
| Gas-limit charging (incl. on revert) | — | ✅ **empirically verified** |

## 4. Architecture

```
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                          Reckon core engine (packages/core)               │
   │  simulate() → revert?  ·  gasModel() → tightest correct limit             │
   │  quoteCost() → worst-case MON  ·  preflight()/safeSend() verdicts         │
   │  (viem; Monad opcode repricing + buffer strategies)                       │
   └───────┬───────────────────────────┬───────────────────────────┬──────────┘
           │ imported by               │ imported by               │ targets
           ▼                           ▼                           ▼
 ┌───────────────────┐      ┌────────────────────────┐   ┌────────────────────────┐
 │  SDK / middleware │      │  MCP agent guard        │   │  GuardedExecutor (sol)  │
 │  (packages/sdk)   │      │  (packages/agent)       │   │  (contracts/)           │
 │  drop-in viem     │      │  reckon_preflight,      │   │  batched exec, per-call │
 │  wrapper for apps │      │  reckon_safe_send,      │   │  gas cap, max-fee ceil, │
 │  & deploy scripts │      │  reckon_quote_cost      │   │  policy; EIP-7702 route │
 └─────────┬─────────┘      └───────────┬────────────┘   └────────────┬───────────┘
           │                            │                             │
           ▼                            ▼                             ▼
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                         Monad testnet (RPC + contracts)                       │
 └─────────────────────────────────────────────────────────────────────────────┘
           ▲
           │ reads live data (blocked txs, MON saved, receipts)
 ┌─────────┴───────────────────────┐
 │  Dashboard (web/) Next.js+Shadcn │  "MON saved" · per-tx receipts · limit vs naive
 └──────────────────────────────────┘
```

### 4.1 `packages/core` — the pre-flight engine (viem, TypeScript)
- `simulate(tx)` — `eth_call` + state overrides (and `debug_traceCall` where useful) to detect
  reverts pre-broadcast, decoding the revert reason.
- `gasModel(tx)` — computes the tightest *correct* gas limit using Monad's real pricing (cold
  account 10,100 / cold storage 8,100 / precompile multipliers) plus a buffer strategy:
  static (~7.5%, per published research) and dynamic-by-`(to, selector)` history.
- `quoteCost(tx)` — worst-case MON the sender will actually be charged (`limit × price`).
- `preflight(tx)` → `{ ok, willRevert, revertReason, recommendedGasLimit, worstCaseFeeMON,
  overpayVsWalletDefault }`. `safeSend(tx)` refuses to broadcast doomed txs.

### 4.2 `packages/sdk` — drop-in for dApps & deploy scripts
Thin viem middleware / wallet client wrapper: call `client.safeSend(tx)` and get pre-flight for
free. Zero-config Monad chain wiring.

### 4.3 `packages/agent` — MCP server / agent guard
Exposes `reckon_preflight`, `reckon_safe_send`, `reckon_quote_cost` as MCP tools so any AI agent
routes every transaction through the seatbelt. Client-side policy (max fee/tx, daily cap) mirrored
on-chain by the GuardedExecutor.

### 4.4 `contracts/` — GuardedExecutor (Foundry, Solidity ^0.8.24, OpenZeppelin)
- `execute(Call[] calls, uint256 perCallGasCap, uint256 maxFeeWei)` — batched executor with a
  per-call gas cap and a max-fee ceiling; refuses over-budget/failing calls cheaply and predictably.
- EIP-7702-delegatable so an EOA/agent can route transactions through it.
- **Honest value:** it makes the correct limit *predictable and bounded* (so you can declare tight
  limits safely) and enforces on-chain policy for agents. It does **not** refund gas — Monad charges
  on the limit, so real savings come from pre-broadcast (§5).

### 4.5 `web/` — dashboard (Next.js + Wagmi v3 + Shadcn + Para)
Live "MON saved" from real blocked/right-sized txs; per-tx receipt pages (simulation verdict,
recommended vs naive limit, worst-case cost, on-chain result); wallet via Para. Design via
`/tastemaker`; every claim browser-tested.

## 5. Honest accounting of where the savings come from

- **Pre-broadcast is where money is saved:** not sending doomed txs (avoid full-limit fee) and
  declaring the tightest correct limit. Once a tx is on-chain, Monad charges the limit — **no
  refunds are possible**, so no component pretends to refund.
- The **on-chain GuardedExecutor** adds *predictability + policy*, not refunds.
- Every savings/΄cost claim in the demo is measured against **real testnet transactions**.

## 6. Phases & milestones

- **Phase 0 — Foundations.** ✅ Repo, plan, README, **empirical gas-model verification** committed.
- **Phase 1 — Core engine + tests.** `packages/core`: simulate + gasModel + quoteCost + preflight;
  unit tests against real testnet tx fixtures. _Milestone:_ `preflight` correctly flags a known
  reverting tx and returns a tighter-but-safe limit than a wallet default, demonstrated on real
  testnet data; tests green.
- **Phase 2 — GuardedExecutor + deploy.** Foundry contract + tests; deploy + verify on testnet.
  _Milestone:_ on-chain guarded batch that refuses an over-budget call, with explorer links + a
  verified contract address.
- **Phase 3 — SDK + MCP agent guard (real agent).** `packages/sdk` + `packages/agent`; a real
  Claude-driven agent that pre-flights before sending; run live on testnet. _Milestone:_ agent
  attempts doomed + over-sized txs, Reckon blocks/right-sizes them, **MON saved quantified on-chain**.
- **Phase 4 — Dashboard.** Next.js app on live testnet data; Para wallet; tastemaker design + UI
  tests. _Milestone:_ deployed app; every displayed claim browser-verified.
- **Phase 5 — (Stretch) consumer surface.** A wallet/browser pre-flight popup: "this tx will revert
  and cost you X MON." Only if 1–4 are solid.
- **Phase 6 — Submission.** Demo video (≤3 min), social post, contract address, repo, project URL.
- **Phase 7 — Market-driven hardening.** ✅ Three research-evidenced additions (not speculative
  features): an adaptive gas buffer (Category Labs described this and never built it), approval/
  permission-escalation risk detection (answers a real ~$175K May 2026 agent-drain incident), and
  an integration recipe (the actual moat mechanism for this product category, per founder-strategy
  research — becoming the pipeline other tools call, not a dashboard). See §9.

**Build order rationale:** the core engine is the dependency for every surface → prove it on real
data → put the guarded contract on-chain → agents/SDK produce live savings → dashboard visualizes
them → package.

## 7. Risks & mitigations

- **Simulation accuracy under async execution** (state drift between `latest` and execution) →
  simulate against the correct block tag; keep a safety buffer; validate against real tx fixtures.
- **Funding agent wallets** (10 MON reserve floor, ~1 tx/1.2s for low balances) → fund from faucet;
  stagger txs; use `eth_sendRawTransactionSync`. _Faucet needs the user (captcha/auth) — will surface._
- **Over-claiming savings** → only measure against real testnet txs; the honest accounting in §5
  stays front-and-center; empirically re-verify before any headline number.
- **Time (deadline Jul 19)** → Phases 1–4 are the winning submission; Phase 5 is optional.

## 9. Phase 7 detail — what the market research actually said, and what we built

Before adding anything, three parallel research passes (agent-economy trends, Monad's specific
competitive landscape, and dev-infra moat strategy) were run rather than guessing at "founder
instinct." Each addition below traces to a specific, current, sourced finding — nothing spec'd
here is speculative.

**1. Adaptive gas buffer** (`packages/core/src/adaptiveBuffer.ts`). Category Labs (Monad's own
team) publicly proposed a rolling-window, per-`(contract, selector)` gas buffer as the ideal
approach, but never shipped it — a genuine unclaimed lane. `fetchHistoricalGasUsage` scans real
recent chain history (successful receipts only, since this repo already proved a Monad receipt's
`gasUsed` can equal the charged limit rather than true cost); `computeAdaptiveBuffer` turns that
into a buffer via a documented three-signal formula (coefficient of variation, tail deviation,
today-vs-history shift). **Deliberately not wired into `preflight()`'s default path** — an early
version's live test timed out at 150s scanning a quiet contract's history with no early exit,
which would make every pre-flight call unacceptably slow. Fixed with a hard wall-clock cap
(`maxDurationMs`, default 8s) and is opt-in only via `PreflightOptions.historicalSamples` — callers
fetch/cache history separately; `preflight()` itself never triggers its own scan, so it stays fast
by default (as already proven live in Phase 1).

**2. Approval/permission-escalation risk detection** (`packages/core/src/riskDetection.ts`). In
May 2026 an autonomous agent lost ~$175K: an NFT grant silently escalated its permissions, then a
prompt injection got it to sign an unlimited token approval, a call that succeeds on-chain and
moves zero value itself, so a naive spend-cap or revert check sees nothing wrong. `detectRiskFlags`
decodes `approve`/`increaseAllowance`/`setApprovalForAll`/`permit` calldata (selectors derived via
viem, verified against known real values, not hand-typed) and flags exactly this pattern, always
computed (cheap, synchronous, no RPC) and attached to every `PreflightVerdict` regardless of
`willRevert`. **Product decision:** Reckon does not auto-block on this in the general SDK/dashboard
(an `approve()` can be entirely legitimate DeFi usage) — it surfaces severity so the caller decides.
The MCP agent-guard surface is stricter by design: `reckon_preflight` returns `isError: true` for a
critical flag even when nothing reverts, because an autonomous agent should not self-authorize a
critical permission grant without a human in the loop, which is exactly the incident this answers.

**3. Integration recipe** (`examples/agent-framework-recipe/`). Founder-strategy research on this
exact product category (Tenderly, Blocknative, Gelato, OpenZeppelin Defender) is blunt: the
historical moat mechanism is not aggregate data and not an enterprise dashboard, it's becoming the
pipeline other tools call before every send. The minimum viable step identified was a single real
reference integration, not a feature build. `agent-loop.mjs` is that recipe: a runnable, tested
example wiring Reckon's MCP server as an agent framework's mandatory pre-flight gate.

**What was deliberately not built:** a dashboard/leaderboard, a token, multi-chain support, an
enterprise policy UI, on-chain enforcement of risk flags (would require redeploying the already-
verified `GuardedExecutor` this close to the deadline for uncertain benefit). All three additions
were built by two parallel isolated-worktree agents plus one done directly; every claim in this
section was independently re-verified (re-ran each agent's tests myself, fixed one real timeout bug
and one real bigint-serialization bug the agents' own tests didn't catch, added a new live
integration test proving the wiring, not just the standalone modules).

## 8. Standing rules

Never claim something works without an end-to-end test. Correctness over speed. Commit + push
regularly; keep this doc and the README current. Built with Monskills; UI via `/tastemaker`.
