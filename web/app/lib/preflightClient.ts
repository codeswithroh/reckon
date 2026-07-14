import { createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { monadTestnet, preflight, type ReckonTxRequest } from "@reckon/core";

/**
 * Client-side pre-flight — runs directly in the browser against Monad testnet (the RPC allows
 * CORS). Same engine as the SDK/agent; no backend needed, so the site deploys as static.
 */
const client = createPublicClient({ chain: monadTestnet, transport: http() });

export interface PreflightResult {
  ok: boolean;
  willRevert: boolean;
  revertReason: string | null;
  recommendedGasLimit: string | null;
  gasPrice: string;
  worstCaseFeeMON: string | null;
  naiveGasLimit: string | null;
  savingsVsNaiveMON: string | null;
  notes: string[];
}

export async function runPreflight(input: {
  from: string;
  to?: string;
  data?: string;
  value?: string;
}): Promise<PreflightResult> {
  const from = (input.from || "0x000000000000000000000000000000000000a11c") as Address;
  if (!isAddress(from)) throw new Error("Invalid `from` address");
  if (input.to && !isAddress(input.to)) throw new Error("Invalid `to` address");

  const tx: ReckonTxRequest = {
    from,
    to: input.to ? (input.to as Address) : undefined,
    data: input.data ? (input.data as Hex) : undefined,
    value: input.value ? BigInt(input.value) : undefined,
  };

  const v = await preflight(client, tx);
  return {
    ok: v.ok,
    willRevert: v.willRevert,
    revertReason: v.revertReason ?? null,
    recommendedGasLimit: v.recommendedGasLimit?.toString() ?? null,
    gasPrice: v.gasPrice.toString(),
    worstCaseFeeMON: v.worstCaseFeeMON ?? null,
    naiveGasLimit: v.naiveGasLimit?.toString() ?? null,
    savingsVsNaiveMON: v.savingsVsNaiveMON ?? null,
    notes: v.notes,
  };
}
