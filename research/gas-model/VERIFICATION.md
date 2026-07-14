# Monad Gas-Model Verification

The problem Reckon addresses rests on one claim about Monad. Rather than trust the docs, we
**verified it against live testnet data** (chainId 10143). These scripts are reproducible; run
them yourself with `npm install && npm run summary`.

## Claim

> On Monad you pay for the **declared `gas_limit`**, not the gas actually used — **even when the
> transaction reverts.**

## Evidence

### 1. A reverted transaction pays the full declared limit (proven to the wei)

`npm run prove-charge` scans recent blocks for a reverted tx and compares the sender's real
balance delta to `gasLimit × price`:

```
tx      : 0x272f56f75f38199c6cc1a465df6bb0c310bae51beaa4ea6500e15107f7fb29b8
status  : 0x0 (reverted)   value: 0 MON
balance delta   = 0.013586524000131908 MON
gasLimit × price = 0.013586524000131908 MON
exact match: true
```

The sender paid the entire declared gas limit and got a reverted transaction in return.

### 2. Receipts report `gasUsed == gasLimit` — real usage is hidden

`npm run prove-receipts` samples 40 recent txs and compares `receipt.gasUsed` to the tx's
declared `gas`:

```
Q1 — receipt.gasUsed == tx.gas(limit):  equal=40  notEqual=0  (of 40)
     => ALWAYS equal: receipt reports the CHARGED LIMIT, not actual usage
```

Consequence: you **cannot** learn your transaction's true gas cost from its receipt — the chain
reports back the limit you declared. `debug_traceTransaction`'s `callTracer` echoes the same
number. The only way to discover the true minimum is to simulate/estimate before sending — which
is exactly what Reckon does.

### 3. Documentation agrees (primary sources)

- *"The gas charged for a transaction is the gas limit set in the transaction, rather than the gas
  used in the course of execution."* — [docs.monad.xyz](https://docs.monad.xyz/developer-essentials/gas-on-monad)
- *"…the sender is still on the hook for the gas consumed up to that point (on Monad, this is the
  `gas_limit`)."* — [category.xyz](https://www.category.xyz/blogs/setting-your-gas-limit-on-monad)
- Wallets balloon the limit on revert-probes: *"when `eth_estimateGas` … reverts, they set the gas
  limit … to a very high value"* — dangerous on Monad because the full limit is charged.
  ([docs.monad.xyz/gas-pricing](https://docs.monad.xyz/developer-essentials/gas-pricing))

### 4. Real-world impact

- A Monad airdrop recipient burned **~$112,700 in MON** on gas from hundreds of failed scripted
  transactions. ([Whale Alert](https://whale-alert.io/stories/eb623de323fd/))
- Monad's transaction **failure rate is ~6.0%** vs Ethereum's 0.9%.

## Why this makes Reckon necessary

Because failed and mis-sized transactions cost real money and the chain hides your true usage, the
only defense is **pre-broadcast**: simulate the transaction, refuse to send doomed ones, and set
the tightest correct limit using Monad's actual opcode pricing. That is Reckon.

_Also verified live (see PLAN.md): ERC-8004 registries, Pyth, Stork, and Multicall3 have code on
testnet; the docs' Chainlink and Pyth-beta feed addresses are empty and unusable._
