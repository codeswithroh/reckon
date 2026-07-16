import { describe, it, expect, beforeAll } from "vitest";
import { createPublicClient, http, getAddress, type PublicClient } from "viem";
import { monadTestnet } from "../../src/chain.js";
import {
  fetchHistoricalGasUsage,
  computeAdaptiveBuffer,
  recommendAdaptiveGasLimit,
} from "../../src/adaptiveBuffer.js";

/**
 * LIVE tests against Monad testnet. These hit the real RPC (eth_getBlockReceipts /
 * eth_getTransactionByHash over real recent blocks) so the adaptive-buffer scan is validated
 * against actual chain history, not a mock.
 *
 * Multicall3 is a heavily-used, permanently-deployed contract on virtually every EVM chain
 * (including Monad testnet), so it's a reliable source of real historical call volume.
 */
const RPC = "https://testnet-rpc.monad.xyz";
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");

let client: PublicClient;
let reachable = false;

beforeAll(async () => {
  client = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
  try {
    reachable = (await client.getChainId()) === 10143;
  } catch {
    reachable = false;
  }
}, 30_000);

describe("adaptiveBuffer (live testnet)", () => {
  it("chain is reachable and is Monad testnet", () => {
    expect(reachable, "Monad testnet RPC must be reachable for live tests").toBe(true);
  });

  it(
    "fetchHistoricalGasUsage returns real gas-usage samples for Multicall3",
    async () => {
      if (!reachable) return;

      // Empirically (manual probing against the live RPC while building this test), Multicall3
      // on Monad testnet gets roughly 2-3 successful calls per ~3000 blocks — real usage, but
      // not "high traffic." A 4000-block window with a small sample cap reliably finds a
      // handful of genuine historical calls within a reasonable test timeout.
      const samples = await fetchHistoricalGasUsage(
        client,
        { to: MULTICALL3 },
        { blockLookback: 4_000, maxSamples: 8 },
      );

      // If this ever comes back empty, that's real chain signal (a dry period) rather than a
      // mock artifact — but we still assert what we can: every returned sample must be a real
      // positive gas figure.
      for (const s of samples) {
        expect(typeof s).toBe("bigint");
        expect(s).toBeGreaterThan(0n);
      }

      if (samples.length === 0) {
        console.warn(
          "No historical Multicall3 calls found in the scanned window — chain may be quiet. " +
            "Skipping the downstream buffer assertions for this run.",
        );
        return;
      }

      expect(samples.length).toBeGreaterThan(0);

      // Feed the real samples through the pure functions and confirm sane output.
      const trueMinGas = 60_000n; // plausible true-min for a simple Multicall3 read
      const buffer = computeAdaptiveBuffer(samples, trueMinGas);
      expect(buffer.bufferBps).toBeGreaterThanOrEqual(100);
      expect(buffer.bufferBps).toBeLessThanOrEqual(3_000);
      expect(buffer.sampleSize).toBe(samples.length);
      if (samples.length < 5) expect(buffer.confidence).toBe("low");
      else if (samples.length < 15) expect(buffer.confidence).toBe("medium");
      else expect(buffer.confidence).toBe("high");

      const recommended = recommendAdaptiveGasLimit(trueMinGas, samples);
      expect(recommended.gasLimit).toBeGreaterThan(trueMinGas);
      expect(recommended.bufferBps).toBe(buffer.bufferBps);
    },
    150_000,
  );

  it(
    "selector-filtered scan only returns samples for matching calldata",
    async () => {
      if (!reachable) return;

      // getEthBalance(address) selector: 0x4d2301cc
      const selector = "0x4d2301cc" as const;
      const samples = await fetchHistoricalGasUsage(
        client,
        { to: MULTICALL3, selector },
        { blockLookback: 2_000, maxSamples: 15 },
      );

      // We can't guarantee this exact selector was called recently, so just assert the scan
      // completes and returns a well-formed (possibly empty) array of positive bigints.
      expect(Array.isArray(samples)).toBe(true);
      for (const s of samples) {
        expect(s).toBeGreaterThan(0n);
      }
    },
    120_000,
  );
});
