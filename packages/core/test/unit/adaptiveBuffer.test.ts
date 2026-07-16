import { describe, it, expect } from "vitest";
import {
  computeAdaptiveBuffer,
  recommendAdaptiveGasLimit,
} from "../../src/adaptiveBuffer.js";
import { DEFAULT_BUFFER_BPS, applyBufferBps } from "../../src/gasModel.js";

describe("computeAdaptiveBuffer", () => {
  it("returns the static default with low confidence when there is no history", () => {
    const result = computeAdaptiveBuffer([], 200_000n);
    expect(result.bufferBps).toBe(DEFAULT_BUFFER_BPS);
    expect(result.confidence).toBe("low");
    expect(result.sampleSize).toBe(0);
  });

  it("produces a tight buffer for low-variance history close to today's estimate", () => {
    // A function that costs almost exactly the same every time.
    const samples = [200_000n, 200_100n, 199_950n, 200_050n, 200_000n, 199_900n, 200_200n];
    const result = computeAdaptiveBuffer(samples, 200_000n);
    expect(result.sampleSize).toBe(7);
    expect(result.confidence).toBe("medium");
    // Should be noticeably tighter than the flat 750bps static default.
    expect(result.bufferBps).toBeLessThan(DEFAULT_BUFFER_BPS);
    expect(result.bufferBps).toBeGreaterThanOrEqual(100);
  });

  it("produces a looser buffer for high-variance history", () => {
    // A function whose cost swings a lot from call to call (data-dependent branches).
    const samples = [
      100_000n,
      400_000n,
      150_000n,
      600_000n,
      120_000n,
      500_000n,
      90_000n,
      450_000n,
    ];
    const result = computeAdaptiveBuffer(samples, 200_000n);
    expect(result.sampleSize).toBe(8);
    expect(result.confidence).toBe("medium");
    expect(result.bufferBps).toBeGreaterThan(DEFAULT_BUFFER_BPS);
    expect(result.bufferBps).toBeLessThanOrEqual(3_000);
  });

  it("never exceeds the 3000bps ceiling even for extreme variance", () => {
    const samples = [10_000n, 5_000_000n, 20_000n, 8_000_000n, 15_000n];
    const result = computeAdaptiveBuffer(samples, 20_000n);
    expect(result.bufferBps).toBeLessThanOrEqual(3_000);
  });

  it("handles a single-sample history without throwing, tagged low confidence", () => {
    const result = computeAdaptiveBuffer([200_000n], 200_000n);
    expect(result.sampleSize).toBe(1);
    expect(result.confidence).toBe("low");
    // Zero internal dispersion (only one point) — buffer should sit near the base floor.
    expect(result.bufferBps).toBeGreaterThanOrEqual(100);
    expect(result.bufferBps).toBeLessThan(DEFAULT_BUFFER_BPS);
  });

  it("confidence scales with sample size", () => {
    const low = computeAdaptiveBuffer([200_000n, 200_000n, 200_000n], 200_000n);
    const medium = computeAdaptiveBuffer(
      Array(8).fill(200_000n),
      200_000n,
    );
    const high = computeAdaptiveBuffer(
      Array(20).fill(200_000n),
      200_000n,
    );
    expect(low.confidence).toBe("low");
    expect(medium.confidence).toBe("medium");
    expect(high.confidence).toBe("high");
  });

  it("increases the buffer when today's estimate diverges sharply from history", () => {
    // Tight, consistent history, but today's true-min is wildly different from what this
    // function has historically cost — the history is a weaker predictor today.
    const samples = [200_000n, 200_100n, 199_950n, 200_050n, 200_000n];
    const consistent = computeAdaptiveBuffer(samples, 200_000n);
    const divergent = computeAdaptiveBuffer(samples, 600_000n);
    expect(divergent.bufferBps).toBeGreaterThan(consistent.bufferBps);
  });
});

describe("recommendAdaptiveGasLimit", () => {
  it("applies the adaptive buffer using the same ceil-rounding as applyBufferBps", () => {
    const samples = [200_000n, 200_100n, 199_950n, 200_050n, 200_000n];
    const trueMinGas = 200_000n;
    const result = recommendAdaptiveGasLimit(trueMinGas, samples);
    expect(result.gasLimit).toBe(applyBufferBps(trueMinGas, result.bufferBps));
    expect(result.gasLimit).toBeGreaterThan(trueMinGas);
  });

  it("falls back to the static default gas limit shape when there is no history", () => {
    const trueMinGas = 21_000n;
    const result = recommendAdaptiveGasLimit(trueMinGas, []);
    expect(result.bufferBps).toBe(DEFAULT_BUFFER_BPS);
    expect(result.gasLimit).toBe(applyBufferBps(trueMinGas, DEFAULT_BUFFER_BPS));
    expect(result.confidence).toBe("low");
    expect(result.sampleSize).toBe(0);
  });
});
