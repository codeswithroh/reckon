# @codeswithroh/reckon-core

The pre-flight engine behind [Reckon](https://reckon-monad-seatbelt.vercel.app) — a transaction
seatbelt for [Monad](https://monad.xyz).

On Monad you pay for the gas limit you **declare**, not the gas you use, even when your
transaction reverts. `preflight()` simulates a transaction before you send it, refuses to let you
broadcast a doomed one, computes the tightest safe gas limit, and flags approval/permission-
escalation risk (unlimited ERC-20 allowances, NFT operator grants, EIP-2612 permits) that a
naive revert check would miss.

## Install

```bash
npm install @codeswithroh/reckon-core viem
```

## Usage

```ts
import { createPublicClient, http } from "viem";
import { monadTestnet, preflight } from "@codeswithroh/reckon-core";

const client = createPublicClient({ chain: monadTestnet, transport: http() });

const verdict = await preflight(client, {
  from: "0xYourAddress",
  to: "0xTargetContract",
  data: "0x...",
});

if (verdict.willRevert) {
  console.log("Would fail:", verdict.revertReason);
} else if (verdict.riskFlags.some((f) => f.severity === "critical")) {
  console.log("Critical risk:", verdict.riskSummary);
} else {
  console.log("Safe to send with gas limit", verdict.recommendedGasLimit);
}
```

## What it does

- **`preflight(client, tx, options?)`** — simulates via `eth_estimateGas`, decodes revert reasons,
  computes the tightest safe gas limit (static or adaptive), and flags approval risk. Never
  broadcasts.
- **`safeSend(clients, tx, options?)`** — pre-flights, then broadcasts only if safe.
- **`detectRiskFlags(tx)`** — pure, synchronous decoding of `approve`/`increaseAllowance`/
  `setApprovalForAll`/`permit` calldata into severity-ranked risk flags.
- **`fetchHistoricalGasUsage` / `computeAdaptiveBuffer` / `recommendAdaptiveGasLimit`** — an
  opt-in adaptive gas buffer learned from a contract's real historical execution variance,
  instead of a flat percentage.

## Why this exists

Verified empirically, not assumed: a reverted transaction on Monad testnet paid its full declared
gas limit, exact to the wei. See the
[verification writeup](https://github.com/codeswithroh/reckon/blob/main/research/gas-model/VERIFICATION.md)
and the full [project README](https://github.com/codeswithroh/reckon).

## License

MIT
