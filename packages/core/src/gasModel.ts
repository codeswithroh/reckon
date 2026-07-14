/**
 * Monad gas model.
 *
 * Two jobs:
 *   1. Turn a *true minimum* gas figure (from `eth_estimateGas`, which binary-searches real
 *      Monad execution) into the tightest *safe* gas limit, using a small buffer — because on
 *      Monad you pay for the declared limit, so every unit of slack is money.
 *   2. Model what a naive wallet would set, so we can quantify the overpay Reckon avoids.
 *
 * Monad-specific facts encoded here (verified in research/gas-model):
 *   - You are charged `gas_limit * price`, not `gas_used * price` — even on revert.
 *   - `eth_estimateGas` reflects Monad's real opcode pricing (cold access / precompiles are
 *     repriced), so we base the recommendation on it rather than on Ethereum assumptions.
 *   - Wallets (e.g. MetaMask) balloon the limit when a revert-probe fails. On Monad that is a
 *     money-loss trap, so Reckon NEVER balloons: if the tx would revert, we refuse it.
 */

/** Opcode repricing on Monad vs Ethereum (gas units). Reference / education, not the basis of
 *  the recommendation — `eth_estimateGas` already prices these correctly on-chain. */
export const MONAD_OPCODE_GAS = {
  coldAccountAccess: 10_100, // Ethereum 2_600
  coldStorageAccess: 8_100, // Ethereum 2_100
  warmAccess: 100,
  precompiles: {
    ecRecover: 6_000, // 2x
    ecMul: 30_000, // 5x
    ecPairing: 225_000, // 5x
    pointEvaluation: 200_000, // 4x
  },
} as const;

/** Exact intrinsic cost of a bare native MON transfer (no calldata). */
export const NATIVE_TRANSFER_GAS = 21_000n;

/**
 * Reckon's default buffer over the true minimum, in basis points.
 * 750 bps = 7.5%, the value published research found gives ~1.2–2% failure with ~7–9% unused
 * gas on Monad — a good static default. Callers can override or use a dynamic buffer.
 */
export const DEFAULT_BUFFER_BPS = 750;

/**
 * A naive wallet's buffer, for the overpay comparison. MetaMask-style clients pad estimates
 * generously (~50%). This is the baseline Reckon improves on for *successful* txs.
 */
export const NAIVE_BUFFER_BPS = 5_000;

const BPS = 10_000n;

/** Apply a basis-point buffer to a gas figure, rounding up. */
export function applyBufferBps(gas: bigint, bufferBps: number): bigint {
  if (gas < 0n) throw new Error("gas must be non-negative");
  if (bufferBps < 0) throw new Error("bufferBps must be non-negative");
  const b = BigInt(Math.floor(bufferBps));
  // ceil(gas * (BPS + b) / BPS)
  const numerator = gas * (BPS + b);
  return (numerator + BPS - 1n) / BPS;
}

/**
 * Recommend the tightest safe gas limit given the true minimum from estimateGas.
 * For fixed-cost native transfers we return the exact intrinsic cost (no buffer needed).
 */
export function recommendGasLimit(params: {
  trueMinGas: bigint;
  isNativeTransfer?: boolean;
  bufferBps?: number;
}): bigint {
  const { trueMinGas, isNativeTransfer = false } = params;
  const bufferBps = params.bufferBps ?? DEFAULT_BUFFER_BPS;
  if (isNativeTransfer && trueMinGas <= NATIVE_TRANSFER_GAS) {
    return NATIVE_TRANSFER_GAS;
  }
  return applyBufferBps(trueMinGas, bufferBps);
}

/** What a naive wallet would likely set as the limit for a *successful* tx. */
export function naiveGasLimit(params: {
  trueMinGas: bigint;
  naiveBufferBps?: number;
}): bigint {
  const naiveBufferBps = params.naiveBufferBps ?? NAIVE_BUFFER_BPS;
  return applyBufferBps(params.trueMinGas, naiveBufferBps);
}

/** Fee actually charged on Monad for a given limit: `limit * price`. */
export function feeForLimit(gasLimit: bigint, gasPrice: bigint): bigint {
  return gasLimit * gasPrice;
}
