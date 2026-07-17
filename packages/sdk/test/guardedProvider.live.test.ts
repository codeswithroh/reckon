import { describe, it, expect, beforeAll } from "vitest";
import { createPublicClient, http, encodeFunctionData, getAddress } from "viem";
import { createGuardedProvider, ReckonRefusedError, type Eip1193Provider } from "../src/index.js";
import { monadTestnet } from "@codeswithroh/reckon-core";

/**
 * LIVE: the EIP-1193 guarded provider against Monad testnet. A mock inner provider records every
 * request so we can prove that a doomed `eth_sendTransaction` is blocked BEFORE it ever reaches the
 * wallet, while a healthy one passes through with an injected tight gas limit.
 */
const DEMO_FROM = getAddress("0xD02aD9e6ee5Cb8eC8Add5E7c630C4f4dE5018867");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");

const bogusPyth = encodeFunctionData({
  abi: [{ type: "function", name: "getPriceUnsafe", stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }], outputs: [{ name: "p", type: "int64" }] }],
  functionName: "getPriceUnsafe",
  args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
});
const healthy = encodeFunctionData({
  abi: [{ type: "function", name: "getEthBalance", stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }], outputs: [{ name: "b", type: "uint256" }] }],
  functionName: "getEthBalance",
  args: [DEMO_FROM],
});

/** A fake wallet provider that records calls and never actually broadcasts. */
function mockProvider() {
  const calls: Array<{ method: string; params?: unknown[] }> = [];
  const provider: Eip1193Provider = {
    async request(args) {
      calls.push(args);
      if (args.method === "eth_sendTransaction") return "0xmockhash";
      if (args.method === "eth_accounts") return [DEMO_FROM];
      return null;
    },
  };
  return { provider, calls };
}

let reachable = false;
beforeAll(async () => {
  try {
    reachable =
      (await createPublicClient({ chain: monadTestnet, transport: http() }).getChainId()) === 10143;
  } catch {
    reachable = false;
  }
});

describe("createGuardedProvider (live)", () => {
  it("blocks a doomed eth_sendTransaction before it reaches the wallet", async () => {
    if (!reachable) return;
    const { provider, calls } = mockProvider();
    const guarded = createGuardedProvider(provider);
    await expect(
      guarded.request({ method: "eth_sendTransaction", params: [{ from: DEMO_FROM, to: PYTH, data: bogusPyth }] }),
    ).rejects.toBeInstanceOf(ReckonRefusedError);
    // The inner wallet was never asked to send.
    expect(calls.some((c) => c.method === "eth_sendTransaction")).toBe(false);
  });

  it("passes a healthy send through with an injected tight gas limit", async () => {
    if (!reachable) return;
    const { provider, calls } = mockProvider();
    const guarded = createGuardedProvider(provider);
    const hash = await guarded.request({
      method: "eth_sendTransaction",
      params: [{ from: DEMO_FROM, to: MULTICALL3, data: healthy }],
    });
    expect(hash).toBe("0xmockhash");
    const sent = calls.find((c) => c.method === "eth_sendTransaction");
    expect(sent).toBeDefined();
    const forwarded = sent!.params![0] as { gas?: string };
    expect(forwarded.gas).toMatch(/^0x[0-9a-f]+$/); // recommended gas was injected
  });

  it("passes non-send RPC calls through untouched", async () => {
    if (!reachable) return;
    const { provider, calls } = mockProvider();
    const guarded = createGuardedProvider(provider);
    await guarded.request({ method: "eth_chainId" });
    expect(calls.at(-1)?.method).toBe("eth_chainId");
  });

  it("warn mode does not throw; it forwards the doomed tx and reports the verdict", async () => {
    if (!reachable) return;
    const { provider, calls } = mockProvider();
    let sawRevert = false;
    const guarded = createGuardedProvider(provider, {
      mode: "warn",
      onVerdict: (v) => {
        if (v.willRevert) sawRevert = true;
      },
    });
    const hash = await guarded.request({
      method: "eth_sendTransaction",
      params: [{ from: DEMO_FROM, to: PYTH, data: bogusPyth }],
    });
    expect(hash).toBe("0xmockhash");
    expect(sawRevert).toBe(true);
    expect(calls.some((c) => c.method === "eth_sendTransaction")).toBe(true);
  });
});
