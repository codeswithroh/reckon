/**
 * Adaptive gas buffer, learned from a contract's own historical execution variance.
 *
 * Reckon's static default (`DEFAULT_BUFFER_BPS` in `./gasModel.ts`) applies a flat 7.5% over
 * `eth_estimateGas`'s true minimum for every call. That's a reasonable population-wide average,
 * but it's blind to the fact that different `(contract, selector)` pairs behave very
 * differently on Monad:
 *   - A simple storage read/write with no branchy logic (e.g. an ERC-20 `transfer` to an
 *     existing balance slot) tends to cost almost exactly the same gas every time → a flat
 *     7.5% buffer is mostly wasted slack, i.e. money left on the table since Monad charges the
 *     declared limit regardless of use.
 *   - A function whose cost depends on data-dependent branches (loops over caller-supplied
 *     arrays, conditional cold-storage access, first-time initializations) can vary a lot
 *     tx-to-tx → 7.5% may not be enough headroom, risking an out-of-gas failure that *still*
 *     burns the full limit on Monad.
 *
 * This module estimates that per-function variance from real recent chain history and turns it
 * into a bespoke buffer, tighter when history says "this is stable" and looser when it says
 * "this swings around a lot." It is intentionally self-contained (no changes to
 * preflight.ts/types.ts/index.ts) so it can be wired in centrally later.
 *
 * Nobody has shipped this for Monad yet — Category Labs described the idea publicly but never
 * built it. This is a first version: the formula below is a defensible, documented heuristic,
 * not a peer-reviewed statistical model. Treat it as a starting point to tune with real
 * production data.
 */

import type { Address, Hex, PublicClient } from "viem";
import { applyBufferBps, DEFAULT_BUFFER_BPS } from "./gasModel.js";

export type AdaptiveConfidence = "high" | "medium" | "low";

export interface HistoricalGasScanOptions {
  /** How many blocks back to scan looking for prior calls to this target. Default 2000. */
  blockLookback?: number;
  /** Stop once this many samples are collected, so the scan doesn't run unbounded. Default 50. */
  maxSamples?: number;
  /**
   * Hard wall-clock cap on the whole scan, in ms. Default 8000. A quiet contract on a quiet
   * chain can have almost no matching calls in the lookback window, in which case the scan
   * would otherwise walk the entire window with no early exit — this guarantees the function
   * always returns promptly with whatever it found, rather than degrading into a multi-minute
   * call. This is why this function must never be called synchronously inside the default
   * preflight() path (see preflight.ts) — it's an explicit, opt-in, cacheable capability.
   */
  maxDurationMs?: number;
}

export interface AdaptiveBufferResult {
  /** Recommended buffer over the true minimum, in basis points. */
  bufferBps: number;
  /** How much to trust this buffer, based on how much history backs it. */
  confidence: AdaptiveConfidence;
  /** Number of historical samples the buffer was computed from. */
  sampleSize: number;
}

export interface AdaptiveGasLimitResult extends AdaptiveBufferResult {
  /** Final recommended gas limit: `trueMinGas` with `bufferBps` applied, rounded up. */
  gasLimit: bigint;
}

const DEFAULT_BLOCK_LOOKBACK = 2_000;
const DEFAULT_MAX_SAMPLES = 50;
const DEFAULT_MAX_DURATION_MS = 8_000;
/**
 * How many blocks to fetch receipts for concurrently per scan round. Empirically (manual
 * probing against the real testnet RPC: 300 blocks in ~8.5s at this concurrency), wall time is
 * dominated by round-trip latency rather than batch size up to several dozen concurrent
 * requests, so a larger batch meaningfully reduces the number of sequential round trips needed
 * to cover the lookback window.
 */
const SCAN_CONCURRENCY = 40;

