# Reckon Contracts — GuardedExecutor

The on-chain half of Reckon: a policy-enforcing, gas-bounded batch executor for Monad.

## What it does (and honestly doesn't)

On Monad you pay for the declared `gas_limit`, not gas used — even on revert. So a contract
**cannot refund gas**, and `GuardedExecutor` does not pretend to. Its real value:

1. **Bounded, predictable execution.** Every call runs under an explicit per-call gas cap
   (`call{gas: cap}`), so no single call can run away. That lets the off-chain Reckon SDK declare a
   tight, correct total gas limit for a whole batch and know it's safe — which is where the MON
   savings come from.
2. **On-chain policy guardrails.** A per-caller policy caps value per call and in total, sets a max
   acceptable gas price, and can restrict targets to an allowlist. These prevent catastrophic value
   loss and unauthorized actions by a buggy or compromised agent — enforced outside the agent's
   control.

EIP-7702 friendly: an EOA can delegate to this implementation; policy is keyed by `msg.sender`.

## Layout

```
src/GuardedExecutor.sol     the contract
test/GuardedExecutor.t.sol  16 tests (success, value, failure modes, gas caps, policy, guards)
script/Deploy.s.sol         deployment script
```

## Develop

```bash
git submodule update --init --recursive   # fetch forge-std
forge build
forge test -vv
```

All 16 tests run on Foundry's local EVM — no network or funds needed.

## Deploy to Monad testnet

1. Put a funded testnet deployer key in `contracts/.env` (see `.env.example`). `.env` is gitignored.
2. Deploy:

   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url monad_testnet --broadcast
   ```

   Deployment costs ~0.2 MON at current testnet gas.

3. Verify the source on the Monad explorers (Monskills verification API):

   ```bash
   # see PLAN.md Phase 2 — verified via https://agents.devnads.com/v1/verify
   ```

## Deployed addresses

_Populated after Phase 2 deployment._

| Network | Address |
|---|---|
| Monad testnet (10143) | _pending funding + deploy_ |
