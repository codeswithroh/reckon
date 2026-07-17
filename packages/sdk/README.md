# @codeswithroh/reckon-sdk

A drop-in SDK for [Reckon](https://reckon-monad-seatbelt.netlify.app) — a transaction seatbelt for
[Monad](https://monad.xyz). Pre-flight and safe-send transactions, guard an EIP-1193 wallet
provider so doomed or risky transactions never reach the wallet, or route a batch through the
on-chain `GuardedExecutor`.

## Install

```bash
npm install @codeswithroh/reckon-sdk viem
```

## Pre-flight and safe-send

```ts
import { createReckonClient } from "@codeswithroh/reckon-sdk";

const reckon = createReckonClient({ account: myAccount });

const verdict = await reckon.preflight(tx);
if (verdict.willRevert) throw new Error(verdict.revertReason);

const { hash } = await reckon.safeSend(tx); // pre-flights, then broadcasts only if safe
```

## Guard a wallet provider

One line protects a whole dApp's users: every `eth_sendTransaction` is pre-flighted first, and
a doomed or critically-risky call (an unlimited approval, an NFT operator grant) is blocked
**before the wallet even prompts** — the user never signs it, never burns MON on a failure.

```ts
import { createGuardedProvider } from "@codeswithroh/reckon-sdk";

const provider = createGuardedProvider(window.ethereum);
// use `provider` anywhere you'd use window.ethereum
```

## Route a batch through the on-chain guard

```ts
await reckon.guardedExecute([
  { target: "0x...", data: "0x...", gasCap: 100_000n },
]);
```

## Why this exists

On Monad you pay for the gas limit you **declare**, not the gas you use, even when your
transaction reverts, verified empirically to the wei (see the
[project README](https://github.com/codeswithroh/reckon)). Reckon pre-flights every transaction so
you stop paying for failures and oversized limits, and flags approval/permission-escalation risk
that a naive revert check would miss.

## License

MIT
