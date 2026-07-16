# Recipe: wiring Reckon into an agent framework's action loop

The integration pattern any agent framework should adopt: **before executing an action that sends
a Monad transaction, ask Reckon's MCP server whether it's safe — and only proceed if it says yes.**

## Why this is the pattern, not just a nice-to-have

In May 2026 an autonomous agent lost ~$175K in a single incident: an attacker sent it an NFT that
silently granted an elevated permission, then used a prompt injection to get the agent to sign
what looked like a routine action. It was actually an unlimited token approval — not a transfer, so
a naive spend-limit check saw nothing wrong. Reckon's pre-flight now flags exactly this class of
call (unlimited `approve`, `setApprovalForAll`, allowance increases), on top of catching reverts
and oversized gas limits. None of that protects anything if the framework doesn't actually call it
before every send — this recipe is the one-line habit that makes it real.

## The pattern

```js
const result = await mcpClient.callTool({
  name: "reckon_preflight",
  arguments: { from, to, data, value },
});

if (result.isError) {
  // Reckon says this would revert, or flagged a risky call (e.g. an unlimited approval).
  // Abort — do not sign, do not broadcast.
} else {
  // Safe to hand off to your framework's own signing/execution layer.
}
```

That's the whole integration. See [`agent-loop.mjs`](./agent-loop.mjs) for a complete, runnable
version wired into a minimal generic agent loop (a stand-in for wherever your framework decides
what to do next).

## Run it

```bash
npm run build -w @reckon/agent   # from the repo root, once
node examples/agent-framework-recipe/agent-loop.mjs
```

It connects to the real Reckon MCP server over stdio and evaluates two real candidate actions
against live Monad testnet — one healthy, one doomed — showing Reckon's actual gate decision for
each. It never broadcasts a transaction itself; see
[`packages/agent/demo/live-agent.mjs`](../../packages/agent/demo/live-agent.mjs) for the version
that does, with real on-chain results.
