import { describe, it, expect, beforeAll } from "vitest";
import {
  createPublicClient,
  http,
  encodeFunctionData,
  getAddress,
  type PublicClient,
} from "viem";
import { monadTestnet } from "../../src/chain.js";
import { preflight } from "../../src/preflight.js";

/**
 * LIVE tests against Monad testnet. These hit the real RPC (estimateGas, gasPrice, real
 * contracts) so the pre-flight engine is validated end-to-end against the actual chain.
 *
 * Scenarios use real, deterministic on-chain conditions — no funded wallet required:
 *   - a zero-value native transfer (always 21000),
 *   - a Multicall3 read (a real successful contract call),
 *   - a Pyth read with a bogus price id (a real, guaranteed contract revert).
 */
const RPC = "https://testnet-rpc.monad.xyz";
const FROM = getAddress("0x000000000000000000000000000000000000a11c");
const DEAD = getAddress("0x000000000000000000000000000000000000dead");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");

const multicall3Abi = [
  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
] as const;

const pythAbi = [
  {
    type: "function",
    name: "getPriceUnsafe",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ name: "price", type: "int64" }],
  },
] as const;

let client: PublicClient;
let reachable = false;

beforeAll(async () => {
  client = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
  try {
    reachable = (await client.getChainId()) === 10143;
  } catch {
    reachable = false;
  }
});

describe("preflight (live testnet)", () => {
  it("chain is reachable and is Monad testnet", () => {
    expect(reachable, "Monad testnet RPC must be reachable for live tests").toBe(true);
  });

  it("OK native: zero-value transfer → recommends the exact 21000 intrinsic gas", async () => {
    if (!reachable) return;
    const v = await preflight(client, { from: FROM, to: DEAD, value: 0n });
    expect(v.ok).toBe(true);
    expect(v.willRevert).toBe(false);
    expect(v.trueMinGas).toBe(21_000n);
    expect(v.recommendedGasLimit).toBe(21_000n);
    expect(v.gasPrice).toBeGreaterThan(0n);
    expect(v.worstCaseFeeWei).toBe(21_000n * v.gasPrice);
  });

  it("OK contract: Multicall3 read → recommended limit strictly cheaper than naive", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: multicall3Abi,
      functionName: "getEthBalance",
      args: [DEAD],
    });
    const v = await preflight(client, { from: FROM, to: MULTICALL3, data });
    expect(v.ok).toBe(true);
    expect(v.willRevert).toBe(false);
    expect(v.trueMinGas).toBeGreaterThan(21_000n); // a real contract call
    expect(v.recommendedGasLimit!).toBeLessThan(v.naiveGasLimit!);
    // On Monad you pay the declared limit, so a tighter limit is real MON saved.
    expect(v.savingsVsNaiveWei!).toBeGreaterThan(0n);
  });

  it("REVERT: Pyth read with a bogus price id → refuses to broadcast and decodes the error", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: pythAbi,
      functionName: "getPriceUnsafe",
      args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
    });
    const v = await preflight(client, { from: FROM, to: PYTH, data });
    expect(v.ok).toBe(false);
    expect(v.willRevert).toBe(true);
    expect(v.revertReason).toBeTruthy();
    // Pyth's PriceFeedNotFound() selector, surfaced by the decoder.
    expect(v.revertReason).toContain("0x14aebe68");
    expect(v.recommendedGasLimit).toBeUndefined();
    // The naive path would have burned a full-limit fee for a doomed tx; Reckon avoids it.
    expect(v.savingsVsNaiveWei!).toBeGreaterThan(0n);
  });
});