/**
 * Scan recent Monad blocks for real transactions to `target.to` (optionally narrowed to calls
 * whose calldata starts with `target.selector`, a 4-byte function selector) and return the
 * `gasUsed` figure from each transaction's receipt.
 *
 * Caveat (see `research/gas-model/VERIFICATION.md`): this repo has empirically shown that a
 * Monad receipt's `gasUsed` can equal the *charged gas limit* rather than the true execution
 * cost, at least for reverted transactions. We therefore only sample *successful* (status
 * 0x1) receipts here, where `gasUsed` is the best available real-world proxy for execution
 * cost — but it is still a proxy, not a guaranteed-precise figure, and callers should treat the
 * resulting distribution as directionally informative rather than exact.
 *
 * Scans newest-block-first in small concurrent batches (mirroring the pattern used in
 * `research/gas-model/*.mjs`) and stops as soon as `maxSamples` is reached, the lookback window
 * is exhausted, or `maxDurationMs` elapses (whichever comes first) — always returning whatever
 * samples were found so far rather than throwing or hanging.
 */
export async function fetchHistoricalGasUsage(
  client: PublicClient,
  target: { to: Address; selector?: Hex },
  opts: HistoricalGasScanOptions = {},
): Promise<bigint[]> {
  const blockLookback = opts.blockLookback ?? DEFAULT_BLOCK_LOOKBACK;
  const maxSamples = opts.maxSamples ?? DEFAULT_MAX_SAMPLES;
  const maxDurationMs = opts.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const toLower = target.to.toLowerCase();
  const selectorLower = target.selector?.toLowerCase();

  const startedAt = Date.now();
  const samples: bigint[] = [];
  const latest = await client.getBlockNumber();
  const floor = latest > BigInt(blockLookback) ? latest - BigInt(blockLookback) : 0n;

  let cursor = latest;
  while (
    cursor > floor &&
    samples.length < maxSamples &&
    Date.now() - startedAt < maxDurationMs
  ) {
    const batchBlocks: bigint[] = [];
    for (let i = 0n; i < BigInt(SCAN_CONCURRENCY) && cursor - i > floor; i++) {
      batchBlocks.push(cursor - i);
    }
    if (batchBlocks.length === 0) break;

    const batchReceipts = await Promise.all(
      batchBlocks.map(async (bn) => {
        try {
          const receipts = await client.request({
            method: "eth_getBlockReceipts",
            params: [`0x${bn.toString(16)}`],
          });
          return receipts ?? [];
        } catch {
          // Block may be outside retained state, or the RPC hiccuped — skip it.
          return [];
        }
      }),
    );

    for (const receipts of batchReceipts) {
      const matches = receipts.filter(
        (r) => r.to && r.to.toLowerCase() === toLower && r.status === "0x1",
      );
      if (matches.length === 0) continue;

      if (selectorLower) {
        // Receipts don't carry calldata, so selector-filtering needs the full transaction.
        // Fetched in parallel per batch to keep the scan reasonably fast.
        const withTx = await Promise.all(
          matches.map(async (r) => {
            try {
              const tx = await client.request({
                method: "eth_getTransactionByHash",
                params: [r.transactionHash],
              });
              return { r, input: tx?.input?.toLowerCase() };
            } catch {
              return { r, input: undefined };
            }
          }),
        );
        for (const { r, input } of withTx) {
          if (samples.length >= maxSamples) break;
          if (!input || !input.startsWith(selectorLower)) continue;
          try {
            samples.push(BigInt(r.gasUsed));
          } catch {
            // malformed/unexpected receipt shape — skip rather than throw.
          }
        }
      } else {
        for (const r of matches) {
          if (samples.length >= maxSamples) break;
          try {
            samples.push(BigInt(r.gasUsed));
          } catch {
            // skip malformed receipt
          }
        }
      }
    }

    cursor -= BigInt(batchBlocks.length);
  }

  return samples;
}

function confidenceFor(sampleSize: number): AdaptiveConfidence {
  if (sampleSize < 5) return "low";
  if (sampleSize < 15) return "medium";
  return "high";
}

const MIN_BUFFER_BPS = 100; // never go below 1% — some slack is always warranted
const MAX_BUFFER_BPS = 3_000; // never go above 30% — beyond this the buffer stops being useful
const BASE_BUFFER_BPS = 200; // floor for a "perfectly stable" function: 2%, tighter than the 7.5% static default

