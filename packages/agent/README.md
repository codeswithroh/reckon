# @reckon/agent — Reckon MCP server

A transaction seatbelt exposed as **MCP tools**, so any AI agent pre-flights every Monad
transaction before sending it. On Monad you pay for the declared gas limit even when a tx reverts,
so an agent that fires a doomed or oversized transaction burns MON for nothing. These tools tell
the agent whether to send, at what gas limit, and what it will cost.

## Tools

| Tool | Purpose |
|---|---|
| `reckon_preflight` | Full check: revert detection, approval/permission-escalation risk flags (unlimited ERC-20 allowances, NFT operator grants, EIP-2612 permits), tightest safe gas limit, worst-case MON cost. Returns `isError: true` for a doomed tx *or* a critical risk flag, so the agent stops either way. |
| `reckon_quote_cost` | Quick gut-check: worst-case MON and whether it would revert. |

Inputs: `{ from, to?, data?, value? (wei string), bufferBps?, rpcUrl? }`.

### Why a critical risk flag blocks even when nothing reverts

In May 2026 an autonomous agent lost ~$175K: an attacker sent it an NFT that silently granted an
elevated role, then used a prompt injection to get it to sign what looked routine, actually an
unlimited token approval. That call succeeds on-chain; a naive "did it revert?" check sees nothing
wrong. `reckon_preflight` decodes `approve`/`increaseAllowance`/`setApprovalForAll`/`permit`
calldata and flags exactly this pattern, `isError: true` regardless of revert status, so an agent
integration that just checks `isError` still gets stopped before signing.

## Run

```bash
npm run build
node dist/server.js      # speaks MCP over stdio
```

## Wire into an MCP host (e.g. Claude Code / Claude Desktop)

```json
{
  "mcpServers": {
    "reckon": {
      "command": "node",
      "args": ["/absolute/path/to/packages/agent/dist/server.js"]
    }
  }
}
```

Then instruct your agent: _"Before sending any Monad transaction, call `reckon_preflight`; if it
reports a revert, do not send."_

## Live demo (real testnet transactions)

`demo/live-agent.mjs` runs an agent's actions two ways — naive vs Reckon-guarded — and measures the
real MON saved:

```bash
set -a; . contracts/.env; set +a        # a funded testnet key
node demo/live-agent.mjs
```

A recorded run (`demo/demo-results.json`): a naive agent burned **0.0408 MON** (a reverted tx +
an oversized-limit tx); the Reckon-guarded agent spent **0.0024 MON** (blocked the doomed tx,
right-sized the healthy one) — a **94% reduction**, every transaction verifiable on the explorer.

## Tests

`npm test` spawns the built server over stdio and drives it through a real MCP client against live
Monad testnet (blocks a doomed tx, sizes a healthy one).
