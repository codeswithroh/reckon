import type { Address, Hex, StateOverride } from "viem";
import type { RiskFlag } from "./riskDetection.js";
import type { AdaptiveConfidence } from "./adaptiveBuffer.js";

/** A transaction request to pre-flight. Mirrors the fields Reckon needs. */
export interface ReckonTxRequest {
  /** Sender. Required for accurate simulation (balance, access lists, msg.sender checks). */
  from: Address;
  /** Target address. `undefined`/omitted means contract creation. */
  to?: Address;
  /** Calldata. */
  data?: Hex;
  /** MON value in wei. */
  value?: bigint;
  /** Optional explicit gas limit the caller intends to use (for comparison). */
  gas?: bigint;
}

export interface PreflightOptions {
  /** Buffer over the true minimum for the recommended limit, in bps. Default 750 (7.5%). */
  bufferBps?: number;
  /** The naive-wallet buffer used for the overpay comparison, in bps. Default 5000 (50%). */
  naiveBufferBps?: number;
  /** Block tag to simulate against. Default "latest". */
  blockTag?: "latest" | "pending" | "safe" | "finalized";
  /** Optional state overrides for the simulation (e.g. inject a balance to test hypotheticals). */
  stateOverride?: StateOverride;
  /**
   * Pre-fetched historical gas-usage samples for this exact `(to, selector)` pair, from
   * `fetchHistoricalGasUsage` in `./adaptiveBuffer.js`. When supplied, `preflight()` computes an
   * adaptive, contract-specific buffer instead of the flat `bufferBps` default.
   *
   * Deliberately NOT auto-fetched inside `preflight()` itself: scanning chain history can take
   * up to several seconds (see `adaptiveBuffer.ts`'s `maxDurationMs`), and `preflight()` is meant
   * to stay fast on every call. Callers that want adaptive buffering should call
   * `fetchHistoricalGasUsage` once (ideally cached/refreshed periodically per contract) and pass
   * the result in here.
   */
  historicalSamples?: bigint[];
}

export interface PreflightVerdict {
  /** Safe to broadcast? False when the tx would revert. */
  ok: boolean;
  /** Would this transaction revert if broadcast now? */
  willRevert: boolean;
  /** Decoded revert reason, when `willRevert`. */
  revertReason?: string;

  /** True minimum gas from `eth_estimateGas` (real Monad execution). Undefined if it reverts. */
  trueMinGas?: bigint;
  /** Reckon's recommended tightest-safe gas limit. Undefined when `willRevert`. */
  recommendedGasLimit?: bigint;
  /** Buffer applied over `trueMinGas`, in bps. */
  bufferBps: number;

  /** Gas price used for cost figures (wei). */
  gasPrice: bigint;

  /** Worst-case fee Monad will charge for the recommended limit (wei). */
  worstCaseFeeWei?: bigint;
  /** Same, formatted in MON. */
  worstCaseFeeMON?: string;

  /** What a naive wallet would likely set as the limit. */
  naiveGasLimit?: bigint;
  /** Fee a naive wallet would be charged (wei). For reverts this is the money simply lost. */
  naiveFeeWei?: bigint;
  /** MON Reckon saves vs the naive path (overpay avoided, or full fee avoided on a revert). */
  savingsVsNaiveWei?: bigint;
  /** Same, formatted in MON. */
  savingsVsNaiveMON?: string;

  /** Human-readable notes explaining the verdict. */
  notes: string[];

  /**
   * Approval/permission-escalation risk flags decoded from the calldata (see
   * `riskDetection.ts`). Always computed, cheap and synchronous — present regardless of
   * `willRevert`. Empty array when nothing risky was detected. Reckon flags these but does NOT
   * automatically block sending on them (an `approve()` can be entirely intentional); the
   * severity is surfaced so the caller/UI can decide how loudly to warn.
   */
  riskFlags: RiskFlag[];
  /** One-line summary of the highest-severity risk flag, or undefined when `riskFlags` is empty. */
  riskSummary?: string;

  /**
   * Present only when `options.historicalSamples` was supplied: the adaptive buffer actually
   * used instead of the flat default, and how much history backed it.
   */
  adaptiveBuffer?: {
    bufferBps: number;
    confidence: AdaptiveConfidence;
    sampleSize: number;
  };
}
