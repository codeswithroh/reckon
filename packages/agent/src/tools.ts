import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { monadTestnet, preflight, type ReckonTxRequest, type RiskFlag } from "@reckon/core";

export interface PreflightInput {
  from: Address;
  to?: Address;
  data?: Hex;
  /** MON value in wei, as a decimal string (JSON has no bigint). */
  value?: string;
  bufferBps?: number;
  rpcUrl?: string;
}

/** A `RiskFlag` with any bigint `details` values stringified — actually JSON-safe, unlike the raw type. */
export interface JsonSafeRiskFlag extends Omit<RiskFlag, "details"> {
  details?: Record<string, unknown>;
}

/** JSON-safe pre-flight result (bigints stringified) for MCP tool output. */
export interface PreflightSummary {
  ok: boolean;
  willRevert: boolean;
  revertReason?: string;
  recommendedGasLimit?: string;
  trueMinGas?: string;
  gasPrice: string;
  worstCaseFeeMON?: string;
  naiveGasLimit?: string;
  savingsVsNaiveMON?: string;
  notes: string[];
  /**
   * Approval/permission-escalation risk flags (see @reckon/core's riskDetection). Agents are the
   * exact population the May 2026 ~$175K incident targeted: an approval that doesn't revert and
   * moves no value, but grants a standing right for someone else to move it later. `hasCriticalRisk`
   * is surfaced separately so callers don't have to re-scan `riskFlags` themselves.
   */
  riskFlags: JsonSafeRiskFlag[];
  riskSummary?: string;
  hasCriticalRisk: boolean;
}

function clientFor(rpcUrl?: string): PublicClient {
  return createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) });
}

/**
 * `RiskFlag.details` can carry raw bigints (e.g. an approve() amount) straight from viem's ABI
 * decoding — `JSON.stringify` throws on those. This makes the flags actually JSON-safe, which
 * `PreflightSummary` is documented (and depended upon by MCP tool output) to be.
 */
function toJsonSafeRiskFlags(flags: RiskFlag[]): JsonSafeRiskFlag[] {
  return flags.map((f) => ({
    ...f,
    details: f.details
      ? Object.fromEntries(
          Object.entries(f.details).map(([k, v]) => [k, typeof v === "bigint" ? v.toString() : v]),
        )
      : undefined,
  }));
}

export async function runPreflight(
  input: PreflightInput,
  client?: PublicClient,
): Promise<PreflightSummary> {
  const c = client ?? clientFor(input.rpcUrl);
  const tx: ReckonTxRequest = {
    from: input.from,
    to: input.to,
    data: input.data,
    value: input.value !== undefined ? BigInt(input.value) : undefined,
  };
  const v = await preflight(c, tx, input.bufferBps !== undefined ? { bufferBps: input.bufferBps } : {});
  return {
    ok: v.ok,
    willRevert: v.willRevert,
    revertReason: v.revertReason,
    recommendedGasLimit: v.recommendedGasLimit?.toString(),
    trueMinGas: v.trueMinGas?.toString(),
    gasPrice: v.gasPrice.toString(),
    worstCaseFeeMON: v.worstCaseFeeMON,
    naiveGasLimit: v.naiveGasLimit?.toString(),
    savingsVsNaiveMON: v.savingsVsNaiveMON,
    notes: v.notes,
    riskFlags: toJsonSafeRiskFlags(v.riskFlags),
    riskSummary: v.riskSummary,
    hasCriticalRisk: v.riskFlags.some((f) => f.severity === "critical"),
  };
}

export async function runQuoteCost(
  input: PreflightInput,
  client?: PublicClient,
): Promise<{ willRevert: boolean; worstCaseMON?: string; recommendedGasLimit?: string }> {
  const s = await runPreflight(input, client);
  return {
    willRevert: s.willRevert,
    worstCaseMON: s.worstCaseFeeMON,
    recommendedGasLimit: s.recommendedGasLimit,
  };
}

/**
 * One-line human verdict, handy for agent logs.
 *
 * A critical risk flag (e.g. an unlimited token approval or an NFT operator grant) blocks the
 * verdict even when the transaction would NOT revert — reverts and risky-but-successful calls
 * are different threats. A revert just wastes gas; a critical approval can drain a wallet later
 * without ever failing on-chain. Both must stop an autonomous agent cold.
 */
export function verdictLine(s: PreflightSummary): string {
  if (s.willRevert) {
    return `BLOCK — would revert (${s.revertReason ?? "unknown"}). On Monad you'd still pay the full gas limit. Do not send.`;
  }
  if (s.hasCriticalRisk) {
    return `BLOCK — ${s.riskSummary}. This would succeed on-chain, but grants a standing permission an attacker (or a prompt-injected mistake) could exploit later. Do not send without explicit human confirmation.`;
  }
  const riskNote = s.riskSummary ? ` Note: ${s.riskSummary}.` : "";
  return `OK — send with gas limit ${s.recommendedGasLimit}; worst-case cost ${s.worstCaseFeeMON} MON (saves ${s.savingsVsNaiveMON} MON vs a naive limit).${riskNote}`;
}
