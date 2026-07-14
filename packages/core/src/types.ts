import type { Address, Hex, StateOverride } from "viem";

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
}
