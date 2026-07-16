import { describe, it, expect, beforeAll } from "vitest";
import { createPublicClient, http, encodeFunctionData, getAddress, type PublicClient } from "viem";
import { monadTestnet } from "../../src/chain.js";
import { preflight } from "../../src/preflight.js";
import { fetchHistoricalGasUsage } from "../../src/adaptiveBuffer.js";

/**
 * LIVE integration tests: proves riskFlags and adaptiveBuffer are actually wired into the real
 * preflight() verdict (not just correct as standalone modules), against real Monad testnet.
 *
 * Risk detection is purely calldata-based (it decodes the 4-byte selector + args), so it doesn't
 * require a "real" ERC-20 deployment to prove the wiring — any live, reachable contract address
 * works as the `to`. Multicall3 (already verified live elsewhere in this repo) is used as the
 * target; whether the call itself reverts there is irrelevant to what's being tested here.
 */
const FROM = getAddress("0x000000000000000000000000000000000000a11c");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const SOME_SPENDER = getAddress("0x000000000000000000000000000000000000dEaD");
const MAX_UINT256 = 2n ** 256n - 1n;

let client: PublicClient;
let reachable = false;

beforeAll(async () => {
  client = createPublicClient({ chain: monadTestnet, transport: http() });
  try {
    reachable = (await client.getChainId()) === 10143;
  } catch {
    reachable = false;
  }
}, 30_000);

describe("preflight() risk-flag + adaptive-buffer integration (live)", () => {
  it("chain is reachable", () => {
    expect(reachable).toBe(true);
  });

  it("flags an unlimited ERC-20 approve() regardless of revert outcome", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [SOME_SPENDER, MAX_UINT256],
    });

    const verdict = await preflight(client, { from: FROM, to: MULTICALL3, data });

    expect(verdict.riskFlags.length).toBeGreaterThan(0);
    const approveFlag = verdict.riskFlags.find((f) => f.kind === "erc20_approve");
    expect(approveFlag).toBeDefined();
    expect(approveFlag!.severity).toBe("critical");
    expect(approveFlag!.details?.spender).toBe(SOME_SPENDER);
    expect(verdict.riskSummary).toBeTruthy();
    expect(verdict.riskSummary).toContain("CRITICAL");
    // The risk summary must also land in notes, so a UI reading only `notes` still sees it.
    expect(verdict.notes.some((n) => n.includes("CRITICAL"))).toBe(true);
  });

  it("flags setApprovalForAll(operator, true) as critical", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "setApprovalForAll",
          stateMutability: "nonpayable",
          inputs: [
            { name: "operator", type: "address" },
            { name: "approved", type: "bool" },
          ],
          outputs: [],
        },
      ],
      functionName: "setApprovalForAll",
      args: [SOME_SPENDER, true],
    });

    const verdict = await preflight(client, { from: FROM, to: MULTICALL3, data });
    const flag = verdict.riskFlags.find((f) => f.kind === "nft_set_approval_for_all");
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe("critical");
  });

  it("plain transfer() produces no risk flags", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "transfer",
          stateMutability: "nonpayable",
          inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
        },
      ],
      functionName: "transfer",
      args: [SOME_SPENDER, 1_000n],
    });

    const verdict = await preflight(client, { from: FROM, to: MULTICALL3, data });
    expect(verdict.riskFlags.length).toBe(0);
    expect(verdict.riskSummary).toBeUndefined();
  });

  it(
    "uses a real adaptive buffer when historicalSamples are supplied",
    async () => {
      if (!reachable) return;
      const data = encodeFunctionData({
        abi: [
          {
            type: "function",
            name: "getEthBalance",
            stateMutability: "view",
            inputs: [{ name: "addr", type: "address" }],
            outputs: [{ name: "b", type: "uint256" }],
          },
        ],
        functionName: "getEthBalance",
        args: [FROM],
      });

      // Real historical scan (bounded, see adaptiveBuffer.ts's maxDurationMs) against the real
      // deployed Multicall3 — not synthetic data.
      const samples = await fetchHistoricalGasUsage(client, { to: MULTICALL3 }, { maxSamples: 10 });

      const withAdaptive = await preflight(client, { from: FROM, to: MULTICALL3, data }, {
        historicalSamples: samples,
      });
      const withStatic = await preflight(client, { from: FROM, to: MULTICALL3, data });

      expect(withAdaptive.ok).toBe(true);
      expect(withAdaptive.adaptiveBuffer).toBeDefined();
      expect(withAdaptive.adaptiveBuffer!.sampleSize).toBe(samples.length);
      expect(withAdaptive.adaptiveBuffer!.bufferBps).toBeGreaterThanOrEqual(100);
      expect(withAdaptive.adaptiveBuffer!.bufferBps).toBeLessThanOrEqual(3_000);
      expect(withAdaptive.bufferBps).toBe(withAdaptive.adaptiveBuffer!.bufferBps);
      // Static path must NOT carry an adaptiveBuffer field.
      expect(withStatic.adaptiveBuffer).toBeUndefined();
      expect(withStatic.bufferBps).toBe(750);
    },
    30_000,
  );
});