// The volatility score blends three signals, each capturing a different failure mode of using
// just one number:
//   1. Coefficient of variation (stdDev / mean) — overall dispersion, relative to typical cost
//      so it's comparable across functions of very different absolute gas cost.
//   2. Tail deviation ((max - mean) / mean) — the worst historical overshoot. CV alone can look
//      small even when there's one nasty outlier buried in an otherwise tight cluster; a single
//      very costly historical execution is a real signal that today's call could hit the same
//      code path, so it gets weighted in directly rather than getting averaged away.
//   3. Shift deviation (|historicalMean - trueMinGas| / max(historicalMean, trueMinGas)) — how
//      much *today's* fresh estimate differs from the historical pattern. If today's estimate
//      is already far from what this function has cost in the past, the history is a weaker
//      predictor of today's execution, so we add extra caution.
// Weights sum to 1; tuned so dispersion dominates (it's the most direct signal) but a bad tail
// sample or a surprising today-vs-history gap can't be fully washed out.
const CV_WEIGHT = 0.5;
const TAIL_WEIGHT = 0.3;
const SHIFT_WEIGHT = 0.2;

// Maps a volatility "fraction" (e.g. 0.10 = 10% relative spread) onto basis points 1:1 with the
// percentage, i.e. a fraction of 0.10 contributes 1000bps before the base/clamp are applied.
const VOLATILITY_TO_BPS_SCALE = 10_000;

/**
 * Pure function: given historical gas-usage samples for this `(contract, selector)` and today's
 * true-minimum estimate, compute a statistically-grounded buffer.
 *
 * No I/O. Deterministic given its inputs, so it's fully unit-testable without a live RPC.
 */
export function computeAdaptiveBuffer(
  samples: bigint[],
  trueMinGas: bigint,
): AdaptiveBufferResult {
  const sampleSize = samples.length;

  if (sampleSize === 0) {
    // No history at all: fall back to the same static default the rest of Reckon uses, and
    // flag low confidence so callers know this isn't actually adaptive yet.
    return { bufferBps: DEFAULT_BUFFER_BPS, confidence: "low", sampleSize: 0 };
  }

  const values = samples.map((s) => Number(s));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const trueMinGasNum = Number(trueMinGas);

  if (!(mean > 0)) {
    // Degenerate history (all-zero samples) — nothing useful to learn from.
    return {
      bufferBps: DEFAULT_BUFFER_BPS,
      confidence: confidenceFor(sampleSize),
      sampleSize,
    };
  }

  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  const maxSample = Math.max(...values);
  const tailDeviation = Math.max(0, (maxSample - mean) / mean);

  const shiftDeviation =
    trueMinGasNum > 0
      ? Math.abs(mean - trueMinGasNum) / Math.max(mean, trueMinGasNum)
      : 0;

  const volatilityScore =
    CV_WEIGHT * cv + TAIL_WEIGHT * tailDeviation + SHIFT_WEIGHT * shiftDeviation;

  const rawBufferBps = BASE_BUFFER_BPS + volatilityScore * VOLATILITY_TO_BPS_SCALE;
  const bufferBps = Math.min(
    MAX_BUFFER_BPS,
    Math.max(MIN_BUFFER_BPS, Math.round(rawBufferBps)),
  );

  return { bufferBps, confidence: confidenceFor(sampleSize), sampleSize };
}

/**
 * Combine `computeAdaptiveBuffer` with the true-minimum estimate to produce a final recommended
 * gas limit, using the same ceil-rounding convention as `recommendGasLimit`/`applyBufferBps` in
 * `./gasModel.ts`.
 */
export function recommendAdaptiveGasLimit(
  trueMinGas: bigint,
  samples: bigint[],
): AdaptiveGasLimitResult {
  const { bufferBps, confidence, sampleSize } = computeAdaptiveBuffer(
    samples,
    trueMinGas,
  );
  const gasLimit = applyBufferBps(trueMinGas, bufferBps);
  return { gasLimit, bufferBps, confidence, sampleSize };
}
