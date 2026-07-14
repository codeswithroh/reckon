import { createPublicClient, http, type Address, type Hex, type PublicClient } from "viem";
import { monadTestnet, preflight, type ReckonTxRequest } from "@reckon/core";

export interface PreflightInput {
  from: Address;
  to?: Address;
  data?: Hex;
  /** MON value in wei, as a decimal string (JSON has no bigint). */
  value?: string;
  bufferBps?: number;
  rpcUrl?: string;
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
}

function clientFor(rpcUrl?: string): PublicClient {
  return createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) });
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

/** One-line human verdict, handy for agent logs. */
export function verdictLine(s: PreflightSummary): string {
  if (s.willRevert) {
    return `BLOCK — would revert (${s.revertReason ?? "unknown"}). On Monad you'd still pay the full gas limit. Do not send.`;
  }
  return `OK — send with gas limit ${s.recommendedGasLimit}; worst-case cost ${s.worstCaseFeeMON} MON (saves ${s.savingsVsNaiveMON} MON vs a naive limit).`;
}
