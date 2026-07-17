import { describe, it, expect, beforeAll } from "vitest";
import { encodeFunctionData, getAddress } from "viem";
import { createReckonClient, type ReckonClient } from "../src/index.js";

/** LIVE tests: the SDK wrapper against real Monad testnet (read-only, no signer). */
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const FROM = getAddress("0x000000000000000000000000000000000000a11c");

let reckon: ReckonClient;
let reachable = false;

beforeAll(async () => {
  reckon = createReckonClient();
  try {
    reachable = (await reckon.publicClient.getChainId()) === 10143;
  } catch {
    reachable = false;
  }
});

describe("@codeswithroh/reckon-sdk (live)", () => {
  it("is wired to Monad testnet", () => {
    expect(reachable).toBe(true);
  });

  it("quoteCost returns a worst-case MON figure for a healthy tx", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "getEthBalance",
          stateMutability: "view",
          inputs: [{ name: "addr", type: "address" }],
          outputs: [{ name: "balance", type: "uint256" }],
        },
      ],
      functionName: "getEthBalance",
      args: [FROM],
    });
    const q = await reckon.quoteCost({ from: FROM, to: MULTICALL3, data });
    expect(q.willRevert).toBe(false);
    expect(q.worstCaseMON).toBeTruthy();
    expect(Number(q.worstCaseMON)).toBeGreaterThan(0);
  });

  it("preflight flags a doomed tx via the SDK", async () => {
    if (!reachable) return;
    const data = encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "getPriceUnsafe",
          stateMutability: "view",
          inputs: [{ name: "id", type: "bytes32" }],
          outputs: [{ name: "p", type: "int64" }],
        },
      ],
      functionName: "getPriceUnsafe",
      args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
    });
    const v = await reckon.preflight({ from: FROM, to: PYTH, data });
    expect(v.ok).toBe(false);
    expect(v.willRevert).toBe(true);
  });

  it("write methods require a signer", async () => {
    await expect(
      reckon.guardedExecute([{ target: MULTICALL3 }]),
    ).rejects.toThrow(/account.*required/);
  });
});
