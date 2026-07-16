// Reckon integration recipe: wiring the MCP pre-flight gate into a generic agent loop.
//
// This is the pattern any agent framework (a custom loop, LangChain, ElizaOS, etc.) should adopt:
// before an agent EXECUTES an action that sends a Monad transaction, it asks Reckon's MCP server
// "should I send this?" and only proceeds if the answer is yes.
//
// Why this matters (not hypothetical): in May 2026 an autonomous agent lost ~$175K because an
// attacker sent it an NFT that silently granted an elevated role, then used a prompt injection to
// get the agent to sign what looked like a routine action — actually an unlimited token approval.
// A naive "spend limit" check doesn't catch this, because an approval moves no value itself; it
// grants a FUTURE right to move value. Reckon's pre-flight now flags exactly this class of call
// (see packages/core/src/riskDetection.ts), in addition to catching reverts and oversized gas
// limits. Gating every send through one tool call is what turns those checks into an actual
// safety net instead of a library nobody remembers to use.
//
// Run:  node examples/agent-framework-recipe/agent-loop.mjs
// Requires: packages/agent built (`npm run build -w @reckon/agent` from repo root).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { encodeFunctionData, getAddress } from "viem";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_SERVER = resolve(__dirname, "../../packages/agent/dist/server.js");

const FROM = getAddress("0x000000000000000000000000000000000000a11c");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");

/**
 * Stand-in for "the framework's action queue" — in a real integration this comes from the
 * agent's own planning/reasoning step, not a hardcoded list. What matters is the gate below,
 * not how the actions were decided on.
 */
const candidateActions = [
  {
    label: "healthy read-style call (Multicall3.getEthBalance)",
    to: MULTICALL3,
    data: encodeFunctionData({
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
    }),
  },
  {
    label: "doomed call (Pyth price feed that doesn't exist)",
    to: PYTH,
    data: encodeFunctionData({
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
    }),
  },
];

async function main() {
  console.log("Connecting to Reckon's MCP server (the pre-flight gate)...\n");
  const transport = new StdioClientTransport({ command: "node", args: [AGENT_SERVER] });
  const client = new Client({ name: "example-agent-framework", version: "0.0.0" });
  await client.connect(transport);

  for (const action of candidateActions) {
    console.log(`--- Agent wants to: ${action.label} ---`);

    // ============================================================
    // THE INTEGRATION POINT: gate every send through reckon_preflight
    // before your framework's own execution/signing step runs.
    // ============================================================
    const result = await client.callTool({
      name: "reckon_preflight",
      arguments: { from: FROM, to: action.to, data: action.data },
    });

    const blocked = result.isError === true;
    const summary = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");

    if (blocked) {
      console.log("Reckon says: DO NOT SEND.");
      console.log(summary.split("\n")[0]);
      console.log("-> Agent aborts this action. (In a real framework: skip execution, log, move on.)\n");
      continue;
    }

    console.log("Reckon says: safe to send.");
    console.log(summary.split("\n")[0]);
    console.log("-> Agent would now hand this off to its own signing/execution layer.");
    console.log("   (This recipe stops here — it never broadcasts — see packages/agent/demo/");
    console.log("   live-agent.mjs for a version that actually sends real testnet transactions.)\n");
  }

  await client.close();
}

main().catch((err) => {
  console.error("Recipe failed:", err);
  process.exit(1);
});
