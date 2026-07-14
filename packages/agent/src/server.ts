#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runPreflight, runQuoteCost, verdictLine } from "./tools.js";

/**
 * Reckon MCP server — a transaction seatbelt for AI agents on Monad.
 *
 * Exposes read-only tools so an autonomous agent pre-flights every transaction BEFORE sending:
 * on Monad you pay for the declared gas limit even when a tx reverts, so an agent that fires a
 * doomed or oversized transaction burns MON for nothing. These tools tell the agent whether to
 * send, at what gas limit, and what it will cost.
 */
export function createServer(): McpServer {
  const server = new McpServer({ name: "reckon", version: "0.0.1" });

  const txShape = {
    from: z.string().describe("Sender address (0x...)."),
    to: z.string().optional().describe("Target address (omit for contract creation)."),
    data: z.string().optional().describe("Calldata hex (0x...)."),
    value: z.string().optional().describe("MON value in wei, as a decimal string."),
    bufferBps: z
      .number()
      .optional()
      .describe("Gas buffer over the true minimum, in basis points (default 750 = 7.5%)."),
    rpcUrl: z.string().optional().describe("Override RPC URL (defaults to Monad testnet)."),
  };

  server.tool(
    "reckon_preflight",
    "Pre-flight a Monad transaction before sending: detect reverts, compute the tightest safe gas " +
      "limit, and estimate the worst-case MON cost. Call this before every send.",
    txShape,
    async (args) => {
      const s = await runPreflight(args as never);
      return {
        content: [
          { type: "text", text: verdictLine(s) },
          { type: "text", text: JSON.stringify(s, null, 2) },
        ],
        isError: s.willRevert,
      };
    },
  );

  server.tool(
    "reckon_quote_cost",
    "Quote the worst-case MON a Monad transaction will cost (charged on the gas limit) and whether " +
      "it would revert. Cheap gut-check before committing to a send.",
    txShape,
    async (args) => {
      const q = await runQuoteCost(args as never);
      return { content: [{ type: "text", text: JSON.stringify(q, null, 2) }] };
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error("reckon MCP server running on stdio");
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("reckon MCP server failed:", err);
    process.exit(1);
  });
}
