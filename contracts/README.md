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
src/GuardedExecutor.sol       the contract
src/MockToken.sol             minimal ERC-20, deployed purely as a live demo target for
                               Reckon's approval-risk detection (see riskDetection.ts) — no
                               production value, just a genuine approve()/transfer() to point
                               the dashboard's "unlimited approval" preset at
test/GuardedExecutor.t.sol    16 tests (success, value, failure modes, gas caps, policy, guards)
test/MockToken.t.sol          6 tests
script/Deploy.s.sol           GuardedExecutor deployment script
script/DeployMockToken.s.sol  MockToken deployment script
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

| Contract | Address | Status |
|---|---|---|
| GuardedExecutor | [`0x84e5C3c524f473c19821ae2D1494b274730bB6AE`](https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE) | ✅ deployed & source-verified |
| MockToken (demo ERC-20) | [`0x1eF032308c9fFfa11277775a3969eBe62dedD68E`](https://testnet.monadscan.com/address/0x1eF032308c9fFfa11277775a3969eBe62dedD68E) | ✅ deployed & source-verified |

All on Monad testnet (chainId 10143).

- GuardedExecutor deploy tx: [`0x3a2800…e4dc7`](https://testnet.monadexplorer.com/tx/0x3a2800dc5ab50807cb2482ae7607f7e9ccc45556953ebcfcbea6faeccdfe4dc7)
- Example live `execute()` batch: [`0x314cca…42ac5`](https://testnet.monadexplorer.com/tx/0x314cca306b7c0cd8581fb47fc1fcc18875673a7b21342c99a5a743e519d42ac5)
  (ran a real Multicall3 read through the guard; emitted `CallExecuted` + `BatchExecuted`)
- MockToken deploy tx: [`0xef5538…345f4`](https://testnet.monadexplorer.com/tx/0xef5538baaeefe1b087cbd5cf42bef43dec4a85587859e7fc3290a0ebe3345f46)
- Verified: [MonadVision](https://testnet.monadvision.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE) · [Monadscan](https://testnet.monadscan.com/address/0x84e5C3c524f473c19821ae2D1494b274730bB6AE)
