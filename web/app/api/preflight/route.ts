import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, type Address, type Hex } from "viem";
import { monadTestnet, preflight, type ReckonTxRequest } from "@reckon/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = createPublicClient({ chain: monadTestnet, transport: http() });

/** Live pre-flight against Monad testnet. No mock data — hits the real RPC every call. */
export async function POST(req: Request) {
  let body: {
    from?: string;
    to?: string;
    data?: string;
    value?: string;
    bufferBps?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const from = (body.from || "0x000000000000000000000000000000000000a11c") as Address;
  if (!isAddress(from)) {
    return NextResponse.json({ error: "Invalid `from` address" }, { status: 400 });
  }
  if (body.to && !isAddress(body.to)) {
    return NextResponse.json({ error: "Invalid `to` address" }, { status: 400 });
  }

  const tx: ReckonTxRequest = {
    from,
    to: body.to ? (body.to as Address) : undefined,
    data: body.data ? (body.data as Hex) : undefined,
    value: body.value ? BigInt(body.value) : undefined,
  };

  try {
    const v = await preflight(
      client,
      tx,
      body.bufferBps !== undefined ? { bufferBps: body.bufferBps } : {},
    );
    return NextResponse.json({
      ok: v.ok,
      willRevert: v.willRevert,
      revertReason: v.revertReason ?? null,
      recommendedGasLimit: v.recommendedGasLimit?.toString() ?? null,
      trueMinGas: v.trueMinGas?.toString() ?? null,
      gasPrice: v.gasPrice.toString(),
      worstCaseFeeMON: v.worstCaseFeeMON ?? null,
      naiveGasLimit: v.naiveGasLimit?.toString() ?? null,
      naiveFeeMON: v.naiveFeeWei != null ? formatMon(v.naiveFeeWei) : null,
      savingsVsNaiveMON: v.savingsVsNaiveMON ?? null,
      notes: v.notes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "preflight failed" },
      { status: 500 },
    );
  }
}

function formatMon(wei: bigint): string {
  // 18 decimals, trimmed
  const s = wei.toString().padStart(19, "0");
  const whole = s.slice(0, -18);
  const frac = s.slice(-18).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}
