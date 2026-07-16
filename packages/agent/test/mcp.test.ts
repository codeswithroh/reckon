import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { encodeFunctionData, getAddress } from "viem";

/**
 * Real MCP integration: spawn the built Reckon MCP server over stdio and call its tools like an
 * AI agent would. The tools hit live Monad testnet, so this validates the whole path end-to-end.
 * Requires `npm run build` first (spawns dist/server.js).
 */
const FROM = getAddress("0x000000000000000000000000000000000000a11c");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");

let client: Client;

beforeAll(async () => {
  const transport = new StdioClientTransport({ command: "node", args: ["dist/server.js"] });
  client = new Client({ name: "reckon-test-agent", version: "0.0.0" });
  await client.connect(transport);
}, 30_000);

afterAll(async () => {
  await client?.close();
});

function textOf(res: { content: Array<{ type: string; text?: string }> }): string {
  return res.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
}

describe("Reckon MCP server (live)", () => {
  it("advertises the seatbelt tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("reckon_preflight");
    expect(names).toContain("reckon_quote_cost");
  });

  it("reckon_preflight OKs a healthy tx and recommends a gas limit", async () => {
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
    const res = (await client.callTool({
      name: "reckon_preflight",
      arguments: { from: FROM, to: MULTICALL3, data },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(res.isError).toBeFalsy();
    const text = textOf(res);
    expect(text).toContain("OK");
    expect(text).toMatch(/recommendedGasLimit/);
  }, 30_000);

  it("reckon_preflight BLOCKS a doomed tx (isError) with a reason", async () => {
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
    const res = (await client.callTool({
      name: "reckon_preflight",
      arguments: { from: FROM, to: PYTH, data },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain("BLOCK");
  }, 30_000);

  it("reckon_preflight BLOCKS a critical approval risk even though it would NOT revert", async () => {
    // approve(spender, MAX_UINT256) — succeeds on-chain (no revert), but grants an unlimited
    // allowance. This is the exact pattern behind the May 2026 ~$175K agent-drain incident: a
    // naive "did it revert?" check sees nothing wrong here.
    const MAX_UINT256 = 2n ** 256n - 1n;
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
      args: [getAddress("0x000000000000000000000000000000000000dEaD"), MAX_UINT256],
    });

    const res = (await client.callTool({
      name: "reckon_preflight",
      arguments: { from: FROM, to: MULTICALL3, data },
    })) as { content: Array<{ type: string; text?: string }>; isError?: boolean };

    expect(res.isError).toBe(true);
    const text = textOf(res);
    expect(text).toContain("BLOCK");
    expect(text).toContain("CRITICAL");
    const jsonText = res.content.find((c) => c.type === "text" && c.text?.trim().startsWith("{"))?.text;
    expect(jsonText).toBeTruthy();
    expect(JSON.parse(jsonText!).hasCriticalRisk).toBe(true);
  }, 30_000);

  it("reckon_quote_cost returns a worst-case MON figure", async () => {
    const res = (await client.callTool({
      name: "reckon_quote_cost",
      arguments: { from: FROM, to: "0x000000000000000000000000000000000000dEaD", value: "0" },
    })) as { content: Array<{ type: string; text?: string }> };
    const parsed = JSON.parse(textOf(res));
    expect(parsed.willRevert).toBe(false);
    expect(Number(parsed.worstCaseMON)).toBeGreaterThan(0);
  }, 30_000);
});
