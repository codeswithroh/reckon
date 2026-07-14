// Reckon core — live demo against Monad testnet.
// Build first:  npm run build   (from packages/core)
// Then run:     node examples/demo.mjs
import { createPublicClient, http, encodeFunctionData, getAddress } from "viem";
import { monadTestnet, preflight } from "../dist/index.js";

const client = createPublicClient({ chain: monadTestnet, transport: http() });
const FROM = getAddress("0x000000000000000000000000000000000000a11c");
const PYTH = getAddress("0x2880aB155794e7179c9eE2e38200202908C17B43");

function show(title, v) {
  console.log(`\n=== ${title} ===`);
  console.log("ok:              ", v.ok);
  console.log("willRevert:      ", v.willRevert);
  if (v.revertReason) console.log("revertReason:    ", v.revertReason);
  if (v.recommendedGasLimit !== undefined)
    console.log("recommendedLimit:", v.recommendedGasLimit.toString());
  if (v.worstCaseFeeMON) console.log("worstCaseFee:    ", v.worstCaseFeeMON, "MON");
  console.log("savingsVsNaive:  ", v.savingsVsNaiveMON, "MON");
  for (const n of v.notes) console.log("  •", n);
}

// 1) A healthy transaction — Reckon recommends a tight limit.
show("Healthy: zero-value transfer", await preflight(client, {
  from: FROM,
  to: "0x000000000000000000000000000000000000dEaD",
  value: 0n,
}));

// 2) A doomed transaction — Reckon refuses to broadcast, so you never pay the full limit.
const badPythCall = encodeFunctionData({
  abi: [{ type: "function", name: "getPriceUnsafe", stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }], outputs: [{ name: "p", type: "int64" }] }],
  functionName: "getPriceUnsafe",
  args: ["0x0000000000000000000000000000000000000000000000000000000000000001"],
});
show("Doomed: Pyth read with a bogus price id", await preflight(client, {
  from: FROM,
  to: PYTH,
  data: badPythCall,
}));
