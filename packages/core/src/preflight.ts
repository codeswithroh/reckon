import { type PublicClient, formatEther } from "viem";
import type { PreflightOptions, PreflightVerdict, ReckonTxRequest } from "./types.js";
import { extractRevertReason } from "./revert.js";
import {
  DEFAULT_BUFFER_BPS,
  NAIVE_BUFFER_BPS,
  feeForLimit,
  naiveGasLimit,
  recommendGasLimit,
} from "./gasModel.js";
import { detectRiskFlags, summarizeRiskFlags } from "./riskDetection.js";
import { computeAdaptiveBuffer } from "./adaptiveBuffer.js";

/**
 * Pre-flight a Monad transaction.
 *
 * The core of Reckon. Given a tx request it:
 *   1. Estimates the true minimum gas via `eth_estimateGas` (real Monad execution).
 *      If that reverts, the tx would fail on-chain → we mark it and refuse it, rather than
 *      ballooning the limit the way ordinary wallets do (which on Monad burns the full limit).
 *   2. Computes the tightest safe limit and the worst-case MON cost.
 *   3. Quantifies what the naive path would have cost — overpay avoided on success, or the
 *      whole fee avoided on a revert.
 *
 * Read-only: never broadcasts. See `safeSend` for the send path.
 */
export async function preflight(
  client: PublicClient,
  tx: ReckonTxRequest,
  options: PreflightOptions = {},
): Promise<PreflightVerdict> {
  const naiveBufferBps = options.naiveBufferBps ?? NAIVE_BUFFER_BPS;
  const blockTag = options.blockTag ?? "latest";
  const notes: string[] = [];

  // Cheap, synchronous, no RPC — safe to always run, regardless of willRevert.
  const riskFlags = detectRiskFlags({ to: tx.to, data: tx.data, value: tx.value });
  const riskSummary = summarizeRiskFlags(riskFlags) || undefined;
  if (riskSummary) notes.push(riskSummary);

  // Adaptive buffer (opt-in via pre-fetched samples, see PreflightOptions.historicalSamples) is
  // only meaningful once trueMinGas is known (it's one of the buffer's input signals), so it's
  // computed further down, in the success path — this just decides the static fallback here.
  const bufferBps = options.bufferBps ?? DEFAULT_BUFFER_BPS;
  const useAdaptive = options.historicalSamples !== undefined && options.bufferBps === undefined;

  const gasPrice = await client.getGasPrice();
  const isNativeTransfer =
    (!tx.data || tx.data === "0x") && tx.to !== undefined && (tx.value ?? 0n) >= 0n;

  let trueMinGas: bigint | undefined;
  try {
    trueMinGas = await client.estimateGas({
      account: tx.from,
      to: tx.to,
      data: tx.data,
      value: tx.value,
      blockTag,
      ...(options.stateOverride ? { stateOverride: options.stateOverride } : {}),
    });
  } catch (err) {
    // estimateGas executes the tx; a throw means it would revert.
    const reason = extractRevertReason(err) ?? "transaction would revert";
    const naiveLimit = tx.gas ?? naiveGasLimit({ trueMinGas: 500_000n, naiveBufferBps });
    const naiveFeeWei = feeForLimit(naiveLimit, gasPrice);
    notes.push(
      "estimateGas reverted — broadcasting would fail and, on Monad, still charge the full gas limit.",
      "Reckon refuses to broadcast. A naive wallet may balloon the limit and burn the fee for nothing.",
    );
    return {
      ok: false,
      willRevert: true,
      revertReason: reason,
      trueMinGas: undefined,
      recommendedGasLimit: undefined,
      bufferBps,
      gasPrice,
      naiveGasLimit: naiveLimit,
      naiveFeeWei,
      savingsVsNaiveWei: naiveFeeWei,
      savingsVsNaiveMON: formatEther(naiveFeeWei),
      notes,
      riskFlags,
      riskSummary,
    };
  }

  let effectiveBufferBps = bufferBps;
  let adaptiveBuffer: PreflightVerdict["adaptiveBuffer"];
  if (useAdaptive) {
    const adaptive = computeAdaptiveBuffer(options.historicalSamples!, trueMinGas);
    effectiveBufferBps = adaptive.bufferBps;
    adaptiveBuffer = adaptive;
    notes.push(
      `Adaptive buffer: ${adaptive.bufferBps}bps from ${adaptive.sampleSize} historical sample(s) ` +
        `(confidence: ${adaptive.confidence}), vs the static ${DEFAULT_BUFFER_BPS}bps default.`,
    );
  }

  const recommendedGasLimit = recommendGasLimit({
    trueMinGas,
    isNativeTransfer,
    bufferBps: effectiveBufferBps,
  });
  const worstCaseFeeWei = feeForLimit(recommendedGasLimit, gasPrice);

  const naiveLimit = tx.gas ?? naiveGasLimit({ trueMinGas, naiveBufferBps });
  const naiveFeeWei = feeForLimit(naiveLimit, gasPrice);
  const savingsVsNaiveWei =
    naiveFeeWei > worstCaseFeeWei ? naiveFeeWei - worstCaseFeeWei : 0n;

  notes.push(
    `True minimum gas ${trueMinGas} → recommended limit ${recommendedGasLimit} (+${effectiveBufferBps} bps).`,
  );
  if (tx.gas !== undefined && tx.gas < recommendedGasLimit) {
    notes.push(
      `Warning: your gas ${tx.gas} is below the recommended ${recommendedGasLimit}; the tx risks running out of gas and — on Monad — still costs the full limit.`,
    );
  }
  if (savingsVsNaiveWei > 0n) {
    notes.push(
      `Tighter than the naive limit ${naiveLimit}: saves ${formatEther(savingsVsNaiveWei)} MON.`,
    );
  }

  return {
    ok: true,
    willRevert: false,
    trueMinGas,
    recommendedGasLimit,
    bufferBps: effectiveBufferBps,
    gasPrice,
    worstCaseFeeWei,
    worstCaseFeeMON: formatEther(worstCaseFeeWei),
    naiveGasLimit: naiveLimit,
    naiveFeeWei,
    savingsVsNaiveWei,
    savingsVsNaiveMON: formatEther(savingsVsNaiveWei),
    notes,
    riskFlags,
    riskSummary,
    adaptiveBuffer,
  };
}
