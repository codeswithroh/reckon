// Reckon live agent demo — REAL transactions on Monad testnet.
//
// Simulates an autonomous agent taking actions, run two ways:
//   NAIVE  — sends like an ordinary wallet: doomed txs get broadcast (and, on Monad, burn the
//            full gas limit for nothing); healthy txs get a padded limit (overpay).
//   RECKON — pre-flights first: blocks doomed txs before broadcast (spends nothing) and sends
//            healthy txs with the tightest safe limit.
//
// It measures REAL balance deltas and reports the MON Reckon saved. Writes demo-results.json.
//
// Run:  set -a; . contracts/.env; set +a
//       node packages/agent/demo/live-agent.mjs
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  formatEther,
  getAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { writeFileSync } from "node:fs";
import { monadTestnet, preflight } from "@codeswithroh/reckon-core";

const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");
const MULTICALL3 = getAddress("0xcA11bde05977b3631167028862bE2a173976CA11");
const NAIVE_LIMIT = 200_000n; // a plausible "agent just set a default limit" value

const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("Set PRIVATE_KEY (e.g. `set -a; . contracts/.env; set +a`).");
  process.exit(1);
}
const account = privateKeyToAccount(pk.startsWith("0x") ? pk : `0x${pk}`);
const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
const wallet = createWalletClient({ chain: monadTestnet, transport: http(), account });

const bogusPythCall = encodeFunctionData({
  abi: [{ type: "function", name: "getPriceUnsafe", stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }], outputs: [{ name: "p", type: "int64" }] }],
  functionName: "getPriceUnsafe",
  args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
});
const healthyCall = encodeFunctionData({
  abi: [{ type: "function", name: "getEthBalance", stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }], outputs: [{ name: "b", type: "uint256" }] }],
  functionName: "getEthBalance",
  args: [account.address],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function sendAndMeasure(tx) {
  const before = await publicClient.getBalance({ address: account.address });
  const hash = await wallet.sendTransaction(tx);
  const rc = await publicClient.waitForTransactionReceipt({ hash });
  const after = await publicClient.getBalance({ address: account.address });
  await sleep(1500); // respect reserve-balance rate limit when under the 10 MON floor
  return { hash, status: rc.status, spent: before - after };
}

async function main() {
  console.log("Agent wallet:", account.address);
  const startBal = await publicClient.getBalance({ address: account.address });
  console.log("Start balance:", formatEther(startBal), "MON\n");

  const rows = [];
  let naiveTotal = 0n;
  let reckonTotal = 0n;

  // ---- Scenario 1: a DOOMED action (would revert) ----
  console.log("Scenario 1 — doomed action (Pyth read with a bogus price id)");
  const doomedTx = { to: PYTH, data: bogusPythCall, gas: NAIVE_LIMIT };

  console.log("  NAIVE: broadcasting anyway…");
  const naive1 = await sendAndMeasure(doomedTx);
  console.log(`    → ${naive1.status} tx ${naive1.hash}, burned ${formatEther(naive1.spent)} MON`);

  console.log("  RECKON: pre-flighting first…");
  const v1 = await preflight(publicClient, { from: account.address, to: PYTH, data: bogusPythCall });
  const reckon1Spent = v1.willRevert ? 0n : 0n;
  console.log(`    → ${v1.willRevert ? "BLOCKED (nothing sent)" : "sent"}; reason: ${v1.revertReason}`);
  naiveTotal += naive1.spent;
  reckonTotal += reckon1Spent;
  rows.push({
    scenario: "doomed action (revert)",
    naive: { tx: naive1.hash, status: naive1.status, spentMON: formatEther(naive1.spent) },
    reckon: { action: "blocked pre-broadcast", spentMON: "0" },
    savedMON: formatEther(naive1.spent - reckon1Spent),
  });

  // ---- Scenario 2: a HEALTHY action with an oversized naive limit ----
  console.log("\nScenario 2 — healthy action (Multicall3 read) with an oversized naive limit");
  console.log("  NAIVE: sending with a padded 200k gas limit…");
  const naive2 = await sendAndMeasure({ to: MULTICALL3, data: healthyCall, gas: NAIVE_LIMIT });
  console.log(`    → ${naive2.status} tx ${naive2.hash}, paid ${formatEther(naive2.spent)} MON`);

  console.log("  RECKON: pre-flighting for the tightest safe limit…");
  const v2 = await preflight(publicClient, { from: account.address, to: MULTICALL3, data: healthyCall });
  console.log(`    → recommended limit ${v2.recommendedGasLimit} (naive used ${NAIVE_LIMIT})`);
  const reckon2 = await sendAndMeasure({
    to: MULTICALL3, data: healthyCall, gas: v2.recommendedGasLimit,
  });
  console.log(`    → ${reckon2.status} tx ${reckon2.hash}, paid ${formatEther(reckon2.spent)} MON`);
  naiveTotal += naive2.spent;
  reckonTotal += reckon2.spent;
  rows.push({
    scenario: "healthy action (oversized naive limit)",
    naive: { tx: naive2.hash, status: naive2.status, spentMON: formatEther(naive2.spent) },
    reckon: { tx: reckon2.hash, status: reckon2.status, spentMON: formatEther(reckon2.spent) },
    savedMON: formatEther(naive2.spent - reckon2.spent),
  });

  const saved = naiveTotal - reckonTotal;
  console.log("\n========== SUMMARY ==========");
  console.log("NAIVE agent total burned :", formatEther(naiveTotal), "MON");
  console.log("RECKON agent total spent :", formatEther(reckonTotal), "MON");
  console.log("MON saved by Reckon      :", formatEther(saved), "MON");
  const pct = naiveTotal > 0n ? Number((saved * 10000n) / naiveTotal) / 100 : 0;
  console.log(`Reduction                : ${pct}%`);

  const results = {
    network: "monad-testnet",
    agent: account.address,
    naiveTotalMON: formatEther(naiveTotal),
    reckonTotalMON: formatEther(reckonTotal),
    savedMON: formatEther(saved),
    reductionPct: pct,
    scenarios: rows,
  };
  const out = new URL("./demo-results.json", import.meta.url);
  writeFileSync(out, JSON.stringify(results, null, 2));
  console.log("\nWrote", out.pathname);
}

main().catch((e) => { console.error(e); process.exit(1); });
