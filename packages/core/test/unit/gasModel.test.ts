import { describe, it, expect } from "vitest";
import {
  applyBufferBps,
  recommendGasLimit,
  naiveGasLimit,
  feeForLimit,
  NATIVE_TRANSFER_GAS,
} from "../../src/gasModel.js";
import { decodeRevertReason } from "../../src/revert.js";
import { encodeErrorResult } from "viem";

describe("applyBufferBps", () => {
  it("adds 7.5% and rounds up", () => {
    // 100000 * 1.075 = 107500
    expect(applyBufferBps(100_000n, 750)).toBe(107_500n);
  });
  it("rounds up on non-integer results", () => {
    // 21001 * 1.075 = 22576.075 -> ceil 22577
    expect(applyBufferBps(21_001n, 750)).toBe(22_577n);
  });
  it("zero buffer is identity", () => {
    expect(applyBufferBps(21_000n, 0)).toBe(21_000n);
  });
  it("rejects negative gas", () => {
    expect(() => applyBufferBps(-1n, 750)).toThrow();
  });
});

describe("recommendGasLimit", () => {
  it("returns exact intrinsic cost for a native transfer", () => {
    expect(
      recommendGasLimit({ trueMinGas: 21_000n, isNativeTransfer: true }),
    ).toBe(NATIVE_TRANSFER_GAS);
  });
  it("buffers contract calls", () => {
    expect(recommendGasLimit({ trueMinGas: 200_000n })).toBe(215_000n);
  });
  it("honors a custom buffer", () => {
    expect(recommendGasLimit({ trueMinGas: 200_000n, bufferBps: 1_000 })).toBe(
      220_000n,
    );
  });
});

describe("naiveGasLimit", () => {
  it("pads ~50% like a generic wallet", () => {
    expect(naiveGasLimit({ trueMinGas: 200_000n })).toBe(300_000n);
  });
});

describe("feeForLimit (Monad charges the limit)", () => {
  it("multiplies limit by price", () => {
    expect(feeForLimit(21_000n, 100_000_000_000n)).toBe(2_100_000_000_000_000n);
  });
  it("recommended is cheaper than naive for the same successful tx", () => {
    const price = 100_000_000_000n;
    const trueMin = 200_000n;
    const recommended = recommendGasLimit({ trueMinGas: trueMin });
    const naive = naiveGasLimit({ trueMinGas: trueMin });
    expect(feeForLimit(recommended, price)).toBeLessThan(
      feeForLimit(naive, price),
    );
  });
});

describe("decodeRevertReason", () => {
  it("decodes Error(string)", () => {
    const data = encodeErrorResult({
      abi: [
        { type: "error", name: "Error", inputs: [{ type: "string", name: "reason" }] },
      ],
      errorName: "Error",
      args: ["SoldOut"],
    });
    expect(decodeRevertReason(data)).toBe("SoldOut");
  });
  it("decodes Panic(uint256) arithmetic overflow", () => {
    const data = encodeErrorResult({
      abi: [
        { type: "error", name: "Panic", inputs: [{ type: "uint256", name: "code" }] },
      ],
      errorName: "Panic",
      args: [0x11n],
    });
    expect(decodeRevertReason(data)).toContain("overflow");
  });
  it("surfaces a custom-error selector", () => {
    // selector for a made-up custom error
    const reason = decodeRevertReason("0xdeadbeef");
    expect(reason).toContain("custom error");
  });
  it("returns undefined for empty data", () => {
    expect(decodeRevertReason("0x")).toBeUndefined();
    expect(decodeRevertReason(undefined)).toBeUndefined();
  });
});
